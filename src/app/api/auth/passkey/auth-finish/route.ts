// Finalise une authentification WebAuthn et renvoie un token one-shot
// que login-form échangera avec NextAuth signIn("admin-passkey").
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyAssertion, getRpId, getOrigin } from "@/lib/security/webauthn";
import { logSecurityEvent } from "@/lib/security/security-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const { id, response } = body as {
    id?: string;
    response?: {
      authenticatorData?: string;
      clientDataJSON?: string;
      signature?: string;
      userHandle?: string;
    };
  };
  if (!id || !response?.authenticatorData || !response?.clientDataJSON || !response?.signature) {
    return NextResponse.json({ error: "Données WebAuthn manquantes" }, { status: 400 });
  }

  const passkey = await prisma.adminPasskey.findUnique({
    where: { credentialId: id },
    include: { admin: { select: { id: true, email: true, isActive: true } } },
  });
  if (!passkey || !passkey.admin.isActive) {
    return NextResponse.json({ error: "Passkey introuvable ou compte inactif" }, { status: 401 });
  }

  // Récupérer challenge
  const clientData = JSON.parse(Buffer.from(response.clientDataJSON, "base64url").toString("utf8")) as { challenge: string };
  const challenge = await prisma.webAuthnChallenge.findUnique({
    where: { challenge: clientData.challenge },
  });
  if (!challenge || challenge.purpose !== "authentication") {
    return NextResponse.json({ error: "Challenge introuvable" }, { status: 400 });
  }
  if (challenge.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge expiré" }, { status: 400 });
  }

  try {
    const { newSignCount } = verifyAssertion({
      authenticatorDataB64u: response.authenticatorData,
      clientDataJSONB64u: response.clientDataJSON,
      signatureB64u: response.signature,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getOrigin(),
      expectedRpId: getRpId(),
      publicKeyPem: passkey.publicKey,
      previousCounter: Number(passkey.counter),
    });
    await prisma.adminPasskey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(newSignCount), lastUsedAt: new Date() },
    });
  } catch (err) {
    await logSecurityEvent({
      adminId: passkey.admin.id,
      type: "login_failed",
      severity: "critical",
      message: "Tentative passkey rejetée (signature/counter invalide)",
      metadata: { reason: err instanceof Error ? err.message : "?" },
    });
    return NextResponse.json({ error: "Vérification échouée" }, { status: 401 });
  }

  // Émettre un token one-shot signé que login-form passera à NextAuth
  // (stocké en BD avec expiration courte pour éviter le replay)
  const oneShotToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(oneShotToken).digest("hex");
  await prisma.webAuthnChallenge.create({
    data: {
      challenge: tokenHash,
      adminId: passkey.admin.id,
      purpose: "auth-token", // distinct purpose
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    },
  });

  // Cleanup challenge
  await prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }).catch(() => null);

  return NextResponse.json({
    success: true,
    email: passkey.admin.email,
    token: oneShotToken,
  });
}
