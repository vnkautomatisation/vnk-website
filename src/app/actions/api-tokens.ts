"use server";
// Server Actions — gestion des AdminApiToken.
import { z } from "zod";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  // Enforcement matrice : ecriture requise sur la/les ressource(s) du module.
  const { getCurrentAdminPermissions, canAct } = await import("@/lib/permissions");
  const perms = await getCurrentAdminPermissions();
  if (!(canAct(perms, "settings", "write") || canAct(perms, "integrations", "write"))) return null;
  return session.user.adminId!;
}

export const SCOPES = [
  "read:clients", "write:clients",
  "read:invoices", "write:invoices",
  "read:quotes", "write:quotes",
  "read:contracts", "write:contracts",
  "read:mandates", "write:mandates",
  "read:payments", "write:payments",
  "read:documents", "write:documents",
  "read:catalogs", "write:catalogs",
  "read:reports",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string()).min(1),
  expiresInDays: z.number().int().min(0).max(365 * 5).optional(),
});

export async function createApiTokenAction(input: z.infer<typeof createSchema>): Promise<Result<{ token: string }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const raw = crypto.randomBytes(32).toString("base64url");
  const token = `vnk_pat_${raw}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const prefix = token.slice(0, 16);

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.adminApiToken.create({
    data: {
      adminId,
      name: parsed.data.name,
      tokenHash,
      prefix,
      scopes: parsed.data.scopes,
      expiresAt,
    },
  });

  await logAudit({ adminId, action: "create", entityType: "api_token", changes: { name: parsed.data.name, scopes: parsed.data.scopes } });
  revalidatePath("/admin/settings/api");
  return { success: true, data: { token } };
}

export async function revokeApiTokenAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

  await prisma.adminApiToken.update({
    where: { id: input.id, adminId },
    data: { revokedAt: new Date() },
  });

  await logAudit({ adminId, action: "delete", entityType: "api_token", entityId: input.id });
  revalidatePath("/admin/settings/api");
  return { success: true };
}

export async function deleteApiTokenAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

  await prisma.adminApiToken.delete({ where: { id: input.id, adminId } });

  await logAudit({ adminId, action: "delete", entityType: "api_token", entityId: input.id });
  revalidatePath("/admin/settings/api");
  return { success: true };
}
