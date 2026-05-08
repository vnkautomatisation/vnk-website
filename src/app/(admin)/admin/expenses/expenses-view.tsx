"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Plus,
  Search,
  DollarSign,
  Receipt,
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
import { formatCurrency, formatDate } from "@/lib/utils";

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  tpsPaid: number;
  tvqPaid: number;
  vendor: string | null;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
};

const EXPENSE_CATEGORIES = [
  { value: "logiciels_licences", label: "Logiciels / Licences" },
  { value: "materiel_informatique", label: "Materiel informatique" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "formation", label: "Formation" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
  { value: "fournitures", label: "Fournitures" },
  { value: "services_comptables", label: "Services comptables" },
  { value: "assurance", label: "Assurance" },
  { value: "autre", label: "Autre" },
];

export function ExpensesView({
  expenses,
  kpis,
}: {
  expenses: Expense[];
  kpis: { total: number; tps: number; tvq: number };
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newDate, setNewDate] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newTps, setNewTps] = useState("");
  const [newTvq, setNewTvq] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const resetForm = () => {
    setNewDate("");
    setNewCategory("");
    setNewTitle("");
    setNewVendor("");
    setNewAmount("");
    setNewTps("");
    setNewTvq("");
    setNewNotes("");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newDate || !newCategory || !newTitle.trim() || !newAmount) {
      return { success: false, error: "Date, categorie, description et montant requis" };
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
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.vendor ?? "").toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  const columns: Column<Expense>[] = [
    {
      key: "date",
      header: "Date",
      accessor: (r) => formatDate(new Date(r.expenseDate)),
      sortable: true,
      sortBy: (r) => r.expenseDate,
    },
    { key: "title", header: "Description", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    {
      key: "category",
      header: "Categorie",
      accessor: (r) => <span className="text-xs capitalize">{r.category.replace(/_/g, " ")}</span>,
      sortable: true,
      sortBy: (r) => r.category,
      hiddenOnMobile: true,
    },
    {
      key: "vendor",
      header: "Fournisseur",
      accessor: (r) => r.vendor ?? "\u2014",
      hiddenOnMobile: true,
    },
    {
      key: "amount",
      header: "Montant HT",
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "tps",
      header: "TPS",
      accessor: (r) => formatCurrency(r.tpsPaid),
      hiddenOnMobile: true,
    },
    {
      key: "tvq",
      header: "TVQ",
      accessor: (r) => formatCurrency(r.tvqPaid),
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wallet className="h-6 w-6" />
            Depenses professionnelles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Suivi des depenses et taxes reclamables</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouvelle depense
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Total depenses" value={formatCurrency(kpis.total)} icon={Wallet} accent="bg-red-500" />
        <StatCard label="TPS reclamable" value={formatCurrency(kpis.tps)} icon={Receipt} accent="bg-blue-500" />
        <StatCard label="TVQ reclamable" value={formatCurrency(kpis.tvq)} icon={DollarSign} accent="bg-indigo-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Description, categorie, fournisseur..." className="pl-9" />
        </div>
      </div>

      <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="depenses" storageKey="admin-expenses" />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouvelle depense" icon={Wallet} accent="bg-red-500" submitLabel="Creer la depense" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-date">Date *</Label>
            <Input id="e-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Categorie *</Label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-title">Description *</Label>
            <Input id="e-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-vendor">Fournisseur</Label>
            <Input id="e-vendor" value={newVendor} onChange={(e) => setNewVendor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-amount">Montant HT (CAD) *</Label>
            <Input id="e-amount" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-tps">TPS payee</Label>
              <Input id="e-tps" type="number" step="0.01" value={newTps} onChange={(e) => setNewTps(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-tvq">TVQ payee</Label>
              <Input id="e-tvq" type="number" step="0.01" value={newTvq} onChange={(e) => setNewTvq(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea id="e-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
