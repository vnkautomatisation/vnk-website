// API · Upload de fichiers admin génériques (PDF, images, etc.)
// Utilise l'abstraction storage (R2/S3/local). Validation type + taille.
// Requiert permissions admin.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { uploadAvatar } from "@/lib/storage/object-storage"; // réutilise l'abstraction storage existante

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME = [
  "application/pdf",
  "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword",
];

function magicByteCheck(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    // %PDF-
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
  }
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/webp") return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42;
  // Office docs : PK signature (zip)
  if (mime.includes("document") || mime.includes("msword")) {
    return buf[0] === 0x50 && buf[1] === 0x4b;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "uploads").replace(/[^a-z0-9_-]/gi, "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: `Type non autorisé (${file.type})` }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (!magicByteCheck(buf, file.type)) {
      return NextResponse.json({ error: "Magic bytes invalides — fichier corrompu ou type erroné" }, { status: 415 });
    }

    // Réutilise uploadAvatar (qui gère R2/S3/local data URL fallback)
    // Préfixe folder spécifique
    const id = crypto.randomBytes(8).toString("hex");
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(-60);
    const result = await uploadAvatar({
      buffer: buf,
      mime: file.type,
      prefix: `${folder}/${id}-${safeName}`,
    });

    await logAudit({
      adminId,
      action: "create",
      entityType: "file_upload",
      changes: { folder, mime: file.type, size: file.size, name: safeName },
    });

    const url = result.kind === "remote" ? result.url : result.dataUrl;
    return NextResponse.json({ url, kind: result.kind });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur serveur" }, { status: 500 });
  }
}
