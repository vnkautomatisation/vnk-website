// GET /api/documents/[id] — sert le fichier document
// Pour les URLs internes (/api/...), proxy le contenu directement.
// Pour les URLs externes, redirect.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

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

  // Pour les URLs internes (API PDF routes), proxy le contenu
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
        "Content-Disposition": `inline; filename="${doc.title}.pdf"`,
      },
    });
  }

  // Pour les URLs externes, redirect
  return NextResponse.redirect(doc.fileUrl);
}
