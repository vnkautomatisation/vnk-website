"use server";
// Actions DocumentUploadRequest — workflow demande/réponse de téléversement.
// Un admin RH (ou manager direct) crée une demande "Téléverse ton permis classe 5"
// ciblant un employé. L'employé voit la demande pending dans Mon espace, uploade
// le fichier (la demande passe en "uploaded"), puis le RH valide ou rejette.
// Si validé : crée un EmployeePersonalDocument officiel rattaché à la demande.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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
    || (perms.hr ?? []).includes("write");
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
    || (perms.hr ?? []).includes("write");
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
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const guard = await requireRequesterAccess(parsed.data.targetAdminId);
  if (!guard) return { success: false, error: "Non autorisé" };

  const target = await prisma.admin.findUnique({
    where: { id: parsed.data.targetAdminId },
    select: { id: true, isActive: true, fullName: true, email: true },
  });
  if (!target || !target.isActive) {
    return { success: false, error: "Employé introuvable ou inactif" };
  }

  const dueDate = parseDateOnly(parsed.data.dueDate ?? null);
  if (dueDate && dueDate.getTime() < Date.now() - 24 * 3600 * 1000) {
    return { success: false, error: "L'échéance ne peut pas être dans le passé" };
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
        title: "Document demandé",
        body:
          parsed.data.title
          + (parsed.data.description ? ` — ${parsed.data.description}` : "")
          + (dueDate ? ` (avant le ${dueDate.toLocaleDateString("fr-CA")})` : ""),
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
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, targetAdminId: true, status: true, title: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };

  const guard = await requireRequesterAccess(req.targetAdminId);
  if (!guard) return { success: false, error: "Non autorisé" };

  if (req.status === "approved" || req.status === "cancelled") {
    return { success: false, error: "Demande déjà clôturée" };
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
        title: "Demande annulée",
        body: `La demande « ${req.title} » a été annulée.`,
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
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, targetAdminId: true, status: true, title: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") {
    return { success: false, error: "La demande n'est plus en attente" };
  }

  const guard = await requireRequesterAccess(req.targetAdminId);
  if (!guard) return { success: false, error: "Non autorisé" };

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
        title: "Rappel : document à téléverser",
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
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };
  const parsed = approveSchema.safeParse(opts);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const guard = await requireHrWrite();
  if (!guard) return { success: false, error: "Non autorisé" };

  const req = await prisma.documentUploadRequest.findUnique({ where: { id } });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "uploaded") {
    return { success: false, error: "Le fichier n'a pas encore été téléversé" };
  }
  if (!req.fileUrl) {
    return { success: false, error: "Fichier manquant" };
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
        title: "Document approuvé",
        body: `Le document « ${req.title} » a été validé par les RH.`,
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
  notes: z.string().min(1, "Le motif est requis").max(1000),
});

export async function rejectUploadRequestAction(
  id: number,
  notes: string,
): Promise<Result> {
  if (!Number.isFinite(id)) return { success: false, error: "ID invalide" };
  const parsed = rejectSchema.safeParse({ notes });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const guard = await requireHrWrite();
  if (!guard) return { success: false, error: "Non autorisé" };

  const req = await prisma.documentUploadRequest.findUnique({
    where: { id },
    select: { id: true, status: true, title: true, targetAdminId: true },
  });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "uploaded") {
    return { success: false, error: "Le fichier n'a pas encore été téléversé" };
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
        title: "Document refusé",
        body: `« ${req.title} » : ${parsed.data.notes}. Veuillez en téléverser un nouveau.`,
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
  try {
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) {
      console.error("[submitUploadResponseAction] Zod fail:", parsed.error.errors);
      return { success: false, error: parsed.error.errors[0].message };
    }

    const guard = await requireSelf(parsed.data.requestId);
    if (!guard) return { success: false, error: "Non autorisé" };

    if (guard.request.status !== "pending") {
      return { success: false, error: "La demande n'accepte plus de téléversement" };
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
            title: "Document téléversé",
            body: `${empName} a téléversé « ${reqWithRequester.title} ». À valider.`,
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
      error: err instanceof Error ? err.message : "Erreur serveur lors du téléversement",
    };
  }
}

// Catégories déplacées vers `@/lib/document-requests/categories` pour pouvoir être
// importées côté client (un fichier "use server" ne peut exporter que des fonctions async).
