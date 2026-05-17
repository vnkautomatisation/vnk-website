// ─────────────────────────────────────────────────────────
// Abstraction de stockage d'objets (avatars, signatures, etc.)
// Backends supportés :
//  - "r2"    : Cloudflare R2 (compatible S3, sans AWS SDK)
//  - "s3"    : Amazon S3 (signature SigV4 minimale)
//  - "local" : fallback = data URL base64 stockée en BD (legacy)
//
// Variables d'environnement :
//   STORAGE_BACKEND=r2|s3|local           (défaut: local)
//   STORAGE_BUCKET=…
//   STORAGE_REGION=…                       (R2: "auto", S3: "us-east-1"…)
//   STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com  (R2 seulement)
//   STORAGE_PUBLIC_BASE_URL=https://cdn.vnk.ca                   (URL publique CDN)
//   STORAGE_ACCESS_KEY_ID=…
//   STORAGE_SECRET_ACCESS_KEY=…
// ─────────────────────────────────────────────────────────
import "server-only";
import crypto from "crypto";

type StorageBackend = "r2" | "s3" | "local";

export type UploadResult =
  | { kind: "remote"; url: string; key: string }
  | { kind: "local"; dataUrl: string };

function backend(): StorageBackend {
  const v = (process.env.STORAGE_BACKEND || "").toLowerCase();
  if (v === "r2" || v === "s3") return v;
  return "local";
}

function bucket(): string {
  const b = process.env.STORAGE_BUCKET;
  if (!b) throw new Error("STORAGE_BUCKET non défini");
  return b;
}

function region(): string {
  return process.env.STORAGE_REGION || (backend() === "r2" ? "auto" : "us-east-1");
}

function endpoint(): string {
  if (backend() === "r2") {
    const ep = process.env.STORAGE_ENDPOINT;
    if (!ep) throw new Error("STORAGE_ENDPOINT requis pour R2");
    return ep.replace(/\/$/, "");
  }
  return `https://s3.${region()}.amazonaws.com`;
}

function publicUrl(key: string): string {
  const base = process.env.STORAGE_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  // Fallback : URL directe bucket (utilisable si bucket public)
  if (backend() === "r2") return `${endpoint()}/${bucket()}/${key}`;
  return `https://${bucket()}.s3.${region()}.amazonaws.com/${key}`;
}

// ───────── Signature AWS SigV4 (suffit pour R2 + S3) ─────────
function sha256(s: string | Buffer): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function hmac(key: Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function getSigningKey(secret: string, date: string, reg: string, service: string): Buffer {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, "utf8"), date);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function signedRequest(opts: {
  method: "PUT" | "DELETE" | "GET";
  key: string;
  body?: Buffer;
  contentType?: string;
  cacheControl?: string;
}): Promise<Response> {
  const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
  const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) throw new Error("STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY manquants");

  const service = "s3";
  const reg = region();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const url = `${endpoint()}/${bucket()}/${opts.key}`;
  const u = new URL(url);
  const host = u.host;
  const canonicalUri = u.pathname;
  const payloadHash = opts.body ? sha256(opts.body) : sha256("");

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  if (opts.cacheControl) headers["cache-control"] = opts.cacheControl;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    "", // query
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${reg}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(secretKey, dateStamp, reg, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method: opts.method,
    headers: { ...headers, authorization },
    // Buffer → Uint8Array (BodyInit compatible) ; pas de body pour DELETE/GET
    body: opts.body ? new Uint8Array(opts.body) : undefined,
  });
}

// ───────── API publique ─────────

/**
 * Upload un buffer d'image. Si backend = local, renvoie un dataUrl (legacy BD).
 * Sinon, upload sur R2/S3 et renvoie l'URL publique.
 */
export async function uploadAvatar(opts: {
  buffer: Buffer;
  mime: string;
  /** Préfixe optionnel (ex: "admin/42"). Sinon = "avatars". */
  prefix?: string;
}): Promise<UploadResult> {
  const ext = opts.mime === "image/png" ? "png"
    : opts.mime === "image/webp" ? "webp"
      : opts.mime === "image/gif" ? "gif"
        : "jpg";
  const id = crypto.randomBytes(8).toString("hex");
  const key = `${opts.prefix ?? "avatars"}/${Date.now()}-${id}.${ext}`;

  if (backend() === "local") {
    return {
      kind: "local",
      dataUrl: `data:${opts.mime};base64,${opts.buffer.toString("base64")}`,
    };
  }

  const res = await signedRequest({
    method: "PUT",
    key,
    body: opts.buffer,
    contentType: opts.mime,
    cacheControl: "public, max-age=31536000, immutable",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload échec (${res.status}) : ${txt.slice(0, 200)}`);
  }

  return { kind: "remote", url: publicUrl(key), key };
}

/**
 * Supprime un objet distant si l'URL pointe vers notre bucket.
 * Sans effet en mode local (data URL).
 */
export async function deleteRemoteAvatar(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;
  if (avatarUrl.startsWith("data:")) return; // legacy, rien à supprimer
  if (backend() === "local") return;

  const base = process.env.STORAGE_PUBLIC_BASE_URL || `${endpoint()}/${bucket()}`;
  if (!avatarUrl.startsWith(base.replace(/\/$/, ""))) return; // pas notre bucket
  const key = avatarUrl.replace(base.replace(/\/$/, "") + "/", "");
  try {
    await signedRequest({ method: "DELETE", key });
  } catch (err) {
    console.error("[storage] delete failed", err);
  }
}

export function isRemoteStorageEnabled(): boolean {
  return backend() !== "local";
}
