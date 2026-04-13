import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  if (session.user.role === "client" && session.user.clientId) {
    await prisma.message.updateMany({
      where: {
        clientId: session.user.clientId,
        sender: "vnk",
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ ok: true });
}
