// Token behind the "Ce n'etait pas moi" link: HMAC over sessionId + adminId, 7 days.
// Not in the route file: a route may only export handlers.
import crypto from "crypto";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "fallback")
    .update(payload)
    .digest("base64url");
}

export function buildNotMeToken(sessionId: string, adminId: number): string {
  const payload = Buffer.from(JSON.stringify({ sessionId, adminId, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyNotMeToken(token: string): { sessionId: string; adminId: number } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    if (sign(payload) !== sig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.sessionId !== "string" || typeof data.adminId !== "number") return null;
    if (typeof data.iat !== "number" || Date.now() - data.iat > TTL_MS) return null;
    return { sessionId: data.sessionId, adminId: data.adminId };
  } catch {
    return null;
  }
}
