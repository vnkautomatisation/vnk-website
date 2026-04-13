// POST /api/auth/two-factor/disable — desactive la 2FA
import { NextResponse } from "next/server";
import { generateSecret, generateURI, verifySync } from "otplib";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!client?.twoFactorEnabled || !client.twoFactorSecret) {
    return NextResponse.json({ error: "2FA non active" }, { status: 400 });
  }

  const isValid = verifySync({
    token: parsed.data.code,
    secret: client.twoFactorSecret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
  }

  await prisma.client.update({
    where: { id: session.user.clientId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  return NextResponse.json({ success: true });
}
