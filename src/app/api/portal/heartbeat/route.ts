// POST /api/portal/heartbeat — met a jour Client.lastSeenAt
// Appele toutes les 60s par le portail client tant qu'il est ouvert
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await prisma.client.update({
    where: { id: session.user.clientId },
    data: { lastSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
