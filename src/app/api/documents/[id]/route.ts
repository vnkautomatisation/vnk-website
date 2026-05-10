// GET /api/documents/[id] — sert le fichier document
// PATCH /api/documents/[id] — mettre a jour metadonnees (titre, description, categorie)
// DELETE /api/documents/[id] — supprimer
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { headers } from "next/headers";

// Construit un Content-Disposition compatible HTTP/1.1 (Latin-1 only) avec fallback RFC 5987 UTF-8
function safeContentDisposition(filename: string, mode: "inline" | "attachment" = "inline"): string {
  // ASCII-only fallback (remplace caracteres > 0x7F par "_")
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  // UTF-8 percent-encoded pour filename*
  const encoded = encodeURIComponent(filename);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: docId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Client can only access their own documents
  if (session.user.role === "client" && doc.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (!doc.fileUrl) {
    return NextResponse.json(
      { error: "Fichier non disponible" },
      { status: 404 }
    );
  }

  // Cas 1 : fichier upload stocke en data URL
  if (doc.fileUrl.startsWith("data:")) {
    const match = doc.fileUrl.match(/^data:([^;,]+)[;,]/);
    const mimeType = match?.[1] ?? doc.fileType ?? "application/octet-stream";
    const base64 = doc.fileUrl.split(",")[1] ?? "";
    const buf = Buffer.from(base64, "base64");
    const fname = doc.fileName ?? doc.title;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": safeContentDisposition(fname, "inline"),
      },
    });
  }

  // Cas 2 : URL interne (API PDF routes), proxy le contenu
  if (doc.fileUrl.startsWith("/api/")) {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const absoluteUrl = `${proto}://${host}${doc.fileUrl}`;

    const pdfRes = await fetch(absoluteUrl, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });

    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: "Erreur generation PDF" },
        { status: pdfRes.status }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": safeContentDisposition(`${doc.title}.pdf`, "inline"),
      },
    });
  }

  // Pour les URLs externes, redirect
  return NextResponse.redirect(doc.fileUrl);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  fileType: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const docId = Number(id);

  const existing = await prisma.document.findUnique({ where: { id: docId } });
  if (!existing) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const updated = await prisma.document.update({ where: { id: docId }, data: parsed.data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "documents",
    entityId: docId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, document: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const docId = Number(id);

  const existing = await prisma.document.findUnique({ where: { id: docId } });
  if (!existing) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  await prisma.document.delete({ where: { id: docId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "documents",
    entityId: docId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
