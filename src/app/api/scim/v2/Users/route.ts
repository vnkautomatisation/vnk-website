// SCIM 2.0 — Users collection (GET list + POST create)
// Spec : https://datatracker.ietf.org/doc/html/rfc7644
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkScimAuth, adminToScim } from "@/lib/security/scim-auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  return new URL(req.url).origin;
}

function scimError(status: number, detail: string) {
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    },
    { status }
  );
}

export async function GET(req: Request) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "";
  const startIndex = Math.max(1, Number(searchParams.get("startIndex") ?? 1));
  const count = Math.min(200, Math.max(1, Number(searchParams.get("count") ?? 100)));

  // Filtre simple : userName eq "x@y.com"
  const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  const where = match ? { email: match[1].toLowerCase().trim() } : {};

  const [users, total] = await Promise.all([
    prisma.admin.findMany({
      where,
      orderBy: { id: "asc" },
      skip: startIndex - 1,
      take: count,
      select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, updatedAt: true },
    }),
    prisma.admin.count({ where }),
  ]);

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: total,
    startIndex,
    itemsPerPage: users.length,
    Resources: users.map((u) => adminToScim(u, baseUrl(req))),
  });
}

export async function POST(req: Request) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return scimError(400, "Body invalide");

  const userName = typeof body.userName === "string" ? body.userName.toLowerCase().trim() : null;
  if (!userName || !userName.includes("@")) return scimError(400, "userName (email) requis");

  const fullName = typeof body.displayName === "string"
    ? body.displayName
    : typeof body.name?.formatted === "string"
      ? body.name.formatted
      : userName;
  const active = body.active !== false;

  const existing = await prisma.admin.findUnique({ where: { email: userName } });
  if (existing) {
    return scimError(409, "Un utilisateur avec cet email existe déjà");
  }

  // Mot de passe placeholder (le user devra utiliser SSO ou demander un reset)
  const crypto = await import("crypto");
  const passwordHash = await import("bcryptjs").then((b) => b.hash(crypto.randomBytes(32).toString("hex"), 12));

  const created = await prisma.admin.create({
    data: {
      email: userName,
      fullName,
      passwordHash,
      isActive: active,
      role: "admin",
    },
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, updatedAt: true },
  });

  await logAudit({
    adminId: null,
    action: "create",
    entityType: "admin",
    entityId: created.id,
    changes: { provisionedVia: "scim", email: userName },
  });

  return NextResponse.json(adminToScim(created, baseUrl(req)), { status: 201 });
}
