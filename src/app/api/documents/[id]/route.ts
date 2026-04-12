// GET /api/documents/[id] — sert le fichier document (redirect vers fileUrl)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
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

  // Redirect to the actual file URL
  return NextResponse.redirect(doc.fileUrl);
}
