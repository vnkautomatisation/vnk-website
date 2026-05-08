"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  Plus,
  Search,
  DollarSign,
  Receipt,
  TrendingUp,
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
import { StatCard } from "@/components/admin/stat-card";
import { CreateModal } from "@/components/admin/create-modal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  { value: "annuelle_impots", label: "Annuelle impots" },
];

export function TaxView({
  declarations,
  kpis,
}: {
  declarations: TaxDeclaration[];
  kpis: { revenueHt: number; tpsCollected: number; tvqCollected: number; totalTaxes: number };
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newType, setNewType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const resetForm = () => {
    setNewType("");
    setNewLabel("");
    setNewStart("");
    setNewEnd("");
    setNewNotes("");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newType || !newLabel.trim() || !newStart || !newEnd) {
      return { success: false, error: "Type, periode, debut et fin requis" };
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
      return { success: false, error: "Erreur reseau" };
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return declarations;
    const q = searchQuery.toLowerCase();
    return declarations.filter(
      (d) =>
        d.periodLabel.toLowerCase().includes(q) ||
        d.periodType.toLowerCase().includes(q)
    );
  }, [declarations, searchQuery]);

  const columns: Column<TaxDeclaration>[] = [
    { key: "period", header: "Periode", accessor: (r) => r.periodLabel, sortable: true, sortBy: (r) => r.periodLabel },
    {
      key: "type",
      header: "Type",
      accessor: (r) => <span className="text-xs capitalize">{r.periodType.replace(/_/g, " ")}</span>,
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
      accessor: (r) => r.submittedAt ? formatDate(new Date(r.submittedAt)) : "\u2014",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileBarChart className="h-6 w-6" />
            Declarations fiscales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Suivi des declarations TPS/TVQ et impots</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouvelle declaration
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Revenu brut HT" value={formatCurrency(kpis.revenueHt)} icon={TrendingUp} accent="bg-emerald-500" />
        <StatCard label="TPS collectee" value={formatCurrency(kpis.tpsCollected)} icon={Receipt} accent="bg-blue-500" />
        <StatCard label="TVQ collectee" value={formatCurrency(kpis.tvqCollected)} icon={DollarSign} accent="bg-indigo-500" />
        <StatCard label="Total taxes" value={formatCurrency(kpis.totalTaxes)} icon={FileBarChart} accent="bg-amber-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Periode, type..." className="pl-9" />
        </div>
      </div>

      <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="declarations-fiscales" storageKey="admin-tax-declarations" />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouvelle declaration" icon={FileBarChart} accent="bg-amber-500" submitLabel="Creer la declaration" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-label">Periode *</Label>
            <Input id="t-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ex: T1 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-start">Debut *</Label>
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
