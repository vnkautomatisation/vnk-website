// POST /api/auth/check-2fa — vérifie si un compte a la 2FA activée
// + détecte si l'appareil est déjà de confiance (pour skip 2FA)
// Appelé AVANT signIn pour savoir si on doit demander le code
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { deviceFingerprint } from "@/lib/security/ua-parser";
import { getRequestGeo } from "@/lib/security/geo";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  kind: z.enum(["admin", "client"]).default("client"),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  if (parsed.data.kind === "admin") {
    const admin = await prisma.admin.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true, twoFactorEnabled: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ valid: false });
    }

    const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!ok) {
      return NextResponse.json({ valid: false });
    }

    let trustedSkip = false;
    if (admin.twoFactorEnabled) {
      // Vérifier si l'appareil est déjà de confiance
      try {
        const ua = req.headers.get("user-agent") ?? "";
        const geo = await getRequestGeo().catch(() => ({ ip: null }));
        const fingerprint = await deviceFingerprint(ua, geo.ip);
        const trusted = await prisma.adminTrustedDevice.findUnique({
          where: { adminId_fingerprint: { adminId: admin.id, fingerprint } },
        });
        if (trusted && new Date(trusted.expiresAt) > new Date()) {
          trustedSkip = true;
          // Touch lastUsedAt pour montrer que l'appareil est actif
          await prisma.adminTrustedDevice.update({
            where: { id: trusted.id },
            data: { lastUsedAt: new Date() },
          }).catch(() => null);
        }
      } catch { /* non bloquant */ }
    }

    return NextResponse.json({
      valid: true,
      requires2FA: admin.twoFactorEnabled && !trustedSkip,
      trustedDeviceMatch: trustedSkip,
    });
  }

  // ── Client ──
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
