// POST /api/auth/two-factor/setup — genere un secret TOTP + QR code
import { NextResponse } from "next/server";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  if (client.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA deja active" }, { status: 409 });
  }

  // Generer le secret
  const secret = generateSecret();

  // Sauvegarder temporairement (pas encore active)
  await prisma.client.update({
    where: { id: session.user.clientId },
    data: { twoFactorSecret: secret },
  });

  // Generer l'URL otpauth et le QR code
  const otpauthUrl = generateURI({ issuer: "VNK Automatisation", label: client.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({
    secret,
    qrCode: qrCodeDataUrl,
  });
}
