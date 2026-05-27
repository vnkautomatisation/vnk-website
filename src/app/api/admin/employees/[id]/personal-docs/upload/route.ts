// POST /api/admin/employees/[id]/personal-docs/upload
// Upload binaire (PDF / image) d'un document personnel — retourne URL.
// Auth: employé lui-même OU admin RH.
// Cette route uploade UNIQUEMENT le fichier ; la création de la ligne
// EmployeePersonalDocument se fait ensuite via upsertPersonalDocAction.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { uploadAvatar } from "@/lib/storage/object-storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

function magicByteCheck(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
  }
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/webp") return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42;
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;

  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  const isSelf = actorId === targetId;
  if (!isSelf && !isHr) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: `Type non autorisé (${file.type})` }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (!magicByteCheck(buf, file.type)) {
      return NextResponse.json(
        { error: "Magic bytes invalides — fichier corrompu ou type erroné" },
        { status: 415 },
      );
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(-60);
    const folder = `personal-docs/${targetId}`;
    const id = crypto.randomBytes(8).toString("hex");

    const result = await uploadAvatar({
      buffer: buf,
      mime: file.type,
      prefix: `${folder}/${id}-${safeName}`,
    });

    await logAudit({
      adminId: actorId,
      action: "create",
      entityType: "personal_doc_file",
      changes: {
        targetAdminId: targetId,
        mime: file.type,
        size: file.size,
        name: safeName,
      },
    });

    const url = result.kind === "remote" ? result.url : result.dataUrl;
    return NextResponse.json({
      url,
      kind: result.kind,
      fileName: safeName,
      fileSize: file.size,
      fileMimeType: file.type,
    });
  } catch (err) {
    console.error("[personal-docs/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
