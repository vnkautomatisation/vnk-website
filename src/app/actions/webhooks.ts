"use server";
// Server Actions — gestion des webhooks sortants + replay des entrants.
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

// ═══════════════════════════════════════════════════════════
// ÉVÉNEMENTS DISPONIBLES (catalogue)
// ═══════════════════════════════════════════════════════════
export const WEBHOOK_EVENTS = [
  // Clients
  { key: "client.created", label: "Nouveau client" },
  { key: "client.updated", label: "Client modifié" },
  { key: "client.archived", label: "Client archivé" },
  // Devis
  { key: "quote.created", label: "Devis créé" },
  { key: "quote.sent", label: "Devis envoyé" },
  { key: "quote.accepted", label: "Devis accepté" },
  { key: "quote.refused", label: "Devis refusé" },
  { key: "quote.expired", label: "Devis expiré" },
  // Factures
  { key: "invoice.created", label: "Facture créée" },
  { key: "invoice.sent", label: "Facture envoyée" },
  { key: "invoice.paid", label: "Facture payée" },
  { key: "invoice.overdue", label: "Facture en retard" },
  { key: "invoice.refunded", label: "Facture remboursée" },
  // Contrats
  { key: "contract.created", label: "Contrat créé" },
  { key: "contract.sent", label: "Contrat envoyé" },
  { key: "contract.signed", label: "Contrat signé" },
  { key: "contract.cancelled", label: "Contrat annulé" },
  // Paiements
  { key: "payment.received", label: "Paiement reçu" },
  { key: "payment.failed", label: "Paiement échoué" },
  { key: "payment.refunded", label: "Paiement remboursé" },
  // Mandats
  { key: "mandate.created", label: "Mandat créé" },
  { key: "mandate.completed", label: "Mandat terminé" },
  // Rendez-vous
  { key: "appointment.scheduled", label: "RDV planifié" },
  { key: "appointment.cancelled", label: "RDV annulé" },
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
  events: z.array(z.string()).min(1, "Sélectionnez au moins un événement"),
  isEnabled: z.boolean().default(true),
});

export async function createWebhookAction(input: z.infer<typeof webhookSchema>): Promise<Result<{ id: number; secret: string }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

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
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

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
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.outgoingWebhook.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "outgoing_webhook", entityId: input.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}

export async function rotateWebhookSecretAction(input: { id: number }): Promise<Result<{ secret: string }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
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
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const wh = await prisma.outgoingWebhook.findUnique({ where: { id: input.id } });
  if (!wh) return { success: false, error: "Webhook introuvable" };

  const payload = {
    id: "evt_test_" + Date.now(),
    event: "test.ping",
    createdAt: new Date().toISOString(),
    data: { message: "Ceci est un test depuis VNK Automatisation" },
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
    return { success: false, error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

// ═══════════════════════════════════════════════════════════
// REPLAY WEBHOOK ENTRANT (re-traitement)
// ═══════════════════════════════════════════════════════════
export async function replayIncomingAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

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
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.incomingWebhookLog.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "incoming_webhook_log", entityId: input.id });
  revalidatePath("/admin/settings/webhooks");
  return { success: true };
}
