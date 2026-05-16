// API · Avatar admin — téléversement (POST) + suppression (DELETE)
// Stocke l'image en data URL base64 dans admin.avatarUrl.
// Validation : image only, max 2 Mo, dimensions raisonnables.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 Mo brut
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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
      return NextResponse.json(
        { error: "Format non supporté. Utilisez JPG, PNG, WebP ou GIF." },
        { status: 415 }
      );
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 2 Mo, reçu ${(file.size / 1024 / 1024).toFixed(2)} Mo)` },
        { status: 413 }
      );
    }

    // Convertir en data URL base64
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;

    await prisma.admin.update({
      where: { id: adminId },
      data: { avatarUrl: dataUrl },
    });

    await logSecurityEvent({
      adminId,
      type: "profile_updated",
      message: "Photo de profil téléversée",
      metadata: { fileType: file.type, fileSize: file.size },
    });

    return NextResponse.json({ ok: true, avatarUrl: dataUrl });
  } catch (err) {
    console.error("[avatar-upload]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: { avatarUrl: null },
    });
    await logSecurityEvent({
      adminId,
      type: "profile_updated",
      message: "Photo de profil supprimée",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
