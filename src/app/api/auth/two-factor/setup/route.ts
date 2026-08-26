// POST /api/auth/two-factor/setup — genere un secret TOTP + QR code (client OU admin)
import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const role = session.user.role;

  let email: string | null = null;
  let alreadyEnabled = false;

  if (role === "admin" && session.user.adminId) {
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.adminId },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!admin) return NextResponse.json({ error: "Admin introuvable" }, { status: 404 });
    email = admin.email;
    alreadyEnabled = admin.twoFactorEnabled;
  } else if (role === "client" && session.user.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: session.user.clientId },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    email = client.email;
    alreadyEnabled = client.twoFactorEnabled;
  } else {
    return unauthorizedJson();
  }

  if (alreadyEnabled) {
    return NextResponse.json({ error: "2FA deja active" }, { status: 409 });
  }

  // Generer le secret
  const secret = generateSecret();

  // Sauvegarder temporairement (pas encore active)
  if (role === "admin") {
    await prisma.admin.update({
      where: { id: session.user.adminId! },
      data: { twoFactorSecret: secret },
    });
  } else {
    await prisma.client.update({
      where: { id: session.user.clientId! },
      data: { twoFactorSecret: secret },
    });
  }

  // Generer l'URL otpauth et le QR code
  const otpauthUrl = generateURI({ issuer: "VNK Automatisation", label: email!, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ secret, qrCode: qrCodeDataUrl });
}
