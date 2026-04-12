"use client";

import { Briefcase } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────
type Mandate = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  estimatedHours: number | null;
  actualHours: number | null;
  hourlyRate: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

// ── Progress bar color helper ────────────────────────────
function progressColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-600";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-red-500";
}

// ── Filter options ───────────────────────────────────────
const filterOptions: FilterOption[] = [
  { value: "active", label: "Actif" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Complete" },
  { value: "paused", label: "En pause" },
  { value: "pending", label: "En attente" },
];

// ── Component ────────────────────────────────────────────
export function PortalMandatesList({ mandates }: { mandates: Mandate[] }) {
  // ── Columns ──────────────────────────────────────────
  const columns: Column<Mandate>[] = [
    {
      key: "title",
      header: "Projet",
      accessor: (r) => (
        <span className="font-medium">{r.title}</span>
      ),
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "progress",
      header: "Progression",
      accessor: (r) => (
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor(r.progress)}`}
              style={{ width: `${r.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums w-8 text-right">
            {r.progress}%
          </span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.progress,
      hiddenOnMobile: true,
    },
    {
      key: "start",
      header: "Debut",
      accessor: (r) => formatDate(r.startDate),
      sortable: true,
      sortBy: (r) => (r.startDate ? new Date(r.startDate) : null),
      hiddenOnMobile: true,
    },
    {
      key: "end",
      header: "Fin",
      accessor: (r) => formatDate(r.endDate),
      sortable: true,
      sortBy: (r) => (r.endDate ? new Date(r.endDate) : null),
      hiddenOnMobile: true,
    },
    {
      key: "hours",
      header: "Heures",
      accessor: (r) => {
        if (r.estimatedHours == null && r.actualHours == null) return "--";
        const actual = r.actualHours ?? 0;
        const estimated = r.estimatedHours;
        return (
          <span className="text-sm tabular-nums">
            {actual} / {estimated ?? "?"} h
          </span>
        );
      },
      sortable: true,
      sortBy: (r) => r.actualHours ?? 0,
      hiddenOnMobile: true,
    },
  ];

  // ── Card renderer ────────────────────────────────────
  const renderCard = (m: Mandate) => (
    <Card className="overflow-hidden">
      <div className="h-2.5 bg-muted overflow-hidden">
        <div
          className={`h-full ${progressColor(m.progress)}`}
          style={{ width: `${m.progress}%` }}
        />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{m.title}</p>
          <StatusBadge status={m.status} />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor(m.progress)}`}
              style={{ width: `${m.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums">
            {m.progress}%
          </span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {m.startDate ? formatDate(m.startDate) : "--"} -{" "}
            {m.endDate ? formatDate(m.endDate) : "--"}
          </span>
          {(m.actualHours != null || m.estimatedHours != null) && (
            <span className="tabular-nums">
              {m.actualHours ?? 0} / {m.estimatedHours ?? "?"} h
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Briefcase className="h-6 w-6 text-[#0F2D52]" />
        <div>
          <h1 className="text-2xl font-bold">Mes mandats</h1>
          <p className="text-sm text-muted-foreground">
            Suivi de vos projets en cours
          </p>
        </div>
      </div>

      <DataTable
        data={mandates}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-mandates"
        searchPlaceholder="Rechercher un mandat..."
        searchFn={(r) => `${r.title} ${r.description ?? ""}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        filterLabel="Tous les statuts"
        exportFilename="mandats"
        emptyMessage="Aucun mandat"
        emptyIcon={
          <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
        }
      />
    </div>
  );
}
