// Crée un challenge de registration WebAuthn pour l'admin connecté.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChallenge, getRpId } from "@/lib/security/webauthn";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, fullName: true },
  });
  if (!admin) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const existing = await prisma.adminPasskey.findMany({
    where: { adminId },
    select: { credentialId: true },
  });

  const challenge = generateChallenge();
  await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      adminId,
      purpose: "registration",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json({
    publicKey: {
      challenge,
      rp: { id: getRpId(), name: "VNK Automatisation" },
      user: {
        id: Buffer.from(`admin-${admin.id}`).toString("base64url"),
        name: admin.email,
        displayName: admin.fullName || admin.email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
      excludeCredentials: existing.map((c: { credentialId: string }) => ({
        type: "public-key" as const,
        id: c.credentialId,
      })),
    },
  });
}
