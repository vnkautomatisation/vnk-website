// API · Avatar admin — téléversement (POST) + suppression (DELETE)
// Stocke l'image en data URL base64 dans admin.avatarUrl.
// Validation : image only, max 2 Mo, dimensions raisonnables.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";
import { validateImageBuffer } from "@/lib/security/image-magic";
import { uploadAvatar, deleteRemoteAvatar } from "@/lib/storage/object-storage";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 Mo brut
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
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

    // ── Vérification magic bytes (le Content-Type est manipulable) ──
    const buf = Buffer.from(await file.arrayBuffer());
    const magic = validateImageBuffer(buf);
    if (!magic.ok) {
      return NextResponse.json({ error: magic.error }, { status: 415 });
    }

    // ── Récupérer l'ancien avatar pour cleanup remote ──
    const previous = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { avatarUrl: true },
    });

    // ── Upload vers R2/S3 (ou data URL fallback) ──
    const uploaded = await uploadAvatar({
      buffer: buf,
      mime: magic.mime,
      prefix: `admin/${adminId}`,
    });
    const newUrl = uploaded.kind === "remote" ? uploaded.url : uploaded.dataUrl;

    await prisma.admin.update({
      where: { id: adminId },
      data: { avatarUrl: newUrl },
    });

    // Cleanup ancien fichier remote
    if (previous?.avatarUrl) {
      await deleteRemoteAvatar(previous.avatarUrl).catch(() => null);
    }

    await logSecurityEvent({
      adminId,
      type: "profile_updated",
      message: "Photo de profil téléversée",
      metadata: { fileType: file.type, fileSize: file.size, backend: uploaded.kind },
    });

    return NextResponse.json({ ok: true, avatarUrl: newUrl });
  } catch (err) {
    console.error("[avatar-upload]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  try {
    const previous = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { avatarUrl: true },
    });
    await prisma.admin.update({
      where: { id: adminId },
      data: { avatarUrl: null },
    });
    if (previous?.avatarUrl) {
      await deleteRemoteAvatar(previous.avatarUrl).catch(() => null);
    }
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
