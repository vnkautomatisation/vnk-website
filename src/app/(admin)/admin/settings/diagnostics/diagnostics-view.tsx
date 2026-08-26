"use client";
// Vue Diagnostics — affichage temps réel des health checks.
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity, ChevronLeft, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, MinusCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CheckStatus = "ok" | "warn" | "error" | "skip";
type Check = {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  ms?: number;
};
type Report = {
  runAt: string;
  summary: { total: number; ok: number; warn: number; error: number; skip: number };
  checks: Check[];
};

const STATUS_META: Record<CheckStatus, { color: string; bg: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  ok: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, label: "OK" },
  warn: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: AlertTriangle, label: "Attention" },
  error: { color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle, label: "Erreur" },
  skip: { color: "text-gray-500", bg: "bg-gray-50 border-gray-200", icon: MinusCircle, label: "Non configuré" },
};

export function DiagnosticsView() {
  const tc = useTranslations("common");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as Report;
      setReport(data);
    } catch (e) {
      toast.error("Échec du diagnostic : " + (e instanceof Error ? e.message : "inconnu"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { run(); }, [run]);

  const byCategory: Record<string, Check[]> = {};
  if (report) {
    for (const c of report.checks) {
      (byCategory[c.category] ??= []).push(c);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-indigo-600 shrink-0">
          <Activity className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Diagnostics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Vérifications de santé : base de données, intégrations, stockage, configuration
          </p>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="shrink-0">
          <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
          {loading ? "Analyse..." : "Relancer"}
        </Button>
      </div>

      {/* RÉSUMÉ */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["ok", "warn", "error", "skip"] as CheckStatus[]).map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const count = report.summary[s];
            return (
              <Card key={s} className={cn("border-l-4", meta.bg)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", meta.color)} />
                    <span className={cn("text-[10px] uppercase tracking-wider font-semibold", meta.color)}>{meta.label}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </CardContent>
              </Card>
            );
          })}
          <Card className="border-l-4 border-l-[#0F2D52]">
            <CardContent className="p-3">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52]">Total</span>
              <p className="text-2xl font-bold mt-1">{report.summary.total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {report && (
        <p className="text-[11px] text-muted-foreground">
          Dernière exécution : {new Date(report.runAt).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "medium" })}
        </p>
      )}

      {/* CHECKS PAR CATÉGORIE */}
      {loading && !report && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin inline mr-2" />
            Analyse en cours...
          </CardContent>
        </Card>
      )}

      {Object.entries(byCategory).map(([category, items]) => {
        const errors = items.filter((c) => c.status === "error").length;
        const warns = items.filter((c) => c.status === "warn").length;
        const isExpanded = expanded[category] !== false; // par défaut ouvert
        return (
          <div key={category} className="space-y-2">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [category]: !isExpanded }))}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <h2 className="font-semibold text-base">{category}</h2>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                {errors > 0 && <Badge className="text-[10px] bg-red-600 hover:bg-red-600">{errors} erreur{errors > 1 ? "s" : ""}</Badge>}
                {warns > 0 && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">{warns} avert.</Badge>}
              </div>
            </button>

            {isExpanded && (
              <Card>
                <div className="divide-y">
                  {items.map((c) => {
                    const meta = STATUS_META[c.status];
                    const Icon = meta.icon;
                    return (
                      <div key={c.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{c.label}</p>
                            {c.ms !== undefined && (
                              <Badge variant="outline" className="text-[10px] font-mono">{c.ms} ms</Badge>
                            )}
                          </div>
                          <p className={cn("text-xs mt-0.5", meta.color)}>{c.message}</p>
                          {c.detail && (
                            <p className="text-[11px] text-muted-foreground mt-1 italic">
                              → {c.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        );
      })}

      {report && report.summary.error === 0 && report.summary.warn === 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Tout est en ordre</p>
              <p className="text-xs text-emerald-800">
                {report.summary.ok} vérification{report.summary.ok > 1 ? "s" : ""} passée{report.summary.ok > 1 ? "s" : ""} avec succès.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
