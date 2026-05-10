// POST /api/documents/[id]/mark-read — toggle isRead (admin) ou marque lu (client)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate";
import { captureRequestContext } from "@/lib/request-context";
import { logAudit } from "@/lib/audit";

const schema = z.object({ isRead: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const docId = Number(id);
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { client: { select: { fullName: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (session.user.role === "client" && doc.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let next: boolean;
  if (session.user.role === "admin") {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    next = parsed.success && parsed.data.isRead !== undefined ? parsed.data.isRead : !doc.isRead;
  } else {
    next = true; // client peut seulement marquer comme lu
  }

  await prisma.document.update({ where: { id: docId }, data: { isRead: next } });

  if (next && !doc.isRead && session.user.role === "client") {
    const ctx = captureRequestContext(req);
    await logAudit({
      adminId: null,
      action: "view",
      entityType: "documents",
      entityId: doc.id,
      changes: {
        type: "document_read_by_client",
        clientId: doc.clientId,
        clientName: doc.client?.fullName ?? null,
        title: doc.title,
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  if (session.user.role === "admin") revalidateAdminViews();
  return NextResponse.json({ success: true, isRead: next });
}
