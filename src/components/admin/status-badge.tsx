// Universal status badge: colour here, wording in the `status` namespace.
"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type StatusVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "info";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  pending: "warning",
  active: "info",
  in_progress: "info",
  paused: "secondary",
  completed: "success",
  confirmed: "success",
  no_show: "destructive",
  cancelled: "destructive",
  accepted: "success",
  declined: "destructive",
  expired: "secondary",
  draft: "secondary",
  sent: "info",
  signed: "success",
  admin_signed: "info",
  client_signed: "info",
  unpaid: "warning",
  paid: "success",
  overdue: "destructive",
  refunded: "secondary",
  open: "warning",
  resolved: "success",
  escalated: "destructive",
  low: "secondary",
  medium: "warning",
  high: "warning",
  critical: "destructive",
  processed: "success",
  failed: "destructive",
  succeeded: "success",
  complete: "success",
  requires_action: "warning",
  requires_payment_method: "warning",
  requires_confirmation: "warning",
  processing: "info",
  canceled: "secondary",
  new: "info",
  converted: "success",
  closed: "secondary",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const t = useTranslations("status");
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant = STATUS_VARIANT[status] ?? "default";
  // An unknown status is shown raw rather than as a missing-key error.
  const label = STATUS_VARIANT[status] ? t(status) : status;
  return <Badge variant={variant}>{label}</Badge>;
}
