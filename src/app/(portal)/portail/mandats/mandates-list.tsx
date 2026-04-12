"use client";

import { useState, useMemo } from "react";
import {
  Briefcase,
  X,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  CheckCircle,
  Loader,
  Pause,
  Rocket,
  Search as SearchIcon,
  Wrench,
  FlaskConical,
  PackageCheck,
  Hash,
  Activity,
  Target,
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

// ── Timeline Steps ───────────────────────────────────────
const STEPS = [
  { key: "start", label: "Demarrage", icon: Rocket },
  { key: "diagnostic", label: "Diagnostic", icon: SearchIcon },
  { key: "intervention", label: "Intervention", icon: Wrench },
  { key: "tests", label: "Tests", icon: FlaskConical },
  { key: "delivery", label: "Livraison", icon: PackageCheck },
];

function getActiveStep(progress: number, status: string): number {
  if (status === "completed") return 5;
  if (status === "pending") return 0;
  if (status === "paused") {
    // Show last active step
    if (progress >= 86) return 4;
    if (progress >= 61) return 3;
    if (progress >= 31) return 2;
    if (progress >= 11) return 1;
    return 0;
  }
  if (progress >= 86) return 4;
  if (progress >= 61) return 3;
  if (progress >= 31) return 2;
  if (progress >= 11) return 1;
  return 0;
}

function MandateTimeline({ progress, status, compact }: { progress: number; status: string; compact?: boolean }) {
  const activeStep = getActiveStep(progress, status);
  const isCompleted = status === "completed";
  const isPaused = status === "paused";

  return (
    <div className={cn("flex items-center w-full", compact ? "gap-0.5" : "gap-0")}>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = isCompleted || i < activeStep;
        const current = !isCompleted && i === activeStep;
        const paused = isPaused && current;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            {/* Step circle */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all",
                  compact ? "h-7 w-7" : "h-9 w-9",
                  done
                    ? "bg-emerald-500 text-white shadow-sm"
                    : current
                      ? paused
                        ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-200"
                        : "bg-[#0F2D52] text-white shadow-md ring-2 ring-blue-200 animate-pulse"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {done ? (
                  <CheckCircle className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                ) : paused ? (
                  <Pause className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                ) : (
                  <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                )}
              </div>
              {!compact && (
                <span
                  className={cn(
                    "text-[10px] mt-1.5 text-center leading-tight font-medium",
                    done
                      ? "text-emerald-700"
                      : current
                        ? paused
                          ? "text-amber-700"
                          : "text-[#0F2D52] font-semibold"
                        : "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 mx-1",
                  compact ? "h-0.5" : "h-0.5 -mt-4",
                  done ? "bg-emerald-400" : current ? "bg-gradient-to-r from-[#0F2D52]/60 to-muted" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Progress bar helpers ────────────────────────────────
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

  // ── KPI stats ─────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = mandates.length;
    const active = mandates.filter((m) => m.status === "active" || m.status === "in_progress").length;
    const completed = mandates.filter((m) => m.status === "completed").length;
    const avgProgress = total > 0 ? Math.round(mandates.reduce((s, m) => s + m.progress, 0) / total) : 0;
    return { total, active, completed, avgProgress };
  }, [mandates]);

  const columns: Column<Mandate>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: () => (
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center">
          <Briefcase className="h-4 w-4 text-purple-600" />
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
              className={`h-full rounded-full ${progressColor(r.progress)} transition-all`}
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
        if (r.estimatedHours == null && r.actualHours == null) return <span className="text-muted-foreground">--</span>;
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
      "overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer",
      selected?.id === m.id && "ring-2 ring-[#0F2D52]"
    )}>
      {/* Progress top bar */}
      <div className="h-1.5 bg-muted overflow-hidden">
        <div className={`h-full ${progressColor(m.progress)} transition-all`} style={{ width: `${m.progress}%` }} />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{m.title}</p>
          <StatusBadge status={m.status} />
        </div>

        {/* Mini timeline in card */}
        <MandateTimeline progress={m.progress} status={m.status} compact />

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
    <div className="space-y-5">
      {/* ── Page header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg">
          <Briefcase className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes mandats</h1>
          <p className="text-sm text-muted-foreground">Suivi de vos projets en cours</p>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="vnk-kpi-card vnk-stat-blue bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Hash className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold tracking-tight">{kpis.total}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-purple bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Actifs</p>
              <p className="text-xl font-bold tracking-tight">{kpis.active}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-emerald bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Completes</p>
              <p className="text-xl font-bold tracking-tight">{kpis.completed}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-amber bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Progression moy.</p>
              <p className="text-xl font-bold tracking-tight">{kpis.avgProgress}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout : table + detail panel ─────────── */}
      <div className="flex gap-4">
        <div className={cn("flex-1 min-w-0 transition-all", selected && "lg:max-w-[calc(100%-380px)]")}>
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

        {/* ── Detail panel — inline right side ────── */}
        {selected && (
          <div className="hidden lg:block w-[370px] shrink-0">
            <Card className="sticky top-20 overflow-hidden border-0 shadow-lg ring-1 ring-border/50">
              {/* Header */}
              <div className="bg-gradient-to-br from-[#0F2D52] to-[#1a4a7a] text-white px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{selected.title}</h3>
                    <div className="mt-1.5">
                      <StatusBadge status={selected.status} />
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Timeline stepper */}
              <div className="px-5 py-4 border-b bg-muted/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Etapes du projet
                </p>
                <MandateTimeline progress={selected.progress} status={selected.status} />
              </div>

              {/* Progression */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progression</span>
                  <span className={`text-lg font-bold ${progressTextColor(selected.progress)}`}>
                    {selected.progress}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progressColor(selected.progress)} transition-all`}
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              {/* Info rows */}
              <div className="px-5 py-4 space-y-3">
                {selected.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selected.description}
                  </p>
                )}

                <div className="space-y-2.5">
                  <DetailRow icon={Calendar} label="Debut" value={selected.startDate ? formatDate(new Date(selected.startDate)) : "--"} />
                  <DetailRow icon={Calendar} label="Fin" value={selected.endDate ? formatDate(new Date(selected.endDate)) : "--"} />
                  <DetailRow
                    icon={Clock}
                    label="Heures"
                    value={
                      selected.estimatedHours != null
                        ? `${selected.actualHours ?? 0} / ${selected.estimatedHours} h`
                        : "--"
                    }
                  />
                  {selected.hourlyRate != null && (
                    <DetailRow icon={TrendingUp} label="Taux" value={`${selected.hourlyRate} $/h`} />
                  )}
                  <DetailRow icon={FileText} label="Cree le" value={formatDate(new Date(selected.createdAt))} />
                </div>

                {/* Hours usage bar */}
                {selected.estimatedHours != null && selected.actualHours != null && (
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground font-medium">Heures utilisees</span>
                      <span className="font-bold">
                        {Math.round((selected.actualHours / selected.estimatedHours) * 100)}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
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

      {/* ── Mobile: bottom sheet ──────────────────── */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
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

              {/* Timeline stepper mobile */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Etapes du projet</p>
                <MandateTimeline progress={selected.progress} status={selected.status} />
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
                <DetailRow icon={Calendar} label="Debut" value={selected.startDate ? formatDate(new Date(selected.startDate)) : "--"} />
                <DetailRow icon={Calendar} label="Fin" value={selected.endDate ? formatDate(new Date(selected.endDate)) : "--"} />
                <DetailRow icon={Clock} label="Heures" value={selected.estimatedHours != null ? `${selected.actualHours ?? 0} / ${selected.estimatedHours} h` : "--"} />
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
