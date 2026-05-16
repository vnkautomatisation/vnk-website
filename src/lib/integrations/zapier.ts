// ─────────────────────────────────────────────────────────
// Intégration Zapier — webhooks sortants (Catch Hook)
// Permet de connecter VNK à 6000+ apps via Zapier.
// L'utilisateur configure un Catch Hook dans Zapier et colle l'URL.
// ─────────────────────────────────────────────────────────
import "server-only";
import { getIntegrationCredentials } from "@/lib/integrations/credentials";

type ZapEvent =
  | "requests.created"
  | "requests.updated"
  | "invoices.created"
  | "invoices.paid"
  | "invoices.overdue"
  | "quotes.created"
  | "quotes.accepted"
  | "appointments.booked"
  | "appointments.cancelled"
  | "payments.received"
  | "clients.created";

const EVENT_CATEGORY_MAP: Record<ZapEvent, string> = {
  "requests.created": "requests",
  "requests.updated": "requests",
  "invoices.created": "invoices",
  "invoices.paid": "invoices",
  "invoices.overdue": "invoices",
  "quotes.created": "quotes",
  "quotes.accepted": "quotes",
  "appointments.booked": "appointments",
  "appointments.cancelled": "appointments",
  "payments.received": "payments",
  "clients.created": "clients",
};

/**
 * Envoie un évènement vers le webhook Zapier configuré.
 * Filtre selon la préférence "events" du Zap (all / invoices / requests / payments).
 * Non bloquant : retourne false en cas d'échec sans throw.
 */
export async function triggerZap(event: ZapEvent, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const creds = await getIntegrationCredentials("zapier");
    if (!creds || !creds.webhook_url) return false;

    // Filtrage par catégorie
    const filter = creds.events ?? "all";
    if (filter !== "all") {
      const category = EVENT_CATEGORY_MAP[event];
      if (category !== filter) return false;
    }

    const body = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const res = await fetch(creds.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error("[zapier] trigger failed:", err);
    return false;
  }
}
