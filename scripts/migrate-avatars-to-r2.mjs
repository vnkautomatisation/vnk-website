#!/usr/bin/env node
// ─────────────────────────────────────────────────────────
// Migration des avatars stockés en base64 (data:image/...) vers R2/S3.
// À lancer une fois après avoir configuré STORAGE_BACKEND=r2|s3
// et les autres variables STORAGE_*.
//
// Usage :
//   node scripts/migrate-avatars-to-r2.mjs            # dry-run
//   node scripts/migrate-avatars-to-r2.mjs --apply    # exécution réelle
//
// Idempotent : un avatar déjà URL distante est sauté. Compte les bytes
// économisés en BD à la fin.
// ─────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// ─── Signature AWS SigV4 (copie de src/lib/storage/object-storage.ts) ───
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function hmac(key, data) { return crypto.createHmac("sha256", key).update(data).digest(); }
function getSigningKey(secret, date, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, "utf8"), date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

const backend = (process.env.STORAGE_BACKEND || "").toLowerCase();
const bucket = process.env.STORAGE_BUCKET;
const region = process.env.STORAGE_REGION || (backend === "r2" ? "auto" : "us-east-1");
const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;
const publicBase = process.env.STORAGE_PUBLIC_BASE_URL;

function endpoint() {
  if (backend === "r2") {
    const ep = process.env.STORAGE_ENDPOINT;
    if (!ep) throw new Error("STORAGE_ENDPOINT requis pour R2");
    return ep.replace(/\/$/, "");
  }
  return `https://s3.${region}.amazonaws.com`;
}
function publicUrl(key) {
  if (publicBase) return `${publicBase.replace(/\/$/, "")}/${key}`;
  if (backend === "r2") return `${endpoint()}/${bucket}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function uploadBuffer(buf, key, mime) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const url = `${endpoint()}/${bucket}/${key}`;
  const u = new URL(url);
  const payloadHash = sha256(buf);

  const headers = {
    host: u.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "content-type": mime,
    "cache-control": "public, max-age=31536000, immutable",
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const canonicalRequest = ["PUT", u.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signature = crypto.createHmac("sha256", getSigningKey(secretKey, dateStamp, region, "s3")).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, authorization },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`PUT ${res.status} ${res.statusText}: ${t.slice(0, 200)}`);
  }
}

function parseDataUrl(s) {
  const m = s.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], "base64") };
}

function extFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function main() {
  if (!backend || backend === "local") {
    console.error("STORAGE_BACKEND doit être 'r2' ou 's3'. Actuellement :", backend || "(non défini)");
    process.exit(1);
  }
  if (!bucket || !accessKey || !secretKey) {
    console.error("STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY requis.");
    process.exit(1);
  }

  console.log(`\nMode : ${APPLY ? "APPLY (modifications réelles)" : "DRY-RUN (aucune écriture)"}`);
  console.log(`Backend : ${backend.toUpperCase()} · Bucket : ${bucket} · Région : ${region}\n`);

  // ─── 1. Admins avec avatar base64 ───
  console.log("Recherche des avatars admin en base64…");
  const admins = await prisma.admin.findMany({
    where: { avatarUrl: { startsWith: "data:" } },
    select: { id: true, email: true, avatarUrl: true },
  });
  console.log(`  → ${admins.length} admin(s) trouvé(s)\n`);

  let okAdmin = 0, errAdmin = 0, totalBytes = 0;
  for (const a of admins) {
    const parsed = parseDataUrl(a.avatarUrl);
    if (!parsed) { console.warn(`  ✗ admin#${a.id} (${a.email}) — data URL invalide`); errAdmin++; continue; }

    const ext = extFromMime(parsed.mime);
    const id = crypto.randomBytes(8).toString("hex");
    const key = `admin/${a.id}/${Date.now()}-${id}.${ext}`;
    totalBytes += a.avatarUrl.length;

    if (APPLY) {
      try {
        await uploadBuffer(parsed.buf, key, parsed.mime);
        await prisma.admin.update({
          where: { id: a.id },
          data: { avatarUrl: publicUrl(key) },
        });
        console.log(`  ✓ admin#${a.id} (${a.email}) → ${publicUrl(key)}`);
        okAdmin++;
      } catch (err) {
        console.error(`  ✗ admin#${a.id} (${a.email}) — ${err.message}`);
        errAdmin++;
      }
    } else {
      console.log(`  · admin#${a.id} (${a.email}) → ${publicUrl(key)} [${(parsed.buf.length / 1024).toFixed(1)} KB]`);
      okAdmin++;
    }
  }

  // ─── 2. Clients avec avatar base64 ───
  console.log("\nRecherche des avatars client en base64…");
  const clients = await prisma.client.findMany({
    where: { avatarUrl: { startsWith: "data:" } },
    select: { id: true, email: true, avatarUrl: true },
  });
  console.log(`  → ${clients.length} client(s) trouvé(s)\n`);

  let okClient = 0, errClient = 0;
  for (const c of clients) {
    const parsed = parseDataUrl(c.avatarUrl);
    if (!parsed) { console.warn(`  ✗ client#${c.id} (${c.email}) — data URL invalide`); errClient++; continue; }

    const ext = extFromMime(parsed.mime);
    const id = crypto.randomBytes(8).toString("hex");
    const key = `client/${c.id}/${Date.now()}-${id}.${ext}`;
    totalBytes += c.avatarUrl.length;

    if (APPLY) {
      try {
        await uploadBuffer(parsed.buf, key, parsed.mime);
        await prisma.client.update({
          where: { id: c.id },
          data: { avatarUrl: publicUrl(key) },
        });
        console.log(`  ✓ client#${c.id} (${c.email}) → ${publicUrl(key)}`);
        okClient++;
      } catch (err) {
        console.error(`  ✗ client#${c.id} (${c.email}) — ${err.message}`);
        errClient++;
      }
    } else {
      console.log(`  · client#${c.id} (${c.email}) → ${publicUrl(key)} [${(parsed.buf.length / 1024).toFixed(1)} KB]`);
      okClient++;
    }
  }

  console.log("\n────────────────────────────────────────────");
  console.log(`Résumé :`);
  console.log(`  Admins migrés  : ${okAdmin} OK · ${errAdmin} erreurs`);
  console.log(`  Clients migrés : ${okClient} OK · ${errClient} erreurs`);
  console.log(`  Espace BD libéré : ~${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (!APPLY) console.log("\n  ⚠️  Dry-run — relancez avec --apply pour exécuter réellement.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Erreur :", err);
  await prisma.$disconnect();
  process.exit(1);
});
