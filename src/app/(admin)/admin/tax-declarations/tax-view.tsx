"use client";
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  { value: "tps_tvq_trimestrielle", labelKey: "trimestrielle_tps_tvq" },
  { value: "annuelle_impots", labelKey: "annuelle_impots" },
];

function typeKey(v: string): string | null {
  return TYPE_OPTIONS.find((o) => o.value === v)?.labelKey ?? null;
}

function statusKey(s: string): string | null {
  return s === "draft" ? "brouillon" : s === "submitted" ? "soumise" : s === "confirmed" ? "confirmee" : null;
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
  const t = useTranslations("admin.tax_decl");
  const tc = useTranslations("common");
  const router = useRouter();
  const [view, setView] = useViewMode("tax-declarations", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);


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


  const [newType, setNewType] = useState("tps_tvq_trimestrielle");
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newNotes, setNewNotes] = useState("");


  const [editDecl, setEditDecl] = useState<TaxDeclaration | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editNotes, setEditNotes] = useState("");


  const [deleteDecl, setDeleteDecl] = useState<TaxDeclaration | null>(null);


  const [submitDecl, setSubmitDecl] = useState<TaxDeclaration | null>(null);
  const [submitting, setSubmitting] = useState(false);


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
    if (!editDecl || !editLabel.trim()) return { success: false, error: t("periode_requise") };
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
      return { success: false, error: data.error || t("erreur") };
    } catch { return { success: false, error: t("erreur_reseau") }; }
  };

  const handleDelete = async () => {
    if (!deleteDecl) return;
    const res = await fetch(`/api/tax-declarations/${deleteDecl.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("declaration_supprimee")); setDeleteDecl(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleSubmit = async () => {
    if (!submitDecl) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tax-declarations/${submitDecl.id}/submit`, { method: "POST" });
      if (res.ok) {
        toast.success(t("declaration_marquee_soumise", { label: submitDecl.periodLabel }));
        setSubmitDecl(null);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || t("erreur"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
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
        toast.error(d.error || t("erreur"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
    } finally {
      setRecalculating(false);
    }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newType || !newLabel.trim() || !newStart || !newEnd) {
      return { success: false, error: t("type_periode_debut_fin_requis") };
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
      return { success: false, error: data.error || t("erreur") };
    } catch {
      return { success: false, error: t("erreur_reseau") };
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
          (typeKey(d.periodType) ? t(typeKey(d.periodType)!) : d.periodType).toLowerCase().includes(q)
      );
    }
    return result;
  }, [declarations, searchQuery, statusFilter, typeFilter]);

  const hasActiveFilter = !!(searchQuery || statusFilter !== "all" || typeFilter !== "all");




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


  const downloadDeclarationPdf = (id: number) => {
    const a = document.createElement("a");
    a.href = `/api/tax-declarations/${id}/pdf`;
    a.rel = "noopener";
    a.click();
  };


  const exportCsv = () => {
    const headers = [
      t("periode"),
      t("type"),
      t("debut"),
      t("fin"),
      t("revenu_ht"),
      t("tps_collectee"),
      t("tvq_collectee"),
      t("total_taxes_plain"),
      t("statut"),
      t("date_soumission"),
      t("notes"),
    ];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach((d) => {
      lines.push([
        d.periodLabel,
        typeKey(d.periodType) ? t(typeKey(d.periodType)!) : d.periodType,
        shortDate(d.periodStart),
        shortDate(d.periodEnd),
        d.totalRevenueHt.toFixed(2),
        d.totalTps.toFixed(2),
        d.totalTvq.toFixed(2),
        d.totalTaxes.toFixed(2),
        statusKey(d.status) ? t(statusKey(d.status)!) : d.status,
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


  const getActions = useCallback((d: TaxDeclaration) => {
    const editable = d.status !== "submitted" && !d.submittedAt;
    return [
      { label: t("telecharger_pdf"), icon: <FileDown className="h-3.5 w-3.5" />, onClick: () => downloadDeclarationPdf(d.id) },
      ...(editable ? [{ label: t("modifier"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) }] : []),
      ...(editable ? [{ label: t("recalculer_montants_2"), icon: <RefreshCw className="h-3.5 w-3.5" />, onClick: () => setRecalcDecl(d) }] : []),
      ...(editable ? [{ label: t("marquer_soumise"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => setSubmitDecl(d) }] : []),
      ...(editable ? [{ label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDecl(d), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);


  const applyQuarterPreset = (q: QuarterPreview) => {
    setNewType("tps_tvq_trimestrielle");
    setNewLabel(q.label);
    setNewStart(q.from);
    setNewEnd(q.to);
    setCreateOpen(true);
  };

  const columns: Column<TaxDeclaration>[] = [
    { key: "period", header: t("periode"), accessor: (r) => <span className="font-semibold">{r.periodLabel}</span>, sortable: true, sortBy: (r) => r.periodLabel },
    {
      key: "type",
      header: t("type"),
      accessor: (r) => <span className="text-xs">{typeKey(r.periodType) ? t(typeKey(r.periodType)!) : r.periodType}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "dates",
      header: t("dates"),
      accessor: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{shortDate(r.periodStart)} → {shortDate(r.periodEnd)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "revenue",
      header: t("revenu_ht"),
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
      header: t("total_taxes_plain"),
      accessor: (r) => <span className="font-semibold tabular-nums text-amber-600">{formatCurrency(r.totalTaxes)}</span>,
      sortable: true,
      sortBy: (r) => r.totalTaxes,
    },
    { key: "status", header: t("statut"), accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "submitted",
      header: t("soumise_le"),
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
              <ActionTooltip label={t("telecharger_pdf_officiel_declaration")}>
                <button onClick={() => downloadDeclarationPdf(r.id)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-[#0F2D52]" aria-label={t("telecharger_pdf")}>
                  <FileDown className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
              <ActionTooltip label={t("declaration_soumise_verrouillee")}>
                <span className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground/60 cursor-help">
                  <Lock className="h-3.5 w-3.5" />
                </span>
              </ActionTooltip>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
            <ActionTooltip label={t("telecharger_pdf_officiel_declaration")}>
              <button onClick={() => downloadDeclarationPdf(r.id)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-[#0F2D52]" aria-label={t("telecharger_pdf")}>
                <FileDown className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={t("modifier_label_statut_notes")}>
              <button onClick={() => openEdit(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground" aria-label={tc("edit")}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={t("recalculer_revenu_taxes_depuis_factures")}>
              <button onClick={() => setRecalcDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-blue-600" aria-label={t("recalculer")}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={t("marquer_comme_soumise_irreversible")}>
              <button onClick={() => setSubmitDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600" aria-label={t("marquer_soumise")}>
                <Send className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={t("supprimer_declaration")}>
              <button onClick={() => setDeleteDecl(r)} className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-red-600" aria-label={tc("delete")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          </div>
        );
      },
    },
  ];


  if (declarations.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            {t("declarations_fiscales")}
          </h1>
          <p className="text-white/70 text-xs mt-0.5">{t("suivi_declarations_tps_tvq_impots")}</p>
        </div>


        <QuarterPreviewSection year={kpis.year} quarters={kpis.quarterPreviews} onCreate={applyQuarterPreset} />

        <div className="rounded-xl border bg-card p-10 text-center">
          <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-base">{t("aucune_declaration_fiscale")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {t("creez_premiere_declaration_archiver_montants")}
          </p>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="mt-4">
            <Plus className="h-4 w-4 mr-1.5" />
            {t("creer_ma_premiere_declaration")}
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

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              {t("declarations_fiscales")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {t("suivi_declarations_resume", { total: declarations.length, drafts: kpis.countDraft, submitted: kpis.countSubmitted })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTooltip label={t("exporter_rapport_annuel_pdf_kpi")}>
              <Button onClick={exportListPdf} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_pdf")}
              </Button>
            </ActionTooltip>
            <ActionTooltip label={t("exporter_csv_excel_comptable")}>
              <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_csv")}
              </Button>
            </ActionTooltip>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("nouvelle_declaration")}
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("revenu_brut_ht")}</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.revenueHt)}</p>
          <p className="text-[10px] text-muted-foreground">factures payées {kpis.year}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("taxes_collectees")}</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(kpis.totalTaxesCollected)}</p>
          <p className="text-[10px] text-muted-foreground">TPS {formatCurrency(kpis.tpsCollected)} · TVQ {formatCurrency(kpis.tvqCollected)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("taxes_payees_depenses")}</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(kpis.tpsPaid + kpis.tvqPaid)}</p>
          <p className="text-[10px] text-muted-foreground">TPS {formatCurrency(kpis.tpsPaid)} · TVQ {formatCurrency(kpis.tvqPaid)}</p>
        </div>
        <div className={cn(
          "rounded-lg border p-3",
          kpis.netToRemit >= 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200",
        )}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {kpis.netToRemit >= 0 ? t("net_remettre") : t("remboursement_attendu")}
          </p>
          <p className={cn("text-lg font-bold tabular-nums", kpis.netToRemit >= 0 ? "text-amber-700" : "text-emerald-700")}>
            {formatCurrency(Math.abs(kpis.netToRemit))}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("collectees_payees")}</p>
        </div>
      </div>


      <QuarterPreviewSection year={kpis.year} quarters={kpis.quarterPreviews} onCreate={applyQuarterPreset} />


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileBarChart className="h-4 w-4" />
              {t("declarations_fiscales")}
            </span>
            <span className="font-semibold">{filtered.length} affichée{filtered.length > 1 ? "s" : ""}</span>
            <span className="text-muted-foreground">{t("revenu_ht")} <span className="font-semibold text-emerald-600">{formatCurrency(kpis.revenueHt)}</span></span>
            <span className="text-muted-foreground">{t("collectees")} <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalTaxesCollected)}</span></span>
            <span className={cn("text-muted-foreground ml-auto", kpis.netToRemit >= 0 ? "" : "")}>
              {kpis.netToRemit >= 0 ? t("net_remettre") : t("remboursement")} <span className={cn("font-semibold", kpis.netToRemit >= 0 ? "text-amber-700" : "text-emerald-700")}>{formatCurrency(Math.abs(kpis.netToRemit))}</span>
            </span>
          </div>
        </div>
      )}


      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Label className="text-[10px]">{t("recherche")}</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("periode_type")}
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">{t("type")}</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_types")}</SelectItem>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">{tc("status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_statuts")}</SelectItem>
              <SelectItem value="draft">Brouillon ({kpis.countDraft})</SelectItem>
              <SelectItem value="submitted">Soumise ({kpis.countSubmitted})</SelectItem>
              <SelectItem value="confirmed">Confirmée ({kpis.countConfirmed})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ViewToggle storageKey="tax-declarations" defaultView="list" onChange={setView} />
      </div>


      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.periodLabel}
              subtitle={typeKey(d.periodType) ? t(typeKey(d.periodType)!) : d.periodType}
              icon={<FileBarChart className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: statusKey(d.status) ? t(statusKey(d.status)!) : d.status, variant: d.status === "confirmed" ? "secondary" : d.status === "submitted" ? "outline" : "destructive" },
              ]}
              stats={[
                { label: t("revenu_ht"), value: formatCurrency(d.totalRevenueHt) },
                { label: t("total_taxes_plain"), value: formatCurrency(d.totalTaxes) },
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
              {hasActiveFilter ? t("aucune_declaration_ne_correspond_filtres") : t("aucune_declaration")}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder={t("rechercher")}
          storageKey="admin-tax-declarations"
          onRowClick={(r) => { if (r.status !== "submitted" && !r.submittedAt) openEdit(r); }}
          emptyMessage={hasActiveFilter ? t("aucune_declaration_ne_correspond_filtres") : t("aucune_declaration")}
        />
      )}


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


      <ConfirmDialog
        open={!!deleteDecl}
        onOpenChange={(o) => { if (!o) setDeleteDecl(null); }}
        title={t("supprimer_declaration_2")}
        description={`La déclaration "${deleteDecl?.periodLabel}" sera supprimée définitivement.`}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />


      <ConfirmDialog
        open={!!submitDecl}
        onOpenChange={(o) => { if (!o) setSubmitDecl(null); }}
        variant="default"
        title={t("marquer_comme_soumise")}
        description={
          submitDecl
            ? `"${submitDecl.periodLabel}" sera verrouillée et ne pourra plus être modifiée ni supprimée. Total à remettre : ${formatCurrency(submitDecl.totalTaxes)}.`
            : ""
        }
        confirmLabel={submitting ? t("soumission") : t("confirmer_soumission")}
        onConfirm={handleSubmit}
        loading={submitting}
      />


      <ConfirmDialog
        open={!!recalcDecl}
        onOpenChange={(o) => { if (!o) setRecalcDecl(null); }}
        variant="default"
        title={t("recalculer_montants")}
        description={
          recalcDecl
            ? `Revenu HT, TPS et TVQ seront recalculés depuis les factures payées entre le ${shortDate(recalcDecl.periodStart)} et le ${shortDate(recalcDecl.periodEnd)}.`
            : ""
        }
        confirmLabel={recalculating ? t("recalcul") : t("recalculer")}
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
  const t = useTranslations("admin.tax_decl");
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-[#0F2D52]" />
          Aperçu trimestres {year}
        </h3>
        <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3 w-3" />
          {t("clic_trimestre_pre_remplir_nouvelle")}
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
              <p className="text-[9px] text-muted-foreground">{t("revenu_ht")}</p>
              {totalCollected > 0 && (
                <div className="mt-1.5 pt-1.5 border-t flex items-baseline justify-between text-[10px]">
                  <span className="text-muted-foreground">{t("net_remettre")}</span>
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
  const t = useTranslations("admin.tax_decl");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const isCreate = mode === "create";


  useEffect(() => {
    if (!open) {
      setPreview(null);
    }
  }, [open]);


  useEffect(() => {
    setPreview(null);
  }, [values.start, values.end]);

  const fetchPreview = async () => {
    if (!values.start || !values.end) {
      toast.error(t("renseigner_dates_debut_fin"));
      return;
    }
    if (new Date(values.end) < new Date(values.start)) {
      toast.error(t("date_fin_doit_etre_apres_2"));
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
        toast.error(d.error || t("erreur_previsualisation"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
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
        toast.success(isCreate ? t("declaration_creee") : t("declaration_mise_jour"));
        onOpenChange(false);
      } else {
        toast.error(result.error || t("erreur_survenue"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" aria-hidden />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <FileBarChart className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-white text-lg">
                {isCreate ? t("nouvelle_declaration_fiscale") : t("modifier_declaration")}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5 truncate">
                {isCreate
                  ? t("archive_montants_tps_tvq_collectes")
                  : (editDecl?.periodLabel || t("modification"))}
              </DialogDescription>
            </div>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">

          {isCreate && quarterPresets.length > 0 && (
            <FormSection title={t("preremplissage_rapide")} icon={<Calendar className="h-3.5 w-3.5" />}>
              <p className="text-[10px] text-muted-foreground -mt-1">{t("cliquer_trimestre_remplir_automatiquement_label")}</p>
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


          <FormSection title={t("periode")} icon={<Calendar className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("type_declaration")}</Label>
                {isCreate ? (
                  <Select value={values.type} onValueChange={values.setType}>
                    <SelectTrigger><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 px-3 rounded-md border bg-muted flex items-center text-sm text-muted-foreground">
                    {typeKey(values.type) ? t(typeKey(values.type)!) : values.type}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("libelle_periode")}</Label>
                <Input value={values.label} onChange={(e) => values.setLabel(e.target.value)} placeholder={t("ex_t1_2026")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("debut")}</Label>
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
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("fin")}</Label>
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
                {t("date_fin_doit_etre_apres")}
              </p>
            )}
          </FormSection>


          {isCreate && (
            <FormSection title={t("apercu_montants")} icon={<Calculator className="h-3.5 w-3.5" />}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {t("calcule_revenu_tps_tvq_collectes")}
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
                  {previewing ? t("calcul") : t("calculer")}
                </Button>
              </div>
              {preview && (
                <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("factures_payees")}</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("nombre")}</span><span className="tabular-nums">{preview.invoices.count}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("revenu_ht")}</span><span className="tabular-nums font-semibold text-emerald-600">{formatCurrency(preview.invoices.revenueHt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("tps_collectee")}</span><span className="tabular-nums text-blue-600">{formatCurrency(preview.invoices.tpsCollected)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq_collectee")}</span><span className="tabular-nums text-indigo-600">{formatCurrency(preview.invoices.tvqCollected)}</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("depenses")}</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("nombre")}</span><span className="tabular-nums">{preview.expenses.count}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("depenses_ht")}</span><span className="tabular-nums">{formatCurrency(preview.expenses.expensesHt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("tps_payee")}</span><span className="tabular-nums text-blue-600">{formatCurrency(preview.expenses.tpsPaid)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq_payee")}</span><span className="tabular-nums text-indigo-600">{formatCurrency(preview.expenses.tvqPaid)}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-md p-2.5 text-center border-t pt-2",
                    preview.netToRemit.total >= 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200",
                  )}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {preview.netToRemit.total >= 0 ? t("net_remettre") : t("remboursement_attendu")}
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
                <p className="text-[11px] text-muted-foreground italic">{t("cliquer_calculer_voir_apos_apercu")}</p>
              )}
            </FormSection>
          )}


          {!isCreate && editDecl && (
            <FormSection title={t("montants_archives")} icon={<Calculator className="h-3.5 w-3.5" />}>
              <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("revenu_ht")}</span><span className="tabular-nums font-semibold text-emerald-600">{formatCurrency(editDecl.totalRevenueHt)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tps_collectee")}</span><span className="tabular-nums text-blue-600">{formatCurrency(editDecl.totalTps)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq_collectee")}</span><span className="tabular-nums text-indigo-600">{formatCurrency(editDecl.totalTvq)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold text-[#0F2D52]"><span>{t("total_taxes_collectees")}</span><span className="tabular-nums">{formatCurrency(editDecl.totalTaxes)}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("tax_view_ces_montants_ont_ete_calcules_au_moment")}<strong>{t("recalculer")}</strong>{t("tax_view_dans_la_liste_si_des_factures_ont")}</p>
            </FormSection>
          )}


          {!isCreate && (
            <FormSection title={tc("status")} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("statut_actuel")}</Label>
                <Select value={values.status} onValueChange={values.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("brouillon")}</SelectItem>
                    <SelectItem value="submitted">{t("soumise_verrouille_declaration")}</SelectItem>
                    <SelectItem value="confirmed">{t("confirmee_apos_arc_revenu_quebec")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t.rich("une_fois_marquee_soumise", { b: (c) => <strong>{c}</strong> })}
                </p>
              </div>
            </FormSection>
          )}


          <FormSection title={t("notes_internes")} icon={<Tag className="h-3.5 w-3.5" />}>
            <Textarea
              value={values.notes}
              onChange={(e) => values.setNotes(e.target.value)}
              rows={3}
              placeholder={t("n_soumission_arc_accuse_reception")}
            />
          </FormSection>


          {isCreate && (
            <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{t("comment_ca_fonctionne")}</p>
                <p>{t("tax_view_a_la_creation_le_systeme_calcule_automatiquement")}<strong>{t("payees")}</strong> {t("entre_dates_debut_fin_inclusif")} <strong>{t("net_remettre_2")}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>


        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={handleSubmitClick}
            disabled={pending || !canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {pending ? t("enregistrement") : (isCreate ? t("creer_declaration") : t("enregistrer"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
