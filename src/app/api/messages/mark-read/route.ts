// POST /api/messages/mark-read
// - Client : marque tous ses messages "vnk" comme lus
// - Admin : marque les messages "client" du clientId fourni comme lus (ou tous si non specifie)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (session.user.role === "client" && session.user.clientId) {
    const r = await prisma.message.updateMany({
      where: { clientId: session.user.clientId, sender: "vnk", isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true, count: r.count });
  }

  if (session.user.role === "admin") {
    const body = await req.json().catch(() => ({}));
    const clientId = body?.clientId ? Number(body.clientId) : null;
    const r = await prisma.message.updateMany({
      where: {
        sender: "client",
        isRead: false,
        ...(clientId ? { clientId } : {}),
      },
      data: { isRead: true },
    });
    revalidateAdminViews();
    return NextResponse.json({ ok: true, count: r.count });
  }

  return NextResponse.json({ ok: true, count: 0 });
}
