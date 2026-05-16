"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { getProvider } from "@/lib/integrations/providers";
import { invalidateIntegrationCache } from "@/lib/integrations/credentials";
import { encryptCredentials, decryptCredentials } from "@/lib/security/crypto";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.adminId!;
}

// ── Enregistrer la config d'une intégration ────────────
const upsertSchema = z.object({
  provider: z.string().min(1),
  credentials: z.record(z.string()).optional(),
  config: z.record(z.string()).optional(),
  enable: z.boolean().optional(),
});

export async function upsertIntegrationAction(input: z.infer<typeof upsertSchema>): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const provider = getProvider(parsed.data.provider);
  if (!provider) return { success: false, error: "Fournisseur inconnu" };

  // ── Fusion avec credentials existants ────────────────
  // Si un champ est laissé vide ou contient la valeur masquée "•••",
  // on conserve la valeur existante (chiffrée) au lieu de l'écraser.
  const existing = await prisma.integration.findUnique({ where: { provider: provider.key } });
  const existingDecrypted = existing?.credentials
    ? decryptCredentials(existing.credentials as Record<string, string>)
    : {};

  const merged: Record<string, string> = { ...existingDecrypted };
  for (const field of provider.fields) {
    const incoming = parsed.data.credentials?.[field.key];
    // Conserve l'existant si incoming est vide OU contient uniquement des •
    if (incoming && !/^•+$/.test(incoming)) {
      merged[field.key] = incoming;
    }
  }

  // Validation des champs requis (sur les valeurs fusionnées)
  for (const field of provider.fields) {
    if (field.required && !merged[field.key]) {
      return { success: false, error: `Champ obligatoire manquant : ${field.label}` };
    }
  }

  // ── Chiffrement AES-256-GCM avant écriture ───────────
  let encryptedCreds: Record<string, string>;
  try {
    encryptedCreds = encryptCredentials(merged);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Clé de chiffrement non configurée";
    return { success: false, error: msg };
  }

  try {
    await prisma.integration.upsert({
      where: { provider: provider.key },
      create: {
        provider: provider.key,
        name: provider.name,
        isEnabled: parsed.data.enable ?? true,
        credentials: encryptedCreds as never,
        config: (parsed.data.config ?? {}) as never,
      },
      update: {
        isEnabled: parsed.data.enable ?? undefined,
        credentials: encryptedCreds as never,
        config: (parsed.data.config ?? {}) as never,
        lastError: null,
      },
    });

    await logAudit({
      adminId,
      action: "settings_update",
      entityType: "integration",
      entityId: null,
      changes: { provider: provider.key, action: "upsert" },
    });
    await logSecurityEvent({
      adminId,
      type: "preferences_updated",
      severity: "warning",
      message: `Intégration configurée : ${provider.name}`,
      metadata: { provider: provider.key },
    });

    invalidateIntegrationCache(provider.key);
    // Reset Stripe client pour qu'il reprenne la nouvelle clé
    if (provider.key === "stripe") {
      const { resetStripeClient } = await import("@/lib/services/stripe");
      resetStripeClient();
    }

    revalidatePath("/admin/profile");
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[integration upsert]", err);
    return { success: false, error: "Erreur lors de l'enregistrement" };
  }
}

// ── Activer/désactiver ────────────────────────────────
export async function toggleIntegrationAction(provider: string, enabled: boolean): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  try {
    await prisma.integration.update({
      where: { provider },
      data: { isEnabled: enabled },
    });
    await logAudit({
      adminId,
      action: "settings_update",
      entityType: "integration",
      entityId: null,
      changes: { provider, isEnabled: enabled },
    });
    invalidateIntegrationCache(provider);
    if (provider === "stripe") {
      const { resetStripeClient } = await import("@/lib/services/stripe");
      resetStripeClient();
    }
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ── Supprimer (déconnecter) ──────────────────────────
export async function deleteIntegrationAction(provider: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  try {
    await prisma.integration.delete({ where: { provider } }).catch(() => null);
    await logAudit({
      adminId,
      action: "delete",
      entityType: "integration",
      entityId: null,
      changes: { provider },
    });
    invalidateIntegrationCache(provider);
    if (provider === "stripe") {
      const { resetStripeClient } = await import("@/lib/services/stripe");
      resetStripeClient();
    }
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}
