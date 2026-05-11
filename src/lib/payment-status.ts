// Helpers partages pour l'affichage type-aware des paiements
// Utilises par /admin/finance/payments + /admin/finance/settlements

// Types ENTRANTS (argent recu chez nous) — eligibles a reconciliation banque
export const INBOUND_TYPES = new Set(["charge", "topup"]);

// Adapte le libelle du statut selon le type. Un "Frais retrofact." complete = mauvaise nouvelle (perte).
export function getStatusDisplay(type: string, status: string): { label: string; cls: string } {
  const isSuccess = ["succeeded", "complete", "completed", "paid"].includes(status);
  if (isSuccess) {
    switch (type) {
      case "refund":         return { label: "Remboursé émis", cls: "bg-amber-100 text-amber-800 border-amber-200" };
      case "chargeback":     return { label: "Chargeback subi", cls: "bg-red-100 text-red-800 border-red-200" };
      case "chargeback_fee": return { label: "Frais prélevé", cls: "bg-red-100 text-red-800 border-red-200" };
      case "adjustment":     return { label: "Ajustement", cls: "bg-purple-100 text-purple-800 border-purple-200" };
      case "topup":          return { label: "Fonds ajoutés", cls: "bg-blue-100 text-blue-800 border-blue-200" };
      case "charge":
      default:               return { label: "Complété", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
  }
  // Status non-success : libelle generique
  const fallback: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    failed: { label: "Échoué", cls: "bg-red-100 text-red-800 border-red-200" },
    canceled: { label: "Annulé", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    processing: { label: "En traitement", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    refunded: { label: "Remboursé", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  return fallback[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
}

// Type = nature de la ligne (lecture seule). Determine automatiquement par Stripe ou a la creation.
// Modifier le type fausserait les rapports comptables → pas editable depuis la UI table.
export const TYPE_META: Record<string, { label: string; color: string; description: string }> = {
  charge: {
    label: "Vente",
    color: "bg-emerald-100 text-emerald-700",
    description: "Argent reçu d'un client (paiement entrant)",
  },
  refund: {
    label: "Remboursement",
    color: "bg-amber-100 text-amber-700",
    description: "Argent retourné au client (sortie d'argent)",
  },
  chargeback: {
    label: "Rétrofacturation",
    color: "bg-red-100 text-red-700",
    description: "Forçage par la banque/carte du client (chargeback)",
  },
  chargeback_fee: {
    label: "Frais rétrofact.",
    color: "bg-rose-100 text-rose-700",
    description: "Frais facturés par Stripe lors d'une rétrofacturation",
  },
  adjustment: {
    label: "Ajustement",
    color: "bg-purple-100 text-purple-700",
    description: "Correction manuelle dans Stripe ou comptable",
  },
  topup: {
    label: "Fonds ajoutés",
    color: "bg-blue-100 text-blue-700",
    description: "Approvisionnement manuel du solde Stripe",
  },
};

// Label brut sans couleur (pour exports CSV, dropdowns)
export const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.label])
);
