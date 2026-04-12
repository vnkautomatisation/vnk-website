// PATCH /api/documents/:id/read — marquer un document comme lu
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: Number(id) },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && doc.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  await prisma.document.update({
    where: { id: Number(id) },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
