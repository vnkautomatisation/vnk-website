// SCIM 2.0 — Users resource (GET / PUT / PATCH / DELETE)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkScimAuth, adminToScim } from "@/lib/security/scim-auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  return new URL(req.url).origin;
}
function scimError(status: number, detail: string) {
  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    status: String(status),
    detail,
  }, { status });
}

async function loadUser(id: string) {
  const n = Number(id);
  if (!n) return null;
  return prisma.admin.findUnique({
    where: { id: n },
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, updatedAt: true },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);
  const { id } = await ctx.params;
  const user = await loadUser(id);
  if (!user) return scimError(404, "User non trouvé");
  return NextResponse.json(adminToScim(user, baseUrl(req)));
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);
  const { id } = await ctx.params;
  const user = await loadUser(id);
  if (!user) return scimError(404, "User non trouvé");

  const body = await req.json().catch(() => null);
  if (!body) return scimError(400, "Body invalide");

  const updated = await prisma.admin.update({
    where: { id: user.id },
    data: {
      fullName: typeof body.displayName === "string"
        ? body.displayName
        : typeof body.name?.formatted === "string"
          ? body.name.formatted
          : user.fullName,
      isActive: body.active !== false,
    },
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, updatedAt: true },
  });

  await logAudit({
    adminId: null, action: "update", entityType: "admin", entityId: user.id,
    changes: { via: "scim", active: body.active !== false },
  });

  return NextResponse.json(adminToScim(updated, baseUrl(req)));
}

// PATCH SCIM (PatchOp) — gère { op: "replace", path: "active", value: false }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);
  const { id } = await ctx.params;
  const user = await loadUser(id);
  if (!user) return scimError(404, "User non trouvé");

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.Operations)) return scimError(400, "Body PatchOp invalide");

  const data: Record<string, unknown> = {};
  for (const op of body.Operations) {
    const path = String(op.path ?? "").toLowerCase();
    const value = op.value;
    if (path === "active") data.isActive = !!value;
    else if (path === "displayname" || path === "name.formatted") data.fullName = String(value);
    else if (path === "" && typeof value === "object" && value !== null) {
      // op sans path : applique tout l'objet
      if ("active" in value) data.isActive = !!value.active;
      if ("displayName" in value) data.fullName = String(value.displayName);
    }
  }

  if (Object.keys(data).length === 0) return NextResponse.json(adminToScim(user, baseUrl(req)));

  const updated = await prisma.admin.update({
    where: { id: user.id },
    data: data as never,
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, updatedAt: true },
  });

  // Si désactivation → invalider sessions
  if (data.isActive === false) {
    await prisma.admin.update({ where: { id: user.id }, data: { sessionsInvalidatedAt: new Date() } });
    await prisma.adminSession.deleteMany({ where: { adminId: user.id } });
  }

  await logAudit({
    adminId: null, action: "update", entityType: "admin", entityId: user.id,
    changes: { via: "scim_patch", ...data },
  });

  return NextResponse.json(adminToScim(updated, baseUrl(req)));
}

// SCIM DELETE → désactivation logique (préserve historique)
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = checkScimAuth(req);
  if (!auth.ok) return scimError(auth.status, auth.error);
  const { id } = await ctx.params;
  const user = await loadUser(id);
  if (!user) return scimError(404, "User non trouvé");

  await prisma.admin.update({
    where: { id: user.id },
    data: { isActive: false, sessionsInvalidatedAt: new Date(), endDate: new Date() },
  });
  await prisma.adminSession.deleteMany({ where: { adminId: user.id } });

  await logAudit({
    adminId: null, action: "delete", entityType: "admin", entityId: user.id,
    changes: { via: "scim_delete" },
  });

  return new NextResponse(null, { status: 204 });
}
