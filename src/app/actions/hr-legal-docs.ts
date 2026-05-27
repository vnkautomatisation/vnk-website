"use server";
// Actions documents légaux (NDA, code conduite, etc.) + signatures employés.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getClientIpFromHeaders } from "@/lib/security/rate-limit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.users ?? []).includes("write")) ? adminId : null;
}

const docSchema = z.object({
  key: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "Clé : a-z, 0-9, _"),
  title: z.string().min(1).max(160),
  category: z.enum(["policy", "nda", "acknowledgment"]).default("policy"),
  version: z.string().min(1).max(20),
  bodyMarkdown: z.string().min(20),
  isRequired: z.boolean().default(true),
  targetPositions: z.array(z.string()).optional(),
  targetDepartments: z.array(z.string()).optional(),
  signatureScope: z
    .enum(["employee_only", "employer_only", "both", "none"])
    .optional()
    .default("employee_only"),
  acknowledgmentMode: z
    .enum(["reading_only", "signature"])
    .optional()
    .default("reading_only"),
});

export async function upsertLegalDocAction(input: z.infer<typeof docSchema> & { id?: number }): Promise<Result<{ id: number }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = docSchema.extend({ id: z.number().int().optional() }).safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Si reading_only, on force scope = "none" (pas de bloc signature en PDF)
  const effectiveScope =
    parsed.data.acknowledgmentMode === "reading_only"
      ? "none"
      : parsed.data.signatureScope;

  let doc;
  if (parsed.data.id) {
    doc = await prisma.legalDocumentTemplate.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        version: parsed.data.version,
        bodyMarkdown: parsed.data.bodyMarkdown,
        isRequired: parsed.data.isRequired,
        signatureScope: effectiveScope,
        // Cast : acknowledgmentMode peut ne pas etre dans le type Prisma genere si dev server pas restart
        ...({ acknowledgmentMode: parsed.data.acknowledgmentMode } as object),
        ...(parsed.data.targetPositions !== undefined ? { targetPositions: parsed.data.targetPositions } : {}),
        ...(parsed.data.targetDepartments !== undefined ? { targetDepartments: parsed.data.targetDepartments } : {}),
      },
      select: { id: true },
    });
  } else {
    doc = await prisma.legalDocumentTemplate.create({
      data: {
        key: parsed.data.key,
        title: parsed.data.title,
        category: parsed.data.category,
        version: parsed.data.version,
        bodyMarkdown: parsed.data.bodyMarkdown,
        isRequired: parsed.data.isRequired,
        signatureScope: effectiveScope,
        // Cast (idem update)
        ...({ acknowledgmentMode: parsed.data.acknowledgmentMode } as object),
        targetPositions: parsed.data.targetPositions ?? [],
        targetDepartments: parsed.data.targetDepartments ?? [],
      },
      select: { id: true },
    });

    // Notifier tous les admins actifs qu'un nouveau document obligatoire est à signer
    if (parsed.data.isRequired) {
      const activeAdmins = await prisma.admin.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      await Promise.all(
        activeAdmins.map((a) =>
          prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: a.id,
              type: "warning",
              title: "Nouveau document à signer",
              body: parsed.data.title,
              link: "/admin/mon-espace/documents",
              icon: "file-signature",
            },
          }).catch(() => null),
        ),
      );
    }
  }
  await logAudit({ adminId, action: parsed.data.id ? "update" : "create", entityType: "legal_doc", entityId: doc.id });
  revalidatePath("/admin/employes/documents");
  return { success: true, data: { id: doc.id } };
}

// Duplique un template legal : copie avec suffix " (copie)" + isStarter = false
export async function duplicateLegalDocTemplateAction(input: { id: number }): Promise<Result<{ id: number; title: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const src = await prisma.legalDocumentTemplate.findUnique({ where: { id: input.id } });
  if (!src) return { success: false, error: "Modèle introuvable" };

  // Trouver une clé unique : key_copy, key_copy_2, …
  const baseKey = `${src.key}_copy`;
  let newKey = baseKey;
  let n = 2;
  while (await prisma.legalDocumentTemplate.findUnique({ where: { key: newKey }, select: { id: true } })) {
    newKey = `${baseKey}_${n++}`;
    if (n > 50) return { success: false, error: "Trop de copies existantes" };
  }

  const newTitle = `${src.title} (copie)`;
  const copy = await prisma.legalDocumentTemplate.create({
    data: {
      key: newKey,
      title: newTitle,
      category: src.category,
      version: src.version,
      bodyMarkdown: src.bodyMarkdown,
      isRequired: src.isRequired,
      isActive: true,
      targetPositions: src.targetPositions,
      targetDepartments: src.targetDepartments,
      variables: src.variables ?? undefined,
      isStarter: false,
    },
    select: { id: true, title: true },
  });

  await logAudit({ adminId, action: "create", entityType: "legal_doc", entityId: copy.id, changes: { duplicatedFrom: src.id } });
  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/employes/documents/bibliotheque");
  return { success: true, data: { id: copy.id, title: copy.title } };
}

// Archive / desarchive un template legal (toggle isActive)
export async function toggleLegalDocActiveAction(input: { id: number; isActive: boolean }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.legalDocumentTemplate.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  });
  await logAudit({ adminId, action: "update", entityType: "legal_doc", entityId: input.id, changes: { isActive: input.isActive } });
  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/employes/documents/bibliotheque");
  return { success: true };
}

export async function deleteLegalDocAction(input: { id: number }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const used = await prisma.legalDocumentSignature.count({ where: { templateId: input.id } });
  if (used > 0) {
    await prisma.legalDocumentTemplate.update({ where: { id: input.id }, data: { isActive: false } });
  } else {
    await prisma.legalDocumentTemplate.delete({ where: { id: input.id } });
  }
  await logAudit({ adminId, action: "delete", entityType: "legal_doc", entityId: input.id });
  revalidatePath("/admin/employes/documents");
  return { success: true };
}

// Signature par l'employé connecté
const signSchema = z.object({
  templateId: z.number().int().positive(),
  // signatureData peut etre vide en mode reading_only (juste un accusé de lecture).
  // En mode signature, on exige une dataURL image valide (verifie plus bas).
  signatureData: z.string().optional().default(""),
  // États des cases obligatoires au moment de la signature.
  // Clé = index de la checkbox dans le markdown (string pour compat JSON).
  checkboxStates: z.record(z.string(), z.boolean()).optional(),
});

export async function signLegalDocAction(
  input: z.infer<typeof signSchema>,
): Promise<Result> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const tpl = await prisma.legalDocumentTemplate.findUnique({ where: { id: parsed.data.templateId } });
  if (!tpl || !tpl.isActive) return { success: false, error: "Document introuvable" };

  // Mode reading_only : signatureData peut etre vide. Mode signature : requis.
  const tplAckMode =
    (tpl as { acknowledgmentMode?: string }).acknowledgmentMode ??
    "reading_only";
  const isReadingOnly = tplAckMode === "reading_only";
  if (!isReadingOnly) {
    if (!parsed.data.signatureData?.startsWith("data:image/")) {
      return { success: false, error: "Signature invalide" };
    }
  }

  const already = await prisma.legalDocumentSignature.findUnique({
    where: { templateId_adminId_version: { templateId: tpl.id, adminId, version: tpl.version } },
  });
  if (already) return { success: false, error: "Déjà signé pour cette version" };

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  const ua = h?.get("user-agent") ?? null;

  const signature = await prisma.legalDocumentSignature.create({
    data: {
      templateId: tpl.id,
      adminId,
      version: tpl.version,
      // Mode reading_only : on stocke null (pas de signature image).
      signatureData: isReadingOnly ? null : parsed.data.signatureData,
      ipAddress: ip,
      userAgent: ua,
      // Stocke l'état des cases au moment de la signature (audit / re-render PDF)
      checkboxStates: parsed.data.checkboxStates ?? undefined,
    },
    select: { id: true, signedAt: true },
  });
  await logAudit({ adminId, action: "create", entityType: "legal_signature", entityId: tpl.id, changes: { key: tpl.key, version: tpl.version } });

  // Marque automatiquement les DocumentSignatureRequest pending visant cet
  // employé comme "completed". Import dynamique pour éviter cycle.
  try {
    const { markSignatureRequestCompleteAction } = await import("./hr-signature-requests");
    await markSignatureRequestCompleteAction({ templateId: tpl.id, signerAdminId: adminId });
  } catch {
    // Ne jamais bloquer la signature à cause de ce cleanup
  }

  // ─── Génération du PDF final signé (best-effort) ───────────────
  // La signature en DB est déjà enregistrée : si la génération échoue,
  // on logue et on continue (le PDF restera disponible via génération
  // à la volée). On ne laisse JAMAIS une erreur PDF bloquer la signature.
  try {
    const [me, { renderTemplateHtmlToPdf }, { buildContextFromEmployee }, { uploadBuffer }] = await Promise.all([
      prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, email: true } }),
      import("@/lib/services/pdf-html-renderer"),
      import("@/lib/document-templates/employee-context"),
      import("@/lib/storage/object-storage"),
    ]);

    const context = await buildContextFromEmployee(adminId).catch(() => ({}));
    const signerName = (me?.fullName ?? me?.email ?? "").trim();

    // Recupere le scope de signature du template (employee_only par defaut)
    const tplScope = (tpl as { signatureScope?: string }).signatureScope as
      | "employee_only"
      | "employer_only"
      | "both"
      | "none"
      | undefined;

    // Recherche une demande de signature recente (pending OU completed dans
    // la meme transaction) avec des customFieldValues a substituer dans le
    // markdown. On prend la plus recente qui cible cet employe individuel.
    let bodyForPdf = tpl.bodyMarkdown;
    try {
      const me2 = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { teamId: true },
      });
      const dsr = await prisma.documentSignatureRequest.findFirst({
        where: {
          templateId: tpl.id,
          OR: [
            { targetAdminId: adminId },
            ...(me2?.teamId ? [{ targetTeamId: me2.teamId }] : []),
            { targetAll: true },
          ],
        },
        orderBy: { requestedAt: "desc" },
        select: { customFieldValues: true },
      });
      const vals = dsr?.customFieldValues as
        | Record<string, string>
        | null
        | undefined;
      if (vals && Object.keys(vals).length > 0) {
        const { applyPlaceholderValues } = await import(
          "@/lib/document-templates/placeholder-detector"
        );
        bodyForPdf = applyPlaceholderValues(tpl.bodyMarkdown, vals);
      }
    } catch {
      /* best-effort : si echec, on rend avec le markdown brut */
    }

    // En mode reading_only, force scope = "none" + omet la signature image,
    // pour que le PDF final n'ait AUCUN bloc signature en bas.
    const effectiveScopeForPdf = isReadingOnly ? "none" : (tplScope ?? "employee_only");

    const pdfBuffer = await renderTemplateHtmlToPdf({
      bodyMarkdown: bodyForPdf,
      context,
      title: tpl.title,
      documentType: "legal",
      metadata: { version: tpl.version, employeeName: signerName || undefined },
      signatures: isReadingOnly
        ? undefined
        : {
            employee: {
              dataUrl: parsed.data.signatureData,
              name: signerName,
              date: signature.signedAt,
            },
          },
      checkboxStates: parsed.data.checkboxStates,
      signatureScope: effectiveScopeForPdf,
    });

    const upload = await uploadBuffer({
      buffer: pdfBuffer,
      mime: "application/pdf",
      keyBase: `legal-signatures/${tpl.key}-${adminId}-v${tpl.version.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      ext: "pdf",
    });
    const finalPdfUrl = upload.kind === "remote" ? upload.url : upload.dataUrl;

    await prisma.legalDocumentSignature.update({
      where: { id: signature.id },
      data: { finalPdfUrl },
    });

    // Notifie l'employé que son PDF signé est disponible
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: adminId,
        type: "success",
        title: "Document signé",
        body: `Votre signature de « ${tpl.title} » est enregistrée. Le PDF final est disponible.`,
        link: "/admin/mon-espace/documents",
        icon: "file-check",
      },
    }).catch(() => null);
  } catch (e) {
    // Log uniquement : la signature reste valide même sans PDF final.
    console.error("[signLegalDocAction] Echec generation PDF final :", e);
  }

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true };
}

// ─────────────────────────────────────────────────────────
// regenerateSignedPdfAction
// Régénère le PDF final d'une signature existante (utile si la
// génération initiale a échoué ou si l'URL est cassée). Côté RH
// uniquement. Renvoie l'URL finale persistée.
// ─────────────────────────────────────────────────────────
export async function regenerateSignedPdfAction(
  input: { signatureId: number },
): Promise<Result<{ finalPdfUrl: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const sig = await prisma.legalDocumentSignature.findUnique({
    where: { id: input.signatureId },
    include: {
      // Charge le template complet : acknowledgmentMode peut ne pas etre dans
      // les types Prisma generes si le dev server n'a pas redemarre. On le
      // recupere via cast `as` plus bas.
      template: true,
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!sig) return { success: false, error: "Signature introuvable" };
  const sigTplAckMode =
    (sig.template as { acknowledgmentMode?: string }).acknowledgmentMode ??
    "reading_only";
  const sigIsReadingOnly = sigTplAckMode === "reading_only";
  // En mode signature, on exige une dataURL valide pour regenerer.
  // En reading_only, signatureData peut etre null (juste accuse de lecture).
  if (!sigIsReadingOnly && !sig.signatureData?.startsWith("data:image/")) {
    return { success: false, error: "Données de signature corrompues" };
  }

  try {
    const [{ renderTemplateHtmlToPdf }, { buildContextFromEmployee }, { uploadBuffer }] =
      await Promise.all([
        import("@/lib/services/pdf-html-renderer"),
        import("@/lib/document-templates/employee-context"),
        import("@/lib/storage/object-storage"),
      ]);

    const context = await buildContextFromEmployee(sig.adminId).catch(() => ({}));
    const signerName = (sig.admin.fullName ?? sig.admin.email ?? "").trim();

    const tplScope = (sig.template as { signatureScope?: string }).signatureScope as
      | "employee_only"
      | "employer_only"
      | "both"
      | "none"
      | undefined;

    const effectiveScopeForPdf = sigIsReadingOnly ? "none" : (tplScope ?? "employee_only");

    const pdfBuffer = await renderTemplateHtmlToPdf({
      bodyMarkdown: sig.template.bodyMarkdown,
      context,
      title: sig.template.title,
      documentType: "legal",
      metadata: { version: sig.version, employeeName: signerName || undefined },
      signatures: sigIsReadingOnly
        ? undefined
        : {
            employee: {
              dataUrl: sig.signatureData as string,
              name: signerName,
              date: sig.signedAt,
            },
          },
      checkboxStates: (sig.checkboxStates as Record<string, boolean> | null) ?? undefined,
      signatureScope: effectiveScopeForPdf,
    });

    const upload = await uploadBuffer({
      buffer: pdfBuffer,
      mime: "application/pdf",
      keyBase: `legal-signatures/${sig.template.key}-${sig.adminId}-v${sig.version.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      ext: "pdf",
    });
    const finalPdfUrl = upload.kind === "remote" ? upload.url : upload.dataUrl;

    await prisma.legalDocumentSignature.update({
      where: { id: sig.id },
      data: { finalPdfUrl },
    });
    await logAudit({
      adminId,
      action: "update",
      entityType: "legal_signature",
      entityId: sig.id,
      changes: { regenerated: true, version: sig.version },
    });

    revalidatePath("/admin/employes/documents");
    revalidatePath("/admin/mon-espace/documents");
    return { success: true, data: { finalPdfUrl } };
  } catch (e) {
    console.error("[regenerateSignedPdfAction] Echec :", e);
    return { success: false, error: "Échec de la régénération du PDF" };
  }
}
