// ─────────────────────────────────────────────────────────
// Intégration Slack — notifications sortantes via webhook entrant
// Configurer un Incoming Webhook Slack puis coller l'URL dans le portail.
// Doc : https://api.slack.com/messaging/webhooks
// ─────────────────────────────────────────────────────────
import "server-only";
import { getIntegrationCredential } from "@/lib/integrations/credentials";

type SlackBlock = {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
};

export type SlackMessageInput = {
  text: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  blocks?: SlackBlock[];
};

// ── Vérifie que Slack est configuré et activé ──
async function getSlackConfig(): Promise<{ webhookUrl: string; channel?: string; username?: string } | null> {
  const webhookUrl = (await getIntegrationCredential("slack", "webhook_url")).value;
  if (!webhookUrl) return null;
  const channel = (await getIntegrationCredential("slack", "default_channel")).value ?? undefined;
  const username = (await getIntegrationCredential("slack", "username")).value ?? "VNK Bot";
  return { webhookUrl, channel, username };
}

// ── Envoi d'un message simple ──
export async function notifySlack(input: SlackMessageInput): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config) return false;

  const payload: Record<string, unknown> = {
    text: input.text,
    username: input.username ?? config.username,
    icon_emoji: input.iconEmoji ?? ":vnk:",
  };
  if (input.channel ?? config.channel) {
    payload.channel = input.channel ?? config.channel;
  }
  if (input.blocks) payload.blocks = input.blocks;

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[slack] notify failed:", err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Helpers spécialisés pour les évènements clés
// ─────────────────────────────────────────────────────────

export async function notifyNewRequest(params: {
  clientName: string;
  title: string;
  serviceType?: string | null;
  urgency: string;
  requestId: number;
}) {
  return notifySlack({
    text: `Nouvelle demande de projet : *${params.title}*`,
    iconEmoji: ":inbox_tray:",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Nouvelle demande de projet" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Titre :*\n${params.title}` },
          { type: "mrkdwn", text: `*Service :*\n${params.serviceType ?? "Non spécifié"}` },
          { type: "mrkdwn", text: `*Urgence :*\n${params.urgency}` },
        ],
      },
    ],
  });
}

export async function notifyInvoicePaid(params: {
  invoiceNumber: string;
  amount: number;
  currency: string;
  clientName: string;
}) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: params.currency.toUpperCase() });
  return notifySlack({
    text: `Facture payée : ${params.invoiceNumber} — ${fmt.format(params.amount)}`,
    iconEmoji: ":moneybag:",
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:moneybag: *Paiement reçu* — ${params.invoiceNumber}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Montant :*\n${fmt.format(params.amount)}` },
        ],
      },
    ],
  });
}

export async function notifyInvoiceOverdue(params: {
  invoiceNumber: string;
  amount: number;
  currency: string;
  clientName: string;
  dueDate: string;
}) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: params.currency.toUpperCase() });
  return notifySlack({
    text: `Facture en retard : ${params.invoiceNumber} (${params.clientName})`,
    iconEmoji: ":warning:",
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:warning: *Facture en retard* — ${params.invoiceNumber}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Montant :*\n${fmt.format(params.amount)}` },
          { type: "mrkdwn", text: `*Échéance :*\n${params.dueDate}` },
        ],
      },
    ],
  });
}

export async function notifyAppointmentBooked(params: {
  clientName: string;
  subject?: string | null;
  date: string;
  startTime: string;
  meetingLink?: string | null;
}) {
  return notifySlack({
    text: `Nouveau rendez-vous : ${params.clientName} — ${params.date} ${params.startTime}`,
    iconEmoji: ":date:",
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:date: *Rendez-vous réservé*` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Date :*\n${params.date} ${params.startTime}` },
          { type: "mrkdwn", text: `*Sujet :*\n${params.subject ?? "Non spécifié"}` },
          { type: "mrkdwn", text: `*Lien :*\n${params.meetingLink ? `<${params.meetingLink}|Rejoindre>` : "—"}` },
        ],
      },
    ],
  });
}

export async function notifyAppointmentCancelled(params: {
  clientName: string;
  date: string;
  startTime: string;
  reason?: string | null;
}) {
  return notifySlack({
    text: `RDV annulé : ${params.clientName} — ${params.date} ${params.startTime}`,
    iconEmoji: ":x:",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:x: *Rendez-vous annulé*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Date :*\n${params.date} ${params.startTime}` },
          { type: "mrkdwn", text: `*Motif :*\n${params.reason ?? "—"}` },
        ],
      },
    ],
  });
}

export async function notifyQuoteAccepted(params: {
  quoteNumber: string;
  amount: number;
  currency: string;
  clientName: string;
}) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: params.currency.toUpperCase() });
  return notifySlack({
    text: `Devis accepté : ${params.quoteNumber} (${params.clientName})`,
    iconEmoji: ":white_check_mark:",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Devis accepté* — ${params.quoteNumber}` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Montant :*\n${fmt.format(params.amount)}` },
        ],
      },
    ],
  });
}

export async function notifyInvoiceCreated(params: {
  invoiceNumber: string;
  amount: number;
  currency: string;
  clientName: string;
  dueDate?: string | null;
}) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: params.currency.toUpperCase() });
  return notifySlack({
    text: `Nouvelle facture : ${params.invoiceNumber} (${params.clientName})`,
    iconEmoji: ":receipt:",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:receipt: *Facture émise* — ${params.invoiceNumber}` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Montant :*\n${fmt.format(params.amount)}` },
          { type: "mrkdwn", text: `*Échéance :*\n${params.dueDate ?? "—"}` },
        ],
      },
    ],
  });
}

export async function notifyQuoteCreated(params: {
  quoteNumber: string;
  amount: number;
  currency: string;
  clientName: string;
}) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: params.currency.toUpperCase() });
  return notifySlack({
    text: `Nouveau devis : ${params.quoteNumber} (${params.clientName})`,
    iconEmoji: ":scroll:",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:scroll: *Devis émis* — ${params.quoteNumber}` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Montant :*\n${fmt.format(params.amount)}` },
        ],
      },
    ],
  });
}

export async function notifyClientCreated(params: {
  clientName: string;
  email: string;
  companyName?: string | null;
}) {
  return notifySlack({
    text: `Nouveau client : ${params.clientName}`,
    iconEmoji: ":bust_in_silhouette:",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:bust_in_silhouette: *Nouveau client*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nom :*\n${params.clientName}` },
          { type: "mrkdwn", text: `*Courriel :*\n${params.email}` },
          { type: "mrkdwn", text: `*Entreprise :*\n${params.companyName ?? "—"}` },
        ],
      },
    ],
  });
}
