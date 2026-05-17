// API · Upload avatar pour un utilisateur admin spécifique.
// Requiert permission users:write OU être le user lui-même.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { validateImageBuffer } from "@/lib/security/image-magic";
import { uploadAvatar, deleteRemoteAvatar } from "@/lib/storage/object-storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function canEditUser(currentAdminId: number, targetId: number): Promise<boolean> {
  if (currentAdminId === targetId) return true;
  const me = await prisma.admin.findUnique({
    where: { id: currentAdminId },
    include: { customRole: true },
  });
  if (!me) return false;
  if (me.customRole?.name === "super_admin") return true;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (perms.users ?? []).includes("write");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (isNaN(targetId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const allowed = await canEditUser(adminId, targetId);
  if (!allowed) return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (JPG, PNG, WebP, GIF)" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 2 Mo)" }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    // Vérification magic bytes — empêche un fichier exécutable masqué en image
    const magic = validateImageBuffer(buf);
    if (!magic.ok) {
      return NextResponse.json({ error: magic.error }, { status: 415 });
    }

    const previous = await prisma.admin.findUnique({
      where: { id: targetId },
      select: { avatarUrl: true },
    });

    const uploaded = await uploadAvatar({
      buffer: buf,
      mime: magic.mime,
      prefix: `admin/${targetId}`,
    });
    const newUrl = uploaded.kind === "remote" ? uploaded.url : uploaded.dataUrl;

    await prisma.admin.update({ where: { id: targetId }, data: { avatarUrl: newUrl } });
    if (previous?.avatarUrl) {
      await deleteRemoteAvatar(previous.avatarUrl).catch(() => null);
    }
    await logAudit({
      adminId, action: "update", entityType: "admin", entityId: targetId,
      changes: { avatarUploaded: true, backend: uploaded.kind },
    });

    return NextResponse.json({ ok: true, avatarUrl: newUrl });
  } catch (err) {
    console.error("[team-avatar]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (isNaN(targetId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const allowed = await canEditUser(adminId, targetId);
  if (!allowed) return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  const prev = await prisma.admin.findUnique({ where: { id: targetId }, select: { avatarUrl: true } });
  await prisma.admin.update({ where: { id: targetId }, data: { avatarUrl: null } });
  if (prev?.avatarUrl) {
    await deleteRemoteAvatar(prev.avatarUrl).catch(() => null);
  }
  await logAudit({ adminId, action: "update", entityType: "admin", entityId: targetId, changes: { avatarRemoved: true } });
  return NextResponse.json({ ok: true });
}
