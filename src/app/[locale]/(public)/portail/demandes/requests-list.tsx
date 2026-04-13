"use client";

import { useState } from "react";
import { Inbox, Hash, Sparkles, Loader, CheckCircle, Plus } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, truncate } from "@/lib/utils";
import { NewRequestModal } from "./new-request-modal";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
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

  const totalCount = requests.length;
  const newCount = requests.filter((r) => r.status === "new").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
  const convertedCount = requests.filter((r) => r.status === "converted").length;

  return (
    <div className="space-y-4">
      <DataTable
        stickyHeader={
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                  <Inbox className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Mes demandes</h1>
                  <p className="text-sm text-muted-foreground">
                    Suivez vos demandes de projet
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle demande
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total demandes</p>
                    <p className="text-2xl font-bold">{totalCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-sky-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-[#0F2D52]">Nouvelles</p>
                    <p className="text-2xl font-bold">{newCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Loader className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-600">En cours</p>
                    <p className="text-2xl font-bold">{inProgressCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">Converties</p>
                    <p className="text-2xl font-bold">{convertedCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
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

      <NewRequestModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
