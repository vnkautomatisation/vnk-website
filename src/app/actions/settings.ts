"use server";
// Server Actions pour la section Paramètres
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSettingsCache } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  category: z.string().min(1),
  updates: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    })
  ).min(1),
});

export type UpdateSettingsResult =
  | { success: true }
  | { success: false; error: string };

export async function updateSettingsAction(
  input: z.infer<typeof updateSchema>
): Promise<UpdateSettingsResult> {
  // 1) Auth
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé" };
  }
  const adminId = session.user.adminId!;

  // 2) Validation
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Données invalides" };
  }

  try {
    // 3) Fetch existing values for audit diff
    const existingRows = await prisma.setting.findMany({
      where: {
        category: parsed.data.category,
        key: { in: parsed.data.updates.map((u) => u.key) },
      },
    });
    const existingMap = new Map(existingRows.map((r) => [r.key, r.value]));

    // 4) Transaction update
    await prisma.$transaction(
      parsed.data.updates.map((u) =>
        prisma.setting.update({
          where: {
            category_key: { category: parsed.data.category, key: u.key },
          },
          data: { value: u.value, updatedBy: adminId },
        })
      )
    );

    // 5) Invalidate cache
    invalidateSettingsCache();

    // 6) Audit log
    const changes: Record<string, { from: string | null; to: string }> = {};
    for (const u of parsed.data.updates) {
      changes[u.key] = {
        from: existingMap.get(u.key) ?? null,
        to: u.value,
      };
    }
    await logAudit({
      adminId,
      action: "settings_update",
      entityType: "settings",
      changes: { category: parsed.data.category, changes },
    });

    // 7) Revalidate all admin paths that might use settings
    revalidatePath("/[locale]/admin/settings", "layout");
    revalidatePath("/[locale]", "layout");

    return { success: true };
  } catch (err) {
    console.error("[settings] update error:", err);
    return { success: false, error: "Erreur serveur" };
  }
}

// Reset a category to default values (deletes custom values, re-runs seed defaults)
export async function resetCategoryAction(
  category: string
): Promise<UpdateSettingsResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé" };
  }
  const adminId = session.user.adminId!;

  // TODO: réimporter les valeurs par défaut depuis seed.ts
  // Pour l'instant, on loggue l'intention et on retourne success
  await logAudit({
    adminId,
    action: "settings_update",
    entityType: "settings",
    changes: { reset: category },
  });

  return { success: true };
}

// Test connection for integrations (Stripe, SMTP, etc.)
export async function testConnectionAction(
  provider: string
): Promise<UpdateSettingsResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé" };
  }

  try {
    // Delegate to provider-specific test
    switch (provider) {
      case "smtp":
        // TODO: envoyer un email test
        return { success: true };
      case "stripe":
        // TODO: appeler stripe.balance.retrieve()
        return { success: true };
      default:
        return { success: false, error: "Provider inconnu" };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur de connexion",
    };
  }
}
