"use server";
// Offboarding wizard complet : checklist IT, retour matériel, RE, exit interview.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const id = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write")) ? id : null;
}

const DEFAULT_CHECKLIST = [
  { key: "exit_interview", label: "Entrevue de départ effectuée" },
  { key: "return_laptop", label: "Retour ordinateur portable" },
  { key: "return_phone", label: "Retour téléphone / cellulaire corpo" },
  { key: "return_badge", label: "Retour badge d'accès / clés" },
  { key: "return_vehicle", label: "Retour véhicule de fonction (si applicable)" },
  { key: "return_credit_card", label: "Retour carte de crédit corpo / essence" },
  { key: "return_tools", label: "Retour outils & équipement spécialisé" },
  { key: "return_epi", label: "Retour équipement protection individuel (EPI)" },
  { key: "revoke_email", label: "Révoquer accès courriel + transférer vers successeur" },
  { key: "revoke_sso", label: "Révoquer SSO externes (Google, Microsoft, GitHub)" },
  { key: "revoke_shared_accounts", label: "Reprendre comptes partagés (Stripe, Dropbox, Sentry)" },
  { key: "revoke_portal", label: "Désactiver compte du portail VNK" },
  { key: "transfer_files", label: "Transférer documents / dossiers en cours" },
  { key: "transfer_clients", label: "Communiquer changement aux clients concernés" },
  { key: "handover_meeting", label: "Réunion de passation avec successeur" },
  { key: "issue_record_employment", label: "Émettre Relevé d'emploi (RE) — EDSC dans 5 jours" },
  { key: "issue_final_paystub", label: "Émettre dernier bulletin de paie + vacances accumulées" },
  { key: "issue_t4_release", label: "Confirmer émission T4 / Relevé 1 en fin d'année" },
  { key: "hr_documentation", label: "Archiver dossier RH employé" },
  { key: "remove_directory", label: "Retirer de l'annuaire interne + site web" },
];

const startSchema = z.object({
  adminId: z.number().int(),
  reason: z.enum(["resignation", "termination", "retirement", "end_contract"]),
  lastDay: z.string(),
  successorId: z.number().int().nullable().optional(),
});

export async function startOffboardingAction(input: z.infer<typeof startSchema>): Promise<Result<{ id: number }>> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const items = DEFAULT_CHECKLIST.map((it) => ({ ...it, done: false, doneAt: null, doneBy: null }));

  const row = await prisma.offboardingChecklist.upsert({
    where: { adminId: parsed.data.adminId },
    create: {
      adminId: parsed.data.adminId,
      initiatedBy: actorId,
      reason: parsed.data.reason,
      lastDay: new Date(parsed.data.lastDay),
      successorId: parsed.data.successorId ?? null,
      items: items as never,
      status: "active",
    },
    update: {
      initiatedBy: actorId,
      reason: parsed.data.reason,
      lastDay: new Date(parsed.data.lastDay),
      successorId: parsed.data.successorId ?? null,
      status: "active",
    },
    select: { id: true },
  });

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "offboarding_checklist",
    entityId: row.id,
    changes: { adminId: parsed.data.adminId, reason: parsed.data.reason },
  });
  revalidatePath("/admin/employes/offboarding");
  return { success: true, data: { id: row.id } };
}

export async function toggleOffboardingItemAction(input: { adminId: number; itemKey: string; done: boolean }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  const checklist = await prisma.offboardingChecklist.findUnique({ where: { adminId: input.adminId } });
  if (!checklist) return { success: false, error: "Checklist introuvable" };

  const items = Array.isArray(checklist.items) ? checklist.items as Array<{ key: string; label: string; done: boolean; doneAt: string | null; doneBy: number | null }> : [];
  const idx = items.findIndex((it) => it.key === input.itemKey);
  if (idx === -1) return { success: false, error: "Item introuvable" };

  items[idx].done = input.done;
  items[idx].doneAt = input.done ? new Date().toISOString() : null;
  items[idx].doneBy = input.done ? actorId : null;

  // Check completion totale
  const allDone = items.every((it) => it.done);
  const status = allDone ? "completed" : "active";

  await prisma.offboardingChecklist.update({
    where: { adminId: input.adminId },
    data: {
      items: items as never,
      status,
      completedAt: allDone ? new Date() : null,
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "offboarding_checklist",
    entityId: checklist.id,
    changes: { item: input.itemKey, done: input.done, status },
  });
  revalidatePath("/admin/employes/offboarding");
  return { success: true };
}

export async function saveExitInterviewAction(input: { adminId: number; notes: string }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  await prisma.offboardingChecklist.update({
    where: { adminId: input.adminId },
    data: {
      exitInterview: input.notes,
      exitInterviewAt: new Date(),
    },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "offboarding_checklist", changes: { exitInterview: true } });
  revalidatePath("/admin/employes/offboarding");
  return { success: true };
}

export async function markRecordOfEmploymentSentAction(input: { adminId: number }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  await prisma.offboardingChecklist.update({
    where: { adminId: input.adminId },
    data: { recordOfEmploymentSentAt: new Date() },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "offboarding_checklist", changes: { reSent: true } });
  revalidatePath("/admin/employes/offboarding");
  return { success: true };
}

// Clôture définitive : marque l'offboarding complete + désactive le compte admin + invalide ses sessions.
export async function completeOffboardingAction(input: { id: number }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  try {
    const offboarding = await prisma.offboardingChecklist.findUnique({
      where: { id: input.id },
      include: { admin: { select: { id: true, fullName: true, email: true, isActive: true, internalNotes: true } } },
    });
    if (!offboarding) return { success: false, error: "Offboarding introuvable" };
    if (offboarding.status === "completed") return { success: false, error: "Déjà complété" };

    const prefix = "[OFFBOARDED]";
    const existingNotes = offboarding.admin.internalNotes ?? "";
    const newNotes = existingNotes.startsWith(prefix)
      ? existingNotes
      : `${prefix} ${new Date().toISOString().slice(0, 10)}${existingNotes ? ` — ${existingNotes}` : ""}`;

    await prisma.$transaction([
      prisma.offboardingChecklist.update({
        where: { id: input.id },
        data: { status: "completed", completedAt: new Date() },
      }),
      prisma.admin.update({
        where: { id: offboarding.adminId },
        data: {
          isActive: false,
          endDate: offboarding.lastDay,
          internalNotes: newNotes,
          sessionsInvalidatedAt: new Date(),
        },
      }),
      prisma.adminSession.deleteMany({ where: { adminId: offboarding.adminId } }),
    ]);

    await logAudit({
      adminId: actorId,
      action: "update",
      entityType: "offboarding_checklist",
      entityId: offboarding.id,
      changes: {
        status: "completed",
        adminDeactivated: offboarding.adminId,
        adminEmail: offboarding.admin.email,
      },
    });

    revalidatePath("/admin/employes/offboarding");
    revalidatePath("/admin/settings/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}
