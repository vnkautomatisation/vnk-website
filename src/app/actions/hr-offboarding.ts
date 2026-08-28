"use server";
// Offboarding wizard complet : checklist IT, retour matériel, RE, exit interview.
import { z } from "zod";
import { getTranslations, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

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

export const DEFAULT_CHECKLIST = [
  { key: "exit_interview", labelKey: "off_entrevue_de_depart_effectuee" },
  { key: "return_laptop", labelKey: "off_retour_ordinateur_portable" },
  { key: "return_phone", labelKey: "off_retour_telephone_cellulaire_corpo" },
  { key: "return_badge", labelKey: "off_retour_badge_d_acces_cles" },
  { key: "return_vehicle", labelKey: "off_retour_vehicule_de_fonction_si_applicable" },
  { key: "return_credit_card", labelKey: "off_retour_carte_de_credit_corpo_essence" },
  { key: "return_tools", labelKey: "off_retour_outils_equipement_specialise" },
  { key: "return_epi", labelKey: "off_retour_equipement_protection_individuel_epi" },
  { key: "revoke_email", labelKey: "off_revoquer_acces_courriel_transferer_vers_successeur" },
  { key: "revoke_sso", labelKey: "off_revoquer_sso_externes_google_microsoft_github" },
  { key: "revoke_shared_accounts", labelKey: "off_reprendre_comptes_partages_stripe_dropbox_sentry" },
  { key: "revoke_portal", labelKey: "off_desactiver_compte_du_portail_vnk" },
  { key: "transfer_files", labelKey: "off_transferer_documents_dossiers_en_cours" },
  { key: "transfer_clients", labelKey: "off_communiquer_changement_aux_clients_concernes" },
  { key: "handover_meeting", labelKey: "off_reunion_de_passation_avec_successeur" },
  { key: "issue_record_employment", labelKey: "off_emettre_releve_d_emploi_re_edsc" },
  { key: "issue_final_paystub", labelKey: "off_emettre_dernier_bulletin_de_paie_vacances" },
  { key: "issue_t4_release", labelKey: "off_confirmer_emission_t4_releve_1_en" },
  { key: "hr_documentation", labelKey: "off_archiver_dossier_rh_employe" },
  { key: "remove_directory", labelKey: "off_retirer_de_l_annuaire_interne_site" },
];

const startSchema = z.object({
  adminId: z.number().int(),
  reason: z.enum(["resignation", "termination", "retirement", "end_contract"]),
  lastDay: z.string(),
  successorId: z.number().int().nullable().optional(),
});

export async function startOffboardingAction(input: z.infer<typeof startSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const dateTag = dateLocale(await getLocale());
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

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

  // Notifier l'employé : processus de départ démarré.
  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: parsed.data.adminId,
        type: "info",
        title: t("processus_de_depart_demarre"),
        body: t("hr_offboarding_votre_dernier_jour_est_fixe_au_p0_consultez", { p0: new Date(parsed.data.lastDay).toLocaleDateString(dateTag) }),
        link: "/admin/mon-espace",
        icon: "log-out",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/employes/offboarding");
  return { success: true, data: { id: row.id } };
}

export async function toggleOffboardingItemAction(input: { adminId: number; itemKey: string; done: boolean }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();

  const checklist = await prisma.offboardingChecklist.findUnique({ where: { adminId: input.adminId } });
  if (!checklist) return { success: false, error: "Checklist introuvable" };

  const items = Array.isArray(checklist.items) ? checklist.items as Array<{ key: string; labelKey?: string; label?: string; done: boolean; doneAt: string | null; doneBy: number | null }> : [];
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
  if (!actorId) return unauthorized();
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
  if (!actorId) return unauthorized();
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
  const t = await getTranslations("admin.action_errors");
  const actorId = await requireHrWrite();
  if (!actorId) return unauthorized();

  try {
    const offboarding = await prisma.offboardingChecklist.findUnique({
      where: { id: input.id },
      include: { admin: { select: { id: true, fullName: true, email: true, isActive: true, internalNotes: true } } },
    });
    if (!offboarding) return { success: false, error: "Offboarding introuvable" };
    if (offboarding.status === "completed") return { success: false, error: t("deja_complete") };

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

    // Notifier tous les super_admin actifs que l'offboarding est complet.
    const superAdmins = await prisma.admin.findMany({
      where: { isActive: true, customRole: { name: "super_admin" } },
      select: { id: true },
    });
    const targetLabel = offboarding.admin.fullName || offboarding.admin.email || t("hr_offboarding_employe_p0", { p0: offboarding.adminId });
    await Promise.all(
      superAdmins.map((sa) =>
        prisma.notification
          .create({
            data: {
              recipientType: "admin",
              recipientId: sa.id,
              type: "success",
              title: t("hr_offboarding_offboarding_complete_pour_p0", { p0: targetLabel }),
              body: t("hr_offboarding_le_compte_a_ete_desactive_et_toutes_les"),
              link: "/admin/employes/offboarding",
              icon: "log-out",
            },
          })
          .catch(() => null)
      )
    );

    revalidatePath("/admin/employes/offboarding");
    revalidatePath("/admin/settings/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}
