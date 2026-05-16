// API · Upload d'images pour le CMS (blog, témoignages, etc.).
// Stocke en data URL base64 dans la table Setting (pool partagé), retourne
// l'URL utilisable directement dans <img src>. Limite : 5 Mo, formats image.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (PNG, JPG, WebP, GIF, SVG)" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max 5 Mo)` }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;

    // Stocker dans Setting (category="cms_media") avec une clé hash unique
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const key = `media_${Date.now()}_${hash}`;

    await prisma.setting.create({
      data: {
        category: "cms_media",
        key,
        value: dataUrl,
        type: "image",
        label: file.name.slice(0, 100),
        isPublic: true,
        updatedBy: adminId,
      },
    });

    await logAudit({
      adminId,
      action: "create",
      entityType: "cms_media",
      changes: { fileName: file.name, fileType: file.type, fileSize: file.size },
    });

    // On retourne directement le data URL pour insertion immédiate dans le HTML
    return NextResponse.json({ ok: true, url: dataUrl, key, fileName: file.name });
  } catch (err) {
    console.error("[cms-upload-image]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
