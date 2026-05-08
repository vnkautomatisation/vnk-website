"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderOpen,
  Plus,
  Search,
  FileText,
  Users,
  Eye,
  EyeOff,
  Calendar,
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
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { cn, formatDate } from "@/lib/utils";

type Doc = {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  mandateId: number | null;
  mandateTitle: string | null;
  title: string;
  description: string | null;
  fileType: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  category: string | null;
  status: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type CategoryFilter = "all" | "unread" | "livrables" | "documentation_technique" | "autres";

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "unread", label: "Non lus" },
  { key: "livrables", label: "Livrables" },
  { key: "documentation_technique", label: "Documentation" },
  { key: "autres", label: "Autres" },
];

const CATEGORY_OPTIONS = [
  { value: "documentation_technique", label: "Documentation technique" },
  { value: "livrables", label: "Livrables" },
  { value: "factures", label: "Factures" },
  { value: "devis", label: "Devis" },
  { value: "contrats", label: "Contrats" },
  { value: "autres", label: "Autres" },
];

export function DocumentsView({
  documents,
  clients,
  kpis,
}: {
  documents: Doc[];
  clients: ClientOption[];
  kpis: { total: number; thisMonth: number; unread: number; uniqueClients: number };
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("documents", "list");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Edit/Delete
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  const resetForm = () => {
    setNewClientId("");
    setNewTitle("");
    setNewCategory("");
    setNewDesc("");
  };

  const openEdit = (d: Doc) => {
    setEditDoc(d);
    setEditTitle(d.title);
    setEditCategory(d.category ?? "");
    setEditDesc(d.description ?? "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editDoc || !editTitle.trim()) return { success: false, error: "Titre requis" };
    try {
      const res = await fetch(`/api/documents/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory || undefined,
          description: editDesc.trim() || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    const res = await fetch(`/api/documents/${deleteDoc.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Document supprime"); setDeleteDoc(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim()) {
      return { success: false, error: "Client et titre requis" };
    }
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          title: newTitle.trim(),
          category: newCategory || undefined,
          description: newDesc.trim() || undefined,
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
    let result = documents;
    if (categoryFilter === "unread") result = result.filter((d) => !d.isRead);
    else if (categoryFilter === "livrables") result = result.filter((d) => d.category === "livrables");
    else if (categoryFilter === "documentation_technique") result = result.filter((d) => d.category === "documentation_technique");
    else if (categoryFilter === "autres") result = result.filter((d) => d.category !== "livrables" && d.category !== "documentation_technique");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.category ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, categoryFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((d: Doc) => [
    { label: "Voir client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", d.clientId) },
    { label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) },
    { label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDoc(d), separator: true, variant: "destructive" as const },
  ], []);

  const columns: Column<Doc>[] = [
    {
      key: "client",
      header: "Client",
      accessor: (r) => (
        <div>
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.clientName,
    },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    {
      key: "category",
      header: "Categorie",
      accessor: (r) => <span className="capitalize text-xs">{(r.category ?? "autre").replace(/_/g, " ")}</span>,
      sortable: true,
      sortBy: (r) => r.category ?? "",
      hiddenOnMobile: true,
    },
    {
      key: "mandate",
      header: "Mandat",
      accessor: (r) => r.mandateTitle ?? "—",
      hiddenOnMobile: true,
    },
    {
      key: "isRead",
      header: "Statut portail",
      accessor: (r) =>
        r.isRead ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Eye className="h-3 w-3" />Lu</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600"><EyeOff className="h-3 w-3" />Non lu</span>
        ),
    },
    {
      key: "createdAt",
      header: "Depose le",
      accessor: (r) => formatDate(new Date(r.createdAt)),
      sortable: true,
      sortBy: (r) => r.createdAt,
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FolderOpen className="h-6 w-6" />
            Documents
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des documents clients</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau document
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total documents" value={kpis.total} icon={FileText} accent="bg-blue-500" />
        <StatCard label="Ce mois" value={kpis.thisMonth} icon={Calendar} accent="bg-indigo-500" />
        <StatCard label="Non lus" value={kpis.unread} icon={EyeOff} accent="bg-amber-500" />
        <StatCard label="Par client" value={kpis.uniqueClients} icon={Users} accent="bg-emerald-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Titre, client, categorie..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCategoryFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                categoryFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ViewToggle storageKey="documents" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.title}
              subtitle={d.clientName}
              icon={<FileText className="h-5 w-5 text-muted-foreground" />}
              badges={[
                { label: (d.category ?? "autre").replace(/_/g, " "), variant: "outline" },
                ...(!d.isRead ? [{ label: "Non lu", variant: "destructive" as const }] : []),
              ]}
              actions={getActions(d)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{d.fileType ?? "Fichier"}</span>
                  <span>{formatDate(new Date(d.createdAt))}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun document trouve</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="documents" storageKey="admin-documents" />
      )}

      <EditModal open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null); }} title="Modifier le document" description={editDoc?.title} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Categorie</Label>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteDoc}
        onOpenChange={(o) => { if (!o) setDeleteDoc(null); }}
        title="Supprimer ce document ?"
        description={`Le document "${deleteDoc?.title}" sera supprime definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau document" icon={FolderOpen} accent="bg-blue-500" submitLabel="Creer le document" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-title">Titre *</Label>
            <Input id="d-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Categorie</Label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-desc">Description</Label>
            <Textarea id="d-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
