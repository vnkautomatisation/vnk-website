"use client";

import { useState } from "react";
import {
  Briefcase,
  X,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
} from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor(r.progress)}`}
              style={{ width: `${r.progress}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums ${progressTextColor(r.progress)}`}>
            {r.progress}%
          </span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.progress,
      hiddenOnMobile: true,
    },
    {
      key: "hours",
      header: "Heures",
      accessor: (r) => {
        if (r.estimatedHours == null && r.actualHours == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm tabular-nums">
            {r.actualHours ?? 0} / {r.estimatedHours ?? "?"} h
          </span>
        );
      },
      hiddenOnMobile: true,
    },
  ];

  const renderCard = (m: Mandate) => (
    <Card className={cn(
      "overflow-hidden hover:shadow-md transition-all cursor-pointer",
      selected?.id === m.id && "ring-2 ring-[#0F2D52]"
    )}>
      <div className="h-1.5 bg-muted overflow-hidden">
        <div className={`h-full ${progressColor(m.progress)}`} style={{ width: `${m.progress}%` }} />
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{m.title}</p>
          <StatusBadge status={m.status} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${progressColor(m.progress)}`} style={{ width: `${m.progress}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums ${progressTextColor(m.progress)}`}>{m.progress}%</span>
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

      {/* Layout : table + detail panel side by side */}
      <div className="flex gap-4">
        {/* Table (shrinks when panel is open) */}
        <div className={cn("flex-1 min-w-0 transition-all", selected && "lg:max-w-[calc(100%-360px)]")}>
          <DataTable
            data={mandates}
            columns={columns}
            getRowId={(r) => r.id}
            renderCard={renderCard}
            onRowClick={(m) => setSelected(m)}
            storageKey="portal-mandates"
            searchPlaceholder="Rechercher un mandat..."
            searchFn={(r) => `${r.title} ${r.description ?? ""}`}
            filterOptions={filterOptions}
            filterFn={(r) => r.status}
            emptyMessage="Aucun mandat"
          />
        </div>

        {/* Detail panel — inline right side */}
        {selected && (
          <div className="hidden lg:block w-[350px] shrink-0">
            <Card className="sticky top-20 overflow-hidden border-2 border-[#0F2D52]/20">
              {/* Header */}
              <div className="bg-[#0F2D52] text-white px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{selected.title}</h3>
                    <div className="mt-1">
                      <StatusBadge status={selected.status} />
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="h-7 w-7 rounded hover:bg-white/10 flex items-center justify-center shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progression */}
              <div className="px-4 py-3 border-b">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progression</span>
                  <span className={`text-lg font-bold ${progressTextColor(selected.progress)}`}>
                    {selected.progress}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progressColor(selected.progress)}`}
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              {/* Info rows */}
              <div className="px-4 py-3 space-y-3">
                {selected.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selected.description}
                  </p>
                )}

                <div className="space-y-2.5">
                  <DetailRow icon={Calendar} label="Debut" value={selected.startDate ? formatDate(new Date(selected.startDate)) : "—"} />
                  <DetailRow icon={Calendar} label="Fin" value={selected.endDate ? formatDate(new Date(selected.endDate)) : "—"} />
                  <DetailRow
                    icon={Clock}
                    label="Heures"
                    value={
                      selected.estimatedHours != null
                        ? `${selected.actualHours ?? 0} / ${selected.estimatedHours} h`
                        : "—"
                    }
                  />
                  {selected.hourlyRate != null && (
                    <DetailRow icon={TrendingUp} label="Taux" value={`${selected.hourlyRate} $/h`} />
                  )}
                  <DetailRow icon={FileText} label="Cree le" value={formatDate(new Date(selected.createdAt))} />
                </div>

                {/* Hours bar */}
                {selected.estimatedHours != null && selected.actualHours != null && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Heures utilisees</span>
                      <span className="font-medium">
                        {Math.round((selected.actualHours / selected.estimatedHours) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          selected.actualHours > selected.estimatedHours ? "bg-red-500" : "bg-[#0F2D52]"
                        }`}
                        style={{
                          width: `${Math.min(100, (selected.actualHours / selected.estimatedHours) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile: bottom sheet style for detail */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{selected.title}</h3>
                  <StatusBadge status={selected.status} />
                </div>
                <button onClick={() => setSelected(null)} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">Progression</span>
                  <span className={`text-xl font-bold ${progressTextColor(selected.progress)}`}>{selected.progress}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${progressColor(selected.progress)}`} style={{ width: `${selected.progress}%` }} />
                </div>
              </div>

              {selected.description && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <DetailRow icon={Calendar} label="Debut" value={selected.startDate ? formatDate(new Date(selected.startDate)) : "—"} />
                <DetailRow icon={Calendar} label="Fin" value={selected.endDate ? formatDate(new Date(selected.endDate)) : "—"} />
                <DetailRow icon={Clock} label="Heures" value={selected.estimatedHours != null ? `${selected.actualHours ?? 0} / ${selected.estimatedHours} h` : "—"} />
                {selected.hourlyRate != null && <DetailRow icon={TrendingUp} label="Taux" value={`${selected.hourlyRate} $/h`} />}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium ml-auto">{value}</span>
    </div>
  );
}
