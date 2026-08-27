"use server";
// ─────────────────────────────────────────────────────────
// Actions serveur pour les brouillons de documents longs.
// (Evaluations 30/60/90, entretiens annuels, plans de developpement)
//
// Workflow :
//   createDocumentDraftAction         -> brouillon vide
//   updateDocumentDraftAction          -> autosave (toutes les ~10s cote UI)
//   markDocumentDraftReadyAction       -> brouillon termine, pret a envoyer
//   sendDocumentDraftForSignatureAction-> cree DSR + marque brouillon "sent"
//   deleteDocumentDraftAction          -> retire un brouillon
//
// Auth : admin authentifie. Les drafts sont visibles uniquement a leur
// auteur (manager) ou aux admins RH (role admin).
// ─────────────────────────────────────────────────────────
import "server-only";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// ─── Helpers ──────────────────────────────────────────────

async function requireAdmin(): Promise<{ id: number; role: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Non autorise");
  }
  const adminId = (session.user as { adminId?: number }).adminId;
  if (!adminId || !Number.isFinite(adminId)) {
    throw new Error("Session admin invalide");
  }
  return { id: adminId, role: String(session.user.role) };
}

/**
 * Autorise a preparer/envoyer un document pour `targetAdminId` :
 * RH (super_admin / users.write / hr.write), manager direct de la cible,
 * ou chef de son equipe. Empeche n'importe quel admin d'envoyer une
 * demande de signature a n'importe qui.
 */
async function canManageEmployeeDocs(meId: number, targetAdminId: number): Promise<boolean> {
  const { isHrAdmin } = await import("@/lib/services/hr-access");
  if (await isHrAdmin(meId)) return true;
  const target = await prisma.admin.findUnique({
    where: { id: targetAdminId },
    select: { managerId: true, team: { select: { leadAdminId: true } } },
  });
  if (!target) return false;
  return target.managerId === meId || target.team?.leadAdminId === meId;
}

// ─── Schemas ──────────────────────────────────────────────

const createSchema = z.object({
  templateId: z.number().int().positive(),
  targetAdminId: z.number().int().positive(),
  customFieldValues: z.record(z.string(), z.string().max(8000)).nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const updateSchema = z.object({
  id: z.number().int().positive(),
  customFieldValues: z.record(z.string(), z.string().max(8000)).nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ─── Actions ──────────────────────────────────────────────

/**
 * Cree un nouveau brouillon vide. Si un brouillon "draft" existe deja pour
 * le meme (templateId, targetAdminId) cree par l'utilisateur courant, on le
 * retourne au lieu d'en creer un nouveau (idempotent).
 */
export async function createDocumentDraftAction(input: unknown) {
  const t = await getTranslations("admin.action_errors");
  const me = await requireAdmin();
  const parsed = createSchema.parse(input);

  // Verifie que template + employe existent
  const [tpl, target] = await Promise.all([
    prisma.legalDocumentTemplate.findUnique({
      where: { id: parsed.templateId },
      select: { id: true, title: true, key: true },
    }),
    prisma.admin.findUnique({
      where: { id: parsed.targetAdminId },
      select: { id: true, fullName: true },
    }),
  ]);
  if (!tpl) throw new Error("Modele introuvable");
  if (!target) throw new Error("Employe introuvable");
  if (!(await canManageEmployeeDocs(me.id, parsed.targetAdminId))) {
    throw new Error(t("non_autorise_rh_ou_manager_direct"));
  }

  // Idempotence : reutilise un brouillon "draft" existant si meme paire
  const existing = await prisma.documentDraft.findFirst({
    where: {
      templateId: parsed.templateId,
      targetAdminId: parsed.targetAdminId,
      authorId: me.id,
      status: "draft",
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    return { id: existing.id, reused: true };
  }

  const draft = await prisma.documentDraft.create({
    data: {
      templateId: parsed.templateId,
      targetAdminId: parsed.targetAdminId,
      authorId: me.id,
      customFieldValues: parsed.customFieldValues ?? undefined,
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : null,
      notes: parsed.notes ?? null,
      status: "draft",
    },
  });

  await logAudit({
    adminId: me.id,
    action: "create",
    entityType: "document_draft",
    entityId: draft.id,
    changes: { templateKey: tpl.key, targetId: parsed.targetAdminId },
  });

  revalidatePath("/admin/employes/documents");
  return { id: draft.id, reused: false };
}

/**
 * Mise a jour partielle d'un brouillon (autosave).
 * - Seul l'auteur ou un admin RH peut modifier.
 * - Refuse si status != "draft" (un brouillon "sent" est immuable).
 */
export async function updateDocumentDraftAction(input: unknown) {
  const t = await getTranslations("admin.action_errors");
  const me = await requireAdmin();
  const parsed = updateSchema.parse(input);

  const draft = await prisma.documentDraft.findUnique({
    where: { id: parsed.id },
    select: { id: true, authorId: true, status: true, templateId: true },
  });
  if (!draft) throw new Error("Brouillon introuvable");
  if (draft.authorId !== me.id) {
    // Seul l'auteur peut editer (les admins RH peuvent lire mais pas editer
    // les brouillons d'autres managers — evite collisions).
    throw new Error("Non autorise a modifier ce brouillon");
  }
  if (draft.status !== "draft" && draft.status !== "ready") {
    throw new Error(t("brouillon_verrouille_deja_envoye"));
  }

  await prisma.documentDraft.update({
    where: { id: parsed.id },
    data: {
      customFieldValues: parsed.customFieldValues ?? undefined,
      scheduledFor: parsed.scheduledFor !== undefined
        ? (parsed.scheduledFor ? new Date(parsed.scheduledFor) : null)
        : undefined,
      notes: parsed.notes !== undefined ? (parsed.notes ?? null) : undefined,
      // Si l'utilisateur reedite un brouillon "ready", on le repasse en "draft"
      status: draft.status === "ready" ? "draft" : undefined,
    },
  });

  return { ok: true };
}

/**
 * Marque un brouillon comme "ready" (pret a envoyer).
 */
export async function markDocumentDraftReadyAction(id: number) {
  const me = await requireAdmin();
  const draft = await prisma.documentDraft.findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true },
  });
  if (!draft) throw new Error("Brouillon introuvable");
  if (draft.authorId !== me.id) throw new Error("Non autorise");
  if (draft.status === "sent") throw new Error("Deja envoye");

  await prisma.documentDraft.update({
    where: { id },
    data: { status: "ready" },
  });
  revalidatePath("/admin/employes/documents");
  return { ok: true };
}

/**
 * Transforme un brouillon en DocumentSignatureRequest (signature envoyee
 * a l'employe cible) et marque le brouillon comme "sent".
 *
 * @param dueDate ISO date string optionnel (deadline signature)
 * @param reason  Note optionnelle au signataire
 */
export async function sendDocumentDraftForSignatureAction(
  id: number,
  opts?: { dueDate?: string | null; reason?: string | null },
) {
  const t = await getTranslations("admin.action_errors");
  const me = await requireAdmin();
  const draft = await prisma.documentDraft.findUnique({
    where: { id },
    include: {
      template: { select: { id: true, title: true, key: true } },
      target: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!draft) throw new Error("Brouillon introuvable");
  if (draft.authorId !== me.id) throw new Error("Non autorise");
  if (draft.status === "sent") throw new Error("Deja envoye");
  if (!(await canManageEmployeeDocs(me.id, draft.targetAdminId))) {
    throw new Error(t("non_autorise_rh_ou_manager_direct"));
  }

  const dueDate = opts?.dueDate ? new Date(opts.dueDate) : null;

  // Cree la signature request en transaction
  await prisma.$transaction(async (tx) => {
    const dsr = await tx.documentSignatureRequest.create({
      data: {
        templateId: draft.templateId,
        requestedById: me.id,
        targetAdminId: draft.targetAdminId,
        dueDate,
        reason: opts?.reason ?? null,
        status: "pending",
        customFieldValues: (draft.customFieldValues as object | null) ?? undefined,
      },
    });
    // Marque le brouillon comme envoye (archive)
    await tx.documentDraft.update({
      where: { id },
      data: { status: "sent", sentAt: new Date() },
    });
    // Notification a l'employe
    await tx.notification.create({
      data: {
        recipientType: "admin",
        recipientId: draft.targetAdminId,
        type: "info",
        title: "Document a signer",
        body: `« ${draft.template.title} » vous a ete envoye pour signature.`,
        link: "/admin/mon-espace/documents",
        icon: "file-pen",
      },
    }).catch(() => null);
    return dsr;
  });

  await logAudit({
    adminId: me.id,
    action: "update",
    entityType: "document_draft",
    entityId: id,
    changes: { event: "sent", templateKey: draft.template.key, targetId: draft.targetAdminId },
  });

  revalidatePath("/admin/employes/documents");
  return { ok: true };
}

/**
 * Supprime un brouillon (seul l'auteur).
 */
export async function deleteDocumentDraftAction(id: number) {
  const me = await requireAdmin();
  const draft = await prisma.documentDraft.findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true, templateId: true },
  });
  if (!draft) return { ok: true }; // idempotent
  if (draft.authorId !== me.id) throw new Error("Non autorise");
  if (draft.status === "sent") throw new Error("Brouillon archive (envoye) : non supprimable");

  await prisma.documentDraft.delete({ where: { id } });
  await logAudit({
    adminId: me.id,
    action: "delete",
    entityType: "document_draft",
    entityId: id,
    changes: { templateId: draft.templateId },
  });
  revalidatePath("/admin/employes/documents");
  return { ok: true };
}
