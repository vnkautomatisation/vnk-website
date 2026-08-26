// PATCH /api/documents/:id/read — marquer un document comme lu
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRequestContext } from "@/lib/request-context";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true } } },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && doc.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }

  const wasUnread = !doc.isRead;
  await prisma.document.update({
    where: { id: Number(id) },
    data: { isRead: true },
  });

  if (wasUnread && session.user.role === "client") {
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

  return NextResponse.json({ ok: true });
}
