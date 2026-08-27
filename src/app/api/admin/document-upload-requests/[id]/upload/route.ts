// POST /api/admin/document-upload-requests/[id]/upload
//
// Refonte 2026-05 : tout inline dans le route handler pour éviter le détour par
// une server action ("use server") qui causait des "Invalid URL" silencieux
// dans la chaîne Next.js. Chaque étape est explicitement try/catchée et loggée.
//
// Flow :
//   1. Auth admin
//   2. Charger la demande + vérifier ownership + status pending
//   3. Lire FormData → File
//   4. Valider MIME + taille + magic bytes
//   5. uploadBuffer() (local → dataUrl base64, distant → URL CDN)
//   6. prisma.documentUploadRequest.update → status "uploaded"
//   7. Audit log (toléré)
//   8. Notification au demandeur (toléré)
//   9. revalidatePath (toléré)
//  10. Retour JSON { success: true }
import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

function magicByteCheck(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  if (mime === "application/pdf") {
    return (
      buf[0] === 0x25
      && buf[1] === 0x50
      && buf[2] === 0x44
      && buf[3] === 0x46
      && buf[4] === 0x2d
    );
  }
  if (mime === "image/png") {
    return (
      buf[0] === 0x89
      && buf[1] === 0x50
      && buf[2] === 0x4e
      && buf[3] === 0x47
    );
  }
  if (mime === "image/jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === "image/webp") {
    return (
      buf[8] === 0x57
      && buf[9] === 0x45
      && buf[10] === 0x42
      && buf[11] === 0x50
    );
  }
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("admin.action_errors");
  const t0 = Date.now();
  let stage = "init";

  try {
    // ─── 1. Auth ────────────────────────────────────────────────
    stage = "auth";
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return unauthorizedJson();
    }
    const actorId = session.user.adminId!;

    // ─── 2. ID ──────────────────────────────────────────────────
    stage = "parse-id";
    const { id: idStr } = await params;
    const reqId = Number(idStr);
    if (!Number.isFinite(reqId) || reqId <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    // ─── 3. Load + auth check ──────────────────────────────────
    stage = "load-request";
    const docReq = await prisma.documentUploadRequest.findUnique({
      where: { id: reqId },
      select: {
        id: true,
        targetAdminId: true,
        status: true,
        requestedById: true,
        title: true,
        targetAdmin: { select: { fullName: true, email: true } },
      },
    });
    if (!docReq) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    if (docReq.targetAdminId !== actorId) {
      return forbiddenJson();
    }
    if (docReq.status !== "pending") {
      return NextResponse.json(
        { error: t("la_demande_n_accepte_plus_de_televersement") },
        { status: 409 },
      );
    }

    // ─── 4. FormData ────────────────────────────────────────────
    stage = "form-data";
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      console.warn("[upload-doc-req] no file", { reqId });
      return NextResponse.json({ error: t("aucun_fichier_recu") }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      console.warn("[upload-doc-req] disallowed mime", { reqId, mime: file.type });
      return NextResponse.json(
        { error: `Type non autorisé (${file.type || "inconnu"})` },
        { status: 415 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { error: t("fichier_vide_selectionnez_un_fichier_non_vide") },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo)` },
        { status: 413 },
      );
    }

    // ─── 5. Buffer + magic bytes ────────────────────────────────
    stage = "buffer";
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 12) {
      return NextResponse.json(
        { error: t("fichier_trop_petit_pour_validation") },
        { status: 415 },
      );
    }
    const magicOk = magicByteCheck(buf, file.type);
    console.log("[upload-doc-req]", {
      reqId,
      mime: file.type,
      size: file.size,
      bufLen: buf.length,
      magicBytesOk: magicOk,
      stage,
    });
    if (!magicOk) {
      return NextResponse.json(
        { error: t("magic_bytes_invalides_fichier_corrompu_ou_type") },
        { status: 415 },
      );
    }

    // ─── 6. Stockage : data URL base64 inline (même pattern que /api/documents)
    //
    // On bypasse complètement l'abstraction object-storage (uploadBuffer/uploadAvatar)
    // qui appelle `new URL()` et peut throw "Invalid URL" si STORAGE_BACKEND est
    // mal configuré. Stockage direct en data URL base64 = pas de dépendance externe,
    // fonctionne en dev et prod. C'est le pattern utilisé par /api/documents qui
    // fonctionne déjà pour les documents clients.
    stage = "build-data-url";
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(-60) || "document";
    const storedUrl = `data:${file.type};base64,${buf.toString("base64")}`;

    // ─── 7. Prisma update ───────────────────────────────────────
    stage = "prisma-update";
    try {
      await prisma.documentUploadRequest.update({
        where: { id: reqId },
        data: {
          status: "uploaded",
          uploadedAt: new Date(),
          fileUrl: storedUrl,
          fileName: safeName,
          fileSize: file.size,
          fileMimeType: file.type,
        },
      });
    } catch (dbErr) {
      console.error("[upload-doc-req] prisma.update FAIL:", dbErr);
      return NextResponse.json(
        {
          error: dbErr instanceof Error
            ? `Base de données : ${dbErr.message}`
            : t("erreur_base_de_donnees"),
        },
        { status: 500 },
      );
    }

    // ─── 8. Audit (toléré) ──────────────────────────────────────
    stage = "audit";
    try {
      await logAudit({
        adminId: actorId,
        action: "update",
        entityType: "document_upload_request",
        entityId: reqId,
        changes: {
          status: "uploaded",
          fileName: safeName,
          fileSize: file.size,
          mime: file.type,
        },
      });
    } catch (auditErr) {
      console.error("[upload-doc-req] audit FAIL (toléré):", auditErr);
    }

    // ─── 9. Notification RH (toléré) ────────────────────────────
    stage = "notification";
    try {
      const empName = docReq.targetAdmin.fullName ?? docReq.targetAdmin.email;
      await prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: docReq.requestedById,
          type: "info",
          title: t("document_televerse"),
          body: `${empName} a téléversé « ${docReq.title} ». À valider.`,
          link: "/admin/employes/documents",
          icon: "upload",
        },
      });
    } catch (notifErr) {
      console.error("[upload-doc-req] notification FAIL (toléré):", notifErr);
    }

    // ─── 10. Revalidation (toléré) ──────────────────────────────
    stage = "revalidate";
    try {
      revalidatePath("/admin/employes/documents");
      revalidatePath("/admin/mon-espace/documents");
      revalidatePath("/admin/mon-espace");
    } catch (revErr) {
      console.error("[upload-doc-req] revalidatePath FAIL (toléré):", revErr);
    }

    // ─── 11. Success ────────────────────────────────────────────
    console.log("[upload-doc-req] SUCCESS", {
      reqId,
      durationMs: Date.now() - t0,
    });
    return NextResponse.json({
      success: true,
      fileName: safeName,
      fileSize: file.size,
      fileMimeType: file.type,
    });
  } catch (err) {
    console.error(`[upload-doc-req] UNCAUGHT at stage="${stage}":`, err);
    return NextResponse.json(
      {
        error: err instanceof Error
          ? `${stage} : ${err.message}`
          : `Erreur serveur (stage: ${stage})`,
      },
      { status: 500 },
    );
  }
}
