// ─────────────────────────────────────────────────────────
// Chiffrement AES-256-GCM pour données sensibles (info bancaire, NAS).
// Utilise ENCRYPTION_KEY (env) — clé hex 64 caractères (= 32 bytes).
//
// Format de sortie : "iv:tag:ciphertext" (tous en base64).
// Chaque chiffrement utilise un IV aléatoire de 12 bytes (recommandé GCM).
// ─────────────────────────────────────────────────────────
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY non configurée. Générer avec : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY doit faire ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} caractères hex)`);
  }
  return buf;
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptString(encrypted: string): string {
  if (!encrypted) return "";
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Format chiffré invalide");
  const key = getKey();
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

// Masque pour affichage UI (ne pas exposer la valeur entière)
export function mask(value: string, visibleEnd = 4): string {
  if (!value) return "";
  if (value.length <= visibleEnd) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleEnd) + value.slice(-visibleEnd);
}
