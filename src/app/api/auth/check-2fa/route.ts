// POST /api/auth/check-2fa — verifie si un client a la 2FA activee
// Appele AVANT signIn pour savoir si on doit demander le code
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { email: parsed.data.email },
    select: { passwordHash: true, twoFactorEnabled: true, isActive: true, archived: true },
  });

  if (!client || !client.isActive || client.archived) {
    return NextResponse.json({ valid: false });
  }

  const valid = await bcrypt.compare(parsed.data.password, client.passwordHash);
  if (!valid) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    requires2FA: client.twoFactorEnabled,
  });
}
