"use server";
// ─────────────────────────────────────────────────────────
// hr-document-handbooks.ts — actions serveur "cahier employe".
//
// Un Handbook regroupe N LegalDocumentTemplate en un livre signe en
// une seule fois. Workflow :
//   1. RH cree le cahier (createHandbookAction) avec une liste de
//      templates ordonnes.
//   2. RH peut modifier (updateHandbookAction) ou archiver
//      (archiveHandbookAction).
//   3. L'employe signe (signHandbookAction) : on stocke la
//      signature + checkboxes + IP + UA, et on genere le PDF final.
//
// Les templates inclus dans un cahier signe ne doivent plus apparaitre
// dans la liste "a signer" de l'employe (filtre cote page.tsx).
// ─────────────────────────────────────────────────────────
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getClientIpFromHeaders } from "@/lib/security/rate-limit";

type Result<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;
  const perms =
    (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.hr_documents ?? []).includes("write")
    ? adminId
    : null;
}

// ─── Schemas ────────────────────────────────────────────────
const handbookBaseSchema = z.object({
  title: z.string().min(2).max(160),
  subtitle: z.string().max(200).nullable().optional(),
  coverIntro: z.string().max(20000).nullable().optional(),
  version: z.string().min(1).max(20).default("1.0"),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  signatureScope: z
    .enum(["employee_only", "employer_only", "both", "none"])
    .default("employee_only"),
  templateIds: z.array(z.number().int().positive()).min(1).max(50),
  // Demande 7 : valeurs RH des champs [CHAMP] des chapitres.
  customFieldValues: z.record(z.string(), z.string()).nullable().optional(),
});

const createHandbookSchema = handbookBaseSchema.extend({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Cle technique : a-z, 0-9, _")
    .optional(),
});

// Slugify : "Mon Cahier RH 2025" -> "mon_cahier_rh_2025"
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// ─── resolveHandbookItemsForEmployee (Demande 6) ────────────
// Filtre les items d'un cahier selon le poste de l'employe :
//  - template.targetPositions vide / null => visible pour TOUS
//  - sinon => visible uniquement si emp.position est dans la liste
// Utilise par preview-pdf, signature et toute UI cote employe.
export async function resolveHandbookItemsForEmployee(
  handbookId: number,
  employeeId: number | null,
) {
  const handbook = await prisma.documentHandbook.findUniqueOrThrow({
    where: { id: handbookId },
    include: {
      items: {
        include: { template: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!employeeId) {
    return handbook.items.map((it) => it.template);
  }
  const emp = await prisma.admin.findUnique({
    where: { id: employeeId },
    select: { position: { select: { name: true } } },
  });
  // Position est une relation : on extrait le name pour le matching contre targetPositions (string[]).
  const empPositionName = emp?.position?.name ?? null;

  return handbook.items
    .map((it) => it.template)
    .filter((t) => {
      const targets = (t.targetPositions as string[] | null) ?? [];
      if (!targets || targets.length === 0) return true;
      if (!empPositionName) return false;
      return targets.includes(empPositionName);
    });
}

// ─── createHandbookAction ───────────────────────────────────
export async function createHandbookAction(
  input: z.infer<typeof createHandbookSchema>,
): Promise<Result<{ id: number; key: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorise" };

  const parsed = createHandbookSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Genere une cle unique : base = slug du titre, +_2, _3... si conflit.
  let key = parsed.data.key ?? slugify(parsed.data.title);
  if (!key) key = `cahier_${Date.now().toString(36)}`;
  const baseKey = key;
  let n = 2;
  while (
    await prisma.documentHandbook.findUnique({
      where: { key },
      select: { id: true },
    })
  ) {
    key = `${baseKey}_${n++}`;
    if (n > 50) return { success: false, error: "Trop de cahiers similaires" };
  }

  // Verifie que les templates existent et sont actifs
  const templates = await prisma.legalDocumentTemplate.findMany({
    where: { id: { in: parsed.data.templateIds }, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(templates.map((t) => t.id));
  const orderedIds = parsed.data.templateIds.filter((id) => validIds.has(id));
  if (orderedIds.length === 0) {
    return { success: false, error: "Aucun template actif fourni" };
  }

  const created = await prisma.documentHandbook.create({
    data: {
      key,
      title: parsed.data.title.trim(),
      subtitle: parsed.data.subtitle?.trim() || null,
      coverIntro: parsed.data.coverIntro || null,
      version: parsed.data.version,
      isActive: parsed.data.isActive,
      isRequired: parsed.data.isRequired,
      signatureScope: parsed.data.signatureScope,
      // Demande 7 : custom field values RH.
      // FIXME (TS) : champ customFieldValues nouveau dans le schema ;
      // cast via Prisma JsonValue le temps que prisma generate puisse rouler.
      ...((parsed.data.customFieldValues ?? null) !== null
        ? { customFieldValues: parsed.data.customFieldValues as object }
        : {}),
      items: {
        create: orderedIds.map((templateId, index) => ({
          templateId,
          orderIndex: index,
        })),
      },
    } as Parameters<typeof prisma.documentHandbook.create>[0]["data"],
    select: { id: true, key: true },
  });

  await logAudit({
    adminId,
    action: "create",
    entityType: "document_handbook",
    entityId: created.id,
    changes: { key: created.key, title: parsed.data.title, templateCount: orderedIds.length },
  });

  revalidatePath("/admin/employes/documents/cahiers");
  revalidatePath("/admin/mon-espace/documents");

  return { success: true, data: { id: created.id, key: created.key } };
}

// ─── updateHandbookAction ───────────────────────────────────
const updateHandbookSchema = handbookBaseSchema.extend({
  id: z.number().int().positive(),
});

export async function updateHandbookAction(
  input: z.infer<typeof updateHandbookSchema>,
): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorise" };

  const parsed = updateHandbookSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const existing = await prisma.documentHandbook.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, key: true },
  });
  if (!existing) return { success: false, error: "Cahier introuvable" };

  // Replace les items (delete + create dans une transaction).
  const templates = await prisma.legalDocumentTemplate.findMany({
    where: { id: { in: parsed.data.templateIds }, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(templates.map((t) => t.id));
  const orderedIds = parsed.data.templateIds.filter((id) => validIds.has(id));
  if (orderedIds.length === 0) {
    return { success: false, error: "Aucun template actif fourni" };
  }

  await prisma.$transaction([
    prisma.documentHandbook.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title.trim(),
        subtitle: parsed.data.subtitle?.trim() || null,
        coverIntro: parsed.data.coverIntro || null,
        version: parsed.data.version,
        isActive: parsed.data.isActive,
        isRequired: parsed.data.isRequired,
        signatureScope: parsed.data.signatureScope,
        // Demande 7 : maj customFieldValues (FIXME : champ nouveau, cast pour TS).
        ...((parsed.data.customFieldValues !== undefined)
          ? { customFieldValues: parsed.data.customFieldValues as object | null }
          : {}),
      } as Parameters<typeof prisma.documentHandbook.update>[0]["data"],
    }),
    prisma.documentHandbookItem.deleteMany({
      where: { handbookId: parsed.data.id },
    }),
    prisma.documentHandbookItem.createMany({
      data: orderedIds.map((templateId, index) => ({
        handbookId: parsed.data.id,
        templateId,
        orderIndex: index,
      })),
    }),
  ]);

  await logAudit({
    adminId,
    action: "update",
    entityType: "document_handbook",
    entityId: parsed.data.id,
    changes: { templateCount: orderedIds.length },
  });

  revalidatePath("/admin/employes/documents/cahiers");
  revalidatePath("/admin/mon-espace/documents");

  return { success: true };
}

// ─── duplicateHandbookAction ────────────────────────────────
// Mission 3 : cree une copie d'un cahier existant (avec ses items),
// avec une nouvelle cle (suffixe _copy) et le titre prefixe "(copie)".
export async function duplicateHandbookAction(input: {
  id: number;
}): Promise<Result<{ id: number; key: string }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorise" };

  const original = await prisma.documentHandbook.findUnique({
    where: { id: input.id },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  if (!original) return { success: false, error: "Cahier introuvable" };

  // Genere une cle unique : original_key + "_copy", puis _copy_2 si conflit.
  let key = `${original.key}_copy`;
  const baseKey = key;
  let n = 2;
  while (
    await prisma.documentHandbook.findUnique({
      where: { key },
      select: { id: true },
    })
  ) {
    key = `${baseKey}_${n++}`;
    if (n > 50) return { success: false, error: "Trop de copies similaires" };
  }

  const copy = await prisma.documentHandbook.create({
    data: {
      key,
      title: `${original.title} (copie)`,
      subtitle: original.subtitle,
      coverIntro: original.coverIntro,
      version: original.version,
      isActive: false, // une copie demarre archivee, RH la publie quand prete
      isRequired: original.isRequired,
      signatureScope: original.signatureScope,
      items: {
        create: original.items.map((it) => ({
          templateId: it.templateId,
          orderIndex: it.orderIndex,
        })),
      },
    },
    select: { id: true, key: true },
  });

  await logAudit({
    adminId,
    action: "create",
    entityType: "document_handbook",
    entityId: copy.id,
    changes: { duplicated_from: original.id, key: copy.key },
  });

  revalidatePath("/admin/employes/documents/cahiers");
  return { success: true, data: { id: copy.id, key: copy.key } };
}

// ─── archiveHandbookAction ──────────────────────────────────
export async function archiveHandbookAction(input: { id: number }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorise" };

  const existing = await prisma.documentHandbook.findUnique({
    where: { id: input.id },
    select: { id: true, isActive: true },
  });
  if (!existing) return { success: false, error: "Cahier introuvable" };

  await prisma.documentHandbook.update({
    where: { id: input.id },
    data: { isActive: false },
  });

  await logAudit({
    adminId,
    action: "update",
    entityType: "document_handbook",
    entityId: input.id,
    changes: { isActive: false, archived: true },
  });

  revalidatePath("/admin/employes/documents/cahiers");
  revalidatePath("/admin/mon-espace/documents");

  return { success: true };
}

// ─── signHandbookAction ─────────────────────────────────────
// Mission 4 : checkboxStates accepte maintenant un objet structurel
// { chapters: { [templateId]: { read, initials } }, globalAccepted: true }
// dans la cle speciale `__handbook`. Le format flat (Record<string, bool>)
// reste accepte pour retro-compat.
const signHandbookSchema = z.object({
  handbookId: z.number().int().positive(),
  // Mission 4 : signatureData optionnel (cahier en lecture seule = scope "none").
  signatureData: z.string().optional(),
  checkboxStates: z.record(z.string(), z.any()).optional(),
});

export async function signHandbookAction(
  input: z.infer<typeof signHandbookSchema>,
): Promise<Result> {
  const parsed = signHandbookSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;

  const handbook = await prisma.documentHandbook.findUnique({
    where: { id: parsed.data.handbookId },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: {
          template: {
            select: {
              id: true,
              key: true,
              title: true,
              bodyMarkdown: true,
              version: true,
              signatureScope: true,
              targetPositions: true,
            },
          },
        },
      },
    },
  });
  if (!handbook || !handbook.isActive) {
    return { success: false, error: "Cahier introuvable ou archive" };
  }

  // Mission 4 : valider acceptation finale (Demande 4 : une seule case finale) + scope signature.
  const scope = (handbook.signatureScope ?? "employee_only") as
    | "employee_only" | "employer_only" | "both" | "none";
  const requiresSignature = scope !== "none";

  if (requiresSignature) {
    if (!parsed.data.signatureData || !parsed.data.signatureData.startsWith("data:image/")) {
      return { success: false, error: "Signature manuscrite requise" };
    }
  }

  // Demande 4 : format simplifie { __handbook: { finalRead, finalInitials, globalAccepted } }.
  // Retro-compat : on accepte aussi { chapters: {...} } pour les payloads existants.
  const states = (parsed.data.checkboxStates ?? {}) as Record<string, unknown>;
  const handbookData = states["__handbook"] as
    | {
        finalRead?: boolean;
        finalInitials?: string;
        globalAccepted?: boolean;
        chapters?: Record<string, { read?: boolean; initials?: string }>;
      }
    | undefined;

  if (handbookData) {
    if (!handbookData.globalAccepted) {
      return { success: false, error: "Acceptation globale requise" };
    }
    // Demande 4 : valide la seule case finale (avec retro-compat chapters legacy).
    const hasFinalRead = !!handbookData.finalRead;
    const finalInitials = (handbookData.finalInitials ?? "").trim();
    const hasLegacyChapters =
      handbookData.chapters && Object.keys(handbookData.chapters).length > 0;

    if (!hasFinalRead && !hasLegacyChapters) {
      return {
        success: false,
        error: "Confirmation finale de lecture requise",
      };
    }
    if (hasFinalRead && finalInitials.length < 2) {
      return { success: false, error: "Initiales finales requises (min. 2 caracteres)" };
    }
    // Mode legacy : valider chaque chapitre (ancien dialog par chapitre)
    if (!hasFinalRead && hasLegacyChapters) {
      const chapters = handbookData.chapters!;
      for (const it of handbook.items) {
        const ch = chapters[String(it.templateId)];
        if (!ch?.read) {
          return {
            success: false,
            error: `Chapitre « ${it.template.title} » non confirme comme lu`,
          };
        }
        if (!ch.initials || ch.initials.trim().length < 2) {
          return {
            success: false,
            error: `Initiales manquantes pour le chapitre « ${it.template.title} »`,
          };
        }
      }
    }
  }

  const already = await prisma.documentHandbookSignature.findUnique({
    where: {
      handbookId_adminId_version: {
        handbookId: handbook.id,
        adminId,
        version: handbook.version,
      },
    },
  });
  if (already) {
    return { success: false, error: "Cahier deja signe pour cette version" };
  }

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  const ua = h?.get("user-agent") ?? null;

  const signature = await prisma.documentHandbookSignature.create({
    data: {
      handbookId: handbook.id,
      adminId,
      version: handbook.version,
      // signatureData est NOT NULL en DB - on stocke chaine vide si scope = "none".
      signatureData: parsed.data.signatureData ?? "",
      ipAddress: ip,
      userAgent: ua,
      checkboxStates: parsed.data.checkboxStates ?? undefined,
    },
    select: { id: true, signedAt: true },
  });

  await logAudit({
    adminId,
    action: "create",
    entityType: "handbook_signature",
    entityId: handbook.id,
    changes: { key: handbook.key, version: handbook.version },
  });

  // ── Generation PDF final (best-effort) ────────────────────
  try {
    const [me, { renderHandbookHtmlToPdf }, { buildContextFromEmployee }, { uploadBuffer }] = await Promise.all([
      prisma.admin.findUnique({
        where: { id: adminId },
        select: { fullName: true, email: true },
      }),
      import("@/lib/services/pdf-html-renderer"),
      import("@/lib/document-templates/employee-context"),
      import("@/lib/storage/object-storage"),
    ]);

    const context = await buildContextFromEmployee(adminId).catch(() => ({}));
    const signerName = (me?.fullName ?? me?.email ?? "").trim();

    // Mission 4 / Demande 4 : extrait finalRead + finalInitials + globalAccepted
    // depuis le payload structurel. Legacy : chapterStates conserve pour retro-compat.
    const chapterStatesNum: Record<number, { read: boolean; initials: string }> = {};
    let globalAcceptedFlag = false;
    let finalReadFlag = false;
    let finalInitialsStr = "";
    if (handbookData) {
      globalAcceptedFlag = !!handbookData.globalAccepted;
      finalReadFlag = !!handbookData.finalRead;
      finalInitialsStr = String(handbookData.finalInitials ?? "");
      if (handbookData.chapters) {
        for (const [tplIdStr, st] of Object.entries(handbookData.chapters)) {
          const tplId = Number(tplIdStr);
          if (Number.isFinite(tplId) && st) {
            chapterStatesNum[tplId] = {
              read: !!st.read,
              initials: String(st.initials ?? ""),
            };
          }
        }
      }
    }

    // Demande 6 : filtrer les chapitres selon le poste de l'employe.
    const empWithPosition = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { position: { select: { name: true } } },
    });
    const empPositionName = empWithPosition?.position?.name ?? null;
    const filteredItems = handbook.items.filter((it) => {
      const targets = (it.template.targetPositions ?? []) as string[];
      if (!targets || targets.length === 0) return true;
      if (!empPositionName) return false;
      return targets.includes(empPositionName);
    });

    // Demande 7 : valeurs custom RH stockees sur le cahier (champs [CHAMP]).
    // FIXME : champ customFieldValues sur DocumentHandbook ; ajouter via Prisma db push
    // si pas encore en base. Cast (handbook as any) pour eviter erreur TS si client non regen.
    const customFieldValues =
      (handbook as unknown as { customFieldValues?: Record<string, string> | null })
        .customFieldValues ?? null;

    const pdfBuffer = await renderHandbookHtmlToPdf({
      handbook: {
        title: handbook.title,
        subtitle: handbook.subtitle ?? undefined,
        coverIntro: handbook.coverIntro ?? undefined,
        version: handbook.version,
        signatureScope: scope,
        customFieldValues,
      },
      chapters: filteredItems.map((it) => ({
        title: it.template.title,
        bodyMarkdown: it.template.bodyMarkdown,
        templateId: it.template.id,
        templateKey: it.template.key,
      })),
      context,
      employeeName: signerName,
      signature: parsed.data.signatureData
        ? {
            dataUrl: parsed.data.signatureData,
            name: signerName,
            date: signature.signedAt,
          }
        : undefined,
      chapterStates: chapterStatesNum,
      globalAccepted: globalAcceptedFlag,
      finalRead: finalReadFlag,
      finalInitials: finalInitialsStr,
    });

    const upload = await uploadBuffer({
      buffer: pdfBuffer,
      mime: "application/pdf",
      keyBase: `handbook-signatures/${handbook.key}-${adminId}-v${handbook.version.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      ext: "pdf",
    });
    const finalPdfUrl = upload.kind === "remote" ? upload.url : upload.dataUrl;

    await prisma.documentHandbookSignature.update({
      where: { id: signature.id },
      data: { finalPdfUrl },
    });

    await prisma.notification
      .create({
        data: {
          recipientType: "admin",
          recipientId: adminId,
          type: "success",
          title: "Cahier signe",
          body: `Votre signature de « ${handbook.title} » est enregistree. Le PDF final est disponible.`,
          link: "/admin/mon-espace/documents",
          icon: "book-open-check",
        },
      })
      .catch(() => null);
  } catch (e) {
    console.error("[signHandbookAction] Echec generation PDF final :", e);
  }

  revalidatePath("/admin/employes/documents/cahiers");
  revalidatePath("/admin/mon-espace/documents");
  return { success: true };
}
