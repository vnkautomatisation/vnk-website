// ─────────────────────────────────────────────────────────
// Chiffrement AES-256-GCM des secrets stockés en base
//
// Pourquoi : si la base de données fuit (backup volé, SQL
// injection, fuite Postgres…), un attaquant verra du
// ciphertext inutilisable sans la master key.
//
// Master key : 32 octets aléatoires, stockés UNIQUEMENT
// dans la variable d'environnement CREDENTIALS_ENCRYPTION_KEY.
// Format : 64 caractères hex (32 octets × 2).
//
// Génération : openssl rand -hex 32
//
// Format de stockage : "v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
// Le préfixe "v1:" permet de versionner si on change d'algo.
// ─────────────────────────────────────────────────────────
import "server-only";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes (96 bits, recommandé pour GCM)
const KEY_LENGTH = 32; // 256 bits
const PREFIX = "v1:";

let _masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY manquante dans .env.local. " +
      "Générez une clé avec : openssl rand -hex 32"
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY invalide : doit être 64 caractères hex (32 octets)"
    );
  }
  _masterKey = Buffer.from(hex, "hex");
  if (_masterKey.length !== KEY_LENGTH) {
    throw new Error(`Clé de chiffrement invalide (taille = ${_masterKey.length})`);
  }
  return _masterKey;
}

// ─────────────────────────────────────────────────────────
// Chiffrer une chaîne (retourne une string sérialisable)
// ─────────────────────────────────────────────────────────
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ─────────────────────────────────────────────────────────
// Déchiffrer une chaîne. Retourne null si format invalide
// ou si la clé ne correspond pas (au lieu de planter, on
// laisse l'appelant gérer le cas legacy non chiffré).
// ─────────────────────────────────────────────────────────
export function decryptSecret(ciphertext: string): string | null {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith(PREFIX)) return null; // legacy non chiffré
  try {
    const parts = ciphertext.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, dataHex] = parts;
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// Détecte si une chaîne est déjà chiffrée par notre système
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// ─────────────────────────────────────────────────────────
// Helpers pour les objets credentials (chaque field chiffré
// individuellement, pour pouvoir afficher quels champs sont
// définis sans tout déchiffrer).
// ─────────────────────────────────────────────────────────
export function encryptCredentials(creds: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    out[k] = v ? encryptSecret(v) : "";
  }
  return out;
}

export function decryptCredentials(creds: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (!v) { out[k] = ""; continue; }
    const dec = decryptSecret(v);
    // Si non chiffré (legacy) : on retourne tel quel — la migration suivante chiffrera
    out[k] = dec ?? v;
  }
  return out;
}

// Codes éphémères stockés en mémoire pour le challenge 2FA mail
// (TTL 10 min, oneshot)
const challengeStore = new Map<string, { code: string; expiresAt: number; adminId: number; purpose: string }>();

export function generateEmailChallenge(adminId: number, purpose: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
  const id = crypto.randomUUID();
  challengeStore.set(id, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    adminId,
    purpose,
  });
  // Nettoyage opportuniste
  for (const [k, v] of challengeStore.entries()) {
    if (v.expiresAt < Date.now()) challengeStore.delete(k);
  }
  return JSON.stringify({ id, code });
}

export function verifyEmailChallenge(challengeId: string, code: string, adminId: number, purpose: string): boolean {
  const entry = challengeStore.get(challengeId);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) { challengeStore.delete(challengeId); return false; }
  if (entry.adminId !== adminId) return false;
  if (entry.purpose !== purpose) return false;
  if (entry.code !== code) return false;
  challengeStore.delete(challengeId); // one-shot
  return true;
}
