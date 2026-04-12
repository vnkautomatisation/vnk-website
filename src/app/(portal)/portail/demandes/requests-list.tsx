"use client";

import { Inbox } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, truncate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────
type Request = {
  id: number;
  serviceType: string | null;
  description: string;
  status: string;
  urgencyLevel: string;
  createdAt: string;
};

// ── Urgency badge config ─────────────────────────────────
const URGENCY_CONFIG: Record<string, { label: string; variant: "secondary" | "warning" | "destructive" }> = {
  low: { label: "Faible", variant: "secondary" },
  normal: { label: "Normale", variant: "secondary" },
  medium: { label: "Moyenne", variant: "warning" },
  urgent: { label: "Urgente", variant: "destructive" },
  high: { label: "Elevee", variant: "destructive" },
  critical: { label: "Critique", variant: "destructive" },
};

// ── Service type labels ──────────────────────────────────
const SERVICE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "plc-programming": "Programmation PLC",
  "scada": "SCADA",
  "hmi": "Interface HMI",
  "web-development": "Developpement Web",
  "automation": "Automatisation",
  "consulting": "Consultation",
  "maintenance": "Maintenance",
};

// ── Filter options ───────────────────────────────────────
const filterOptions: FilterOption[] = [
  { value: "new", label: "Nouvelle" },
  { value: "in_progress", label: "En cours" },
  { value: "converted", label: "Convertie" },
  { value: "closed", label: "Fermee" },
];

// ── Component ────────────────────────────────────────────
export function PortalRequestsList({ requests }: { requests: Request[] }) {
  // ── Columns ──────────────────────────────────────────
  const columns: Column<Request>[] = [
    {
      key: "service",
      header: "Service",
      accessor: (r) => (
        <span className="font-medium">
          {r.serviceType ? (SERVICE_LABELS[r.serviceType] ?? r.serviceType) : "--"}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.serviceType ?? "",
    },
    {
      key: "description",
      header: "Description",
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {truncate(r.description, 60)}
        </span>
      ),
    },
    {
      key: "urgency",
      header: "Urgence",
      accessor: (r) => {
        const config = URGENCY_CONFIG[r.urgencyLevel];
        if (!config) return <Badge variant="outline">{r.urgencyLevel}</Badge>;
        return (
          <Badge
            variant={config.variant}
            className={r.urgencyLevel === "critical" ? "font-bold" : ""}
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => formatDate(r.createdAt),
      sortable: true,
      sortBy: (r) => new Date(r.createdAt),
      hiddenOnMobile: true,
    },
  ];

  // ── Card renderer ────────────────────────────────────
  const renderCard = (req: Request) => {
    const urgencyConfig = URGENCY_CONFIG[req.urgencyLevel];
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {urgencyConfig && (
                <Badge
                  variant={urgencyConfig.variant}
                  className={req.urgencyLevel === "critical" ? "font-bold" : ""}
                >
                  {urgencyConfig.label}
                </Badge>
              )}
              <StatusBadge status={req.status} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(req.createdAt)}
            </span>
          </div>

          <p className="font-semibold text-sm">
            {req.serviceType
              ? (SERVICE_LABELS[req.serviceType] ?? req.serviceType)
              : "Demande de projet"}
          </p>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {req.description}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-[#0F2D52]" />
        <div>
          <h1 className="text-2xl font-bold">Mes demandes</h1>
          <p className="text-sm text-muted-foreground">
            Suivez vos demandes de projet
          </p>
        </div>
      </div>

      <DataTable
        data={requests}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-requests"
        searchPlaceholder="Rechercher une demande..."
        searchFn={(r) => `${r.serviceType ?? ""} ${r.description}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        filterLabel="Tous les statuts"
        exportFilename="demandes"
        emptyMessage="Aucune demande"
        emptyIcon={
          <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
        }
      />
    </div>
  );
}
