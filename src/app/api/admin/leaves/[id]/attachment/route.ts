// POST /api/admin/leaves/[id]/attachment
// Upload d'un justificatif (PDF, image) pour une demande de conge.
// Reutilise l'abstraction storage (R2/S3/local data URL fallback).
// Auth : auteur de la demande OU reviewer (verifie dans uploadLeaveAttachmentAction).
import "server-only";
import { getTranslations } from "next-intl/server";
import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";
import { uploadAvatar } from "@/lib/storage/object-storage";
import { uploadLeaveAttachmentAction } from "@/app/actions/hr-leaves";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = [
  "application/pdf",
  "image/png", "image/jpeg", "image/webp",
];

function magicBytes(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
  }
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/webp") return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42;
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId }, select: { id: true, adminId: true } });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (leave.adminId !== actorId) {
    const ok = await assertCanReviewLeave(actorId, leave.adminId);
    if (!ok) return forbiddenJson();
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: t("aucun_fichier_recu") }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: t("route_type_non_autorise_p0", { p0: file.type }) }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!magicBytes(buf, file.type)) {
      return NextResponse.json({ error: "Magic bytes invalides — fichier corrompu" }, { status: 415 });
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(-80);
    const stamp = crypto.randomBytes(6).toString("hex");
    const result = await uploadAvatar({
      buffer: buf,
      mime: file.type,
      prefix: `leaves/${leaveId}/${stamp}-${safeName}`,
    });
    const url = result.kind === "remote" ? result.url : result.dataUrl;

    const saved = await uploadLeaveAttachmentAction({
      id: leaveId,
      attachmentUrl: url,
      attachmentName: safeName,
    });
    if (!saved.success) {
      return NextResponse.json({ error: saved.error }, { status: 400 });
    }

    return NextResponse.json({ url, name: safeName });
  } catch (err) {
    console.error("[leave attachment]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur serveur" }, { status: 500 });
  }
}
