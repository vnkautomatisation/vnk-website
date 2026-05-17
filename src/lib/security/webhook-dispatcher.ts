// ─────────────────────────────────────────────────────────
// Webhook dispatcher pour events critiques (Slack/Teams).
// Lit l'URL depuis env (SECURITY_WEBHOOK_URL) ou settings DB.
// Non bloquant : si l'envoi échoue, on log et on continue.
// ─────────────────────────────────────────────────────────
import "server-only";

type WebhookPayload = {
  source: "slack" | "teams" | "generic";
  url: string;
};

let cachedWebhook: WebhookPayload | null | undefined = undefined;

async function resolveWebhook(): Promise<WebhookPayload | null> {
  if (cachedWebhook !== undefined) return cachedWebhook;
  // 1) Env vars d'abord (priorité)
  const slackUrl = process.env.SLACK_SECURITY_WEBHOOK_URL;
  const teamsUrl = process.env.TEAMS_SECURITY_WEBHOOK_URL;
  const genericUrl = process.env.SECURITY_WEBHOOK_URL;
  if (slackUrl) {
    cachedWebhook = { source: "slack", url: slackUrl };
  } else if (teamsUrl) {
    cachedWebhook = { source: "teams", url: teamsUrl };
  } else if (genericUrl) {
    cachedWebhook = { source: "generic", url: genericUrl };
  } else {
    // 2) Settings DB (table Setting clé = "security_webhook_url" catégorie "integrations")
    try {
      const { prisma } = await import("@/lib/prisma");
      const setting = await prisma.setting.findUnique({
        where: { category_key: { category: "integrations", key: "security_webhook_url" } },
      });
      const v = (setting?.value as string | null) ?? null;
      if (v && typeof v === "string" && v.startsWith("https://")) {
        const source = v.includes("hooks.slack.com")
          ? "slack"
          : v.includes("webhook.office.com") || v.includes("outlook.office")
            ? "teams"
            : "generic";
        cachedWebhook = { source, url: v };
      } else {
        cachedWebhook = null;
      }
    } catch {
      cachedWebhook = null;
    }
  }
  return cachedWebhook;
}

export type WebhookEventLevel = "warning" | "critical";

export type WebhookEvent = {
  level: WebhookEventLevel;
  title: string;
  message: string;
  fields?: Array<{ label: string; value: string }>;
  link?: string;
};

// Liste blanche des types qui déclenchent un webhook
const CRITICAL_TYPES = new Set([
  "suspicious_login",
  "password_breach_detected",
  "all_sessions_revoked",
  "account_deletion_requested",
  "two_factor_disabled",
  "api_token_created",
  "trusted_device_added",
  "user_deleted",
]);

export function shouldDispatchForType(type: string, severity: string): boolean {
  if (severity === "critical") return true;
  if (severity === "warning" && CRITICAL_TYPES.has(type)) return true;
  return false;
}

export async function dispatchWebhook(event: WebhookEvent): Promise<void> {
  const w = await resolveWebhook();
  if (!w) return;

  try {
    const body =
      w.source === "slack"
        ? buildSlackPayload(event)
        : w.source === "teams"
          ? buildTeamsPayload(event)
          : buildGenericPayload(event);

    await fetch(w.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[webhook-dispatcher]", err);
  }
}

function buildSlackPayload(e: WebhookEvent) {
  const icon = e.level === "critical" ? ":rotating_light:" : ":warning:";
  const fields = (e.fields ?? []).map((f) => ({
    type: "mrkdwn",
    text: `*${f.label}*\n${f.value}`,
  }));
  return {
    text: `${icon} ${e.title}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${icon} ${e.title}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: e.message },
      },
      ...(fields.length > 0
        ? [{ type: "section", fields }]
        : []),
      ...(e.link
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Voir dans le portail" },
                  url: e.link,
                },
              ],
            },
          ]
        : []),
    ],
  };
}

function buildTeamsPayload(e: WebhookEvent) {
  // Format MessageCard (legacy mais largement supporté)
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: e.level === "critical" ? "DC2626" : "F59E0B",
    summary: e.title,
    title: e.title,
    text: e.message,
    sections: e.fields
      ? [
          {
            facts: e.fields.map((f) => ({ name: f.label, value: f.value })),
          },
        ]
      : undefined,
    potentialAction: e.link
      ? [
          {
            "@type": "OpenUri",
            name: "Voir dans le portail",
            targets: [{ os: "default", uri: e.link }],
          },
        ]
      : undefined,
  };
}

function buildGenericPayload(e: WebhookEvent) {
  return {
    level: e.level,
    title: e.title,
    message: e.message,
    fields: e.fields,
    link: e.link,
    timestamp: new Date().toISOString(),
  };
}
