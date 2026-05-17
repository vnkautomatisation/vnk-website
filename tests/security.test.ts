// Tests unitaires sur les fonctions de sécurité critiques.
// Lance via : npm test  (utilise tsx --test, support .ts natif)
//
// Ces tests valident la logique pure (pas la DB).
// Pour la DB, prévoir un environnement de test dédié (Prisma sqlite in-memory).
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Imports directs des modules TS (résolus par tsx)
import { escapeHtml, escapeUrlForEmail } from "../src/lib/security/escape-html";
import { detectImageMagic, validateImageBuffer } from "../src/lib/security/image-magic";
import { checkRateLimit } from "../src/lib/security/rate-limit";
import { b64uEncode, b64uDecode, generateChallenge, parseAuthData } from "../src/lib/security/webauthn";
import { checkScimAuth, adminToScim } from "../src/lib/security/scim-auth";

// ──────────────────────────────────────────────────────────────
// escapeHtml
// ──────────────────────────────────────────────────────────────
test("escapeHtml échappe les caractères dangereux", () => {
  assert.equal(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
  assert.equal(escapeHtml(`Yan "&" <Co>`), "Yan &quot;&amp;&quot; &lt;Co&gt;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeUrlForEmail bloque les protocoles dangereux", () => {
  assert.equal(escapeUrlForEmail("javascript:alert(1)"), "");
  assert.equal(escapeUrlForEmail("data:text/html;base64,XYZ"), "");
  assert.equal(escapeUrlForEmail("vbscript:foo"), "");
  assert.equal(escapeUrlForEmail("file:///etc/passwd"), "");
  const safe = escapeUrlForEmail("https://vnk.ca/admin?token=abc");
  assert.ok(safe.startsWith("https:"));
});

// ──────────────────────────────────────────────────────────────
// detectImageMagic
// ──────────────────────────────────────────────────────────────
test("detectImageMagic reconnaît JPEG/PNG/GIF/WebP par magic bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const gif89 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  assert.equal(detectImageMagic(jpeg), "jpeg");
  assert.equal(detectImageMagic(png), "png");
  assert.equal(detectImageMagic(gif89), "gif");
  assert.equal(detectImageMagic(webp), "webp");
});

test("detectImageMagic rejette les fichiers non-image", () => {
  const fakeJpg = Buffer.from("This is a text file pretending to be a JPEG image");
  assert.equal(detectImageMagic(fakeJpg), null);
  const exe = Buffer.from([0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // MZ = exe windows
  assert.equal(detectImageMagic(exe), null);
});

test("validateImageBuffer rejette les formats non autorisés", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const ok = validateImageBuffer(jpeg, ["jpeg", "png"]);
  assert.equal(ok.ok, true);
  const ko = validateImageBuffer(jpeg, ["png", "webp"]);
  assert.equal(ko.ok, false);
});

// ──────────────────────────────────────────────────────────────
// checkRateLimit
// ──────────────────────────────────────────────────────────────
test("checkRateLimit fonctionne en sliding window", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    const r = checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(r.ok, true);
  }
  const blocked = checkRateLimit({ key, limit: 3, windowMs: 60_000 });
  assert.equal(blocked.ok, false);
});

// ──────────────────────────────────────────────────────────────
// WebAuthn helpers
// ──────────────────────────────────────────────────────────────
test("b64uEncode/Decode est cohérent", () => {
  const orig = Buffer.from([0, 255, 128, 64, 32, 16, 1]);
  const enc = b64uEncode(orig);
  assert.ok(!enc.includes("+"));
  assert.ok(!enc.includes("/"));
  assert.ok(!enc.includes("="));
  const dec = b64uDecode(enc);
  assert.deepEqual(dec, orig);
});

test("generateChallenge produit 32 octets uniques", () => {
  const a = generateChallenge();
  const b = generateChallenge();
  assert.notEqual(a, b);
  assert.equal(b64uDecode(a).length, 32);
});

test("parseAuthData lit le rpIdHash et les flags", () => {
  const rpIdHash = crypto.createHash("sha256").update("vnk.ca").digest();
  const flags = 0x05; // UP + UV
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(42, 0);
  const authData = Buffer.concat([rpIdHash, Buffer.from([flags]), counter]);
  const parsed = parseAuthData(authData);
  assert.deepEqual(parsed.rpIdHash, rpIdHash);
  assert.equal(parsed.flags, 0x05);
  assert.equal(parsed.signCount, 42);
});

// ──────────────────────────────────────────────────────────────
// SCIM
// ──────────────────────────────────────────────────────────────
test("checkScimAuth refuse sans bearer et accepte le bon", () => {
  process.env.SCIM_BEARER_TOKEN = "test-token-123456-abc";
  const req = new Request("https://x.test/api/scim/v2/Users");
  const res = checkScimAuth(req);
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);

  const okReq = new Request("https://x.test/api/scim/v2/Users", {
    headers: { authorization: "Bearer test-token-123456-abc" },
  });
  const okRes = checkScimAuth(okReq);
  assert.equal(okRes.ok, true);

  const wrongReq = new Request("https://x.test/api/scim/v2/Users", {
    headers: { authorization: "Bearer wrong-token-______________" },
  });
  const wrongRes = checkScimAuth(wrongReq);
  assert.equal(wrongRes.ok, false);
  assert.equal(wrongRes.status, 401);
});

test("adminToScim génère un User SCIM 2.0 valide", () => {
  const scim = adminToScim(
    {
      id: 42,
      email: "yan@vnk.ca",
      fullName: "Yan Verone",
      isActive: true,
      createdAt: new Date("2024-01-15T12:00:00Z"),
      updatedAt: new Date("2024-06-01T09:30:00Z"),
    },
    "https://vnk.ca"
  );
  assert.equal(scim.id, "42");
  assert.equal(scim.userName, "yan@vnk.ca");
  assert.equal(scim.name?.givenName, "Yan");
  assert.equal(scim.name?.familyName, "Verone");
  assert.equal(scim.active, true);
  assert.equal(scim.emails[0].primary, true);
  assert.equal(scim.meta.location, "https://vnk.ca/api/scim/v2/Users/42");
  assert.ok(scim.schemas.includes("urn:ietf:params:scim:schemas:core:2.0:User"));
});
