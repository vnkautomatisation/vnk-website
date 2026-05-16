"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileBarChart,
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateModal } from "@/components/admin/create-modal";
import { EditModal } from "@/components/admin/edit-modal";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type TaxDeclaration = {
  id: number;
  periodType: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalRevenueHt: number;
  totalTps: number;
  totalTvq: number;
  totalTaxes: number;
  status: string;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
};

const TYPE_OPTIONS = [
  { value: "tps_tvq_trimestrielle", label: "Trimestrielle TPS/TVQ" },
  { value: "annuelle_impots", label: "Annuelle impôts" },
];

function typeLabel(v: string): string {
  return TYPE_OPTIONS.find((t) => t.value === v)?.label ?? v.replace(/_/g, " ");
}

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function TaxView({
  declarations,
  kpis,
}: {
  declarations: TaxDeclaration[];
  kpis: { revenueHt: number; tpsCollected: number; tvqCollected: number; totalTaxes: number };
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("tax-declarations", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Sticky scroll detection (Wix pattern)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const [newType, setNewType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit/Delete
  const [editDecl, setEditDecl] = useState<TaxDeclaration | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editNotes, setEditNotes] = useState("");
  const [deleteDecl, setDeleteDecl] = useState<TaxDeclaration | null>(null);

  const resetForm = () => {
    setNewType("");
    setNewLabel("");
    setNewStart("");
    setNewEnd("");
    setNewNotes("");
  };

  const openEdit = (d: TaxDeclaration) => {
    setEditDecl(d);
    setEditLabel(d.periodLabel);
    setEditStatus(d.status);
    setEditNotes(d.notes ?? "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editDecl || !editLabel.trim()) return { success: false, error: "Période requise" };
    try {
      const res = await fetch(`/api/tax-declarations/${editDecl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodLabel: editLabel.trim(),
          status: editStatus,
          notes: editNotes.trim() || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteDecl) return;
    const res = await fetch(`/api/tax-declarations/${deleteDecl.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Déclaration supprimée"); setDeleteDecl(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newType || !newLabel.trim() || !newStart || !newEnd) {
      return { success: false, error: "Type, période, début et fin requis" };
    }
    try {
      const res = await fetch("/api/tax-declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: newType,
          periodLabel: newLabel.trim(),
          periodStart: newStart,
          periodEnd: newEnd,
          notes: newNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        resetForm();
        router.refresh();
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch {
      return { success: false, error: "Erreur réseau" };
    }
  };

  const filtered = useMemo(() => {
    let result = declarations;
    if (statusFilter !== "all") result = result.filter((d) => d.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.periodLabel.toLowerCase().includes(q) ||
          typeLabel(d.periodType).toLowerCase().includes(q)
      );
    }
    return result;
  }, [declarations, searchQuery, statusFilter]);

  // Export CSV des déclarations filtrées
  const exportCsv = () => {
    const headers = [
      "Période",
      "Type",
      "Début",
      "Fin",
      "Revenu HT",
      "TPS collectée",
      "TVQ collectée",
      "Total taxes",
      "Statut",
      "Date soumission",
      "Notes",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach((d) => {
      const statusLbl = d.status === "draft" ? "Brouillon" : d.status === "submitted" ? "Soumise" : d.status === "confirmed" ? "Confirmée" : d.status;
      lines.push([
        d.periodLabel,
        typeLabel(d.periodType),
        d.periodStart.slice(0, 10),
        d.periodEnd.slice(0, 10),
        d.totalRevenueHt.toFixed(2),
        d.totalTps.toFixed(2),
        d.totalTvq.toFixed(2),
        d.totalTaxes.toFixed(2),
        statusLbl,
        d.submittedAt ? d.submittedAt.slice(0, 10) : "",
        d.notes ?? "",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `declarations-fiscales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Actions menu pour EntityCard
  const getActions = useCallback((d: TaxDeclaration) => {
    const editable = d.status !== "submitted" && !d.submittedAt;
    return [
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDecl(d), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);

  const columns: Column<TaxDeclaration>[] = [
    { key: "period", header: "Période", accessor: (r) => r.periodLabel, sortable: true, sortBy: (r) => r.periodLabel },
    {
      key: "type",
      header: "Type",
      accessor: (r) => <span className="text-xs">{typeLabel(r.periodType)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "revenue",
      header: "Revenu",
      accessor: (r) => formatCurrency(r.totalRevenueHt),
      sortable: true,
      sortBy: (r) => r.totalRevenueHt,
    },
    {
      key: "tps",
      header: "TPS",
      accessor: (r) => formatCurrency(r.totalTps),
      hiddenOnMobile: true,
    },
    {
      key: "tvq",
      header: "TVQ",
      accessor: (r) => formatCurrency(r.totalTvq),
      hiddenOnMobile: true,
    },
    {
      key: "taxes",
      header: "Total taxes",
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.totalTaxes)}</span>,
      sortable: true,
      sortBy: (r) => r.totalTaxes,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "submitted",
      header: "Soumise le",
      accessor: (r) => r.submittedAt ? formatDate(new Date(r.submittedAt)) : "—",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero VNK */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Déclarations fiscales
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Suivi des déclarations TPS/TVQ et impôts · {declarations.length} déclaration{declarations.length > 1 ? "s" : ""} enregistrée{declarations.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exporter CSV
            </Button>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nouvelle déclaration
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs (basés sur factures payées de l'année courante) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenu brut HT</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.revenueHt)}</p>
          <p className="text-[10px] text-muted-foreground">année courante</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">TPS collectée</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(kpis.tpsCollected)}</p>
          <p className="text-[10px] text-muted-foreground">à remettre au fédéral</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">TVQ collectée</p>
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{formatCurrency(kpis.tvqCollected)}</p>
          <p className="text-[10px] text-muted-foreground">à remettre au Québec</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total taxes</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(kpis.totalTaxes)}</p>
          <p className="text-[10px] text-muted-foreground">TPS + TVQ</p>
        </div>
      </div>

      {/* Sentinel + sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileBarChart className="h-4 w-4" />
              Déclarations fiscales
            </span>
            <span className="font-semibold">{filtered.length} affichées</span>
            <span className="text-muted-foreground">Revenu HT <span className="font-semibold text-emerald-600">{formatCurrency(kpis.revenueHt)}</span></span>
            <span className="text-muted-foreground">TPS <span className="font-semibold text-blue-600">{formatCurrency(kpis.tpsCollected)}</span></span>
            <span className="text-muted-foreground">TVQ <span className="font-semibold text-indigo-600">{formatCurrency(kpis.tvqCollected)}</span></span>
            <span className="ml-auto text-muted-foreground">Total taxes <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalTaxes)}</span></span>
          </div>
        )}

        {/* Filtres inline */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Période, type…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="submitted">Soumise</SelectItem>
                <SelectItem value="confirmed">Confirmée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ViewToggle storageKey="tax-declarations" defaultView="list" onChange={setView} />
        </div>
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.periodLabel}
              subtitle={typeLabel(d.periodType)}
              icon={<FileBarChart className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: d.status === "draft" ? "Brouillon" : d.status === "submitted" ? "Soumise" : d.status === "confirmed" ? "Confirmée" : d.status, variant: d.status === "confirmed" ? "secondary" : "outline" },
              ]}
              stats={[
                { label: "Revenu HT", value: formatCurrency(d.totalRevenueHt) },
                { label: "Total taxes", value: formatCurrency(d.totalTaxes) },
              ]}
              actions={getActions(d)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>TPS: {formatCurrency(d.totalTps)}</span>
                  <span>TVQ: {formatCurrency(d.totalTvq)}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune déclaration trouvée</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="declarations-fiscales" storageKey="admin-tax-declarations" />
      )}

      <EditModal open={!!editDecl} onOpenChange={(o) => { if (!o) setEditDecl(null); }} title="Modifier la déclaration" description={editDecl?.periodLabel} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Période *</Label><Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} /></div>
          <div className="space-y-2"><Label>Statut</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="submitted">Soumise</SelectItem>
                <SelectItem value="confirmed">Confirmée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteDecl}
        onOpenChange={(o) => { if (!o) setDeleteDecl(null); }}
        title="Supprimer cette déclaration ?"
        description={`La déclaration "${deleteDecl?.periodLabel}" sera supprimée définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouvelle déclaration" icon={FileBarChart} accent="bg-amber-500" submitLabel="Créer la déclaration" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-label">Période *</Label>
            <Input id="t-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ex: T1 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-start">Début *</Label>
              <Input id="t-start" type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-end">Fin *</Label>
              <Input id="t-end" type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea id="t-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
