// GET /api/documents — liste documents (admin: tous, client: les siens)
// POST /api/documents — upload (admin) — fichier en data URL ou metadata seule (pour fileUrl externe)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const MAX_DATAURL_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024 * 1.4);

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(60).optional(),
  // Soit upload : fournit fileData + fileName
  fileData: z.string().startsWith("data:").optional(),
  fileName: z.string().max(255).optional(),
  // Soit metadata-seule (lien externe ou route api)
  fileUrl: z.string().optional(),
  fileType: z.string().max(60).optional(),
  fileSize: z.number().int().nonnegative().optional(),
}).refine((d) => d.fileData || d.fileUrl, { message: "Fichier ou URL requis" });

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const unread = searchParams.get("unread") === "true";

  const documents = await prisma.document.findMany({
    where: {
      ...(session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! }),
      ...(category && { category }),
      ...(unread && { isRead: false }),
    },
    include: {
      mandate: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("documents", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message ?? "Données invalides" }, { status: 400 });
  }

  // Si upload : valide la taille + extrait mimeType
  let fileType = parsed.data.fileType;
  let fileSize = parsed.data.fileSize;
  let fileUrl = parsed.data.fileUrl;
  if (parsed.data.fileData) {
    if (parsed.data.fileData.length > MAX_DATAURL_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${MAX_UPLOAD_MB} Mo)` }, { status: 413 });
    }
    // data:<mime>;base64,<data>
    const mimeMatch = parsed.data.fileData.match(/^data:([^;,]+)[;,]/);
    fileType = fileType ?? mimeMatch?.[1] ?? "application/octet-stream";
    if (!fileSize) {
      const base64 = parsed.data.fileData.split(",")[1] ?? "";
      fileSize = Math.floor(base64.length * 0.75);
    }
    fileUrl = parsed.data.fileData; // stocke directement le data URL
  }

  const document = await prisma.document.create({
    data: {
      clientId: parsed.data.clientId,
      mandateId: parsed.data.mandateId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      fileType,
      fileName: parsed.data.fileName,
      fileSize,
      fileUrl,
      uploadedBy: session.user.email ?? "admin",
    },
  });

  await createWorkflowEvent({
    clientId: document.clientId,
    eventType: "message_from_admin",
    eventLabel: `Document ${document.title} déposé`,
    triggeredBy: "admin",
    metadata: { documentId: document.id, category: document.category ?? null },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "documents",
    entityId: document.id,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, document });
}
