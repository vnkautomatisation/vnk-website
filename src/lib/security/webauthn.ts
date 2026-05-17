// ─────────────────────────────────────────────────────────
// WebAuthn helpers — implémentation minimale sans dépendance externe.
// Couvre registration + assertion pour le flow "passkey" (sans mot de passe).
//
// IMPORTANT — limites de cette implémentation :
//  - Vérification d'attestation = "none" (pas d'attestation cryptographique
//    de l'authenticator). On valide uniquement la signature lors du login,
//    ce qui suffit pour empêcher le replay et l'usurpation tant qu'on a
//    confiance dans le navigateur (modèle de menace classique passkey).
//  - Algorithmes supportés : ES256 (COSE alg -7) et RS256 (COSE alg -257).
//    Les yubikeys et passkeys Apple/Google/Microsoft utilisent ES256 par défaut.
//
// Pas de "server-only" sur ce fichier : pure crypto Node, testable directement.
// ─────────────────────────────────────────────────────────
import crypto from "crypto";

// Base64url helpers
export function b64uEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}
export function b64uDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// Generate a 32-byte random challenge (base64url string)
export function generateChallenge(): string {
  return b64uEncode(crypto.randomBytes(32));
}

// ─────────── Parsing CBOR minimal (pour authenticatorData uniquement) ───────────
// On n'utilise CBOR que pour décoder la clé publique COSE. Implémentation
// volontairement limitée aux constructions COSE EC2 et RSA standard.
function decodeCoseKey(buf: Buffer): { algorithm: number; pemKey: string } {
  // COSE_Key est un map CBOR. On lit kty (1), alg (3), crv (-1), x (-2), y (-3)
  // ou n (-1) et e (-2) pour RSA.
  let i = 0;
  function readMajorAndValue(): { major: number; value: number } {
    const b = buf[i++];
    const major = b >> 5;
    const info = b & 0x1f;
    let value: number;
    if (info < 24) value = info;
    else if (info === 24) value = buf[i++];
    else if (info === 25) { value = buf.readUInt16BE(i); i += 2; }
    else if (info === 26) { value = buf.readUInt32BE(i); i += 4; }
    else throw new Error("CBOR too large");
    return { major, value };
  }
  function readNegInt(): number {
    const { major, value } = readMajorAndValue();
    if (major === 0) return value;
    if (major === 1) return -1 - value;
    throw new Error("expected int");
  }
  function readBytes(): Buffer {
    const { major, value } = readMajorAndValue();
    if (major !== 2) throw new Error("expected bytes");
    const out = buf.subarray(i, i + value);
    i += value;
    return out;
  }

  const head = readMajorAndValue();
  if (head.major !== 5) throw new Error("COSE_Key not a map");
  const entries = head.value;

  let kty = 0, alg = 0;
  let crv = 0;
  let x: Buffer | null = null, y: Buffer | null = null;
  let n: Buffer | null = null, e: Buffer | null = null;

  for (let k = 0; k < entries; k++) {
    const key = readNegInt();
    switch (key) {
      case 1: kty = readNegInt(); break;
      case 3: alg = readNegInt(); break;
      case -1:
        if (kty === 2) crv = readNegInt();
        else n = readBytes();
        break;
      case -2:
        if (kty === 2) x = readBytes();
        else e = readBytes();
        break;
      case -3: y = readBytes(); break;
      default: {
        // skip value
        const { major, value } = readMajorAndValue();
        if (major === 2 || major === 3) i += value;
        else if (major === 4 || major === 5) {
          // not expected for our keys, but skip nested map/array best-effort
          throw new Error("Unsupported COSE structure");
        }
      }
    }
  }

  if (kty === 2 && crv === 1 && x && y) {
    // EC2 / P-256 / alg = -7 (ES256)
    const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
    const spkiPrefix = Buffer.from(
      "3059301306072a8648ce3d020106082a8648ce3d030107034200",
      "hex"
    );
    const spki = Buffer.concat([spkiPrefix, uncompressed]);
    const pem = "-----BEGIN PUBLIC KEY-----\n" +
      spki.toString("base64").match(/.{1,64}/g)!.join("\n") +
      "\n-----END PUBLIC KEY-----\n";
    return { algorithm: alg || -7, pemKey: pem };
  }

  if (kty === 3 && n && e) {
    // RSA / alg = -257 (RS256)
    // Construction manuelle d'un SPKI RSA (DER) — utilise crypto.createPublicKey
    const key = crypto.createPublicKey({
      key: { kty: "RSA", n: n.toString("base64url"), e: e.toString("base64url") },
      format: "jwk",
    });
    return { algorithm: alg || -257, pemKey: key.export({ type: "spki", format: "pem" }) as string };
  }

  throw new Error("Type COSE non supporté (uniquement ES256/RS256)");
}

// ─────────── Parsing AttestationObject (registration) ───────────
function parseAttestationObject(buf: Buffer): { authData: Buffer } {
  // attestationObject = CBOR map { fmt, attStmt, authData }
  let i = 0;
  function readByte() { return buf[i++]; }
  function readMajorAndValue(): { major: number; value: number } {
    const b = readByte();
    const major = b >> 5;
    const info = b & 0x1f;
    let value: number;
    if (info < 24) value = info;
    else if (info === 24) value = readByte();
    else if (info === 25) { value = buf.readUInt16BE(i); i += 2; }
    else if (info === 26) { value = buf.readUInt32BE(i); i += 4; }
    else throw new Error("CBOR too large");
    return { major, value };
  }
  function readString(): string {
    const { major, value } = readMajorAndValue();
    if (major !== 3) throw new Error("expected string");
    const s = buf.subarray(i, i + value).toString("utf8");
    i += value;
    return s;
  }
  function readBytes(): Buffer {
    const { major, value } = readMajorAndValue();
    if (major !== 2) throw new Error("expected bytes");
    const out = buf.subarray(i, i + value);
    i += value;
    return out;
  }
  function skipValue() {
    const { major, value } = readMajorAndValue();
    if (major === 2 || major === 3) i += value;
    else if (major === 4) {
      for (let k = 0; k < value; k++) skipValue();
    } else if (major === 5) {
      for (let k = 0; k < value; k++) { skipValue(); skipValue(); }
    }
  }

  const head = readMajorAndValue();
  if (head.major !== 5) throw new Error("attestationObject n'est pas un map CBOR");

  let authData: Buffer | null = null;
  for (let k = 0; k < head.value; k++) {
    const key = readString();
    if (key === "authData") authData = readBytes();
    else skipValue();
  }
  if (!authData) throw new Error("authData absent");
  return { authData };
}

// ─────────── Parsing authData ───────────
export type AuthData = {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credentialId?: Buffer;
  credentialPublicKey?: Buffer;
  aaguid?: Buffer;
};

export function parseAuthData(buf: Buffer): AuthData {
  if (buf.length < 37) throw new Error("authData trop court");
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const signCount = buf.readUInt32BE(33);

  const result: AuthData = { rpIdHash, flags, signCount };
  if ((flags & 0x40) !== 0) {
    // AT flag : attestedCredentialData présent
    const aaguid = buf.subarray(37, 53);
    const credLen = buf.readUInt16BE(53);
    const credentialId = buf.subarray(55, 55 + credLen);
    const credentialPublicKey = buf.subarray(55 + credLen);
    result.aaguid = aaguid;
    result.credentialId = credentialId;
    result.credentialPublicKey = credentialPublicKey;
  }
  return result;
}

// ─────────── Vérification registration ───────────
export function verifyRegistration(opts: {
  attestationObjectB64u: string;
  clientDataJSONB64u: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
}): {
  credentialId: string;
  publicKeyPem: string;
  signCount: number;
  aaguid: string | null;
  backupEligible: boolean;
  backupState: boolean;
} {
  const clientDataBuf = b64uDecode(opts.clientDataJSONB64u);
  const clientData = JSON.parse(clientDataBuf.toString("utf8"));

  if (clientData.type !== "webauthn.create") {
    throw new Error(`type inattendu : ${clientData.type}`);
  }
  if (clientData.challenge !== opts.expectedChallenge) {
    throw new Error("challenge ne correspond pas");
  }
  if (clientData.origin !== opts.expectedOrigin) {
    throw new Error(`origin invalide : ${clientData.origin}`);
  }

  const attestationObj = parseAttestationObject(b64uDecode(opts.attestationObjectB64u));
  const authData = parseAuthData(attestationObj.authData);

  const expectedRpIdHash = crypto.createHash("sha256").update(opts.expectedRpId).digest();
  if (!expectedRpIdHash.equals(authData.rpIdHash)) {
    throw new Error("rpIdHash invalide");
  }
  if ((authData.flags & 0x01) === 0) {
    throw new Error("user presence flag manquant");
  }
  if (!authData.credentialId || !authData.credentialPublicKey) {
    throw new Error("credentialId / publicKey absent");
  }

  const cose = decodeCoseKey(authData.credentialPublicKey);

  return {
    credentialId: b64uEncode(authData.credentialId),
    publicKeyPem: cose.pemKey,
    signCount: authData.signCount,
    aaguid: authData.aaguid ? authData.aaguid.toString("hex") : null,
    backupEligible: (authData.flags & 0x08) !== 0,
    backupState: (authData.flags & 0x10) !== 0,
  };
}

// ─────────── Vérification assertion (login) ───────────
export function verifyAssertion(opts: {
  authenticatorDataB64u: string;
  clientDataJSONB64u: string;
  signatureB64u: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  publicKeyPem: string;
  previousCounter: number;
}): { newSignCount: number } {
  const clientDataBuf = b64uDecode(opts.clientDataJSONB64u);
  const clientData = JSON.parse(clientDataBuf.toString("utf8"));
  if (clientData.type !== "webauthn.get") {
    throw new Error(`type inattendu : ${clientData.type}`);
  }
  if (clientData.challenge !== opts.expectedChallenge) {
    throw new Error("challenge ne correspond pas");
  }
  if (clientData.origin !== opts.expectedOrigin) {
    throw new Error("origin invalide");
  }

  const authDataBuf = b64uDecode(opts.authenticatorDataB64u);
  const parsed = parseAuthData(authDataBuf);

  const expectedRpIdHash = crypto.createHash("sha256").update(opts.expectedRpId).digest();
  if (!expectedRpIdHash.equals(parsed.rpIdHash)) {
    throw new Error("rpIdHash invalide");
  }
  if ((parsed.flags & 0x01) === 0) {
    throw new Error("user presence manquant");
  }

  // Le signedData = authenticatorData || sha256(clientDataJSON)
  const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
  const signedData = Buffer.concat([authDataBuf, clientDataHash]);

  // Détecter algo via le PEM (ES256 vs RS256). On essaie ES256 d'abord.
  const sig = b64uDecode(opts.signatureB64u);
  let valid = false;
  try {
    valid = crypto.verify("sha256", signedData, { key: opts.publicKeyPem, dsaEncoding: "der" }, sig);
  } catch {
    valid = false;
  }
  if (!valid) {
    // Retry sans dsaEncoding (RSA)
    valid = crypto.verify("sha256", signedData, opts.publicKeyPem, sig);
  }
  if (!valid) throw new Error("signature WebAuthn invalide");

  // Vérifier counter (anti-clone)
  if (parsed.signCount > 0 && parsed.signCount <= opts.previousCounter) {
    throw new Error("counter régressé (passkey potentiellement clonée)");
  }

  return { newSignCount: parsed.signCount };
}

// ─────────── Config helpers ───────────
export function getRpId(): string {
  const url = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
  return new URL(url).hostname;
}
export function getOrigin(): string {
  const url = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
  return new URL(url).origin;
}
