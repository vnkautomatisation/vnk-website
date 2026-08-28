"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
const URGENCY_CONFIG: Record<string, { labelKey: string; variant: "secondary" | "warning" | "destructive" }> = {
  low: { labelKey: "urgency_low", variant: "secondary" },
  normal: { labelKey: "urgency_normal", variant: "secondary" },
  medium: { labelKey: "urgency_medium", variant: "warning" },
  urgent: { labelKey: "urgency_urgent", variant: "destructive" },
  high: { labelKey: "urgency_high", variant: "destructive" },
  critical: { labelKey: "urgency_critical", variant: "destructive" },
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
const filterOptions: { value: string; labelKey: string }[] = [
  { value: "new", labelKey: "opt_nouvelle" },
  { value: "in_progress", labelKey: "opt_en_cours" },
  { value: "converted", labelKey: "opt_convertie" },
  { value: "closed", labelKey: "opt_fermee" },
];

// ── Component ────────────────────────────────────────────
export function PortalRequestsList({ requests }: { requests: Request[] }) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const columns: Column<Request>[] = [
    {
      key: "service",
      header: t("service"),
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
      header: t("description"),
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {truncate(r.description, 60)}
        </span>
      ),
    },
    {
      key: "urgency",
      header: t("urgence"),
      accessor: (r) => {
        const config = URGENCY_CONFIG[r.urgencyLevel];
        if (!config) return <Badge variant="outline">{r.urgencyLevel}</Badge>;
        return (
          <Badge
            variant={config.variant}
            className={r.urgencyLevel === "critical" ? "font-bold" : ""}
          >
            {t(config.labelKey)}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: t("statut"),
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date",
      header: t("date"),
      accessor: (r) => formatDate(r.createdAt),
      sortable: true,
      sortBy: (r) => new Date(r.createdAt),
      hiddenOnMobile: true,
    },
  ];


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
                  {t(urgencyConfig.labelKey)}
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
              : t("demande_projet")}
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
                <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                  <Inbox className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="portal-title">{t("demandes")}</h1>
                  <p className="text-sm text-muted-foreground">
                    {t("suivez_demandes_projet")}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t("nouvelle_demande")}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("total_demandes")}</p>
                    <p className="portal-kpi-number">{totalCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-sky-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-sky-100 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-[#0F2D52]">{t("nouvelles")}</p>
                    <p className="portal-kpi-number">{newCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-amber-100 flex items-center justify-center">
                    <Loader className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-amber-600">{t("cours")}</p>
                    <p className="portal-kpi-number">{inProgressCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-emerald-600">{t("converties")}</p>
                    <p className="portal-kpi-number">{convertedCount}</p>
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
        searchPlaceholder={t("rechercher_demande")}
        searchFn={(r) => `${r.serviceType ?? ""} ${r.description}`}
        filterOptions={filterOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        filterFn={(r) => r.status}
        filterLabel={t("tous_statuts")}
        exportFilename="demandes"
        emptyMessage={t("aucune_demande")}
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
