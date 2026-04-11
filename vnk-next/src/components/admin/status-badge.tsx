// Badge de statut universel avec mapping i18n + couleurs VNK
import { Badge } from "@/components/ui/badge";

type StatusVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "info";

const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  // Mandate
  pending: { label: "En attente", variant: "warning" },
  active: { label: "Actif", variant: "info" },
  in_progress: { label: "En cours", variant: "info" },
  paused: { label: "En pause", variant: "secondary" },
  completed: { label: "Complété", variant: "success" },
  cancelled: { label: "Annulé", variant: "destructive" },
  // Quote
  accepted: { label: "Accepté", variant: "success" },
  declined: { label: "Refusé", variant: "destructive" },
  expired: { label: "Expiré", variant: "secondary" },
  // Contract
  draft: { label: "Brouillon", variant: "secondary" },
  sent: { label: "Envoyé", variant: "info" },
  signed: { label: "Signé", variant: "success" },
  // Invoice
  unpaid: { label: "Non payée", variant: "warning" },
  paid: { label: "Payée", variant: "success" },
  overdue: { label: "En retard", variant: "destructive" },
  refunded: { label: "Remboursée", variant: "secondary" },
  // Dispute
  open: { label: "Ouvert", variant: "warning" },
  resolved: { label: "Résolu", variant: "success" },
  escalated: { label: "Escaladé", variant: "destructive" },
  // Priority
  low: { label: "Faible", variant: "secondary" },
  medium: { label: "Moyenne", variant: "warning" },
  high: { label: "Élevée", variant: "warning" },
  critical: { label: "Critique", variant: "destructive" },
  // Refund
  processed: { label: "Traité", variant: "success" },
  failed: { label: "Échoué", variant: "destructive" },
  // Request
  new: { label: "Nouvelle", variant: "info" },
  converted: { label: "Convertie", variant: "success" },
  closed: { label: "Fermée", variant: "secondary" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const config = STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
