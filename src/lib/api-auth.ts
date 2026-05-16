// Helper pour authentifier les requêtes API via Bearer token (AdminApiToken).
// Vérifie : token valide · non révoqué · non expiré · scope requis.
import "server-only";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type ApiTokenContext = {
  tokenId: number;
  adminId: number;
  scopes: string[];
};

export async function authenticateApiToken(
  req: NextRequest,
  requiredScope?: string
): Promise<{ ok: true; ctx: ApiTokenContext } | { ok: false; response: NextResponse }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, response: NextResponse.json({ error: "Header Authorization manquant" }, { status: 401 }) };
  }
  const token = match[1].trim();
  if (!token.startsWith("vnk_pat_")) {
    return { ok: false, response: NextResponse.json({ error: "Format de token invalide" }, { status: 401 }) };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await prisma.adminApiToken.findFirst({
    where: { tokenHash },
    include: { admin: { select: { isActive: true, lockedUntil: true } } },
  });

  if (!record) {
    return { ok: false, response: NextResponse.json({ error: "Token invalide" }, { status: 401 }) };
  }
  if (record.revokedAt) {
    return { ok: false, response: NextResponse.json({ error: "Token révoqué" }, { status: 401 }) };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return { ok: false, response: NextResponse.json({ error: "Token expiré" }, { status: 401 }) };
  }
  if (!record.admin.isActive) {
    return { ok: false, response: NextResponse.json({ error: "Compte associé désactivé" }, { status: 401 }) };
  }
  if (record.admin.lockedUntil && record.admin.lockedUntil > new Date()) {
    return { ok: false, response: NextResponse.json({ error: "Compte associé bloqué" }, { status: 401 }) };
  }

  const scopes = record.scopes as string[];
  if (requiredScope && !scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Scope requis : ${requiredScope}` }, { status: 403 }),
    };
  }

  // Mise à jour lastUsed (fire-and-forget)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  prisma.adminApiToken
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ip },
    })
    .catch(() => {});

  return {
    ok: true,
    ctx: { tokenId: record.id, adminId: record.adminId, scopes },
  };
}
