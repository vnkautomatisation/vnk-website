// Helpers partages pour l'affichage type-aware des paiements
// Utilises par /admin/finance/payments + /admin/finance/settlements

// Types ENTRANTS (argent recu chez nous) — eligibles a reconciliation banque
export const INBOUND_TYPES = new Set(["charge", "topup"]);

// Adapte le libelle du statut selon le type. Un "Frais retrofact." complete = mauvaise nouvelle (perte).
export function getStatusDisplay(type: string, status: string): { labelKey: string; cls: string } {
  const isSuccess = ["succeeded", "complete", "completed", "paid"].includes(status);
  if (isSuccess) {
    switch (type) {
      case "refund":         return { labelKey: "ps_refund_issued", cls: "bg-amber-100 text-amber-800 border-amber-200" };
      case "chargeback":     return { labelKey: "ps_chargeback", cls: "bg-red-100 text-red-800 border-red-200" };
      case "chargeback_fee": return { labelKey: "ps_fee_charged", cls: "bg-red-100 text-red-800 border-red-200" };
      case "adjustment":     return { labelKey: "ps_adjustment", cls: "bg-purple-100 text-purple-800 border-purple-200" };
      case "topup":          return { labelKey: "ps_topup", cls: "bg-blue-100 text-blue-800 border-blue-200" };
      case "charge":
      default:               return { labelKey: "ps_completed", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
  }
  // Status non-success : libelle generique
  const fallback: Record<string, { labelKey: string; cls: string }> = {
    pending: { labelKey: "ps_pending", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    failed: { labelKey: "ps_failed", cls: "bg-red-100 text-red-800 border-red-200" },
    canceled: { labelKey: "ps_canceled", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    processing: { labelKey: "ps_processing", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    refunded: { labelKey: "ps_refunded", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  return fallback[status] ?? { labelKey: "", cls: "bg-gray-100 text-gray-700 border-gray-200" };
}

// Type = nature de la ligne (lecture seule). Determine automatiquement par Stripe ou a la creation.
// Modifier le type fausserait les rapports comptables → pas editable depuis la UI table.
export const TYPE_META: Record<string, { labelKey: string; color: string; descriptionKey: string }> = {
  charge: {
    labelKey: "pt_charge",
    color: "bg-emerald-100 text-emerald-700",
    descriptionKey: "pt_charge_desc",
  },
  refund: {
    labelKey: "pt_refund",
    color: "bg-amber-100 text-amber-700",
    descriptionKey: "pt_refund_desc",
  },
  chargeback: {
    labelKey: "pt_chargeback",
    color: "bg-red-100 text-red-700",
    descriptionKey: "pt_chargeback_desc",
  },
  chargeback_fee: {
    labelKey: "pt_chargeback_fee",
    color: "bg-rose-100 text-rose-700",
    descriptionKey: "pt_chargeback_fee_desc",
  },
  adjustment: {
    labelKey: "ps_adjustment",
    color: "bg-purple-100 text-purple-700",
    descriptionKey: "pt_adjustment_desc",
  },
  topup: {
    labelKey: "ps_topup",
    color: "bg-blue-100 text-blue-700",
    descriptionKey: "pt_topup_desc",
  },
};

// Cle brute sans couleur (pour exports CSV, dropdowns)
export const TYPE_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.labelKey])
);
