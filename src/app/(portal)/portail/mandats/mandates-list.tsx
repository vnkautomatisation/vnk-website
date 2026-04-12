"use client";

import { useState } from "react";
import {
  Briefcase,
  X,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  User,
} from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";

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

function progressColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-600";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function progressTextColor(pct: number): string {
  if (pct >= 75) return "text-emerald-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

const filterOptions: FilterOption[] = [
  { value: "active", label: "Actif" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Complete" },
  { value: "paused", label: "En pause" },
  { value: "pending", label: "En attente" },
];

export function PortalMandatesList({ mandates }: { mandates: Mandate[] }) {
  const [selected, setSelected] = useState<Mandate | null>(null);

  const openDetail = (m: Mandate) => setSelected(m);
  const closeDetail = () => setSelected(null);

  const columns: Column<Mandate>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: () => (
        <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <Briefcase className="h-4 w-4 text-[#0F2D52]" />
        </div>
      ),
    },
    {
      key: "title",
      header: "Projet",
      accessor: (r) => <span className="font-medium">{r.title}</span>,
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
              className={`h-full rounded-full transition-all ${progressColor(r.progress)}`}
              style={{ width: `${r.progress}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums w-8 text-right ${progressTextColor(r.progress)}`}>
            {r.progress}%
          </span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.progress,
      hiddenOnMobile: true,
    },
    {
      key: "dates",
      header: "Periode",
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.startDate ? formatDate(new Date(r.startDate)) : "—"}
          {r.endDate ? ` — ${formatDate(new Date(r.endDate))}` : ""}
        </span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "hours",
      header: "Heures",
      accessor: (r) => {
        if (r.estimatedHours == null && r.actualHours == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm font-medium tabular-nums">
            {r.actualHours ?? 0} / {r.estimatedHours ?? "?"} h
          </span>
        );
      },
      sortable: true,
      sortBy: (r) => r.actualHours ?? 0,
      hiddenOnMobile: true,
    },
  ];

  const renderCard = (m: Mandate) => (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      <div className="h-1.5 bg-muted overflow-hidden">
        <div className={`h-full ${progressColor(m.progress)}`} style={{ width: `${m.progress}%` }} />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{m.title}</p>
          <StatusBadge status={m.status} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${progressColor(m.progress)}`} style={{ width: `${m.progress}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums ${progressTextColor(m.progress)}`}>{m.progress}%</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{m.startDate ? formatDate(new Date(m.startDate)) : "—"}</span>
          {(m.actualHours != null || m.estimatedHours != null) && (
            <span className="tabular-nums">{m.actualHours ?? 0} / {m.estimatedHours ?? "?"} h</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <Briefcase className="h-5 w-5 text-[#0F2D52]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes mandats</h1>
          <p className="text-sm text-muted-foreground">Suivi de vos projets en cours</p>
        </div>
      </div>

      <DataTable
        data={mandates}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        onRowClick={openDetail}
        storageKey="portal-mandates"
        searchPlaceholder="Rechercher un mandat..."
        searchFn={(r) => `${r.title} ${r.description ?? ""}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        emptyMessage="Aucun mandat"
      />

      {/* ── Detail panel (slide-out from right) ──────────── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={closeDetail}
          />
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="bg-[#0F2D52] text-white px-5 py-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={selected.status} />
                <button
                  onClick={closeDetail}
                  className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="font-bold text-lg leading-tight">{selected.title}</h2>
            </div>

            {/* Progress */}
            <div className="px-5 py-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progression</span>
                <span className={`text-2xl font-bold ${progressTextColor(selected.progress)}`}>
                  {selected.progress}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(selected.progress)}`}
                  style={{ width: `${selected.progress}%` }}
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Description */}
              {selected.description && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Description
                  </h3>
                  <p className="text-sm leading-relaxed">{selected.description}</p>
                </div>
              )}

              <Separator />

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoItem icon={Calendar} label="Date debut" value={selected.startDate ? formatDate(new Date(selected.startDate)) : "Non definie"} />
                <InfoItem icon={Calendar} label="Date fin" value={selected.endDate ? formatDate(new Date(selected.endDate)) : "Non definie"} />
                <InfoItem icon={Clock} label="Heures estimees" value={selected.estimatedHours != null ? `${selected.estimatedHours} h` : "—"} />
                <InfoItem icon={Clock} label="Heures reelles" value={selected.actualHours != null ? `${selected.actualHours} h` : "—"} />
                {selected.hourlyRate != null && (
                  <InfoItem icon={TrendingUp} label="Taux horaire" value={`${selected.hourlyRate} $/h`} />
                )}
                <InfoItem icon={FileText} label="Cree le" value={formatDate(new Date(selected.createdAt))} />
              </div>

              {/* Hours comparison */}
              {selected.estimatedHours != null && selected.actualHours != null && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Suivi des heures
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estimees</span>
                        <span className="font-medium">{selected.estimatedHours} h</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Realisees</span>
                        <span className="font-medium">{selected.actualHours} h</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            selected.actualHours > selected.estimatedHours
                              ? "bg-red-500"
                              : "bg-emerald-600"
                          }`}
                          style={{
                            width: `${Math.min(100, (selected.actualHours / selected.estimatedHours) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round((selected.actualHours / selected.estimatedHours) * 100)}% utilise
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0">
              <Button variant="outline" className="w-full" onClick={closeDetail}>
                Fermer
              </Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
