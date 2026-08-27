// GET /api/admin/employees/[id]/personal-docs/[docId]/file
// Téléchargement / aperçu d'un fichier de document personnel.
// Auth: employé propriétaire OU admin RH (sauf isPrivate qui exige être self
// ou super_admin).
// Content-Disposition: inline pour PDF/image, attachment sinon.
//
// Cas du stockage :
//   - kind=remote : fileUrl pointe vers CDN public (R2/S3) → redirect 302
//     ou stream (ici on redirige : c'est le pattern le plus simple et le CDN
//     est l'ACL ; on aurait besoin d'URLs signées pour un vrai privé).
//   - kind=local : fileUrl est un data URL "data:mime;base64,..." → décodage
//     et stream direct.
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
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;

  const { id: idStr, docId: docIdStr } = await params;
  const targetId = Number(idStr);
  const docId = Number(docIdStr);
  if (!Number.isFinite(targetId) || !Number.isFinite(docId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const [me, doc] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: actorId },
      include: { customRole: true },
    }),
    prisma.employeePersonalDocument.findUnique({ where: { id: docId } }),
  ]);

  if (!me) return unauthorizedJson();
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (doc.adminId !== targetId) {
    return NextResponse.json({ error: "Document hors scope" }, { status: 404 });
  }
  if (!doc.fileUrl) {
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
  const isSelf = actorId === targetId;

  if (!isSelf && !isHr) {
    return forbiddenJson();
  }
  if (doc.isPrivate && !isSelf && !isSuper) {
    return NextResponse.json({ error: t("document_prive") }, { status: 403 });
  }

  await logAudit({
    adminId: actorId,
    action: "view",
    entityType: "employee_personal_doc",
    entityId: docId,
    changes: { targetAdminId: targetId },
  }).catch(() => null);

  // ── Cas 1 : data URL (storage local) ──────────────────────
  if (doc.fileUrl.startsWith("data:")) {
    const match = /^data:([^;,]+)(?:;base64)?,(.+)$/.exec(doc.fileUrl);
    if (!match) {
      return NextResponse.json({ error: "Fichier corrompu" }, { status: 500 });
    }
    const mime = match[1];
    const isBase64 = /;base64,/.test(doc.fileUrl);
    const buf = isBase64
      ? Buffer.from(match[2], "base64")
      : Buffer.from(decodeURIComponent(match[2]), "utf8");

    const disp = INLINE_MIMES.has(mime) ? "inline" : "attachment";
    const filename = doc.fileName ?? `document-${doc.id}`;
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

  // ── Cas 2 : URL distante (CDN) ────────────────────────────
  // Redirige vers le CDN. NOTE : si le bucket est public l'URL est lisible
  // par quiconque l'a — pour un vrai contrôle d'accès il faudrait des URLs
  // signées (TODO si on bascule sur stockage privé).
  return NextResponse.redirect(doc.fileUrl, 302);
}
