"use server";
// Actions documents personnels employé (permis, diplômes, certifications...).
// L'employé uploade/édite/supprime ses propres docs. Un admin RH peut tout
// voir + vérifier (sauf isPrivate=true qui n'est visible que par l'employé).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent, type SecurityEventType } from "@/lib/security/security-events";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const CATEGORIES = [
  "licence",
  "diploma",
  "certification",
  "id_card",
  "passport",
  "medical",
  "other",
] as const;

// ─── Helpers permissions ────────────────────────────────────────
async function requireSelfOrHr(targetAdminId: number): Promise<
  | { actorId: number; isSelf: boolean; isHr: boolean; isSuper: boolean }
  | null
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const actorId = session.user.adminId!;
  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  const isSelf = actorId === targetAdminId;
  if (!isSelf && !isHr) return null;
  return { actorId, isSelf, isHr, isSuper };
}

async function requireHrRead(): Promise<{ adminId: number; isSuper: boolean } | null> {
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
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");
  if (!isHr) return null;
  return { adminId, isSuper };
}

// ─── Schemas ────────────────────────────────────────────────────
const upsertSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  category: z.enum(CATEGORIES),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).nullable().optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
  fileName: z.string().max(255).nullable().optional(),
  fileSize: z.number().int().nullable().optional(),
  fileMimeType: z.string().max(120).nullable().optional(),
  issuedAt: z.string().nullable().optional(),   // ISO date "YYYY-MM-DD"
  expiresAt: z.string().nullable().optional(),  // ISO date "YYYY-MM-DD"
  issuer: z.string().max(160).nullable().optional(),
  referenceNumber: z.string().max(120).nullable().optional(),
  isPrivate: z.boolean().default(false).optional(),
});

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  // YYYY-MM-DD => Date UTC à 00:00 pour Prisma @db.Date
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// ─── upsertPersonalDocAction ────────────────────────────────────
export async function upsertPersonalDocAction(
  input: z.infer<typeof upsertSchema>,
): Promise<Result<{ id: number }>> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const guard = await requireSelfOrHr(parsed.data.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };

  // Restriction : seul l'employé peut créer/modifier les docs marqués privés.
  // Un admin RH ne peut PAS toucher un doc privé existant.
  if (parsed.data.id) {
    const existing = await prisma.employeePersonalDocument.findUnique({
      where: { id: parsed.data.id },
      select: { adminId: true, isPrivate: true },
    });
    if (!existing) return { success: false, error: "Document introuvable" };
    if (existing.adminId !== parsed.data.adminId) {
      return { success: false, error: "Document hors scope" };
    }
    if (existing.isPrivate && !guard.isSelf) {
      return { success: false, error: "Document privé : seul l'employé peut le modifier" };
    }
  }

  // L'admin RH peut créer un doc côté employé, mais pas un doc privé en son nom
  if (!guard.isSelf && parsed.data.isPrivate) {
    return { success: false, error: "Seul l'employé peut marquer un document privé" };
  }

  const issuedAt = parseDateOnly(parsed.data.issuedAt ?? null);
  const expiresAt = parseDateOnly(parsed.data.expiresAt ?? null);
  if (issuedAt && expiresAt && expiresAt < issuedAt) {
    return { success: false, error: "La date d'expiration est antérieure à l'émission" };
  }

  // Une modif par un RH invalide la vérification précédente (l'employé doit revalider ?)
  // Convention : si fileUrl change, on remet isVerified=false.
  const willResetVerification = !!parsed.data.id && parsed.data.fileUrl !== undefined;

  const data = {
    adminId: parsed.data.adminId,
    category: parsed.data.category,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    fileUrl: parsed.data.fileUrl ?? null,
    fileName: parsed.data.fileName ?? null,
    fileSize: parsed.data.fileSize ?? null,
    fileMimeType: parsed.data.fileMimeType ?? null,
    issuedAt,
    expiresAt,
    issuer: parsed.data.issuer ?? null,
    referenceNumber: parsed.data.referenceNumber ?? null,
    isPrivate: parsed.data.isPrivate ?? false,
  };

  const row = parsed.data.id
    ? await prisma.employeePersonalDocument.update({
        where: { id: parsed.data.id },
        data: {
          ...data,
          ...(willResetVerification ? { isVerified: false, verifiedAt: null, verifiedByAdminId: null, verificationNotes: null } : {}),
        },
        select: { id: true },
      })
    : await prisma.employeePersonalDocument.create({ data, select: { id: true } });

  await logAudit({
    adminId: guard.actorId,
    action: parsed.data.id ? "update" : "create",
    entityType: "employee_personal_doc",
    entityId: row.id,
    changes: { adminId: parsed.data.adminId, category: parsed.data.category },
  });

  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/documents");
  return { success: true, data: { id: row.id } };
}

// ─── deletePersonalDocAction ────────────────────────────────────
export async function deletePersonalDocAction(input: { id: number }): Promise<Result> {
  const { id } = input;
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };

  const doc = await prisma.employeePersonalDocument.findUnique({
    where: { id },
    select: { adminId: true, isPrivate: true, title: true, category: true },
  });
  if (!doc) return { success: false, error: "Document introuvable" };

  const guard = await requireSelfOrHr(doc.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };

  // Doc privé : seul l'employé peut supprimer
  if (doc.isPrivate && !guard.isSelf) {
    return { success: false, error: "Document privé : seul l'employé peut le supprimer" };
  }

  await prisma.employeePersonalDocument.delete({ where: { id } });

  await logAudit({
    adminId: guard.actorId,
    action: "delete",
    entityType: "employee_personal_doc",
    entityId: id,
    changes: { adminId: doc.adminId, title: doc.title, category: doc.category },
  });

  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/documents");
  return { success: true };
}

// ─── verifyPersonalDocAction ────────────────────────────────────
const verifySchema = z.object({
  id: z.number().int(),
  verified: z.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
});

export async function verifyPersonalDocAction(
  input: z.infer<typeof verifySchema>,
): Promise<Result> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const doc = await prisma.employeePersonalDocument.findUnique({
    where: { id: parsed.data.id },
    select: { adminId: true, isPrivate: true, title: true },
  });
  if (!doc) return { success: false, error: "Document introuvable" };

  // Seul un admin RH peut vérifier (l'employé ne peut pas s'auto-vérifier)
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const actorId = session.user.adminId!;
  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return { success: false, error: "Non autorisé" };
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  if (!isHr) return { success: false, error: "Permission RH requise" };

  // Doc privé : ne peut être vérifié (l'admin RH ne le voit pas)
  if (doc.isPrivate && !isSuper) {
    return { success: false, error: "Document privé : non vérifiable" };
  }

  await prisma.employeePersonalDocument.update({
    where: { id: parsed.data.id },
    data: parsed.data.verified
      ? {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedByAdminId: actorId,
          verificationNotes: parsed.data.notes ?? null,
        }
      : {
          isVerified: false,
          verifiedAt: null,
          verifiedByAdminId: null,
          verificationNotes: parsed.data.notes ?? null,
        },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "employee_personal_doc",
    entityId: parsed.data.id,
    changes: { verified: parsed.data.verified, targetAdminId: doc.adminId, notes: parsed.data.notes ?? null },
  });

  // Log security event (type custom — colonne string accepte n'importe quel libellé)
  await logSecurityEvent({
    adminId: actorId,
    type: "profile_updated" as SecurityEventType,
    severity: "info",
    message: parsed.data.verified
      ? `Document personnel vérifié : ${doc.title}`
      : `Vérification document retirée : ${doc.title}`,
    metadata: { targetAdminId: doc.adminId, docId: parsed.data.id },
  }).catch(() => null);

  // Notifier l'employé concerné
  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: doc.adminId,
        type: parsed.data.verified ? "success" : "info",
        title: parsed.data.verified
          ? "Document personnel vérifié"
          : "Vérification de document retirée",
        body: doc.title + (parsed.data.notes ? ` — ${parsed.data.notes}` : ""),
        link: "/admin/mon-espace/documents",
        icon: "shield",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/documents");
  return { success: true };
}

// ─── listExpiringDocsAction (RH) ────────────────────────────────
// Retourne les docs personnels expirant dans <= daysAhead jours (default 60).
// Réservé aux RH (utilisé pour le panneau d'alertes admin).
export async function listExpiringDocsAction(input?: { daysAhead?: number }): Promise<
  Result<
    Array<{
      id: number;
      adminId: number;
      adminName: string | null;
      category: string;
      title: string;
      expiresAt: string; // ISO
      daysUntil: number;
      isVerified: boolean;
    }>
  >
> {
  const guard = await requireHrRead();
  if (!guard) return { success: false, error: "Non autorisé" };

  const daysAhead = Math.max(1, Math.min(365, input?.daysAhead ?? 60));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const rows = await prisma.employeePersonalDocument.findMany({
    where: {
      expiresAt: { gte: today, lte: cutoff },
      // RH ne voit pas les docs privés (sauf super_admin)
      ...(guard.isSuper ? {} : { isPrivate: false }),
      admin: { isActive: true },
    },
    orderBy: { expiresAt: "asc" },
    include: { admin: { select: { id: true, fullName: true, email: true } } },
  });

  const data = rows.map((r) => {
    const expiresAt = r.expiresAt!;
    const daysUntil = Math.ceil((expiresAt.getTime() - today.getTime()) / 86400000);
    return {
      id: r.id,
      adminId: r.adminId,
      adminName: r.admin.fullName ?? r.admin.email,
      category: r.category,
      title: r.title,
      expiresAt: expiresAt.toISOString(),
      daysUntil,
      isVerified: r.isVerified,
    };
  });

  return { success: true, data };
}
