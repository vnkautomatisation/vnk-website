"use server";
// =============================================================
// Actions inline pour creation rapide de postes depuis les
// wizards (ex : ContractWizard, TemplateWizard).
//
// Differences avec src/app/actions/positions.ts (CRUD complet) :
//   - Permissions plus tolerantes (admin suffit, pas besoin de
//     scope "positions.write" — RH peut ajouter un poste a la
//     volee meme sans permissions team complete).
//   - Retourne directement { id, name, isExisting } pour le UI
//     du picker multi-select.
// =============================================================
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const createPositionInlineSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(80, "Nom trop long"),
  description: z.string().max(500).optional(),
  defaultDepartment: z.string().max(80).optional(),
});

export interface CreatePositionInlineResult {
  id: number;
  name: string;
  isExisting: boolean;
}

/**
 * Cree un poste en mode "inline" depuis un wizard.
 * Si un poste avec ce nom existe deja (case-insensitive),
 * le retourne au lieu de creer un doublon.
 */
export async function createPositionInlineAction(input: {
  name: string;
  description?: string;
  defaultDepartment?: string;
}): Promise<CreatePositionInlineResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Non autorise");
  }
  const adminId = session.user.adminId!;

  const data = createPositionInlineSchema.parse({
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    defaultDepartment: input.defaultDepartment?.trim() || undefined,
  });

  // Recherche case-insensitive d'un poste deja existant
  const existing = await prisma.position.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) {
    return { id: existing.id, name: existing.name, isExisting: true };
  }

  const created = await prisma.position.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      defaultDepartment: data.defaultDepartment ?? null,
      isSystem: false,
      sortOrder: 9999,
      color: "#6b7280",
    },
    select: { id: true, name: true },
  });

  await logAudit({
    adminId,
    action: "create",
    entityType: "position",
    entityId: created.id,
    changes: { after: { name: created.name, inline: true } },
  });

  revalidatePath("/admin/employes/postes");
  revalidatePath("/admin/settings/team");

  return { id: created.id, name: created.name, isExisting: false };
}
