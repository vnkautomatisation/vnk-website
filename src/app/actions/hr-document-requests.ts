"use server";
// Actions DocumentUploadRequest — workflow demande/réponse de téléversement.
// Un admin RH (ou manager direct) crée une demande "Téléverse ton permis classe 5"
// ciblant un employé. L'employé voit la demande pending dans Mon espace, uploade
// le fichier (la demande passe en "uploaded"), puis le RH valide ou rejette.
// Si validé : crée un EmployeePersonalDocument officiel rattaché à la demande.
import { z } from "zod";
import { getTranslations, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

type Result<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

const CATEGORIES = [
  "licence",
  "diploma",
  "certification",
  "id_card",
  "passport",
  "medical",
  "other",
] as const;

type Category = (typeof CATEGORIES)[number];

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// ─── Permission helpers ─────────────────────────────────────────
// Un admin RH OU le manager direct du targetAdmin peut créer/annuler/relancer.
async function requireRequesterAccess(
  targetAdminId: number,
): Promise<{ actorId: number; isHr: boolean; isSuper: boolean; isManager: boolean } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const actorId = session.user.adminId!;
  const [me, target] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: actorId },
      include: { customRole: true },
    }),
    prisma.admin.findUnique({
      where: { id: targetAdminId },
      select: { id: true, managerId: true },
    }),
  ]);
  if (!me || !target) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.hr_documents ?? []).includes("write");
  const isManager = target.managerId === actorId;
  if (!isHr && !isManager) return null;
  return { actorId, isHr, isSuper, isManager };
}

// Validation finale réservée aux RH (les managers ne valident pas).
async function requireHrWrite(): Promise<{ actorId: number; isSuper: boolean } | null> {
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
    || (perms.hr ?? []).includes("write")
    || (perms.hr_documents ?? []).includes("write");
  if (!isHr) return null;
  return { actorId, isSuper };
}

// Employé courant — pour le submit côté employé.
async function requireSelf(requestId: number): Promise<
  | { actorId: number; request: { id: number; targetAdminId: number; status: string; title: string } }
  | null
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const actorId = session.user.adminId!;
  const req = await prisma.documentUploadRequest.findUnique({
    where: { id: requestId },
    select: { id: true, targetAdminId: true, status: true, title: true },
  });
  if (!req) return null;
  if (req.targetAdminId !== actorId) return null;
  return { actorId, request: req };
}

// ─── createUploadRequestAction ─────────────────────────────────
const createSchema = z.object({
  targetAdminId: z.number().int(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(CATEGORIES),
  dueDate: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
});

export async function createUploadRequestAction(
  input: z.infer<typeof createSchema>,
): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const dateTag = dateLocale(await getLocale());
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const guard = await requireRequesterAccess(parsed.data.targetAdminId);
  if (!guard) return unauthorized();

  const target = await prisma.admin.findUnique({
    where: { id: parsed.data.targetAdminId },
    select: { id: true, isActive: true, fullName: true, email: true },
  });
  if (!target || !target.isActive) {
    return { success: false, error: t("employe_introuvable_ou_inactif") };
  }

  const dueDate = parseDateOnly(parsed.data.dueDate ?? null);
  if (dueDate && dueDate.getTime() < Date.now() - 24 * 3600 * 1000) {
    return { success: false, error: t("l_echeance_ne_peut_pas_etre_dans") };
  }

  const row = await prisma.documentUploadRequest.create({
    data: {
      targetAdminId: parsed.data.targetAdminId,
      requestedById: guard.actorId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      category: parsed.data.category,
      dueDate,
      isRequired: parsed.data.isRequired ?? true,
      status: "pending",
    },
    select: { id: true },
  });

  await logAudit({
    adminId: guard.actorId,
    action: "create",
    entityType: "document_upload_request",
    entityId: row.id,
    changes: {
      targetAdminId: parsed.data.targetAdminId,
      title: parsed.data.title,
      category: parsed.data.category,
    },
  });

  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: parsed.data.targetAdminId,
        type: "warning",
        title: t("document_demande"),
        body:
          parsed.data.title
          + (parsed.data.description ? ` — ${parsed.data.description}` : "")
          + (dueDate ? t("hr_document_requests_avant_le_p0", { p0: dueDate.toLocaleDateString(dateTag) }) : ""),
        link: "/admin/mon-espace/documents",
        icon: "file-text",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true, data: { id: row.id } };
}

// ─── cancelUploadRequestAction ─────────────────────────────────
export async function cancelUploadRequestAction(id: number): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, targetAdminId: true, status: true, title: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };

  const guard = await requireRequesterAccess(req.targetAdminId);
  if (!guard) return unauthorized();

  if (req.status === "approved" || req.status === "cancelled") {
    return { success: false, error: t("demande_deja_cloturee") };
  }

  await prisma.documentUploadRequest.update({
    where: { id },
    data: { status: "cancelled" },
  });

  await logAudit({
    adminId: guard.actorId,
    action: "update",
    entityType: "document_upload_request",
    entityId: id,
    changes: { status: "cancelled", previousStatus: req.status },
  });

  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: req.targetAdminId,
        type: "info",
        title: t("demande_annulee"),
        body: t("hr_document_requests_la_demande_p0_a_ete_annulee", { p0: req.title }),
        link: "/admin/mon-espace/documents",
        icon: "x-circle",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true };
}

// ─── remindUploadRequestAction ─────────────────────────────────
export async function remindUploadRequestAction(id: number): Promise<Result<{ notified: number }>> {
  const t = await getTranslations("admin.action_errors");
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, targetAdminId: true, status: true, title: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") {
    return { success: false, error: t("la_demande_n_est_plus_en_attente") };
  }

  const guard = await requireRequesterAccess(req.targetAdminId);
  if (!guard) return unauthorized();

  await prisma.documentUploadRequest.update({
    where: { id },
    data: {
      remindersSent: { increment: 1 },
      lastReminderAt: new Date(),
    },
  });

  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: req.targetAdminId,
        type: "warning",
        title: t("rappel_document_a_televerser"),
        body: req.title,
        link: "/admin/mon-espace/documents",
        icon: "bell",
      },
    })
    .catch(() => null);

  await logAudit({
    adminId: guard.actorId,
    action: "update",
    entityType: "document_upload_request",
    entityId: id,
    changes: { reminded: true },
  });

  revalidatePath("/admin/employes/documents");
  return { success: true, data: { notified: 1 } };
}

// ─── approveUploadRequestAction ───────────────────────────────
const approveSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  alsoCreatePersonalDoc: z.boolean().optional(),
});

export async function approveUploadRequestAction(
  id: number,
  opts: z.infer<typeof approveSchema> = {},
): Promise<Result<{ personalDocId: number | null }>> {
  const t = await getTranslations("admin.action_errors");
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };
  const parsed = approveSchema.safeParse(opts);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const guard = await requireHrWrite();
  if (!guard) return unauthorized();

  const req = await prisma.documentUploadRequest.findUnique({ where: { id } });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "uploaded") {
    return { success: false, error: t("le_fichier_n_a_pas_encore_ete") };
  }
  if (!req.fileUrl) {
    return { success: false, error: "Fichier manquant" };
  }
  // Org-chart rule: an HR admin cannot approve an upload that targets
  // THEMSELVES — only their superior can (founder excepted).
  {
    const { selfApprovalError } = await import("@/lib/services/org-guard");
    const selfErr = await selfApprovalError(guard.actorId, req.targetAdminId);
    if (selfErr) return { success: false, error: selfErr };
  }

  // Création optionnelle du EmployeePersonalDocument officiel (par défaut oui).
  const alsoCreate = parsed.data.alsoCreatePersonalDoc ?? true;
  let personalDocId: number | null = null;
  if (alsoCreate) {
    const pdoc = await prisma.employeePersonalDocument.create({
      data: {
        adminId: req.targetAdminId,
        category: req.category,
        title: req.title,
        description: req.description,
        fileUrl: req.fileUrl,
        fileName: req.fileName,
        fileSize: req.fileSize,
        fileMimeType: req.fileMimeType,
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByAdminId: guard.actorId,
        verificationNotes: parsed.data.notes ?? null,
        isPrivate: false,
      },
      select: { id: true },
    });
    personalDocId = pdoc.id;
  }

  await prisma.documentUploadRequest.update({
    where: { id },
    data: {
      status: "approved",
      reviewedById: guard.actorId,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.notes ?? null,
      personalDocumentId: personalDocId,
    },
  });

  await logAudit({
    adminId: guard.actorId,
    action: "update",
    entityType: "document_upload_request",
    entityId: id,
    changes: {
      status: "approved",
      personalDocId,
      targetAdminId: req.targetAdminId,
    },
  });

  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: req.targetAdminId,
        type: "success",
        title: t("document_approuve"),
        body: t("hr_document_requests_le_document_p0_a_ete_valide_par_les", { p0: req.title }),
        link: "/admin/mon-espace/documents",
        icon: "check-circle",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true, data: { personalDocId } };
}

// ─── rejectUploadRequestAction ────────────────────────────────
const rejectSchema = z.object({
  notes: z.string().min(1, "le_motif_est_requis").max(1000),
});

export async function rejectUploadRequestAction(
  id: number,
  notes: string,
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };
  const parsed = rejectSchema.safeParse({ notes });
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const guard = await requireHrWrite();
  if (!guard) return unauthorized();

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, status: true, title: true, targetAdminId: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "uploaded") {
    return { success: false, error: t("le_fichier_n_a_pas_encore_ete") };
  }
  // Org-chart rule: cannot review an upload that targets yourself.
  {
    const { selfApprovalError } = await import("@/lib/services/org-guard");
    const selfErr = await selfApprovalError(guard.actorId, req.targetAdminId);
    if (selfErr) return { success: false, error: selfErr };
  }

  // On repasse la demande en "pending" pour que l'employé puisse re-téléverser,
  // en effaçant les infos fichier. Status final "rejected" archive le refus.
  await prisma.documentUploadRequest.update({
    where: { id },
    data: {
      status: "pending",
      fileUrl: null,
      fileName: null,
      fileSize: null,
      fileMimeType: null,
      uploadedAt: null,
      reviewedById: guard.actorId,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.notes,
    },
  });

  await logAudit({
    adminId: guard.actorId,
    action: "update",
    entityType: "document_upload_request",
    entityId: id,
    changes: {
      status: "rejected",
      targetAdminId: req.targetAdminId,
      notes: parsed.data.notes,
    },
  });

  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: req.targetAdminId,
        type: "error",
        title: t("document_refuse"),
        body: t("hr_document_requests_p0_p1_veuillez_en_televerser_un_nouveau", { p0: req.title, p1: parsed.data.notes }),
        link: "/admin/mon-espace/documents",
        icon: "x-circle",
      },
    })
    .catch(() => null);

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true };
}

// ─── submitUploadResponseAction (employé) ─────────────────────
// Appelée par l'endpoint POST /api/admin/document-upload-requests/[id]/upload
// après upload du fichier. Marque la demande comme "uploaded".
const submitSchema = z.object({
  requestId: z.number().int(),
  // ⚠️ En mode STORAGE_BACKEND=local, fileUrl est une data URL base64. Pour 10 Mo
  // de PDF, la dataUrl dépasse 13 Mo (base64 inflate ~33 %). On laisse une marge.
  fileUrl: z.string().min(1).max(20_000_000),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0),
  fileMimeType: z.string().min(1).max(120),
});

export async function submitUploadResponseAction(
  input: z.infer<typeof submitSchema>,
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  try {
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) {
      console.error("[submitUploadResponseAction] Zod fail:", parsed.error.errors);
      return { success: false, error: t(parsed.error.errors[0].message) };
    }

    const guard = await requireSelf(parsed.data.requestId);
    if (!guard) return unauthorized();

    if (guard.request.status !== "pending") {
      return { success: false, error: t("la_demande_n_accepte_plus_de_televersement") };
    }

    await prisma.documentUploadRequest.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "uploaded",
        uploadedAt: new Date(),
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        fileMimeType: parsed.data.fileMimeType,
      },
    });

    await logAudit({
      adminId: guard.actorId,
      action: "update",
      entityType: "document_upload_request",
      entityId: parsed.data.requestId,
      changes: { status: "uploaded", fileName: parsed.data.fileName },
    }).catch((e) => console.error("[submitUploadResponseAction] audit fail:", e));

    // Notifier le demandeur initial (toleratoire)
    try {
      const reqWithRequester = await prisma.documentUploadRequest.findUnique({
        where: { id: parsed.data.requestId },
        select: {
          requestedById: true,
          title: true,
          targetAdmin: { select: { fullName: true, email: true } },
        },
      });
      if (reqWithRequester) {
        const empName =
          reqWithRequester.targetAdmin.fullName ?? reqWithRequester.targetAdmin.email;
        await prisma.notification.create({
          data: {
            recipientType: "admin",
            recipientId: reqWithRequester.requestedById,
            type: "info",
            title: t("document_televerse"),
            body: t("hr_document_requests_p0_a_televerse_p1_a_valider", { p0: empName, p1: reqWithRequester.title }),
            link: "/admin/employes/documents",
            icon: "upload",
          },
        });
      }
    } catch (notifErr) {
      console.error("[submitUploadResponseAction] notification fail:", notifErr);
      // on continue, ce n'est pas critique
    }

    // Revalidation tolérante (Next 15 peut throw "Invalid URL" si appelé hors contexte serveur)
    try {
      revalidatePath("/admin/employes/documents");
      revalidatePath("/admin/mon-espace/documents");
    } catch (revErr) {
      console.error("[submitUploadResponseAction] revalidatePath fail:", revErr);
    }
    return { success: true };
  } catch (err) {
    console.error("[submitUploadResponseAction] UNEXPECTED:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : t("erreur_serveur_televersement"),
    };
  }
}

// Catégories déplacées vers `@/lib/document-requests/categories` pour pouvoir être
// importées côté client (un fichier "use server" ne peut exporter que des fonctions async).
