// ─────────────────────────────────────────────────────────
// Validation magic bytes pour images uploadées.
// Le Content-Type HTTP est manipulable ; on vérifie les 1ers octets
// pour s'assurer du format réel.
// Pure utilité — utilisable en tests.
// ─────────────────────────────────────────────────────────

export type DetectedImage = "jpeg" | "png" | "webp" | "gif" | null;

export function detectImageMagic(buf: Buffer | Uint8Array): DetectedImage {
  const b = buf instanceof Buffer ? buf : Buffer.from(buf);
  if (b.length < 12) return null;

  // JPEG : FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "png";
  // GIF : "GIF87a" ou "GIF89a"
  if (
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 &&
    b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  ) return "gif";
  // WebP : "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "webp";

  return null;
}

// Mappe le magic detecté vers le MIME canonique
const MAGIC_TO_MIME: Record<NonNullable<DetectedImage>, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function validateImageBuffer(
  buf: Buffer | Uint8Array,
  allowed: Array<NonNullable<DetectedImage>> = ["jpeg", "png", "gif", "webp"]
): { ok: true; mime: string; format: NonNullable<DetectedImage> } | { ok: false; error: string } {
  const fmt = detectImageMagic(buf);
  if (!fmt) {
    return { ok: false, error: "Fichier non reconnu comme image (magic bytes invalides)" };
  }
  if (!allowed.includes(fmt)) {
    return { ok: false, error: `Format ${fmt} non autorisé` };
  }
  return { ok: true, mime: MAGIC_TO_MIME[fmt], format: fmt };
}
