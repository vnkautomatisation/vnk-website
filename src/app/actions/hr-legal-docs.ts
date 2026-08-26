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
  return (isSuper || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write") || (perms.hr_documents ?? []).includes("write")) ? adminId : null;
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

  let doc: { id: number };
  if (parsed.data.id) {
    // Version AVANT update : si elle change, on relance automatiquement les
    // signataires des versions precedentes (parite avec les cahiers qui sont
    // versionnes nativement).
    const before = await prisma.legalDocumentTemplate.findUnique({
      where: { id: parsed.data.id },
      select: { version: true },
    });
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

    // ── Nouvelle version -> re-signature automatique ─────────────────
    // Les employes actifs ayant signe une version anterieure recoivent une
    // nouvelle demande individuelle (sauf demande pending deja existante)
    // + une notification. Sans ca, un bump de version reste invisible tant
    // que le RH ne renvoie pas des demandes a la main.
    if (before && before.version !== parsed.data.version) {
      try {
        const prevSigners = await prisma.legalDocumentSignature.findMany({
          where: { templateId: doc.id },
          select: { adminId: true },
          distinct: ["adminId"],
        });
        const signerIds = prevSigners.map((s) => s.adminId);
        if (signerIds.length > 0) {
          const active = await prisma.admin.findMany({
            where: { id: { in: signerIds }, isActive: true },
            select: { id: true },
          });
          const pending = await prisma.documentSignatureRequest.findMany({
            where: {
              templateId: doc.id,
              status: "pending",
              targetAdminId: { in: active.map((a) => a.id) },
            },
            select: { targetAdminId: true },
          });
          const pendingSet = new Set(
            pending.map((p) => p.targetAdminId).filter((x): x is number => x !== null),
          );
          const toCreate = active.map((a) => a.id).filter((id) => !pendingSet.has(id));
          if (toCreate.length > 0) {
            await prisma.documentSignatureRequest.createMany({
              data: toCreate.map((targetAdminId) => ({
                templateId: doc.id,
                requestedById: adminId,
                targetAdminId,
                reason: `Nouvelle version ${parsed.data.version} — re-signature requise`,
                status: "pending",
              })),
            });
            await Promise.all(
              toCreate.map((id) =>
                prisma.notification.create({
                  data: {
                    recipientType: "admin",
                    recipientId: id,
                    type: "warning",
                    title: "Document mis à jour — re-signature requise",
                    body: `« ${parsed.data.title} » est passé en version ${parsed.data.version}. Merci de le relire et le re-signer.`,
                    link: "/admin/mon-espace/documents",
                    icon: "file-signature",
                  },
                }).catch(() => null),
              ),
            );
          }
        }
      } catch (e) {
        // Best-effort : la mise a jour du template reste valide.
        console.error("[upsertLegalDocAction] Echec re-signature auto :", e);
      }
    }
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
  // Cap 2M chars (~1.5 Mo d'image) : evite un dataURL geant en DB/PDF.
  signatureData: z.string().max(2_000_000).optional().default(""),
  // États des cases obligatoires au moment de la signature.
  // Clé = index de la checkbox dans le markdown (string pour compat JSON).
  checkboxStates: z.record(z.string(), z.boolean()).optional(),
  // Valeurs des [CHAMP] que l'employe remplit lui-meme (numero membre OIQ/CPA,
  // permis...). Mergees avec les customFieldValues RH au moment du rendu.
  // Filtrees + echappees cote serveur (cf. signLegalDocAction).
  employeeFieldValues: z.record(z.string().max(120), z.string().max(500)).optional(),
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

  // Enforcement serveur : TOUTES les cases `- [ ]` du template doivent etre
  // cochees. L'UI le garantit deja, mais un appel direct a l'action pourrait
  // le contourner — un document legal signe avec des confirmations non
  // cochees n'a aucune valeur.
  const checkboxCount =
    (tpl.bodyMarkdown.match(/^\s*[-*]\s+\[[ xX]\]\s+.+$/gm) ?? []).length;
  if (checkboxCount > 0) {
    const states = parsed.data.checkboxStates ?? {};
    for (let i = 0; i < checkboxCount; i++) {
      if (states[String(i)] !== true) {
        return {
          success: false,
          error: "Toutes les confirmations doivent être cochées avant de signer",
        };
      }
    }
  }

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  const ua = h?.get("user-agent") ?? null;

  // Valeurs `[CHAMP]` remplies par l'employe lui-meme dans le wizard.
  // Filtre STRICT : seules les cles detectees fillBy="employee" dans le
  // template sont acceptees — sinon un appel direct pourrait ecraser les
  // valeurs RH (faits disciplinaires, contenu fill_X du manager).
  // Les valeurs sont echappees : rendues comme texte litteral dans le PDF,
  // aucune injection markdown/HTML possible. Persistees sur la signature
  // (fieldValues) pour que toute regeneration reproduise le PDF exact.
  const employeeFieldValues: Record<string, string> = {};
  if (parsed.data.employeeFieldValues) {
    const { detectPlaceholdersWithInfo, escapeUntrustedInlineValue } = await import(
      "@/lib/document-templates/placeholder-detector"
    );
    const allowedKeys = new Set(
      detectPlaceholdersWithInfo(tpl.bodyMarkdown)
        .filter((p) => p.fillBy === "employee")
        .map((p) => p.key),
    );
    for (const [k, v] of Object.entries(parsed.data.employeeFieldValues)) {
      if (!allowedKeys.has(k)) continue;
      const trimmed = typeof v === "string" ? v.trim() : "";
      if (trimmed.length > 0) {
        employeeFieldValues[k] = escapeUntrustedInlineValue(trimmed);
      }
    }
  }
  const fieldValuesForDb =
    Object.keys(employeeFieldValues).length > 0 ? employeeFieldValues : null;

  // Re-signature : si l'employe a deja signe cette version (le RH a renvoye
  // une demande pour la meme version pour corriger un detail, ou l'employe
  // veut re-signer suite a une mise a jour des champs), on REMPLACE la
  // signature existante au lieu de bloquer. Le PDF final est regenere
  // avec les nouvelles donnees, supprime l'ancien (cf. cleanup plus bas).
  const signature = await prisma.legalDocumentSignature.upsert({
    where: {
      templateId_adminId_version: {
        templateId: tpl.id,
        adminId,
        version: tpl.version,
      },
    },
    create: {
      templateId: tpl.id,
      adminId,
      version: tpl.version,
      signatureData: isReadingOnly ? null : parsed.data.signatureData,
      ipAddress: ip,
      userAgent: ua,
      checkboxStates: parsed.data.checkboxStates ?? undefined,
      // Cast : fieldValues peut ne pas etre dans le client Prisma genere
      // si le dev server n'a pas redemarre apres `prisma db push`.
      ...({ fieldValues: fieldValuesForDb } as object),
    },
    update: {
      signatureData: isReadingOnly ? null : parsed.data.signatureData,
      ipAddress: ip,
      userAgent: ua,
      checkboxStates: parsed.data.checkboxStates ?? undefined,
      signedAt: new Date(),
      // Reset finalPdfUrl : sera regenere par le bloc PDF plus bas
      finalPdfUrl: null,
      ...({ fieldValues: fieldValuesForDb } as object),
      // Re-signature : le document change -> la contresignature employeur
      // precedente n'est plus valide, on la reset.
      ...({
        employerSignatureData: null,
        employerSignedAt: null,
        employerSignedById: null,
      } as object),
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

    // (employeeFieldValues deja filtre + echappe plus haut, avant l'upsert.)

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
      const hrVals = (dsr?.customFieldValues as
        | Record<string, string>
        | null
        | undefined) ?? {};
      // Merge : valeurs employe ECRASENT celles RH (employe a la main sur ses
      // infos pro perso comme numero de membre)
      const mergedVals = { ...hrVals, ...employeeFieldValues };
      if (Object.keys(mergedVals).length > 0) {
        // Separe les fill_X (long form wizard) des placeholders {{...}}
        // classiques. Les fill_X sont injectes dans le context pour que le
        // renderer PDF les substitue aux `___` du markdown. Les {{...}}
        // sont substitues immediatement via applyPlaceholderValues.
        const fillVals: Record<string, string> = {};
        const placeholderVals: Record<string, string> = {};
        for (const [k, v] of Object.entries(mergedVals)) {
          if (/^fill_\d+$/.test(k)) fillVals[k] = v;
          else placeholderVals[k] = v;
        }
        if (Object.keys(placeholderVals).length > 0) {
          const { applyPlaceholderValues } = await import(
            "@/lib/document-templates/placeholder-detector"
          );
          bodyForPdf = applyPlaceholderValues(tpl.bodyMarkdown, placeholderVals);
        }
        // Injecte les fill_X directement dans le context pour auto-detection
        // par processMarkdownToHtml (etape 3-zero-A).
        if (Object.keys(fillVals).length > 0) {
          Object.assign(context, fillVals);
        }
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
      // Bloc Accuse final identique au preview wizard : Signatures + Accuse
      // cote a cote, case cochee, signature image embarquee si presente.
      acknowledgmentBlock: {
        acknowledged: true,
        employeeName: signerName || undefined,
      },
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
// applyDsrValuesForRender (helper interne, pas une action)
// Recupere les customFieldValues de la DSR la plus recente ciblant
// l'employe et les applique comme au moment de la signature :
//   - fill_X (long form) -> injectes dans le context (mutation)
//   - {{...}} / [CHAMP]  -> substitues dans le markdown retourne
// `overrideVals` (valeurs employe persistees sur la signature, deja
// echappees) ECRASENT les valeurs RH — meme regle qu'a la signature.
// Best-effort : retourne le markdown brut si echec.
// ─────────────────────────────────────────────────────────
async function applyDsrValuesForRender(
  templateId: number,
  adminId: number,
  bodyMarkdown: string,
  context: Record<string, string>,
  overrideVals?: Record<string, string> | null,
): Promise<string> {
  try {
    const me = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { teamId: true },
    });
    const dsr = await prisma.documentSignatureRequest.findFirst({
      where: {
        templateId,
        OR: [
          { targetAdminId: adminId },
          ...(me?.teamId ? [{ targetTeamId: me.teamId }] : []),
          { targetAll: true },
        ],
      },
      orderBy: { requestedAt: "desc" },
      select: { customFieldValues: true },
    });
    const hrVals = (dsr?.customFieldValues as
      | Record<string, string>
      | null
      | undefined) ?? {};
    const merged = { ...hrVals, ...(overrideVals ?? {}) };
    if (Object.keys(merged).length === 0) return bodyMarkdown;
    const fillVals: Record<string, string> = {};
    const placeholderVals: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (/^fill_\d+$/.test(k)) fillVals[k] = v;
      else placeholderVals[k] = v;
    }
    if (Object.keys(fillVals).length > 0) Object.assign(context, fillVals);
    if (Object.keys(placeholderVals).length > 0) {
      const { applyPlaceholderValues } = await import(
        "@/lib/document-templates/placeholder-detector"
      );
      return applyPlaceholderValues(bodyMarkdown, placeholderVals);
    }
    return bodyMarkdown;
  } catch {
    return bodyMarkdown;
  }
}

// ─────────────────────────────────────────────────────────
// rebuildFinalPdf (helper interne, pas une action)
// Reconstruit le PDF final d'une signature : contexte employe, valeurs RH
// (DSR) + valeurs employe persistees, cases cochees, signature employe,
// contresignature employeur si presente, bloc Accuse. Upload + persiste
// finalPdfUrl. Utilise par les deux actions de regeneration ET par la
// contresignature employeur — UNE seule source de verite pour le rendu.
// ─────────────────────────────────────────────────────────
async function rebuildFinalPdf(
  signatureId: number,
): Promise<{ ok: true; finalPdfUrl: string } | { ok: false; error: string }> {
  const sig = await prisma.legalDocumentSignature.findUnique({
    where: { id: signatureId },
    include: {
      // Template complet : acknowledgmentMode / signatureScope recuperes via
      // cast `as` (client Prisma possiblement pas regenere).
      template: true,
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!sig) return { ok: false, error: "Signature introuvable" };

  const ackMode =
    (sig.template as { acknowledgmentMode?: string }).acknowledgmentMode
    ?? "reading_only";
  const isReadingOnly = ackMode === "reading_only";
  if (!isReadingOnly && !sig.signatureData?.startsWith("data:image/")) {
    return { ok: false, error: "Donnees de signature corrompues" };
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
    const effectiveScope = isReadingOnly ? "none" : (tplScope ?? "employee_only");

    // Valeurs employe persistees a la signature (deja echappees).
    const storedVals =
      ((sig as unknown as { fieldValues?: Record<string, string> | null }).fieldValues)
      ?? null;
    const bodyForPdf = await applyDsrValuesForRender(
      sig.templateId,
      sig.adminId,
      sig.template.bodyMarkdown,
      context as Record<string, string>,
      storedVals,
    );

    // Contresignature employeur si presente.
    const emp = sig as unknown as {
      employerSignatureData?: string | null;
      employerSignedAt?: Date | string | null;
      employerSignedById?: number | null;
    };
    let employerBlock: { dataUrl: string; name: string; date: Date } | undefined;
    if (!isReadingOnly && emp.employerSignatureData?.startsWith("data:image/")) {
      let employerName = "VNK Automatisation Inc.";
      if (emp.employerSignedById) {
        const signer = await prisma.admin.findUnique({
          where: { id: emp.employerSignedById },
          select: { fullName: true, email: true },
        });
        employerName = (signer?.fullName ?? signer?.email ?? employerName).trim();
      }
      employerBlock = {
        dataUrl: emp.employerSignatureData,
        name: employerName,
        date: emp.employerSignedAt ? new Date(emp.employerSignedAt) : new Date(),
      };
    }

    const pdfBuffer = await renderTemplateHtmlToPdf({
      bodyMarkdown: bodyForPdf,
      context,
      title: sig.template.title,
      documentType: "legal",
      metadata: { version: sig.version, employeeName: signerName || undefined },
      signatures: isReadingOnly
        ? undefined
        : {
            employee: {
              dataUrl: sig.signatureData as string,
              name: signerName,
              date: sig.signedAt,
            },
            ...(employerBlock ? { employer: employerBlock } : {}),
          },
      checkboxStates: (sig.checkboxStates as Record<string, boolean> | null) ?? undefined,
      signatureScope: effectiveScope,
      acknowledgmentBlock: {
        acknowledged: true,
        employeeName: signerName || undefined,
      },
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
    return { ok: true, finalPdfUrl };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[rebuildFinalPdf] Echec :", {
      signatureId,
      templateKey: sig.template.key,
      message: errMsg,
    });
    return { ok: false, error: errMsg.slice(0, 120) };
  }
}

// ─────────────────────────────────────────────────────────
// regenerateSignedPdfAction — regeneration cote RH.
// ─────────────────────────────────────────────────────────
export async function regenerateSignedPdfAction(
  input: { signatureId: number },
): Promise<Result<{ finalPdfUrl: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const res = await rebuildFinalPdf(input.signatureId);
  if (!res.ok) return { success: false, error: res.error };

  await logAudit({
    adminId,
    action: "update",
    entityType: "legal_signature",
    entityId: input.signatureId,
    changes: { regenerated: true },
  });
  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true, data: { finalPdfUrl: res.finalPdfUrl } };
}

// ─────────────────────────────────────────────────────────
// regenerateMyOwnSignedPdfAction — l'employe regenere le PDF d'une de SES
// propres signatures (generation initiale echouee : finalPdfUrl null).
// ─────────────────────────────────────────────────────────
export async function regenerateMyOwnSignedPdfAction(
  input: { signatureId: number },
): Promise<Result<{ finalPdfUrl: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;

  const sig = await prisma.legalDocumentSignature.findUnique({
    where: { id: input.signatureId },
    select: { id: true, adminId: true },
  });
  if (!sig) return { success: false, error: "Signature introuvable" };
  if (sig.adminId !== adminId) {
    return { success: false, error: "Cette signature ne vous appartient pas" };
  }

  const res = await rebuildFinalPdf(input.signatureId);
  if (!res.ok) return { success: false, error: `Echec : ${res.error}` };

  await logAudit({
    adminId,
    action: "update",
    entityType: "legal_signature",
    entityId: sig.id,
    changes: { regenerated_by_employee: true },
  });
  revalidatePath("/admin/mon-espace/documents");
  return { success: true, data: { finalPdfUrl: res.finalPdfUrl } };
}

// ─────────────────────────────────────────────────────────
// employerSignLegalDocAction — contresignature EMPLOYEUR d'un document
// legal deja signe par l'employe. Reserve RH (requireHrWrite). Uniquement
// pour les templates avec signatureScope "both" ou "employer_only" en mode
// signature. Regenere le PDF final avec les DEUX signatures et notifie
// l'employe.
// ─────────────────────────────────────────────────────────
export async function employerSignLegalDocAction(
  input: { signatureId: number; signatureDataUrl: string },
): Promise<Result<{ finalPdfUrl: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };

  if (
    typeof input.signatureDataUrl !== "string"
    || !input.signatureDataUrl.startsWith("data:image/")
    || input.signatureDataUrl.length > 2_000_000
  ) {
    return { success: false, error: "Signature employeur invalide" };
  }

  const sig = await prisma.legalDocumentSignature.findUnique({
    where: { id: input.signatureId },
    include: {
      template: true,
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!sig) return { success: false, error: "Signature introuvable" };

  const ackMode =
    (sig.template as { acknowledgmentMode?: string }).acknowledgmentMode
    ?? "reading_only";
  if (ackMode === "reading_only") {
    return { success: false, error: "Document en accusé de lecture : pas de contresignature" };
  }
  const scope = (sig.template as { signatureScope?: string }).signatureScope;
  if (scope !== "both" && scope !== "employer_only") {
    return { success: false, error: "Ce document ne prévoit pas de signature employeur" };
  }

  // Org-chart rule: cannot counter-sign your OWN document (founder excepted).
  {
    const { selfApprovalError } = await import("@/lib/services/org-guard");
    const selfErr = await selfApprovalError(adminId, sig.adminId);
    if (selfErr) {
      return { success: false, error: "Vous ne pouvez pas contresigner votre propre document — seul votre supérieur peut le faire" };
    }
  }

  await prisma.legalDocumentSignature.update({
    where: { id: sig.id },
    data: {
      // Cast : colonnes possiblement absentes du client Prisma genere
      // (dev server pas redemarre apres `prisma db push`).
      ...({
        employerSignatureData: input.signatureDataUrl,
        employerSignedAt: new Date(),
        employerSignedById: adminId,
      } as object),
    },
  });

  const res = await rebuildFinalPdf(sig.id);
  if (!res.ok) {
    // La contresignature est enregistree meme si le PDF echoue (best-effort,
    // regenerable ensuite).
    console.error("[employerSignLegalDocAction] PDF non regenere :", res.error);
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "legal_signature",
    entityId: sig.id,
    changes: { employer_signed: true, by: adminId },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: sig.adminId,
      type: "success",
      title: "Document contresigné",
      body: `« ${sig.template.title} » a été contresigné par l'employeur. Le PDF final est à jour.`,
      link: "/admin/mon-espace/documents",
      icon: "file-check",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/documents");
  revalidatePath("/admin/mon-espace/documents");
  return res.ok
    ? { success: true, data: { finalPdfUrl: res.finalPdfUrl } }
    : { success: false, error: `Contresignature enregistrée, PDF à régénérer (${res.error})` };
}
