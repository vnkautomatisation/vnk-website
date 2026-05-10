"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Activity, Search, Download, RefreshCw, LogIn, ShoppingCart, FileSignature,
  ShieldCheck, Mail, FileText, GitBranch, Clock, Users, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/admin/stat-card";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn } from "@/lib/utils";

type AuditEvent = {
  id: string;
  source: "login" | "order" | "signature" | "consent" | "email" | "audit" | "workflow";
  type: string;
  label: string;
  clientId: number | null;
  clientName?: string | null;
  adminId?: number | null;
  adminEmail?: string | null;
  email?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };

const SOURCE_OPTIONS = [
  { value: "login", label: "Connexions", icon: LogIn, color: "bg-blue-100 text-blue-700" },
  { value: "order", label: "Commandes/Paiements", icon: ShoppingCart, color: "bg-emerald-100 text-emerald-700" },
  { value: "signature", label: "Signatures", icon: FileSignature, color: "bg-violet-100 text-violet-700" },
  { value: "consent", label: "Consentements", icon: ShieldCheck, color: "bg-cyan-100 text-cyan-700" },
  { value: "email", label: "Emails", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "audit", label: "Actions admin", icon: FileText, color: "bg-red-100 text-red-700" },
  { value: "workflow", label: "Workflow", icon: GitBranch, color: "bg-indigo-100 text-indigo-700" },
];

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AuditTrailView({
  clients,
  counts,
}: {
  clients: ClientOption[];
  counts: Record<string, number>;
}) {
  const { open: openEntity } = useEntityPanels();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilters.size > 0) params.set("type", Array.from(sourceFilters).join(","));
      if (filterClient) params.set("clientId", filterClient);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      params.set("limit", "300");
      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      } else {
        toast.error("Erreur chargement");
      }
    } finally { setLoading(false); }
  }, [sourceFilters, filterClient, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e) =>
      e.label.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.clientName ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.ipAddress ?? "").toLowerCase().includes(q)
    );
  }, [events, search]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Source", "Type", "Label", "Client", "Email", "IP", "User-Agent", "Métadonnées"],
      ...filtered.map((e) => [
        e.createdAt,
        e.source,
        e.type,
        e.label,
        e.clientName ?? "",
        e.email ?? "",
        e.ipAddress ?? "",
        e.userAgent ?? "",
        JSON.stringify(e.metadata ?? {}),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} événements exportés`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Audit trail</h1>
              <p className="text-white/70 text-sm mt-0.5">Timeline immuable — connexions · paiements · signatures · consentements · emails · workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Rafraîchir
            </Button>
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={exportCsv}>
              <Download className="h-4 w-4" />Exporter CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard label="Connexions" value={counts.login ?? 0} icon={LogIn} accent="bg-blue-500" />
        <StatCard label="Commandes" value={counts.order ?? 0} icon={ShoppingCart} accent="bg-emerald-500" />
        <StatCard label="Signatures" value={counts.signature ?? 0} icon={FileSignature} accent="bg-violet-500" />
        <StatCard label="Consentements" value={counts.consent ?? 0} icon={ShieldCheck} accent="bg-cyan-500" />
        <StatCard label="Emails" value={counts.email ?? 0} icon={Mail} accent="bg-amber-500" />
        <StatCard label="Actions admin" value={counts.audit ?? 0} icon={FileText} accent="bg-red-500" />
        <StatCard label="Workflow" value={counts.workflow ?? 0} icon={GitBranch} accent="bg-indigo-500" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Label, client, email, IP..." className="pl-9" />
        </div>
        <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-auto h-9 text-xs" />
        <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-auto h-9 text-xs" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOURCE_OPTIONS.map((s) => {
          const isOn = sourceFilters.has(s.value);
          const Icon = s.icon;
          return (
            <button key={s.value} type="button"
              onClick={() => {
                const set = new Set(sourceFilters);
                if (isOn) set.delete(s.value); else set.add(s.value);
                setSourceFilters(set);
              }}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                isOn ? "bg-[#0F2D52] text-white" : s.color)}>
              <Icon className="h-3 w-3" />{s.label}
            </button>
          );
        })}
        {sourceFilters.size > 0 && (
          <button type="button" onClick={() => setSourceFilters(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground px-2">
            Tout effacer
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun événement</div>
          ) : (
            filtered.map((e) => {
              const src = SOURCE_OPTIONS.find((s) => s.value === e.source);
              const Icon = src?.icon ?? Activity;
              return (
                <div key={e.id} className="px-4 py-3 hover:bg-muted/40 flex items-start gap-3 transition-colors">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", src?.color ?? "bg-gray-100 text-gray-700")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium">{e.label}</p>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmtRelative(e.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                      {e.clientName && (
                        <button type="button" onClick={() => e.clientId && openEntity("client", e.clientId)}
                          className="inline-flex items-center gap-1 hover:text-[#0F2D52] hover:underline">
                          <Users className="h-2.5 w-2.5" />{e.clientName}
                        </button>
                      )}
                      {e.adminEmail && (
                        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" />{e.adminEmail}</span>
                      )}
                      {e.ipAddress && (
                        <span className="inline-flex items-center gap-1 font-mono"><Globe className="h-2.5 w-2.5" />{e.ipAddress}</span>
                      )}
                      {(e.metadata as { country?: string } | null)?.country && (
                        <span>📍 {(e.metadata as { country: string }).country}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(e.createdAt).toLocaleString("fr-CA")}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <p className="text-[10px] text-center text-muted-foreground">
        {filtered.length} événement(s) affiché(s) — limite 300. Affinez les filtres pour voir plus.
      </p>
    </div>
  );
}
