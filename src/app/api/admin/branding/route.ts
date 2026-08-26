// API · Branding — téléversement des logos et favicons.
// Les fichiers sont encodés en data URL base64 et stockés dans la table Setting
// (category=appearance, key=logo_<slot>). Slots supportés :
//   - primary  : logo principal (header clair)
//   - dark     : logo blanc/inversé (header sombre, footer)
//   - favicon  : favicon (PNG carré recommandé)
//   - login    : logo écran de connexion (peut être plus grand)
//   - email    : logo entête de courriel transactionnel
//   - pdf      : logo pour entête PDF (factures, devis)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const ALLOWED_SLOTS = ["primary", "dark", "favicon", "login", "email", "pdf"] as const;
type Slot = (typeof ALLOWED_SLOTS)[number];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "write"], ["branding", "write"], ["website", "write"], ["client_portal", "write"]])) {
    return forbiddenJson();
  }
  const adminId = session.user.adminId!;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const slot = form.get("slot")?.toString();

    if (!slot || !ALLOWED_SLOTS.includes(slot as Slot)) {
      return NextResponse.json({ error: "Emplacement invalide" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (PNG, JPG, WebP, SVG, ICO)" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max 5 Mo)` }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;

    const key = `logo_${slot}`;
    await prisma.setting.upsert({
      where: { category_key: { category: "appearance", key } },
      update: { value: dataUrl, type: "image", updatedBy: adminId },
      create: {
        category: "appearance",
        key,
        value: dataUrl,
        type: "image",
        label: `Logo ${slot}`,
        description: `Logo pour l'emplacement « ${slot} »`,
        isPublic: true,
        updatedBy: adminId,
      },
    });

    await logAudit({
      adminId,
      action: "settings_update",
      entityType: "branding",
      changes: { slot, fileType: file.type, fileSize: file.size },
    });

    return NextResponse.json({ ok: true, slot, value: dataUrl });
  } catch (err) {
    console.error("[branding-upload]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — vide le logo d'un slot
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "write"], ["branding", "write"], ["website", "write"], ["client_portal", "write"]])) {
    return forbiddenJson();
  }
  const adminId = session.user.adminId!;

  const { searchParams } = new URL(request.url);
  const slot = searchParams.get("slot");
  if (!slot || !ALLOWED_SLOTS.includes(slot as Slot)) {
    return NextResponse.json({ error: "Emplacement invalide" }, { status: 400 });
  }

  await prisma.setting.updateMany({
    where: { category: "appearance", key: `logo_${slot}` },
    data: { value: null, updatedBy: adminId },
  });

  await logAudit({
    adminId,
    action: "settings_update",
    entityType: "branding",
    changes: { slot, action: "delete" },
  });

  return NextResponse.json({ ok: true });
}
