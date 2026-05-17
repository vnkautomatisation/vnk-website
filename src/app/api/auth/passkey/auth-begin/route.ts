// Crée un challenge d'authentification WebAuthn (discoverable credentials).
// Pas d'auth requise — le navigateur va proposer les passkeys disponibles.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateChallenge, getRpId } from "@/lib/security/webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : null;

  let allowCredentials: Array<{ type: "public-key"; id: string; transports?: AuthenticatorTransport[] }> = [];
  if (email) {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });
    if (admin?.isActive) {
      const passkeys = await prisma.adminPasskey.findMany({
        where: { adminId: admin.id },
        select: { credentialId: true, transports: true },
      });
      allowCredentials = passkeys.map((p: { credentialId: string; transports: string | null }) => ({
        type: "public-key" as const,
        id: p.credentialId,
        transports: p.transports?.split(",").filter(Boolean) as AuthenticatorTransport[] | undefined,
      }));
    }
  }

  const challenge = generateChallenge();
  await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      email,
      purpose: "authentication",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json({
    publicKey: {
      challenge,
      rpId: getRpId(),
      timeout: 60_000,
      userVerification: "preferred",
      allowCredentials,
    },
  });
}
