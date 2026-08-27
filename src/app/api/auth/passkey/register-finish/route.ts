// Valide la registration WebAuthn et stocke la passkey.
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRegistration, getRpId, getOrigin } from "@/lib/security/webauthn";
import { logSecurityEvent } from "@/lib/security/security-events";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const { id, response, deviceLabel } = body as {
    id?: string;
    response?: { attestationObject?: string; clientDataJSON?: string; transports?: string[] };
    deviceLabel?: string;
  };
  if (!id || !response?.attestationObject || !response?.clientDataJSON) {
    return NextResponse.json({ error: t("donnees_webauthn_manquantes") }, { status: 400 });
  }

  // Récupérer le challenge en attente
  const clientData = JSON.parse(Buffer.from(response.clientDataJSON, "base64url").toString("utf8")) as { challenge: string };
  const challenge = await prisma.webAuthnChallenge.findUnique({
    where: { challenge: clientData.challenge },
  });
  if (!challenge || challenge.adminId !== adminId || challenge.purpose !== "registration") {
    return NextResponse.json({ error: t("challenge_introuvable_ou_perime") }, { status: 400 });
  }
  if (challenge.expiresAt < new Date()) {
    return NextResponse.json({ error: t("challenge_expire") }, { status: 400 });
  }

  let verified;
  try {
    verified = verifyRegistration({
      attestationObjectB64u: response.attestationObject,
      clientDataJSONB64u: response.clientDataJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getOrigin(),
      expectedRpId: getRpId(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : t("verification_echouee") },
      { status: 400 }
    );
  }

  // Vérifier que ce credentialId n'existe pas déjà
  const exists = await prisma.adminPasskey.findUnique({
    where: { credentialId: verified.credentialId },
  });
  if (exists) {
    return NextResponse.json({ error: t("cette_passkey_est_deja_enregistree") }, { status: 409 });
  }

  await prisma.adminPasskey.create({
    data: {
      adminId,
      credentialId: verified.credentialId,
      publicKey: verified.publicKeyPem,
      counter: BigInt(verified.signCount),
      transports: Array.isArray(response.transports) ? response.transports.join(",") : null,
      deviceLabel: deviceLabel?.slice(0, 80) ?? null,
      backupEligible: verified.backupEligible,
      backupState: verified.backupState,
      aaguid: verified.aaguid,
    },
  });

  // Nettoyer le challenge utilisé
  await prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }).catch(() => null);

  await logSecurityEvent({
    adminId,
    type: "passkey_added",
    severity: "success",
    message: `Passkey ajoutée${deviceLabel ? ` : ${deviceLabel}` : ""}`,
    metadata: { credentialId: verified.credentialId.slice(0, 8) + "…", aaguid: verified.aaguid },
  });

  return NextResponse.json({ success: true });
}
