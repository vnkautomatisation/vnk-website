"use server";
// Actions CRUD pour les notes et avis du dossier employe (EmployeeNote).
// Categories : general | discipline | commendation | observation | medical | onboarding | exit.
// Severity (optionnel, surtout discipline) : info | warning | critical.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

// Suis le pattern hr-leaves.ts : super_admin OU permission users.write (+ hr.write par tolerance)
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
  const ok = isSuper || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");
  return ok ? adminId : null;
}

async function getActorContext(): Promise<{ adminId: number; isSuper: boolean } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return null;
  return { adminId, isSuper: me.customRole?.name === "super_admin" };
}

const CATEGORIES = ["general", "discipline", "commendation", "observation", "medical", "onboarding", "exit"] as const;
const SEVERITIES = ["info", "warning", "critical"] as const;

const createSchema = z.object({
  adminId: z.number().int(),
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES).nullable().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  isConfidential: z.boolean().optional().default(true),
  occurredAt: z.string().nullable().optional(),
  attachmentUrl: z.string().max(1000).nullable().optional(),
});

export async function createEmployeeNoteAction(
  input: z.infer<typeof createSchema>,
): Promise<Result<{ id: number }>> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorise" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verifier que la cible existe (et recuperer pour la notification)
  const target = await prisma.admin.findUnique({
    where: { id: parsed.data.adminId },
    select: { id: true, fullName: true, email: true },
  });
  if (!target) return { success: false, error: "Employe introuvable" };

  const row = await prisma.employeeNote.create({
    data: {
      adminId: parsed.data.adminId,
      authorId: actorId,
      category: parsed.data.category,
      severity: parsed.data.severity ?? null,
      title: parsed.data.title,
      body: parsed.data.body,
      isConfidential: parsed.data.isConfidential ?? true,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    },
    select: { id: true },
  });

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "employee_note",
    entityId: row.id,
    changes: {
      targetAdminId: parsed.data.adminId,
      category: parsed.data.category,
      severity: parsed.data.severity ?? null,
    },
  });

  // Notification : avis disciplinaire critique → previens immediatement l'employe.
  if (parsed.data.category === "discipline" && parsed.data.severity === "critical") {
    await prisma.notification
      .create({
        data: {
          recipientType: "admin",
          recipientId: parsed.data.adminId,
          type: "warning",
          title: "Note disciplinaire ajoutee a votre dossier",
          body: parsed.data.title,
          link: "/admin/mon-espace",
          icon: "alert-triangle",
        },
      })
      .catch(() => null);
  }

  revalidatePath("/admin/employes");
  revalidatePath(`/admin/employes/${parsed.data.adminId}/dossier`);
  revalidatePath("/admin/mon-espace/dossier");
  return { success: true, data: { id: row.id } };
}

const updateSchema = z.object({
  id: z.number().int(),
  category: z.enum(CATEGORIES).optional(),
  severity: z.enum(SEVERITIES).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  isConfidential: z.boolean().optional(),
  occurredAt: z.string().nullable().optional(),
  attachmentUrl: z.string().max(1000).nullable().optional(),
});

export async function updateEmployeeNoteAction(
  input: z.infer<typeof updateSchema>,
): Promise<Result> {
  const actor = await getActorContext();
  if (!actor) return { success: false, error: "Non autorise" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const existing = await prisma.employeeNote.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, adminId: true, authorId: true },
  });
  if (!existing) return { success: false, error: "Note introuvable" };

  // Seul l'auteur OU super_admin peut modifier
  if (existing.authorId !== actor.adminId && !actor.isSuper) {
    return { success: false, error: "Vous ne pouvez modifier que vos propres notes" };
  }

  await prisma.employeeNote.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.severity !== undefined ? { severity: parsed.data.severity } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      ...(parsed.data.isConfidential !== undefined ? { isConfidential: parsed.data.isConfidential } : {}),
      ...(parsed.data.occurredAt !== undefined
        ? { occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null }
        : {}),
      ...(parsed.data.attachmentUrl !== undefined ? { attachmentUrl: parsed.data.attachmentUrl } : {}),
    },
  });

  await logAudit({
    adminId: actor.adminId,
    action: "update",
    entityType: "employee_note",
    entityId: parsed.data.id,
    changes: { targetAdminId: existing.adminId },
  });

  revalidatePath("/admin/employes");
  revalidatePath(`/admin/employes/${existing.adminId}/dossier`);
  revalidatePath("/admin/mon-espace/dossier");
  return { success: true };
}

export async function deleteEmployeeNoteAction(input: { id: number }): Promise<Result> {
  const actor = await getActorContext();
  if (!actor) return { success: false, error: "Non autorise" };
  if (!actor.isSuper) return { success: false, error: "Suppression reservee au super_admin" };

  const existing = await prisma.employeeNote.findUnique({
    where: { id: input.id },
    select: { id: true, adminId: true },
  });
  if (!existing) return { success: false, error: "Note introuvable" };

  await prisma.employeeNote.delete({ where: { id: input.id } });
  await logAudit({
    adminId: actor.adminId,
    action: "delete",
    entityType: "employee_note",
    entityId: input.id,
    changes: { targetAdminId: existing.adminId },
  });

  revalidatePath("/admin/employes");
  revalidatePath(`/admin/employes/${existing.adminId}/dossier`);
  revalidatePath("/admin/mon-espace/dossier");
  return { success: true };
}

export async function acknowledgeEmployeeNoteAction(input: { id: number }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;

  const note = await prisma.employeeNote.findUnique({
    where: { id: input.id },
    select: { id: true, adminId: true, acknowledgedAt: true },
  });
  if (!note) return { success: false, error: "Note introuvable" };

  // L'employe concerne uniquement peut acquitter sa note.
  if (note.adminId !== adminId) {
    return { success: false, error: "Cette note ne vous est pas adressee" };
  }
  if (note.acknowledgedAt) return { success: true };

  await prisma.employeeNote.update({
    where: { id: input.id },
    data: { acknowledgedAt: new Date() },
  });
  await logAudit({
    adminId,
    action: "update",
    entityType: "employee_note",
    entityId: input.id,
    changes: { acknowledged: true },
  });

  revalidatePath("/admin/mon-espace/dossier");
  revalidatePath(`/admin/employes/${note.adminId}/dossier`);
  return { success: true };
}
