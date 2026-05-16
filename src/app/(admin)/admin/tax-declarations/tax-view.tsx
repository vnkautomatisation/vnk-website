"use client";
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileBarChart,
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  CheckCircle2,
  RefreshCw,
  Send,
  Calendar,
  Calculator,
  Tag,
  Lock,
  Info,
  FileDown,
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormSection } from "@/components/admin/client-form-fields";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
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

type QuarterPreview = {
  quarter: number;
  label: string;
  from: string;
  to: string;
  invoiceCount: number;
  revenueHt: number;
  tpsCollected: number;
  tvqCollected: number;
  tpsPaid: number;
  tvqPaid: number;
};

type Kpis = {
  year: number;
  revenueHt: number;
  tpsCollected: number;
  tvqCollected: number;
  totalTaxesCollected: number;
  expensesHt: number;
  tpsPaid: number;
  tvqPaid: number;
  netTps: number;
  netTvq: number;
  netToRemit: number;
  countDraft: number;
  countSubmitted: number;
  countConfirmed: number;
  quarterPreviews: QuarterPreview[];
};

const TYPE_OPTIONS = [
  { value: "tps_tvq_trimestrielle", label: "Trimestrielle TPS/TVQ" },
  { value: "annuelle_impots", label: "Annuelle impôts" },
];

function typeLabel(v: string): string {
  return TYPE_OPTIONS.find((t) => t.value === v)?.label ?? v.replace(/_/g, " ");
}

function statusLabel(s: string): string {
  return s === "draft" ? "Brouillon" : s === "submitted" ? "Soumise" : s === "confirmed" ? "Confirmée" : s;
}

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// Aperçu calcul live appelé par modal Create
type PreviewData = {
  invoices: { count: number; revenueHt: number; tpsCollected: number; tvqCollected: number; totalTaxesCollected: number };
  expenses: { count: number; expensesHt: number; tpsPaid: number; tvqPaid: number; totalTaxesPaid: number };
  netToRemit: { tps: number; tvq: number; total: number };
};

export function TaxView({
  declarations,
  kpis,
}: {
  declarations: TaxDeclaration[];
  kpis: Kpis;
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("tax-declarations", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Sticky scroll detection
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

  // Create form state
  const [newType, setNewType] = useState("tps_tvq_trimestrielle");
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit form state
  const [editDecl, setEditDecl] = useState<TaxDeclaration | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editNotes, setEditNotes] = useState("");

  // Delete
  const [deleteDecl, setDeleteDecl] = useState<TaxDeclaration | null>(null);

  // Submit confirm
  const [submitDecl, setSubmitDecl] = useState<TaxDeclaration | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recalculate confirm
  const [recalcDecl, setRecalcDecl] = useState<TaxDeclaration | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const resetForm = () => {
    setNewType("tps_tvq_trimestrielle");
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

  const handleSubmit = async () => {
    if (!submitDecl) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tax-declarations/${submitDecl.id}/submit`, { method: "POST" });
      if (res.ok) {
        toast.success(`Déclaration "${submitDecl.periodLabel}" marquée comme soumise`);
        setSubmitDecl(null);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculate = async () => {
    if (!recalcDecl) return;
    setRecalculating(true);
    try {
      const res = await fetch(`/api/tax-declarations/${recalcDecl.id}/recalculate`, { method: "POST" });
      if (res.ok) {
        toast.success(`Montants recalculés pour "${recalcDecl.periodLabel}"`);
        setRecalcDecl(null);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setRecalculating(false);
    }
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
    if (typeFilter !== "all") result = result.filter((d) => d.periodType === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.periodLabel.toLowerCase().includes(q) ||
          typeLabel(d.periodType).toLowerCase().includes(q)
      );
    }
    return result;
  }, [declarations, searchQuery, statusFilter, typeFilter]);

  const hasActiveFilter = !!(searchQuery || statusFilter !== "all" || typeFilter !== "all");

  // Export PDF de la liste (filtres serveur : type + statut)
  // Pas de window.open (onglet vide) : anchor invisible → le navigateur déclenche le download
  // grâce au Content-Disposition: attachment côté API.
  const exportListPdf = () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const url = `/api/tax-declarations/export/pdf${params.toString() ? `?${params.toString()}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.click();
  };

  // PDF formel d'une déclaration individuelle
  const downloadDeclarationPdf = (id: number) => {
    const a = document.createElement("a");
    a.href = `/api/tax-declarations/${id}/pdf`;
    a.rel = "noopener";
    a.click();
  };

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
      lines.push([
        d.periodLabel,
        typeLabel(d.periodType),
        shortDate(d.periodStart),
        shortDate(d.periodEnd),
        d.totalRevenueHt.toFixed(2),
        d.totalTps.toFixed(2),
        d.totalTvq.toFixed(2),
        d.totalTaxes.toFixed(2),
        statusLabel(d.status),
        d.submittedAt ? shortDate(d.submittedAt) : "",
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

  // Actions menu pour EntityCard (grid view)
  const getActions = useCallback((d: TaxDeclaration) => {
    const editable = d.status !== "submitted" && !d.submittedAt;
    return [
      { label: "Télécharger PDF", icon: <FileDown className="h-3.5 w-3.5" />, onClick: () => downloadDeclarationPdf(d.id) },
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) }] : []),
      ...(editable ? [{ label: "Recalculer les montants", icon: <RefreshCw className="h-3.5 w-3.5" />, onClick: () => setRecalcDecl(d) }] : []),
      ...(editable ? [{ label: "Marquer soumise", icon: <Send className="h-3.5 w-3.5" />, onClick: () => setSubmitDecl(d) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDecl(d), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);

  // Appliquer un trimestre preview vers le formulaire Create
  const applyQuarterPreset = (q: QuarterPreview) => {
    setNewType("tps_tvq_trimestrielle");
    setNewLabel(q.label);
    setNewStart(q.from);
    setNewEnd(q.to);
    setCreateOpen(true);
  };

  const columns: Column<TaxDeclaration>[] = [
    { key: "period", header: "Période", accessor: (r) => <span className="font-semibold">{r.periodLabel}</span>, sortable: true, sortBy: (r) => r.periodLabel },
    {
      key: "type",
      header: "Type",
      accessor: (r) => <span className="text-xs">{typeLabel(r.periodType)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "dates",
      header: "Dates",
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{shortDate(r.periodStart)} → {shortDate(r.periodEnd)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "revenue",
      header: "Revenu HT",
      accessor: (r) => <span className="tabular-nums">{formatCurrency(r.totalRevenueHt)}</span>,
      sortable: true,
      sortBy: (r) => r.totalRevenueHt,
    },
    {
      key: "tps",
      header: "TPS",
      accessor: (r) => <span className="tabular-nums text-blue-600">{formatCurrency(r.totalTps)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "tvq",
      header: "TVQ",
      accessor: (r) => <span className="tabular-nums text-indigo-600">{formatCurrency(r.totalTvq)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "taxes",
      header: "Total taxes",
      accessor: (r) => <span className="font-semibold tabular-nums text-amber-600">{formatCurrency(r.totalTaxes)}</span>,
      sortable: true,
      sortBy: (r) => r.totalTaxes,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "submitted",
      header: "Soumise le",
      accessor: (r) => r.submittedAt ? <span className="text-xs">{formatDate(new Date(r.submittedAt))}</span> : <span className="text-muted-foreground italic text-xs">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      accessor: (r) => {
        const editable = r.status !== "submitted" && !r.submittedAt;
        if (!editable) {
          return (
            <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
              <ActionTooltip label="Télécharger le PDF officiel de la déclaration">
                <button onClick={() => downloadDeclarationPdf(r.id)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-[#0F2D52]" aria-label="Télécharger PDF">
                  <FileDown className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
              <ActionTooltip label="Déclaration soumise — verrouillée">
                <span className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground/60 cursor-help">
                  <Lock className="h-3.5 w-3.5" />
                </span>
              </ActionTooltip>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
            <ActionTooltip label="Télécharger le PDF officiel de la déclaration">
              <button onClick={() => downloadDeclarationPdf(r.id)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-[#0F2D52]" aria-label="Télécharger PDF">
                <FileDown className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label="Modifier (label, statut, notes)">
              <button onClick={() => openEdit(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Modifier">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label="Recalculer revenu et taxes depuis les factures payées">
              <button onClick={() => setRecalcDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-blue-600" aria-label="Recalculer">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label="Marquer comme soumise (irréversible)">
              <button onClick={() => setSubmitDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600" aria-label="Marquer soumise">
                <Send className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label="Supprimer la déclaration">
              <button onClick={() => setDeleteDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          </div>
        );
      },
    },
  ];

  // Empty state full-page si aucune déclaration
  if (declarations.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Déclarations fiscales
          </h1>
          <p className="text-white/70 text-xs mt-0.5">Suivi des déclarations TPS/TVQ et impôts</p>
        </div>

        {/* Section aperçu trimestres — utile même sans déclaration créée */}
        <QuarterPreviewSection year={kpis.year} quarters={kpis.quarterPreviews} onCreate={applyQuarterPreset} />

        <div className="rounded-xl border bg-card p-10 text-center">
          <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-base">Aucune déclaration fiscale</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Créez votre première déclaration pour archiver les montants TPS/TVQ collectés et payés sur une période donnée.
          </p>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="mt-4">
            <Plus className="h-4 w-4 mr-1.5" />
            Créer ma première déclaration
          </Button>
        </div>

        <TaxFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          editDecl={null}
          values={{
            type: newType, setType: setNewType,
            label: newLabel, setLabel: setNewLabel,
            start: newStart, setStart: setNewStart,
            end: newEnd, setEnd: setNewEnd,
            status: "draft", setStatus: () => {},
            notes: newNotes, setNotes: setNewNotes,
          }}
          quarterPresets={kpis.quarterPreviews}
          onSubmit={handleCreate}
        />
      </div>
    );
  }

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
              Suivi des déclarations TPS/TVQ et impôts · {declarations.length} déclaration{declarations.length > 1 ? "s" : ""} · {kpis.countDraft} brouillon{kpis.countDraft > 1 ? "s" : ""}, {kpis.countSubmitted} soumise{kpis.countSubmitted > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTooltip label="Exporter le rapport annuel en PDF (KPI + liste + net à remettre)">
              <Button onClick={exportListPdf} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Exporter PDF
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Exporter en CSV pour Excel / comptable">
              <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exporter CSV
              </Button>
            </ActionTooltip>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nouvelle déclaration
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs YTD */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenu brut HT</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.revenueHt)}</p>
          <p className="text-[10px] text-muted-foreground">factures payées {kpis.year}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxes collectées</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(kpis.totalTaxesCollected)}</p>
          <p className="text-[10px] text-muted-foreground">TPS {formatCurrency(kpis.tpsCollected)} · TVQ {formatCurrency(kpis.tvqCollected)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxes payées (dépenses)</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(kpis.tpsPaid + kpis.tvqPaid)}</p>
          <p className="text-[10px] text-muted-foreground">TPS {formatCurrency(kpis.tpsPaid)} · TVQ {formatCurrency(kpis.tvqPaid)}</p>
        </div>
        <div className={cn(
          "rounded-lg border p-3",
          kpis.netToRemit >= 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200",
        )}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {kpis.netToRemit >= 0 ? "Net à remettre" : "Remboursement attendu"}
          </p>
          <p className={cn("text-lg font-bold tabular-nums", kpis.netToRemit >= 0 ? "text-amber-700" : "text-emerald-700")}>
            {formatCurrency(Math.abs(kpis.netToRemit))}
          </p>
          <p className="text-[10px] text-muted-foreground">collectées − payées</p>
        </div>
      </div>

      {/* Aperçu trimestres année courante */}
      <QuarterPreviewSection year={kpis.year} quarters={kpis.quarterPreviews} onCreate={applyQuarterPreset} />

      {/* Sentinel — détecte quand contenu sort viewport */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sticky bar (rendue uniquement quand scrollée) */}
      {scrolled && (
        <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileBarChart className="h-4 w-4" />
              Déclarations fiscales
            </span>
            <span className="font-semibold">{filtered.length} affichée{filtered.length > 1 ? "s" : ""}</span>
            <span className="text-muted-foreground">Revenu HT <span className="font-semibold text-emerald-600">{formatCurrency(kpis.revenueHt)}</span></span>
            <span className="text-muted-foreground">Collectées <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalTaxesCollected)}</span></span>
            <span className={cn("text-muted-foreground ml-auto", kpis.netToRemit >= 0 ? "" : "")}>
              {kpis.netToRemit >= 0 ? "Net à remettre" : "Remboursement"} <span className={cn("font-semibold", kpis.netToRemit >= 0 ? "text-amber-700" : "text-emerald-700")}>{formatCurrency(Math.abs(kpis.netToRemit))}</span>
            </span>
          </div>
        </div>
      )}

      {/* Filtres */}
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
          <Label className="text-[10px]">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Statut</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="draft">Brouillon ({kpis.countDraft})</SelectItem>
              <SelectItem value="submitted">Soumise ({kpis.countSubmitted})</SelectItem>
              <SelectItem value="confirmed">Confirmée ({kpis.countConfirmed})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ViewToggle storageKey="tax-declarations" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille ou table */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.periodLabel}
              subtitle={typeLabel(d.periodType)}
              icon={<FileBarChart className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: statusLabel(d.status), variant: d.status === "confirmed" ? "secondary" : d.status === "submitted" ? "outline" : "destructive" },
              ]}
              stats={[
                { label: "Revenu HT", value: formatCurrency(d.totalRevenueHt) },
                { label: "Total taxes", value: formatCurrency(d.totalTaxes) },
              ]}
              actions={getActions(d)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>TPS {formatCurrency(d.totalTps)}</span>
                  <span>TVQ {formatCurrency(d.totalTvq)}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
              {hasActiveFilter ? "Aucune déclaration ne correspond aux filtres" : "Aucune déclaration"}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder="Rechercher..."
          storageKey="admin-tax-declarations"
          onRowClick={(r) => { if (r.status !== "submitted" && !r.submittedAt) openEdit(r); }}
          emptyMessage={hasActiveFilter ? "Aucune déclaration ne correspond aux filtres" : "Aucune déclaration"}
        />
      )}

      {/* Edit modal VNK */}
      <TaxFormDialog
        mode="edit"
        open={!!editDecl}
        onOpenChange={(o) => { if (!o) setEditDecl(null); }}
        editDecl={editDecl}
        values={{
          type: editDecl?.periodType ?? "", setType: () => {},
          label: editLabel, setLabel: setEditLabel,
          start: editDecl?.periodStart.slice(0, 10) ?? "", setStart: () => {},
          end: editDecl?.periodEnd.slice(0, 10) ?? "", setEnd: () => {},
          status: editStatus, setStatus: setEditStatus,
          notes: editNotes, setNotes: setEditNotes,
        }}
        quarterPresets={[]}
        onSubmit={handleEdit}
      />

      {/* Create modal VNK */}
      <TaxFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        editDecl={null}
        values={{
          type: newType, setType: setNewType,
          label: newLabel, setLabel: setNewLabel,
          start: newStart, setStart: setNewStart,
          end: newEnd, setEnd: setNewEnd,
          status: "draft", setStatus: () => {},
          notes: newNotes, setNotes: setNewNotes,
        }}
        quarterPresets={kpis.quarterPreviews}
        onSubmit={handleCreate}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteDecl}
        onOpenChange={(o) => { if (!o) setDeleteDecl(null); }}
        title="Supprimer cette déclaration ?"
        description={`La déclaration "${deleteDecl?.periodLabel}" sera supprimée définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      {/* Submit confirm */}
      <ConfirmDialog
        open={!!submitDecl}
        onOpenChange={(o) => { if (!o) setSubmitDecl(null); }}
        variant="default"
        title="Marquer comme soumise ?"
        description={
          submitDecl
            ? `"${submitDecl.periodLabel}" sera verrouillée et ne pourra plus être modifiée ni supprimée. Total à remettre : ${formatCurrency(submitDecl.totalTaxes)}.`
            : ""
        }
        confirmLabel={submitting ? "Soumission…" : "Confirmer la soumission"}
        onConfirm={handleSubmit}
        loading={submitting}
      />

      {/* Recalculate confirm */}
      <ConfirmDialog
        open={!!recalcDecl}
        onOpenChange={(o) => { if (!o) setRecalcDecl(null); }}
        variant="default"
        title="Recalculer les montants ?"
        description={
          recalcDecl
            ? `Revenu HT, TPS et TVQ seront recalculés depuis les factures payées entre le ${shortDate(recalcDecl.periodStart)} et le ${shortDate(recalcDecl.periodEnd)}.`
            : ""
        }
        confirmLabel={recalculating ? "Recalcul…" : "Recalculer"}
        onConfirm={handleRecalculate}
        loading={recalculating}
      />
    </div>
  );
}

// ─── Section Aperçu Trimestres ──────────────────────────────────────────
function QuarterPreviewSection({
  year,
  quarters,
  onCreate,
}: {
  year: number;
  quarters: QuarterPreview[];
  onCreate: (q: QuarterPreview) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-[#0F2D52]" />
          Aperçu trimestres {year}
        </h3>
        <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3 w-3" />
          Clic sur un trimestre pour pré-remplir une nouvelle déclaration
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {quarters.map((q) => {
          const netToRemit = (q.tpsCollected - q.tpsPaid) + (q.tvqCollected - q.tvqPaid);
          const totalCollected = q.tpsCollected + q.tvqCollected;
          return (
            <button
              key={q.quarter}
              type="button"
              onClick={() => onCreate(q)}
              disabled={q.invoiceCount === 0}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-all",
                q.invoiceCount === 0
                  ? "bg-muted/30 border-muted opacity-60 cursor-not-allowed"
                  : "bg-card hover:bg-muted hover:border-[#0F2D52] hover:shadow-sm",
              )}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-bold text-[#0F2D52]">{q.label}</span>
                <span className="text-[9px] text-muted-foreground">{q.invoiceCount} facture{q.invoiceCount > 1 ? "s" : ""}</span>
              </div>
              <p className="text-base font-bold tabular-nums">{formatCurrency(q.revenueHt)}</p>
              <p className="text-[9px] text-muted-foreground">Revenu HT</p>
              {totalCollected > 0 && (
                <div className="mt-1.5 pt-1.5 border-t flex items-baseline justify-between text-[10px]">
                  <span className="text-muted-foreground">Net à remettre</span>
                  <span className={cn("font-semibold", netToRemit >= 0 ? "text-amber-700" : "text-emerald-700")}>
                    {formatCurrency(Math.abs(netToRemit))}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dialog VNK pour Create + Edit Tax Declaration ──────────────────────
function TaxFormDialog({
  mode,
  open,
  onOpenChange,
  editDecl,
  values,
  quarterPresets,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editDecl: TaxDeclaration | null;
  values: {
    type: string; setType: (v: string) => void;
    label: string; setLabel: (v: string) => void;
    start: string; setStart: (v: string) => void;
    end: string; setEnd: (v: string) => void;
    status: string; setStatus: (v: string) => void;
    notes: string; setNotes: (v: string) => void;
  };
  quarterPresets: QuarterPreview[];
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const isCreate = mode === "create";

  // Reset preview when dialog closes
  useEffect(() => {
    if (!open) {
      setPreview(null);
    }
  }, [open]);

  // Reset preview quand start/end changent (sera recalculé sur clic)
  useEffect(() => {
    setPreview(null);
  }, [values.start, values.end]);

  const fetchPreview = async () => {
    if (!values.start || !values.end) {
      toast.error("Renseigner les dates de début et fin");
      return;
    }
    if (new Date(values.end) < new Date(values.start)) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch(`/api/tax-declarations/preview?from=${values.start}&to=${values.end}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur de prévisualisation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setPreviewing(false);
    }
  };

  const applyPreset = (q: QuarterPreview) => {
    values.setLabel(q.label);
    values.setStart(q.from);
    values.setEnd(q.to);
    values.setType("tps_tvq_trimestrielle");
    setPreview(null);
  };

  const datesValid = !!(values.start && values.end && new Date(values.end) >= new Date(values.start));
  const canSubmit = isCreate
    ? !!values.type && !!values.label.trim() && datesValid
    : !!values.label.trim();

  const handleSubmitClick = () => {
    startTransition(async () => {
      const result = await onSubmit();
      if (result.success) {
        toast.success(isCreate ? "Déclaration créée" : "Déclaration mise à jour");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Une erreur est survenue");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header navy gradient VNK */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" aria-hidden />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <FileBarChart className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-white text-lg">
                {isCreate ? "Nouvelle déclaration fiscale" : "Modifier la déclaration"}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5 truncate">
                {isCreate
                  ? "Archive les montants TPS/TVQ collectés et payés pour une période donnée"
                  : (editDecl?.periodLabel || "Modification")}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          {/* Presets trimestres (création seulement) */}
          {isCreate && quarterPresets.length > 0 && (
            <FormSection title="Préremplissage rapide" icon={<Calendar className="h-3.5 w-3.5" />}>
              <p className="text-[10px] text-muted-foreground -mt-1">Cliquer un trimestre pour remplir automatiquement le label et les dates :</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quarterPresets.map((q) => (
                  <button
                    key={q.quarter}
                    type="button"
                    onClick={() => applyPreset(q)}
                    disabled={q.invoiceCount === 0}
                    className={cn(
                      "px-2 py-1.5 rounded text-[10px] font-medium border transition-colors text-center",
                      q.invoiceCount === 0
                        ? "bg-muted/30 text-muted-foreground border-muted opacity-50 cursor-not-allowed"
                        : values.label === q.label
                          ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                          : "bg-background text-foreground hover:bg-muted hover:border-[#0F2D52]"
                    )}
                  >
                    <span className="block font-bold">{q.label}</span>
                    <span className="block text-[9px] opacity-70">{q.invoiceCount} fact.</span>
                  </button>
                ))}
              </div>
            </FormSection>
          )}

          {/* Section 1 : Détails période */}
          <FormSection title="Période" icon={<Calendar className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type de déclaration *</Label>
                {isCreate ? (
                  <Select value={values.type} onValueChange={values.setType}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 px-3 rounded-md border bg-muted flex items-center text-sm text-muted-foreground">
                    {typeLabel(values.type)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Libellé période *</Label>
                <Input value={values.label} onChange={(e) => values.setLabel(e.target.value)} placeholder="ex : T1 2026" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Début *</Label>
                {isCreate ? (
                  <Input type="date" value={values.start} onChange={(e) => values.setStart(e.target.value)} />
                ) : (
                  <div className="h-9 px-3 rounded-md border bg-muted flex items-center text-sm text-muted-foreground inline-flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    {shortDate(values.start)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fin *</Label>
                {isCreate ? (
                  <Input type="date" value={values.end} onChange={(e) => values.setEnd(e.target.value)} min={values.start || undefined} />
                ) : (
                  <div className="h-9 px-3 rounded-md border bg-muted flex items-center text-sm text-muted-foreground inline-flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    {shortDate(values.end)}
                  </div>
                )}
              </div>
            </div>
            {isCreate && !datesValid && values.start && values.end && (
              <p className="text-[11px] text-red-600 inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                La date de fin doit être après la date de début.
              </p>
            )}
          </FormSection>

          {/* Section 2 (Create) : Aperçu calculé */}
          {isCreate && (
            <FormSection title="Aperçu des montants" icon={<Calculator className="h-3.5 w-3.5" />}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Calcule revenu, TPS et TVQ collectés et payés pour la période sélectionnée — avant de créer la déclaration.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fetchPreview}
                  disabled={!datesValid || previewing}
                  className="shrink-0"
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  {previewing ? "Calcul…" : "Calculer"}
                </Button>
              </div>
              {preview && (
                <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Factures payées</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span className="tabular-nums">{preview.invoices.count}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Revenu HT</span><span className="tabular-nums font-semibold text-emerald-600">{formatCurrency(preview.invoices.revenueHt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TPS collectée</span><span className="tabular-nums text-blue-600">{formatCurrency(preview.invoices.tpsCollected)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TVQ collectée</span><span className="tabular-nums text-indigo-600">{formatCurrency(preview.invoices.tvqCollected)}</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dépenses</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span className="tabular-nums">{preview.expenses.count}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Dépenses HT</span><span className="tabular-nums">{formatCurrency(preview.expenses.expensesHt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TPS payée</span><span className="tabular-nums text-blue-600">{formatCurrency(preview.expenses.tpsPaid)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TVQ payée</span><span className="tabular-nums text-indigo-600">{formatCurrency(preview.expenses.tvqPaid)}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-md p-2.5 text-center border-t pt-2",
                    preview.netToRemit.total >= 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200",
                  )}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {preview.netToRemit.total >= 0 ? "Net à remettre" : "Remboursement attendu"}
                    </p>
                    <p className={cn("text-xl font-bold tabular-nums", preview.netToRemit.total >= 0 ? "text-amber-700" : "text-emerald-700")}>
                      {formatCurrency(Math.abs(preview.netToRemit.total))}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      TPS net {formatCurrency(preview.netToRemit.tps)} · TVQ net {formatCurrency(preview.netToRemit.tvq)}
                    </p>
                  </div>
                </div>
              )}
              {!preview && datesValid && (
                <p className="text-[11px] text-muted-foreground italic">Cliquer sur Calculer pour voir l&apos;aperçu.</p>
              )}
            </FormSection>
          )}

          {/* Section 2 (Edit) : Montants archivés */}
          {!isCreate && editDecl && (
            <FormSection title="Montants archivés" icon={<Calculator className="h-3.5 w-3.5" />}>
              <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Revenu HT</span><span className="tabular-nums font-semibold text-emerald-600">{formatCurrency(editDecl.totalRevenueHt)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TPS collectée</span><span className="tabular-nums text-blue-600">{formatCurrency(editDecl.totalTps)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVQ collectée</span><span className="tabular-nums text-indigo-600">{formatCurrency(editDecl.totalTvq)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold text-[#0F2D52]"><span>Total taxes collectées</span><span className="tabular-nums">{formatCurrency(editDecl.totalTaxes)}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ces montants ont été calculés au moment de la création. Utiliser <strong>Recalculer</strong> dans la liste si des factures ont été ajoutées/modifiées.
              </p>
            </FormSection>
          )}

          {/* Section 3 (Edit) : Statut */}
          {!isCreate && (
            <FormSection title="Statut" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut actuel</Label>
                <Select value={values.status} onValueChange={values.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="submitted">Soumise (verrouille la déclaration)</SelectItem>
                    <SelectItem value="confirmed">Confirmée par l&apos;ARC / Revenu Québec</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Une fois marquée comme <strong>soumise</strong>, la déclaration ne peut plus être modifiée ni supprimée.
                </p>
              </div>
            </FormSection>
          )}

          {/* Notes */}
          <FormSection title="Notes internes" icon={<Tag className="h-3.5 w-3.5" />}>
            <Textarea
              value={values.notes}
              onChange={(e) => values.setNotes(e.target.value)}
              rows={3}
              placeholder="N° de soumission ARC, accusé de réception, commentaire interne…"
            />
          </FormSection>

          {/* Aide pédagogique (Create) */}
          {isCreate && (
            <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Comment ça fonctionne</p>
                <p>
                  À la création, le système calcule automatiquement le revenu HT, la TPS et la TVQ collectées depuis toutes les factures <strong>payées</strong> entre les dates de début et fin (inclusif). Les dépenses ne sont pas archivées mais leurs taxes payées sont visibles dans l&apos;aperçu pour calculer le <strong>net à remettre</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button
            onClick={handleSubmitClick}
            disabled={pending || !canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {pending ? "Enregistrement…" : (isCreate ? "Créer la déclaration" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
