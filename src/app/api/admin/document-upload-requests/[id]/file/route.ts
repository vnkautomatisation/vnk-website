// GET /api/admin/document-upload-requests/[id]/file
// Téléchargement / aperçu du fichier téléversé en réponse à une demande.
// Auth : employé propriétaire OU RH OU manager direct de l'employé ciblé.
import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const INLINE_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;

  const { id: idStr } = await params;
  const reqId = Number(idStr);
  if (!Number.isFinite(reqId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const [me, docReq] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: actorId },
      include: { customRole: true },
    }),
    prisma.documentUploadRequest.findUnique({
      where: { id: reqId },
      include: {
        targetAdmin: { select: { id: true, managerId: true } },
      },
    }),
  ]);

  if (!me) return unauthorizedJson();
  if (!docReq) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (!docReq.fileUrl) {
    return NextResponse.json({ error: t("aucun_fichier_attache") }, { status: 404 });
  }

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");
  const isSelf = actorId === docReq.targetAdminId;
  const isManager = docReq.targetAdmin.managerId === actorId;

  if (!isSelf && !isHr && !isManager) {
    return forbiddenJson();
  }

  await logAudit({
    adminId: actorId,
    action: "view",
    entityType: "document_upload_request",
    entityId: reqId,
    changes: { targetAdminId: docReq.targetAdminId },
  }).catch(() => null);

  // Cas 1 : data URL (storage local)
  if (docReq.fileUrl.startsWith("data:")) {
    const match = /^data:([^;,]+)(?:;base64)?,(.+)$/.exec(docReq.fileUrl);
    if (!match) {
      return NextResponse.json({ error: "Fichier corrompu" }, { status: 500 });
    }
    const mime = match[1];
    const isBase64 = /;base64,/.test(docReq.fileUrl);
    const buf = isBase64
      ? Buffer.from(match[2], "base64")
      : Buffer.from(decodeURIComponent(match[2]), "utf8");

    const disp = INLINE_MIMES.has(mime) ? "inline" : "attachment";
    const filename = docReq.fileName ?? `document-${docReq.id}`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${disp}; filename="${filename.replace(/[^a-z0-9._-]/gi, "_")}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  }

  // Cas 2 : URL distante (CDN)
  return NextResponse.redirect(docReq.fileUrl, 302);
}
