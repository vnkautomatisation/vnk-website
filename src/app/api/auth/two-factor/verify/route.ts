// POST /api/auth/two-factor/verify — verifie le code TOTP et active la 2FA (client OU admin)
import { NextResponse } from "next/server";
import { verifySync } from "otplib";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRequestContext } from "@/lib/request-context";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  const role = session.user.role;
  let secret: string | null = null;

  if (role === "admin" && session.user.adminId) {
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.adminId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!admin?.twoFactorSecret) {
      return NextResponse.json({ error: "Configurez d'abord la 2FA" }, { status: 400 });
    }
    secret = admin.twoFactorSecret;
  } else if (role === "client" && session.user.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: session.user.clientId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!client?.twoFactorSecret) {
      return NextResponse.json({ error: "Configurez d'abord la 2FA" }, { status: 400 });
    }
    secret = client.twoFactorSecret;
  } else {
    return unauthorizedJson();
  }

  // Verifier le code
  const isValid = verifySync({ token: parsed.data.code, secret });
  if (!isValid) {
    return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
  }

  // Activer la 2FA
  if (role === "admin") {
    await prisma.admin.update({
      where: { id: session.user.adminId! },
      data: { twoFactorEnabled: true },
    });
  } else {
    await prisma.client.update({
      where: { id: session.user.clientId! },
      data: { twoFactorEnabled: true },
    });
  }

  const ctx = captureRequestContext(req);
  await logAudit({
    adminId: role === "admin" ? session.user.adminId ?? null : null,
    action: "update",
    entityType: role === "admin" ? "admin" : "clients",
    entityId: role === "admin" ? session.user.adminId! : session.user.clientId!,
    changes: { type: "2fa_enabled" },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return NextResponse.json({ success: true });
}
