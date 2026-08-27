"use server";
// Server Actions — gestion des webhooks sortants + replay des entrants.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

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

// ═══════════════════════════════════════════════════════════
// ÉVÉNEMENTS DISPONIBLES (catalogue)
// ═══════════════════════════════════════════════════════════
export const WEBHOOK_EVENTS = [
  // Clients
  { key: "client.created", labelKey: "wh_nouveau_client" },
  { key: "client.updated", labelKey: "wh_client_modifie" },
  { key: "client.archived", labelKey: "wh_client_archive" },
  // Devis
  { key: "quote.created", labelKey: "wh_devis_cree" },
  { key: "quote.sent", labelKey: "wh_devis_envoye" },
  { key: "quote.accepted", labelKey: "wh_devis_accepte" },
  { key: "quote.refused", labelKey: "wh_devis_refuse" },
  { key: "quote.expired", labelKey: "wh_devis_expire" },
  // Factures
  { key: "invoice.created", labelKey: "wh_facture_creee" },
  { key: "invoice.sent", labelKey: "wh_facture_envoyee" },
  { key: "invoice.paid", labelKey: "wh_facture_payee" },
  { key: "invoice.overdue", labelKey: "wh_facture_en_retard" },
  { key: "invoice.refunded", labelKey: "wh_facture_remboursee" },
  // Contrats
  { key: "contract.created", labelKey: "wh_contrat_cree" },
  { key: "contract.sent", labelKey: "wh_contrat_envoye" },
  { key: "contract.signed", labelKey: "wh_contrat_signe" },
  { key: "contract.cancelled", labelKey: "wh_contrat_annule" },
  // Paiements
  { key: "payment.received", labelKey: "wh_paiement_recu" },
  { key: "payment.failed", labelKey: "wh_paiement_echoue" },
  { key: "payment.refunded", labelKey: "wh_paiement_rembourse" },
  // Mandats
  { key: "mandate.created", labelKey: "wh_mandat_cree" },
  { key: "mandate.completed", labelKey: "wh_mandat_termine" },
  // Rendez-vous
  { key: "appointment.scheduled", labelKey: "wh_rdv_planifie" },
  { key: "appointment.cancelled", labelKey: "wh_rdv_annule" },
] as const;

function generateSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("hex");
}

// ═══════════════════════════════════════════════════════════
// CRUD WEBHOOK SORTANT
// ═══════════════════════════════════════════════════════════
const webhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url("URL invalide"),
  events: z.array(z.string()).min(1, "selectionnez_au_moins_un_evenement"),
  isEnabled: z.boolean().default(true),
});

export async function createWebhookAction(input: z.infer<typeof webhookSchema>): Promise<Result<{ id: number; secret: string }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const secret = generateSecret();
  const created = await prisma.outgoingWebhook.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      isEnabled: parsed.data.isEnabled,
    },
    select: { id: true, secret: true },
  });

  await logAudit({ adminId, action: "create", entityType: "outgoing_webhook", entityId: created.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true, data: { id: created.id, secret: created.secret } };
}

export async function updateWebhookAction(input: z.infer<typeof webhookSchema> & { id: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  await prisma.outgoingWebhook.update({
    where: { id: input.id },
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      isEnabled: parsed.data.isEnabled,
    },
  });

  await logAudit({ adminId, action: "update", entityType: "outgoing_webhook", entityId: input.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}

export async function deleteWebhookAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.outgoingWebhook.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "outgoing_webhook", entityId: input.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}

export async function rotateWebhookSecretAction(input: { id: number }): Promise<Result<{ secret: string }>> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const newSecret = generateSecret();
  await prisma.outgoingWebhook.update({
    where: { id: input.id },
    data: { secret: newSecret },
  });
  await logAudit({ adminId, action: "update", entityType: "outgoing_webhook", entityId: input.id, changes: { rotated: true } });
  revalidatePath("/admin/settings/webhooks");
  return { success: true, data: { secret: newSecret } };
}

// ═══════════════════════════════════════════════════════════
// TEST WEBHOOK (envoi d'un payload factice)
// ═══════════════════════════════════════════════════════════
export async function testWebhookAction(input: { id: number }): Promise<Result<{ status: number; ms: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  const wh = await prisma.outgoingWebhook.findUnique({ where: { id: input.id } });
  if (!wh) return { success: false, error: "Webhook introuvable" };

  const payload = {
    id: "evt_test_" + Date.now(),
    event: "test.ping",
    createdAt: new Date().toISOString(),
    data: { message: t("ceci_est_un_test_depuis_vnk_automatisation") },
  };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", wh.secret).update(body).digest("hex");

  try {
    const start = Date.now();
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VNK-Event": "test.ping",
        "X-VNK-Signature": `sha256=${signature}`,
        "User-Agent": "VNK-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - start;

    await prisma.outgoingWebhook.update({
      where: { id: input.id },
      data: {
        lastFireAt: new Date(),
        lastStatus: res.status,
        failCount: res.ok ? 0 : wh.failCount + 1,
      },
    });

    return { success: true, data: { status: res.status, ms } };
  } catch (e) {
    await prisma.outgoingWebhook.update({
      where: { id: input.id },
      data: { failCount: wh.failCount + 1, lastFireAt: new Date() },
    });
    return { success: false, error: e instanceof Error ? e.message : t("erreur_reseau_action") };
  }
}

// ═══════════════════════════════════════════════════════════
// REPLAY WEBHOOK ENTRANT (re-traitement)
// ═══════════════════════════════════════════════════════════
export async function replayIncomingAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  const log = await prisma.incomingWebhookLog.findUnique({ where: { id: input.id } });
  if (!log) return { success: false, error: "Log introuvable" };

  // Marquer pour retraitement (le handler webhook réel décidera selon le provider)
  await prisma.incomingWebhookLog.update({
    where: { id: input.id },
    data: { processed: false, error: null },
  });

  await logAudit({ adminId, action: "update", entityType: "incoming_webhook_log", entityId: input.id, changes: { action: "replay" } });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}

export async function deleteIncomingLogAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.incomingWebhookLog.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "incoming_webhook_log", entityId: input.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}
