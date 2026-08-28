"use client";
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  X,
  Paperclip,
  Eye,
  Calculator,
  TrendingUp,
  Receipt,
  FileText,
  Building2,
  Tag,
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
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { cn, formatDate } from "@/lib/utils";


type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  tpsPaid: number;
  tvqPaid: number;
  vendor: string | null;
  receiptUrl: string | null;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
};

type Kpis = {
  total: number;
  tps: number;
  tvq: number;
  ytdTotal: number;
  ytdTps: number;
  ytdTvq: number;
  quarterTotal: number;
  quarterTps: number;
  quarterTvq: number;
  byCategory: { category: string; total: number; count: number }[];
  topVendors: { vendor: string; total: number; count: number }[];
};

const EXPENSE_CATEGORIES = [
  { value: "logiciels_licences", labelKey: "logiciels_licences" },
  { value: "materiel_informatique", labelKey: "materiel_informatique" },
  { value: "telecommunications", labelKey: "telecommunications" },
  { value: "formation", labelKey: "formation" },
  { value: "marketing", labelKey: "marketing" },
  { value: "transport", labelKey: "transport" },
  { value: "fournitures", labelKey: "fournitures" },
  { value: "services_comptables", labelKey: "services_comptables" },
  { value: "assurance", labelKey: "assurance" },
  { value: "autre", labelKey: "autre" },
];

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;
const TODAY = () => new Date().toISOString().slice(0, 10);

type ReceiptAction = "create" | "keep" | "replace" | "remove";

function categoryKey(v: string): string | null {
  return EXPENSE_CATEGORIES.find((c) => c.value === v)?.labelKey ?? null;
}

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Lit un fichier en data URL (max validé côté backend)
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// Période presets
function getPresetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 30);
      return { from: toIso(f), to: toIso(now) };
    }
    case "thisMonth": {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIso(f), to: toIso(now) };
    }
    case "lastMonth": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIso(f), to: toIso(t) };
    }
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      const f = new Date(now.getFullYear(), q * 3, 1);
      return { from: toIso(f), to: toIso(now) };
    }
    case "thisYear": {
      const f = new Date(now.getFullYear(), 0, 1);
      return { from: toIso(f), to: toIso(now) };
    }
    case "lastYear": {
      const f = new Date(now.getFullYear() - 1, 0, 1);
      const t = new Date(now.getFullYear() - 1, 11, 31);
      return { from: toIso(f), to: toIso(t) };
    }
    default:
      return null;
  }
}

export function ExpensesView({
  expenses,
  kpis,
}: {
  expenses: Expense[];
  kpis: Kpis;
}) {
  const t = useTranslations("admin.expenses");
  const tc = useTranslations("common");
  const router = useRouter();
  const formatCurrency = useCurrency();
  const [view, setView] = useViewMode("expenses", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);


  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);


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


  const [newDate, setNewDate] = useState(TODAY());
  const [newCategory, setNewCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newTps, setNewTps] = useState("");
  const [newTvq, setNewTvq] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newReceiptData, setNewReceiptData] = useState<string | null>(null);
  const [newReceiptName, setNewReceiptName] = useState("");


  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTps, setEditTps] = useState("");
  const [editTvq, setEditTvq] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReceiptAction, setEditReceiptAction] = useState<ReceiptAction>("keep");
  const [editReceiptData, setEditReceiptData] = useState<string | null>(null);
  const [editReceiptName, setEditReceiptName] = useState("");

  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

  const resetForm = () => {
    setNewDate(TODAY());
    setNewCategory("");
    setNewTitle("");
    setNewVendor("");
    setNewAmount("");
    setNewTps("");
    setNewTvq("");
    setNewNotes("");
    setNewReceiptData(null);
    setNewReceiptName("");
  };


  const autoCalcCreate = () => {
    const a = Number(newAmount);
    if (!Number.isFinite(a) || a <= 0) return;
    setNewTps((a * TPS_RATE).toFixed(2));
    setNewTvq((a * TVQ_RATE).toFixed(2));
  };

  const autoCalcEdit = () => {
    const a = Number(editAmount);
    if (!Number.isFinite(a) || a <= 0) return;
    setEditTps((a * TPS_RATE).toFixed(2));
    setEditTvq((a * TVQ_RATE).toFixed(2));
  };

  const openEdit = (e: Expense) => {
    setEditExpense(e);
    setEditDate(e.expenseDate.slice(0, 10));
    setEditCategory(e.category);
    setEditTitle(e.title);
    setEditVendor(e.vendor ?? "");
    setEditAmount(String(e.amount));
    setEditTps(String(e.tpsPaid));
    setEditTvq(String(e.tvqPaid));
    setEditNotes(e.notes ?? "");
    setEditReceiptAction("keep");
    setEditReceiptData(null);
    setEditReceiptName("");
  };

  const handleNewReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setNewReceiptData(dataUrl);
      setNewReceiptName(file.name);
    } catch {
      toast.error(t("impossible_lire_fichier"));
    }
  };

  const handleEditReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditReceiptData(dataUrl);
      setEditReceiptName(file.name);
      setEditReceiptAction("replace");
    } catch {
      toast.error(t("impossible_lire_fichier"));
    }
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editExpense || !editTitle.trim() || !editAmount) return { success: false, error: t("description_montant_requis") };
    try {
      const payload: Record<string, unknown> = {
        expenseDate: editDate || undefined,
        category: editCategory,
        title: editTitle.trim(),
        vendor: editVendor.trim() || undefined,
        amount: Number(editAmount),
        tpsPaid: editTps ? Number(editTps) : 0,
        tvqPaid: editTvq ? Number(editTvq) : 0,
        notes: editNotes.trim() || undefined,
      };
      if (editReceiptAction === "replace" && editReceiptData) payload.receiptData = editReceiptData;
      else if (editReceiptAction === "remove") payload.receiptData = null;

      const res = await fetch(`/api/expenses/${editExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || t("erreur") };
    } catch { return { success: false, error: t("erreur_reseau") }; }
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;
    const res = await fetch(`/api/expenses/${deleteExpense.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("depense_supprimee")); setDeleteExpense(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newDate || !newCategory || !newTitle.trim() || !newAmount) {
      return { success: false, error: t("date_categorie_description_montant_requis") };
    }
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: newDate,
          category: newCategory,
          title: newTitle.trim(),
          vendor: newVendor.trim() || undefined,
          amount: Number(newAmount),
          tpsPaid: newTps ? Number(newTps) : 0,
          tvqPaid: newTvq ? Number(newTvq) : 0,
          notes: newNotes.trim() || undefined,
          receiptData: newReceiptData ?? undefined,
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

  const applyPreset = (preset: string) => {
    const r = getPresetRange(preset);
    if (!r) return;
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const activePreset = useMemo(() => {
    if (!dateFrom && !dateTo) return "all";
    for (const k of ["30d", "thisMonth", "lastMonth", "thisQuarter", "thisYear", "lastYear"]) {
      const r = getPresetRange(k);
      if (r && r.from === dateFrom && r.to === dateTo) return k;
    }
    return "custom";
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (categoryFilter !== "all") result = result.filter((e) => e.category === categoryFilter);
    if (dateFrom) result = result.filter((e) => new Date(e.expenseDate) >= new Date(dateFrom));
    if (dateTo) {
      const t = new Date(dateTo); t.setDate(t.getDate() + 1);
      result = result.filter((e) => new Date(e.expenseDate) <= t);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (categoryKey(e.category) ? t(categoryKey(e.category)!) : e.category.replace(/_/g, " ")).toLowerCase().includes(q) ||
          (e.vendor ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, searchQuery, categoryFilter, dateFrom, dateTo]);


  const exportCsv = () => {
    const headers = [
      t("date"),
      t("categorie"),
      t("description"),
      t("fournisseur"),
      t("montant_ht"),
      t("tps_payee"),
      t("tvq_payee"),
      t("total_ttc"),
      t("recu_joint"),
      t("notes"),
    ];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach((e) => {
      lines.push([
        e.expenseDate.slice(0, 10),
        (categoryKey(e.category) ? t(categoryKey(e.category)!) : e.category.replace(/_/g, " ")),
        e.title,
        e.vendor ?? "",
        e.amount.toFixed(2),
        e.tpsPaid.toFixed(2),
        e.tvqPaid.toFixed(2),
        (e.amount + e.tpsPaid + e.tvqPaid).toFixed(2),
        e.receiptUrl ? t("oui") : t("non"),
        e.notes ?? "",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `depenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const filteredTps = filtered.reduce((s, e) => s + e.tpsPaid, 0);
  const filteredTvq = filtered.reduce((s, e) => s + e.tvqPaid, 0);
  const filteredWithReceipt = filtered.filter((e) => e.receiptUrl).length;
  const hasActiveFilter = !!(searchQuery || categoryFilter !== "all" || dateFrom || dateTo);



  const exportPdf = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    const url = `/api/expenses/export/pdf${params.toString() ? `?${params.toString()}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.click();
  };


  const getActions = useCallback((e: Expense) => [
    ...(e.receiptUrl ? [{ label: t("voir_recu"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => setPreviewExpense(e) }] : []),
    { label: t("modifier"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(e) },
    { label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteExpense(e), separator: true, variant: "destructive" as const },
  ], []);

  const columns: Column<Expense>[] = [
    {
      key: "date",
      header: t("date"),
      accessor: (r) => formatDate(new Date(r.expenseDate)),
      sortable: true,
      sortBy: (r) => r.expenseDate,
    },
    { key: "title", header: t("description"), accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    {
      key: "category",
      header: t("categorie"),
      accessor: (r) => <span className="text-xs">{(categoryKey(r.category) ? t(categoryKey(r.category)!) : r.category.replace(/_/g, " "))}</span>,
      sortable: true,
      sortBy: (r) => r.category,
      hiddenOnMobile: true,
    },
    {
      key: "vendor",
      header: t("fournisseur"),
      accessor: (r) => r.vendor ?? <span className="text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "amount",
      header: t("montant_ht"),
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "tps",
      header: t("tps"),
      accessor: (r) => <span className="text-xs">{formatCurrency(r.tpsPaid)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "tvq",
      header: t("tvq"),
      accessor: (r) => <span className="text-xs">{formatCurrency(r.tvqPaid)}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "receipt",
      header: t("recu"),
      accessor: (r) => r.receiptUrl ? (
        <ActionTooltip label={t("voir_recu_joint")}>
          <button
            onClick={(ev) => { ev.stopPropagation(); setPreviewExpense(r); }}
            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-emerald-600"
            aria-label={t("voir_recu")}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
        </ActionTooltip>
      ) : (
        <ActionTooltip label={t("aucun_recu_joint")}>
          <span className="text-muted-foreground/60 text-xs italic cursor-help">—</span>
        </ActionTooltip>
      ),
    },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
          <ActionTooltip label={t("modifier_depense")}>
            <button
              onClick={() => openEdit(r)}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label={tc("edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          <ActionTooltip label={t("supprimer_depense")}>
            <button
              onClick={() => setDeleteExpense(r)}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-red-600"
              aria-label={tc("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        </div>
      ),
    },
  ];


  if (expenses.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t("depenses_professionnelles")}
              </h1>
              <p className="text-white/70 text-xs mt-0.5">{t("suivi_depenses_taxes_reclamables")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-10 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-base">{t("aucune_depense_enregistree")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {t("ajoutez_premieres_depenses_logiciels_materiel")}
          </p>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="mt-4">
            <Plus className="h-4 w-4 mr-1.5" />
            {t("creer_ma_premiere_depense")}
          </Button>
        </div>
        <ExpenseFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          editExpense={null}
          values={{
            date: newDate, setDate: setNewDate,
            category: newCategory, setCategory: setNewCategory,
            title: newTitle, setTitle: setNewTitle,
            vendor: newVendor, setVendor: setNewVendor,
            amount: newAmount, setAmount: setNewAmount,
            tps: newTps, setTps: setNewTps,
            tvq: newTvq, setTvq: setNewTvq,
            notes: newNotes, setNotes: setNewNotes,
          }}
          autoCalc={autoCalcCreate}
          receiptAction="create"
          setReceiptAction={() => { /* not used in create */ }}
          receiptData={newReceiptData}
          setReceiptData={setNewReceiptData}
          receiptName={newReceiptName}
          setReceiptName={setNewReceiptName}
          onReceiptFile={handleNewReceipt}
          onPreviewReceipt={() => { /* no preview during create */ }}
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
              <Wallet className="h-5 w-5" />
              {t("depenses_professionnelles")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {t("suivi_depenses_n_enregistrees", { count: expenses.length })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTooltip label={t("exporter_pdf_kpi_tableau_formate")}>
              <Button onClick={exportPdf} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_pdf")}
              </Button>
            </ActionTooltip>
            <ActionTooltip label={t("exporter_csv_excel_comptable_filtres")}>
              <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_csv")}
              </Button>
            </ActionTooltip>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("nouvelle_depense")}
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("annee_courante")}</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.ytdTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{t("total_ytd_ht")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("trimestre_courant")}</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.quarterTotal)}</p>
          <p className="text-[10px] text-muted-foreground">TPS {formatCurrency(kpis.quarterTps)} · TVQ {formatCurrency(kpis.quarterTvq)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("tps_reclamable_ytd")}</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(kpis.ytdTps)}</p>
          <p className="text-[10px] text-muted-foreground">{t("deduire_declaration")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("tvq_reclamable_ytd")}</p>
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{formatCurrency(kpis.ytdTvq)}</p>
          <p className="text-[10px] text-muted-foreground">{t("deduire_declaration")}</p>
        </div>
      </div>


      {(kpis.byCategory.length > 0 || kpis.topVendors.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kpis.byCategory.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  {t("repartition_categorie")}
                </h3>
                <span className="text-[10px] text-muted-foreground">Total : {formatCurrency(kpis.total)}</span>
              </div>
              <div className="space-y-1.5">
                {kpis.byCategory.slice(0, 6).map((c) => {
                  const pct = kpis.total > 0 ? (c.total / kpis.total) * 100 : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <button onClick={() => setCategoryFilter(c.category)} className="truncate hover:text-[#0F2D52] hover:underline text-left">{(categoryKey(c.category) ? t(categoryKey(c.category)!) : c.category.replace(/_/g, " "))}</button>
                        <span className="tabular-nums font-medium">{formatCurrency(c.total)} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-[#0F2D52]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {kpis.topVendors.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                {t("top_fournisseurs")}
              </h3>
              <div className="space-y-2">
                {kpis.topVendors.map((v) => (
                  <div key={v.vendor} className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => setSearchQuery(v.vendor)}
                      className="truncate hover:text-[#0F2D52] hover:underline text-left"
                    >
                      {v.vendor}
                    </button>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-semibold tabular-nums">{formatCurrency(v.total)}</span>
                      <span className="text-muted-foreground ml-1.5">({v.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Wallet className="h-4 w-4" />
              {t("depenses")}
            </span>
            <span className="font-semibold">{tc("shown_f", { count: filtered.length })}</span>
            <span className="text-muted-foreground">{t("total")} <span className="font-semibold">{formatCurrency(filteredTotal)}</span></span>
            <span className="text-muted-foreground">TPS <span className="font-semibold text-blue-600">{formatCurrency(filteredTps)}</span></span>
            <span className="text-muted-foreground">TVQ <span className="font-semibold text-indigo-600">{formatCurrency(filteredTvq)}</span></span>
            <span className="ml-auto text-muted-foreground">{t("avec_recu_ratio", { count: filteredWithReceipt, total: filtered.length })}</span>
          </div>
        </div>
      )}


      <div>

        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="text-[10px] text-muted-foreground mr-1">{t("periode")}</span>
          {[
            { k: "all", l: t("toutes") },
            { k: "30d", l: t("30_jours") },
            { k: "thisMonth", l: t("mois") },
            { k: "lastMonth", l: t("mois_dernier") },
            { k: "thisQuarter", l: t("trimestre") },
            { k: "thisYear", l: t("annee") },
            { k: "lastYear", l: t("annee_derniere") },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => {
                if (p.k === "all") { setDateFrom(""); setDateTo(""); }
                else applyPreset(p.k);
              }}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium border transition-colors",
                activePreset === p.k
                  ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                  : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
              )}
            >
              {p.l}
            </button>
          ))}
          {activePreset === "custom" && (
            <span className="px-2 py-1 rounded text-[10px] font-medium border bg-amber-50 text-amber-800 border-amber-200">
              {t("personnalisee")}
            </span>
          )}
        </div>


        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">{t("recherche")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("description_categorie_fournisseur")}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">{t("categorie")}</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toutes")}</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("du")}</Label>
            <Input type="date" max={TODAY()} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">{t("au")}</Label>
            <Input type="date" max={TODAY()} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
          {hasActiveFilter && (
            <Button onClick={() => { setDateFrom(""); setDateTo(""); setCategoryFilter("all"); setSearchQuery(""); }} size="sm" variant="ghost" className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              {t("effacer")}
            </Button>
          )}
          <ViewToggle storageKey="expenses" defaultView="list" onChange={setView} />
        </div>
      </div>


      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => (
            <EntityCard
              key={e.id}
              title={e.title}
              subtitle={e.vendor ?? t("aucun_fournisseur")}
              icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: (categoryKey(e.category) ? t(categoryKey(e.category)!) : e.category.replace(/_/g, " ")), variant: "outline" },
                ...(e.receiptUrl ? [{ label: t("recu"), variant: "secondary" as const }] : []),
              ]}
              stats={[
                { label: t("montant_ht"), value: formatCurrency(e.amount) },
                { label: t("ttc"), value: formatCurrency(e.amount + e.tpsPaid + e.tvqPaid) },
              ]}
              actions={getActions(e)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatDate(new Date(e.expenseDate))}</span>
                  <span>TPS {formatCurrency(e.tpsPaid)} · TVQ {formatCurrency(e.tvqPaid)}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("aucune_depense_ne_correspond_filtres")}</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder={t("rechercher")}
          storageKey="admin-expenses"
          onRowClick={(r) => openEdit(r)}
          emptyMessage={
            hasActiveFilter
              ? t("aucune_depense_ne_correspond_filtres")
              : t("aucune_depense_enregistree")
          }
        />
      )}


      <ExpenseFormDialog
        mode="edit"
        open={!!editExpense}
        onOpenChange={(o) => { if (!o) setEditExpense(null); }}
        editExpense={editExpense}
        values={{
          date: editDate, setDate: setEditDate,
          category: editCategory, setCategory: setEditCategory,
          title: editTitle, setTitle: setEditTitle,
          vendor: editVendor, setVendor: setEditVendor,
          amount: editAmount, setAmount: setEditAmount,
          tps: editTps, setTps: setEditTps,
          tvq: editTvq, setTvq: setEditTvq,
          notes: editNotes, setNotes: setEditNotes,
        }}
        autoCalc={autoCalcEdit}
        receiptAction={editReceiptAction}
        setReceiptAction={setEditReceiptAction}
        receiptData={editReceiptData}
        setReceiptData={setEditReceiptData}
        receiptName={editReceiptName}
        setReceiptName={setEditReceiptName}
        onReceiptFile={handleEditReceipt}
        onPreviewReceipt={() => editExpense && setPreviewExpense(editExpense)}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteExpense}
        onOpenChange={(o) => { if (!o) setDeleteExpense(null); }}
        title={t("supprimer_depense_2")}
        description={t("expenses_view_la_depense_p0_sera_supprimee_definitivement", { p0: (deleteExpense?.title ?? "") })}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />


      <ExpenseFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        editExpense={null}
        values={{
          date: newDate, setDate: setNewDate,
          category: newCategory, setCategory: setNewCategory,
          title: newTitle, setTitle: setNewTitle,
          vendor: newVendor, setVendor: setNewVendor,
          amount: newAmount, setAmount: setNewAmount,
          tps: newTps, setTps: setNewTps,
          tvq: newTvq, setTvq: setNewTvq,
          notes: newNotes, setNotes: setNewNotes,
        }}
        autoCalc={autoCalcCreate}
        receiptAction="create"
        setReceiptAction={() => { /* not used in create mode */ }}
        receiptData={newReceiptData}
        setReceiptData={setNewReceiptData}
        receiptName={newReceiptName}
        setReceiptName={setNewReceiptName}
        onReceiptFile={handleNewReceipt}
        onPreviewReceipt={() => { /* no preview during create */ }}
        onSubmit={handleCreate}
      />


      {previewExpense?.receiptUrl && (
        <PdfViewerModal
          open={!!previewExpense}
          onClose={() => setPreviewExpense(null)}
          pdfUrl={previewExpense.receiptUrl}
          title={t("expenses_view_recu_p0", { p0: previewExpense.title })}
          date={formatDate(new Date(previewExpense.expenseDate))}
          downloadName={`recu-${previewExpense.id}`}
        />
      )}
    </div>
  );
}

// ─── Dialog VNK pour Create + Edit dépense ─────────────────────────────
// Pattern aligné avec invoices : gradient navy header + FormSection cards + footer custom.

function ExpenseFormDialog({
  mode,
  open,
  onOpenChange,
  editExpense,
  values,
  autoCalc,
  receiptAction,
  setReceiptAction,
  receiptData,
  setReceiptData,
  receiptName,
  setReceiptName,
  onReceiptFile,
  onPreviewReceipt,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editExpense: Expense | null;
  values: {
    date: string; setDate: (v: string) => void;
    category: string; setCategory: (v: string) => void;
    title: string; setTitle: (v: string) => void;
    vendor: string; setVendor: (v: string) => void;
    amount: string; setAmount: (v: string) => void;
    tps: string; setTps: (v: string) => void;
    tvq: string; setTvq: (v: string) => void;
    notes: string; setNotes: (v: string) => void;
  };
  autoCalc: () => void;
  receiptAction: ReceiptAction;
  setReceiptAction: (a: ReceiptAction) => void;
  receiptData: string | null;
  setReceiptData: (v: string | null) => void;
  receiptName: string;
  setReceiptName: (v: string) => void;
  onReceiptFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onPreviewReceipt: () => void;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
}) {
  const t = useTranslations("admin.expenses");
  const tc = useTranslations("common");
  const formatCurrency = useCurrency();
  const [pending, startTransition] = useTransition();
  const isCreate = mode === "create";

  const amountNum = Number(values.amount) || 0;
  const tpsNum = Number(values.tps) || 0;
  const tvqNum = Number(values.tvq) || 0;
  const ttc = amountNum + tpsNum + tvqNum;

  const canSubmit = !!values.title.trim() && !!values.amount && !!values.date && !!values.category;

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await onSubmit();
      if (result.success) {
        toast.success(isCreate ? t("depense_creee") : t("depense_mise_jour"));
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
              {isCreate ? <Wallet className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-white text-lg">
                {isCreate ? t("nouvelle_depense") : t("modifier_depense")}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5 truncate">
                {isCreate
                  ? t("enregistrer_depense_professionnelle_taxes_payees")
                  : (editExpense?.title || t("modification"))}
              </DialogDescription>
            </div>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">

          <FormSection title={t("details")} icon={<FileText className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("date")}</Label>
                <Input type="date" max={TODAY()} value={values.date} onChange={(e) => values.setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("categorie_2")}</Label>
                <Select value={values.category} onValueChange={values.setCategory}>
                  <SelectTrigger><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("description")}</Label>
              <Input value={values.title} onChange={(e) => values.setTitle(e.target.value)} placeholder={t("ex_abonnement_railway_mai")} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> Fournisseur
              </Label>
              <Input value={values.vendor} onChange={(e) => values.setVendor(e.target.value)} placeholder={t("ex_stripe_railway_bell_canadian")} />
            </div>
          </FormSection>


          <FormSection title={t("montant_taxes")} icon={<Calculator className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("montant_ht_cad")}</Label>
                <ActionTooltip label={t("calculer_automatiquement_tps_5_tvq")}>
                  <button type="button" onClick={autoCalc} disabled={!values.amount} className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0F2D52] hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
                    <Calculator className="h-3 w-3" />
                    {t("calculer_taxes")}
                  </button>
                </ActionTooltip>
              </div>
              <Input type="number" step="0.01" min="0" value={values.amount} onChange={(e) => values.setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tps_payee")}</Label>
                <Input type="number" step="0.01" min="0" value={values.tps} onChange={(e) => values.setTps(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tvq_payee")}</Label>
                <Input type="number" step="0.01" min="0" value={values.tvq} onChange={(e) => values.setTvq(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {amountNum > 0 && (
              <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sous_total_ht")}</span><span className="tabular-nums">{formatCurrency(amountNum)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tps_payee")}</span><span className="tabular-nums text-blue-600">{formatCurrency(tpsNum)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq_payee")}</span><span className="tabular-nums text-indigo-600">{formatCurrency(tvqNum)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold text-[#0F2D52]"><span>{t("total_ttc")}</span><span className="tabular-nums">{formatCurrency(ttc)}</span></div>
              </div>
            )}
          </FormSection>


          <FormSection title={t("recu_justificatif")} icon={<Receipt className="h-3.5 w-3.5" />}>
            {isCreate ? (
              receiptData ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 truncate max-w-[260px]">
                    <Paperclip className="h-3.5 w-3.5" />
                    {receiptName || t("recu_joint")}
                  </span>
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => { setReceiptData(null); setReceiptName(""); }}>
                    <X className="h-3 w-3 mr-1" />
                    {t("retirer")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="ef-receipt-new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border bg-background hover:bg-muted cursor-pointer w-fit">
                    <Paperclip className="h-3.5 w-3.5" />
                    {t("joindre_recu_pdf_image")}
                    <input id="ef-receipt-new" type="file" accept="application/pdf,image/*" className="hidden" onChange={onReceiptFile} />
                  </Label>
                  <p className="text-[10px] text-muted-foreground">{t("optionnel_recommande_justification_arc_cas")}</p>
                </div>
              )
            ) : (

              <>
                {receiptAction === "keep" && editExpense?.receiptUrl ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      {t("recu_joint")}
                    </span>
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={onPreviewReceipt}>
                      <Eye className="h-3 w-3 mr-1" />
                      {tc("view")}
                    </Button>
                    <Label htmlFor="ef-receipt-replace" className="cursor-pointer">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border bg-background hover:bg-muted">
                        <Pencil className="h-3 w-3" />
                        {t("remplacer")}
                      </span>
                      <input id="ef-receipt-replace" type="file" accept="application/pdf,image/*" className="hidden" onChange={onReceiptFile} />
                    </Label>
                    <Button type="button" size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => setReceiptAction("remove")}>
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t("retirer")}
                    </Button>
                  </div>
                ) : receiptAction === "replace" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 truncate max-w-[260px]">
                      <Paperclip className="h-3.5 w-3.5" />
                      {receiptName || t("nouveau_recu_pret")}
                    </span>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setReceiptAction("keep"); setReceiptData(null); setReceiptName(""); }}>
                      {t("annuler_remplacement")}
                    </Button>
                  </div>
                ) : receiptAction === "remove" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("recu_sera_retire_apos_enregistrement")}
                    </span>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setReceiptAction("keep")}>
                      {tc("cancel")}
                    </Button>
                  </div>
                ) : (

                  <div className="space-y-2">
                    <Label htmlFor="ef-receipt-add" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border bg-background hover:bg-muted cursor-pointer w-fit">
                      <Paperclip className="h-3.5 w-3.5" />
                      {t("joindre_recu_pdf_image")}
                      <input id="ef-receipt-add" type="file" accept="application/pdf,image/*" className="hidden" onChange={onReceiptFile} />
                    </Label>
                    <p className="text-[10px] text-muted-foreground">{t("aucun_recu_joint_depense")}</p>
                  </div>
                )}
              </>
            )}
          </FormSection>


          <FormSection title={t("notes_internes")} icon={<Tag className="h-3.5 w-3.5" />}>
            <Textarea value={values.notes} onChange={(e) => values.setNotes(e.target.value)} rows={3} placeholder={t("commentaire_n_reference_fournisseur_contexte")} />
          </FormSection>
        </div>


        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || !canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {pending ? t("enregistrement") : (isCreate ? t("creer_depense") : t("enregistrer"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
