"use server";
// CRUD des sous-équipes (Team) — gestion hiérarchique.
// Requiert permission users:write (même garde que les rôles/postes).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  const can = isSuper || (perms.users ?? []).includes("write");
  return can ? adminId : null;
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  leadAdminId: z.number().int().nullable().optional(),
  parentTeamId: z.number().int().nullable().optional(),
});

export async function createTeamAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireWrite();
  if (!adminId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Empêcher cycle si parentTeamId pointe vers une équipe qui est descendante
  if (parsed.data.parentTeamId) {
    const parent = await prisma.team.findUnique({ where: { id: parsed.data.parentTeamId } });
    if (!parent) return { success: false, error: "Équipe parente introuvable" };
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? "#0F2D52",
      leadAdminId: parsed.data.leadAdminId ?? null,
      parentTeamId: parsed.data.parentTeamId ?? null,
    },
    select: { id: true },
  });

  await logAudit({
    adminId, action: "create", entityType: "team", entityId: team.id,
    changes: { name: parsed.data.name },
  });

  revalidatePath("/admin/settings/team");
  return { success: true, data: { id: team.id } };
}

const updateSchema = createSchema.extend({ id: z.number().int() });

export async function updateTeamAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const adminId = await requireWrite();
  if (!adminId) return unauthorized();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Anti-cycle : la team ne peut pas se choisir elle-même OU un de ses descendants comme parent.
  if (parsed.data.parentTeamId) {
    if (parsed.data.parentTeamId === parsed.data.id) {
      return { success: false, error: "Une équipe ne peut pas être son propre parent" };
    }
    // Vérifier qu'on ne crée pas de boucle (parent → ... → cette team)
    let cursor: number | null = parsed.data.parentTeamId;
    const visited = new Set<number>();
    while (cursor != null) {
      if (cursor === parsed.data.id) {
        return { success: false, error: "Cycle détecté dans la hiérarchie des équipes" };
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const next: { parentTeamId: number | null } | null = await prisma.team.findUnique({
        where: { id: cursor }, select: { parentTeamId: true },
      });
      cursor = next?.parentTeamId ?? null;
    }
  }

  await prisma.team.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? undefined,
      leadAdminId: parsed.data.leadAdminId ?? null,
      parentTeamId: parsed.data.parentTeamId ?? null,
    },
  });

  await logAudit({
    adminId, action: "update", entityType: "team", entityId: parsed.data.id,
    changes: { name: parsed.data.name },
  });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

export async function deleteTeamAction(input: { id: number }): Promise<Result> {
  const adminId = await requireWrite();
  if (!adminId) return unauthorized();

  // Détacher les membres avant suppression
  await prisma.$transaction([
    prisma.admin.updateMany({ where: { teamId: input.id }, data: { teamId: null } }),
    prisma.team.updateMany({ where: { parentTeamId: input.id }, data: { parentTeamId: null } }),
    prisma.team.delete({ where: { id: input.id } }),
  ]);

  await logAudit({ adminId, action: "delete", entityType: "team", entityId: input.id });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

const assignSchema = z.object({
  adminId: z.number().int(),
  teamId: z.number().int().nullable(),
  managerId: z.number().int().nullable().optional(),
});

export async function assignAdminToTeamAction(input: z.infer<typeof assignSchema>): Promise<Result> {
  const actorId = await requireWrite();
  if (!actorId) return unauthorized();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Anti-cycle manager : on ne peut pas être son propre manager
  if (parsed.data.managerId && parsed.data.managerId === parsed.data.adminId) {
    return { success: false, error: "Un utilisateur ne peut pas être son propre manager" };
  }

  // Anti-cycle hiérarchique (manager → ... → moi)
  if (parsed.data.managerId) {
    let cursor: number | null = parsed.data.managerId;
    const visited = new Set<number>();
    while (cursor != null) {
      if (cursor === parsed.data.adminId) {
        return { success: false, error: "Cycle détecté dans la hiérarchie managériale" };
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const next: { managerId: number | null } | null = await prisma.admin.findUnique({
        where: { id: cursor }, select: { managerId: true },
      });
      cursor = next?.managerId ?? null;
    }
  }

  await prisma.admin.update({
    where: { id: parsed.data.adminId },
    data: {
      teamId: parsed.data.teamId,
      managerId: parsed.data.managerId ?? null,
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "admin",
    entityId: parsed.data.adminId,
    changes: { teamId: parsed.data.teamId, managerId: parsed.data.managerId ?? null },
  });
  revalidatePath("/admin/settings/team");
  return { success: true };
}
