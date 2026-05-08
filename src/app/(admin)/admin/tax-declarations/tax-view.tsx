"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileBarChart,
  Plus,
  Search,
  DollarSign,
  Receipt,
  TrendingUp,
  Eye,
  Pencil,
  Trash2,
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
import { EditModal } from "@/components/admin/edit-modal";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [view, setView] = useViewMode("tax-declarations", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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
    if (!editDecl || !editLabel.trim()) return { success: false, error: "Periode requise" };
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
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteDecl) return;
    const res = await fetch(`/api/tax-declarations/${deleteDecl.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Declaration supprimee"); setDeleteDecl(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
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

  // Actions menu pour EntityCard
  const getActions = useCallback((d: TaxDeclaration) => {
    const editable = d.status !== "submitted" && !d.submittedAt;
    return [
      { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDecl(d), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);

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
      accessor: (r) => r.submittedAt ? formatDate(new Date(r.submittedAt)) : "—",
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
        <ViewToggle storageKey="tax-declarations" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.periodLabel}
              subtitle={TYPE_OPTIONS.find((t) => t.value === d.periodType)?.label ?? d.periodType.replace(/_/g, " ")}
              icon={<FileBarChart className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: d.status === "draft" ? "Brouillon" : d.status === "submitted" ? "Soumise" : d.status === "confirmed" ? "Confirmee" : d.status, variant: d.status === "confirmed" ? "secondary" : "outline" },
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
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune declaration trouvee</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="declarations-fiscales" storageKey="admin-tax-declarations" />
      )}

      <EditModal open={!!editDecl} onOpenChange={(o) => { if (!o) setEditDecl(null); }} title="Modifier la declaration" description={editDecl?.periodLabel} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Periode *</Label><Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} /></div>
          <div className="space-y-2"><Label>Statut</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="submitted">Soumise</SelectItem>
                <SelectItem value="confirmed">Confirmee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteDecl}
        onOpenChange={(o) => { if (!o) setDeleteDecl(null); }}
        title="Supprimer cette declaration ?"
        description={`La declaration "${deleteDecl?.periodLabel}" sera supprimee definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

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
