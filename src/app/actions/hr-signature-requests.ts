"use server";
// Actions DocumentSignatureRequest — un admin RH demande à des employés
// spécifiques (individu / équipe / tous) de signer un LegalDocumentTemplate.
// Une demande se complète automatiquement quand l'employé signe (cf
// signLegalDocAction dans hr-legal-docs.ts).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  return isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.hr_documents ?? []).includes("write")
    ? adminId
    : null;
}

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// ─── createSignatureRequestAction ───────────────────────────────
// targets:
//   { all: true }            → 1 ligne avec targetAll=true (les employés sont
//                              déterminés au moment de l'affichage admin actifs)
//   { teamId: number }       → 1 ligne avec targetTeamId
//   { adminIds: number[] }   → N lignes individuelles (déduplique celles déjà
//                              pending OU déjà signées pour cette version)
const createSchema = z.object({
  templateId: z.number().int(),
  targets: z.union([
    z.object({ all: z.literal(true) }),
    z.object({ teamId: z.number().int() }),
    z.object({ adminIds: z.array(z.number().int()).min(1) }),
  ]),
  dueDate: z.string().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  // Valeurs saisies par le RH pour les `[CHAMP]` libres du template.
  // Format : { "DATE": "15 mars 2025", "SUJET INITIAL": "Retard chronique" }.
  customFieldValues: z.record(z.string(), z.string().max(2000)).nullable().optional(),
});

export async function createSignatureRequestAction(
  input: z.infer<typeof createSchema>,
): Promise<Result<{ createdCount: number; skipped: number }>> {
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const tpl = await prisma.legalDocumentTemplate.findUnique({
    where: { id: parsed.data.templateId },
    select: { id: true, title: true, version: true, isActive: true },
  });
  if (!tpl || !tpl.isActive) return { success: false, error: "Template introuvable ou inactif" };

  const dueDate = parseDateOnly(parsed.data.dueDate ?? null);
  if (dueDate && dueDate.getTime() < Date.now() - 24 * 3600 * 1000) {
    return { success: false, error: "L'échéance ne peut pas être dans le passé" };
  }

  // Normalise les valeurs des champs libres : trim. Les valeurs VIDES ("")
  // sont CONSERVEES intentionnellement : elles signalent au renderer PDF
  // qu'il faut SUPPRIMER la ligne du markdown (cas "Fait 2 / Fait 3 non
  // remplis" -> on retire les bullets vides du document final).
  const cleanedFieldValues = (() => {
    const src = parsed.data.customFieldValues ?? null;
    if (!src) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) {
      if (typeof v !== "string") continue;
      out[k] = v.trim(); // "" reste "" -> marqueur de suppression de ligne
    }
    return Object.keys(out).length > 0 ? out : null;
  })();

  const baseFields = {
    templateId: tpl.id,
    requestedById: actorId,
    dueDate,
    reason: parsed.data.reason ?? null,
    status: "pending" as const,
    customFieldValues: cleanedFieldValues ?? undefined,
  };

  let createdCount = 0;
  let skipped = 0;
  const notifyTargetAdminIds: number[] = [];

  // ── Case 1 : all ────────────────────────────────────────────
  if ("all" in parsed.data.targets) {
    // Une seule "demande globale" — évite la duplication si une existe déjà
    const exists = await prisma.documentSignatureRequest.findFirst({
      where: { templateId: tpl.id, targetAll: true, status: "pending" },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
    } else {
      await prisma.documentSignatureRequest.create({
        data: { ...baseFields, targetAll: true },
      });
      createdCount += 1;
      // Notifier tous les actifs qui n'ont pas signé la version courante
      const targets = await prisma.admin.findMany({
        where: {
          isActive: true,
          NOT: {
            legalSignatures: { some: { templateId: tpl.id, version: tpl.version } },
          },
        },
        select: { id: true },
      });
      notifyTargetAdminIds.push(...targets.map((t) => t.id));
    }
  }

  // ── Case 2 : teamId ─────────────────────────────────────────
  else if ("teamId" in parsed.data.targets) {
    const teamId = parsed.data.targets.teamId;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, members: { where: { isActive: true }, select: { id: true } } },
    });
    if (!team) return { success: false, error: "Équipe introuvable" };

    const exists = await prisma.documentSignatureRequest.findFirst({
      where: { templateId: tpl.id, targetTeamId: teamId, status: "pending" },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
    } else {
      await prisma.documentSignatureRequest.create({
        data: { ...baseFields, targetTeamId: teamId },
      });
      createdCount += 1;
      // Filtrer membres qui n'ont pas signé la version
      const memberIds = team.members.map((m) => m.id);
      if (memberIds.length > 0) {
        const alreadySigned = await prisma.legalDocumentSignature.findMany({
          where: { templateId: tpl.id, version: tpl.version, adminId: { in: memberIds } },
          select: { adminId: true },
        });
        const signedSet = new Set(alreadySigned.map((s) => s.adminId));
        notifyTargetAdminIds.push(...memberIds.filter((id) => !signedSet.has(id)));
      }
    }
  }

  // ── Case 3 : adminIds[] ─────────────────────────────────────
  else {
    const ids = Array.from(new Set(parsed.data.targets.adminIds));
    // Filtre IDs valides + actifs
    const valid = await prisma.admin.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    const validSet = new Set(valid.map((v) => v.id));

    // Skip ceux qui ont DEJA une demande pending pour ce template (evite
    // les doublons de notifications). En revanche, on N'IGNORE PLUS les
    // employes qui ont deja signe la version courante : si le RH renvoie
    // explicitement une demande, c'est pour qu'ils re-signent (corrections,
    // mise a jour, etc.). signLegalDocAction est en upsert et remplace
    // l'ancienne signature par la nouvelle.
    const existingPending = await prisma.documentSignatureRequest.findMany({
      where: {
        templateId: tpl.id,
        status: "pending",
        targetAdminId: { in: Array.from(validSet) },
      },
      select: { targetAdminId: true },
    });
    const pendingSet = new Set(
      existingPending.map((r) => r.targetAdminId).filter((x): x is number => x !== null),
    );

    const toCreate = Array.from(validSet).filter((id) => !pendingSet.has(id));
    skipped += ids.length - toCreate.length;

    if (toCreate.length > 0) {
      const rows = toCreate.map((adminId) => ({
        ...baseFields,
        // Prisma `createMany` n'accepte pas `undefined` pour les colonnes
        // Json — on normalise en `null` si pas de champs libres.
        customFieldValues: cleanedFieldValues ?? undefined,
        targetAdminId: adminId,
      }));
      await prisma.documentSignatureRequest.createMany({ data: rows });
      createdCount += toCreate.length;
      notifyTargetAdminIds.push(...toCreate);
    }
  }

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "signature_request",
    changes: {
      templateId: tpl.id,
      templateTitle: tpl.title,
      createdCount,
      skipped,
      targetKind: "all" in parsed.data.targets
        ? "all"
        : "teamId" in parsed.data.targets
          ? "team"
          : "individual",
    },
  });

  // Notifier les cibles individuelles (max 200 pour éviter timeout)
  const uniqueTargets = Array.from(new Set(notifyTargetAdminIds)).slice(0, 200);
  if (uniqueTargets.length > 0) {
    await prisma.notification
      .createMany({
        data: uniqueTargets.map((rid) => ({
          recipientType: "admin",
          recipientId: rid,
          type: "warning",
          title: "Signature demandée",
          body: tpl.title + (parsed.data.reason ? ` — ${parsed.data.reason}` : ""),
          link: "/admin/mon-espace/documents",
          icon: "file-signature",
        })),
        skipDuplicates: true,
      })
      .catch(() => null);
  }

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true, data: { createdCount, skipped } };
}

// ─── cancelSignatureRequestAction ───────────────────────────────
export async function cancelSignatureRequestAction(input: { id: number }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();

  const req = await prisma.documentSignatureRequest.findUnique({
    where: { id: input.id },
    select: { id: true, status: true, templateId: true, targetAdminId: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") return { success: false, error: "Demande déjà clôturée" };

  await prisma.documentSignatureRequest.update({
    where: { id: input.id },
    data: { status: "cancelled", completedAt: new Date() },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "signature_request",
    entityId: input.id,
    changes: { status: "cancelled" },
  });

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true };
}

// ─── remindSignatureRequestAction ───────────────────────────────
// Renvoie une notification aux cibles d'une demande pending.
export async function remindSignatureRequestAction(input: { id: number }): Promise<
  Result<{ notified: number }>
> {
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();

  const req = await prisma.documentSignatureRequest.findUnique({
    where: { id: input.id },
    include: { template: { select: { id: true, title: true, version: true } } },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") return { success: false, error: "Demande déjà clôturée" };

  let targetIds: number[] = [];

  if (req.targetAdminId) {
    targetIds = [req.targetAdminId];
  } else if (req.targetTeamId) {
    const members = await prisma.admin.findMany({
      where: { teamId: req.targetTeamId, isActive: true },
      select: { id: true },
    });
    targetIds = members.map((m) => m.id);
  } else if (req.targetAll) {
    const all = await prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    targetIds = all.map((a) => a.id);
  }

  // Exclure UNIQUEMENT ceux qui ont signe APRES la creation de la demande.
  // Si la signature precede la demande (cas de re-signing : employe avait
  // signe v1.0, RH renvoie une demande pour faire re-signer), on garde le
  // destinataire — il doit etre rappele.
  if (targetIds.length > 0) {
    const signed = await prisma.legalDocumentSignature.findMany({
      where: {
        templateId: req.template.id,
        version: req.template.version,
        adminId: { in: targetIds },
        signedAt: { gte: req.requestedAt },
      },
      select: { adminId: true },
    });
    const signedSet = new Set(signed.map((s) => s.adminId));
    targetIds = targetIds.filter((id) => !signedSet.has(id));
  }

  if (targetIds.length === 0) {
    return { success: true, data: { notified: 0 } };
  }

  await prisma.notification
    .createMany({
      data: targetIds.slice(0, 200).map((rid) => ({
        recipientType: "admin",
        recipientId: rid,
        type: "warning",
        title: "Rappel : signature demandée",
        body: req.template.title,
        link: "/admin/mon-espace/documents",
        icon: "bell",
      })),
      skipDuplicates: true,
    })
    .catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "signature_request",
    entityId: input.id,
    changes: { reminded: targetIds.length },
  });

  revalidatePath("/admin/employes/documents");
  return { success: true, data: { notified: targetIds.length } };
}

// ─── markSignatureRequestCompleteAction ─────────────────────────
// Appelée automatiquement par signLegalDocAction quand un employé signe
// (cf hr-legal-docs.ts). Trouve les demandes pending qui visent ce duo
// (templateId, adminId) — qu'elles soient individuelles, par équipe ou globales.
export async function markSignatureRequestCompleteAction(input: {
  templateId: number;
  signerAdminId: number;
}): Promise<Result<{ closed: number }>> {
  // Pas de vérif d'auth ici : appelée depuis le serveur (signLegalDocAction)
  // qui a déjà vérifié l'auth de l'employé. Reste interne.
  const signer = await prisma.admin.findUnique({
    where: { id: input.signerAdminId },
    select: { id: true, teamId: true },
  });
  if (!signer) return { success: false, error: "Signataire introuvable" };

  const candidates = await prisma.documentSignatureRequest.findMany({
    where: {
      templateId: input.templateId,
      status: "pending",
      OR: [
        { targetAdminId: signer.id },
        ...(signer.teamId ? [{ targetTeamId: signer.teamId }] : []),
        { targetAll: true },
      ],
    },
    select: { id: true, targetAdminId: true },
  });

  if (candidates.length === 0) return { success: true, data: { closed: 0 } };

  // Pour les demandes individuelles : on peut clôturer directement la ligne.
  // Pour team/all : on ne ferme PAS la demande globale (d'autres employés sont
  // encore concernés). Le statut se calcule au runtime côté UI (% signataires).
  const individualIds = candidates
    .filter((c) => c.targetAdminId === signer.id)
    .map((c) => c.id);

  let closed = 0;
  if (individualIds.length > 0) {
    const r = await prisma.documentSignatureRequest.updateMany({
      where: { id: { in: individualIds } },
      data: { status: "completed", completedAt: new Date() },
    });
    closed = r.count;
  }

  return { success: true, data: { closed } };
}
