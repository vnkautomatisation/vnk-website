"use server";
// Workflow d'appel sur une attribution de vacances (R5).
// Un employe peut faire appel d'une preference granted (non-prefere) ou denied
// apres l'attribution d'une fenetre. Un super_admin / RH (leaves.write) revoit
// l'appel et peut accepter (re-attribuer / changer le statut) ou rejeter.
//
// Actions :
//   - submitAppealAction   : proprietaire -> appealStatus pending
//   - reviewAppealAction   : super_admin/RH -> approved | rejected
//   - withdrawAppealAction : proprietaire -> appealStatus null
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const ERR_NO_AUTHORITY = "Vous n'avez pas l'autorite pour reviser les appels.";

// ─── Helper : check si l'acteur peut reviser un appel ────────────
async function canReviewAppeals(adminId: number): Promise<boolean> {
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return false;
  if (me.customRole?.name === "super_admin") return true;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (perms.leaves ?? []).includes("write")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
}

// ─── 1) Soumettre un appel ───────────────────────────────────────
const submitAppealSchema = z.object({
  preferenceId: z.number().int().positive(),
  reason: z.string().min(3).max(500),
});

export async function submitAppealAction(
  input: z.infer<typeof submitAppealSchema>,
): Promise<Result<{ preferenceId: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const actorId = session.user.adminId!;
  const parsed = submitAppealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const pref = await prisma.vacationPreference.findUnique({
    where: { id: parsed.data.preferenceId },
    include: { window: { select: { id: true, name: true, status: true } } },
  });
  if (!pref) return { success: false, error: "Preference introuvable" };
  if (!pref.window) return { success: false, error: "Fenetre introuvable" };

  // Conditions :
  //   - acteur doit etre le proprietaire de la preference
  //   - status pref doit etre granted ou denied
  //   - status window doit etre allocated
  //   - aucun appel deja pending sur cette preference
  if (pref.adminId !== actorId) {
    return { success: false, error: "Vous ne pouvez faire appel que sur vos propres preferences." };
  }
  if (pref.status !== "granted" && pref.status !== "denied") {
    return { success: false, error: "L'appel n'est possible que sur une preference granted ou denied." };
  }
  if (pref.window.status !== "allocated") {
    return { success: false, error: "L'appel n'est possible que sur une fenetre allocated." };
  }
  if (pref.appealStatus === "pending") {
    return { success: false, error: "Un appel est deja en cours pour cette preference." };
  }

  await prisma.vacationPreference.update({
    where: { id: pref.id },
    data: {
      appealStatus: "pending",
      appealReason: parsed.data.reason.slice(0, 500),
      appealedAt: new Date(),
      appealReviewedBy: null,
      appealReviewedAt: null,
      appealReviewNotes: null,
    },
  });

  // Notif super_admins + RH
  const reviewers = await prisma.admin.findMany({
    where: {
      isActive: true,
      OR: [
        { customRole: { name: "super_admin" } },
        // role avec permission leaves.write/users.write/hr.write -> trop large pour requete typed,
        // on prend super_admin uniquement ici en plus du manager si present.
      ],
    },
    select: { id: true },
  });
  // Ajoute le manager direct du proprietaire
  const owner = await prisma.admin.findUnique({
    where: { id: actorId },
    select: { fullName: true, email: true, managerId: true },
  });
  const recipientIds = new Set<number>();
  for (const r of reviewers) {
    if (r.id !== actorId) recipientIds.add(r.id);
  }
  if (owner?.managerId && owner.managerId !== actorId) recipientIds.add(owner.managerId);

  const ownerLabel = owner?.fullName || owner?.email || `#${actorId}`;
  if (recipientIds.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(recipientIds).map((rid) => ({
        recipientType: "admin",
        recipientId: rid,
        type: "warning",
        title: `Appel d'attribution : ${pref.window!.name}`,
        body: `${ownerLabel} fait appel sur sa preference rang ${pref.rank} (${pref.status}). Motif : ${parsed.data.reason.slice(0, 200)}`,
        link: "/admin/employes/conges/fenetres",
        icon: "alert-triangle",
      })),
      skipDuplicates: true,
    }).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "vacation_preference_appeal",
    entityId: pref.id,
    changes: { submitted: true, reason: parsed.data.reason.slice(0, 200) },
  });
  await logSecurityEvent({
    adminId: actorId,
    type: "profile_updated",
    severity: "info",
    message: `Appel soumis sur la preference de vacances #${pref.id}`,
    metadata: { preferenceId: pref.id, windowId: pref.windowId, reason: parsed.data.reason.slice(0, 200) },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { preferenceId: pref.id } };
}

// ─── 2) Revoir un appel (RH / super_admin) ───────────────────────
const reviewAppealSchema = z.object({
  preferenceId: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().max(500).optional(),
});

export async function reviewAppealAction(
  input: z.infer<typeof reviewAppealSchema>,
): Promise<Result<{ preferenceId: number; decision: "approved" | "rejected" }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorise" };
  const actorId = session.user.adminId!;
  const parsed = reviewAppealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const allowed = await canReviewAppeals(actorId);
  if (!allowed) return { success: false, error: ERR_NO_AUTHORITY };

  const pref = await prisma.vacationPreference.findUnique({
    where: { id: parsed.data.preferenceId },
    include: { window: { select: { id: true, name: true, status: true } } },
  });
  if (!pref) return { success: false, error: "Preference introuvable" };
  if (!pref.window) return { success: false, error: "Fenetre introuvable" };
  if (pref.appealStatus !== "pending") {
    return { success: false, error: "Aucun appel en attente sur cette preference." };
  }
  if (pref.adminId === actorId) {
    // Founder is the only exception (no superior in the org chart).
    const { isFounder } = await import("@/lib/services/org-guard");
    if (!(await isFounder(actorId))) {
      return { success: false, error: "Vous ne pouvez pas reviser votre propre appel." };
    }
  }

  const notesClean = parsed.data.notes?.slice(0, 500) ?? null;
  const now = new Date();

  if (parsed.data.decision === "approved") {
    // Approuver l'appel : si la pref etait denied -> granted (avec creation LeaveRequest)
    //                    si la pref etait granted -> on garde granted mais on note l'appel
    if (pref.status === "denied") {
      // Verifie chevauchement
      const overlap = await prisma.leaveRequest.findFirst({
        where: {
          adminId: pref.adminId,
          status: { in: ["approved", "pending"] },
          startDate: { lte: pref.endDate },
          endDate: { gte: pref.startDate },
        },
        select: { id: true },
      });
      if (overlap) {
        return { success: false, error: "Conflit avec une demande de conge existante — appel non approuve." };
      }
      try {
        await prisma.$transaction(async (tx) => {
          const leave = await tx.leaveRequest.create({
            data: {
              adminId: pref.adminId,
              type: "vacation",
              startDate: pref.startDate,
              endDate: pref.endDate,
              daysCount: pref.daysCount,
              status: "approved",
              reviewerId: actorId,
              reviewedAt: now,
              reviewNotes: `Accorde suite a appel (fenetre "${pref.window!.name}", rang ${pref.rank})`,
            },
            select: { id: true },
          });
          await tx.vacationPreference.update({
            where: { id: pref.id },
            data: {
              status: "granted",
              leaveRequestId: leave.id,
              appealStatus: "approved",
              appealReviewedBy: actorId,
              appealReviewedAt: now,
              appealReviewNotes: notesClean,
            },
          });
        });
      } catch (err) {
        console.error("[reviewAppealAction] approval txn failed", err);
        return { success: false, error: "Echec de l'approbation — aucune modification." };
      }
    } else {
      // pref etait granted -> on n'inverse rien, on note simplement l'approbation
      await prisma.vacationPreference.update({
        where: { id: pref.id },
        data: {
          appealStatus: "approved",
          appealReviewedBy: actorId,
          appealReviewedAt: now,
          appealReviewNotes: notesClean,
        },
      });
    }
  } else {
    // rejected : on note simplement la decision, pas de changement de statut pref
    await prisma.vacationPreference.update({
      where: { id: pref.id },
      data: {
        appealStatus: "rejected",
        appealReviewedBy: actorId,
        appealReviewedAt: now,
        appealReviewNotes: notesClean,
      },
    });
  }

  // Notif employe
  const reviewer = await prisma.admin.findUnique({
    where: { id: actorId },
    select: { fullName: true, email: true },
  });
  const reviewerLabel = reviewer?.fullName || reviewer?.email || "RH";
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: pref.adminId,
      type: parsed.data.decision === "approved" ? "success" : "warning",
      title: parsed.data.decision === "approved"
        ? `Appel approuve : ${pref.window.name}`
        : `Appel refuse : ${pref.window.name}`,
      body: notesClean
        ? `${reviewerLabel} a ${parsed.data.decision === "approved" ? "approuve" : "refuse"} votre appel. Notes : ${notesClean}`
        : `${reviewerLabel} a ${parsed.data.decision === "approved" ? "approuve" : "refuse"} votre appel.`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "vacation_preference_appeal",
    entityId: pref.id,
    changes: { decision: parsed.data.decision, notes: notesClean, previousStatus: pref.status },
  });
  await logSecurityEvent({
    adminId: pref.adminId,
    type: "profile_updated",
    severity: parsed.data.decision === "approved" ? "success" : "info",
    message: `Appel sur vacances ${parsed.data.decision === "approved" ? "approuve" : "refuse"}`,
    metadata: { preferenceId: pref.id, windowId: pref.windowId, by: actorId },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  if (parsed.data.decision === "approved" && pref.status === "denied") {
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  return { success: true, data: { preferenceId: pref.id, decision: parsed.data.decision } };
}

// ─── 3) Retirer un appel (proprietaire) ──────────────────────────
const withdrawAppealSchema = z.object({
  preferenceId: z.number().int().positive(),
});

export async function withdrawAppealAction(
  input: z.infer<typeof withdrawAppealSchema>,
): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorise" };
  const actorId = session.user.adminId!;
  const parsed = withdrawAppealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const pref = await prisma.vacationPreference.findUnique({
    where: { id: parsed.data.preferenceId },
    select: { id: true, adminId: true, appealStatus: true, windowId: true },
  });
  if (!pref) return { success: false, error: "Preference introuvable" };
  if (pref.adminId !== actorId) {
    return { success: false, error: "Vous ne pouvez retirer que vos propres appels." };
  }
  if (pref.appealStatus !== "pending") {
    return { success: false, error: "Aucun appel pending a retirer." };
  }

  await prisma.vacationPreference.update({
    where: { id: pref.id },
    data: {
      appealStatus: null,
      appealReason: null,
      appealedAt: null,
      appealReviewedBy: null,
      appealReviewedAt: null,
      appealReviewNotes: null,
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "vacation_preference_appeal",
    entityId: pref.id,
    changes: { withdrawn: true },
  });

  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}
