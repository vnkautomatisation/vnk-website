import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

// GET /api/notifications — liste notifications admin
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const skip = Number(url.searchParams.get("offset") ?? 0);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const where = {
    recipientType: "admin" as const,
    recipientId: session.user.adminId!,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        recipientType: "admin",
        recipientId: session.user.adminId!,
        isRead: false,
      },
    }),
  ]);

  return NextResponse.json({ notifications, total, unreadCount });
}

// PATCH /api/notifications — marquer comme lu(es)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const body = await req.json();
  const adminId = session.user.adminId!;

  // Marquer toutes comme lues
  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: {
        recipientType: "admin",
        recipientId: adminId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  // Marquer une seule notification comme lue
  if (body.notificationId) {
    await prisma.notification.update({
      where: { id: body.notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Parametre manquant" }, { status: 400 });
}
