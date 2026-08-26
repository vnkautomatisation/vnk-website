"use client";
// ─────────────────────────────────────────────────────────
// DocumentsAdminViewV2 — refonte UX inspirée Personio / HiBob /
// PandaDoc. Architecture :
//
//   ┌──────────────────────────────────────────────────────┐
//   │ Header VNK + breadcrumb + bouton "+ Nouveau document" │
//   ├──────────────────────────────────────────────────────┤
//   │ Mini-bar 48px : chips de statut filtrables  +  🔍     │
//   ├──────────┬───────────────────────────────────────────┤
//   │ Sidebar  │ Table dense (multi-select)                 │
//   │ 240px    │ Nom · Catégorie · Destinataire · Statut · ⋯│
//   │ Sections │                                            │
//   │ par      │ Click ligne -> drawer 480px (PDF + actions)│
//   │ intention│                                            │
//   └──────────┴───────────────────────────────────────────┘
//
// Sections sidebar (par INTENTION, pas par type d'objet) :
//   - Mes actions       (templates avec demande pending sur moi-eq)
//   - Bibliotheque      (tous templates, groupés par catégorie)
//   - Suivi & conformité (signatures en cours / uploads / dossiers)
//   - Archives          (signés + completed)
//
// Réutilise les dialogs existants : StartDraftDialog, SignatureRequestDialog,
// TemplateFieldsDialog, TemplateRichEditorDialog, etc.
// ─────────────────────────────────────────────────────────
import { useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  FileSignature,
  FileText,
  Filter,
  FolderOpen,
  Inbox,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isLongFormTemplate } from "@/lib/document-templates/fill-field-parser";
import { detectPlaceholders } from "@/lib/document-templates/placeholder-detector";
import { StartDraftDialog } from "@/components/admin/start-draft-dialog";
import { DocumentDraftEditor } from "@/components/admin/document-draft-editor";

// ─── Types ────────────────────────────────────────────────
// Reprend exactement les memes types que v1 pour pouvoir swap drop-in.

type Template = {
  id: number;
  key: string;
  title: string;
  category: string;
  version: string;
  bodyMarkdown: string;
  isRequired: boolean;
  targetPositions?: string[];
  targetDepartments?: string[];
  signatureScope?: "employee_only" | "employer_only" | "both" | "none";
  acknowledgmentMode?: "reading_only" | "signature";
  _count: { signatures: number };
};
type Signature = {
  id: number;
  adminId: number;
  templateId: number;
  version: string;
  signedAt: string;
  finalPdfUrl: string | null;
  signatureData: string | null;
};
type Employee = {
  id: number;
  fullName: string | null;
  email: string;
  team: { id: number; name: string } | null;
};
type PendingRequest = {
  id: number;
  templateId: number;
  template: { id: number; title: string; key: string; version: string; isRequired: boolean };
  requestedAt: string;
  requestedBy: { id: number; fullName: string | null; email: string };
  dueDate: string | null;
  reason: string | null;
  status: string;
  targetAdminId: number | null;
  targetAdmin: { id: number; fullName: string | null; email: string } | null;
  targetTeamId: number | null;
  targetAll: boolean;
};
type UploadRequestAdmin = {
  id: number;
  title: string;
  category: string;
  status: string;
  dueDate: string | null;
  targetAdmin: { id: number; fullName: string | null; email: string };
  requestedBy: { id: number; fullName: string | null; email: string };
  createdAt: string;
};

// Section sidebar (par INTENTION)
type SidebarSection = "actions" | "library" | "tracking" | "archives";
// Filtre statut (chips)
type StatusFilter = "all" | "needs_action" | "in_progress" | "signed" | "drafts";

// Item unifié pour la table (template, request, ou upload, normalisés)
type RowItem = {
  id: string; // "tpl-12" | "req-5" | "up-3"
  kind: "template" | "request" | "upload";
  title: string;
  category: string;
  destinataire: string | null;
  status: "draft" | "pending" | "signed" | "model" | "expired";
  statusLabel: string;
  updatedAt: string;
  // Refs pour ouvrir le drawer / lancer actions
  templateId?: number;
  template?: Template;
  pendingRequest?: PendingRequest;
  uploadRequest?: UploadRequestAdmin;
};

// ─── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

const CATEGORY_LABEL: Record<string, string> = {
  policy: "Politique",
  legal: "Légal",
  lettre: "Lettre",
  onboarding: "Onboarding",
  nda: "NDA",
  contract: "Contrat",
};

const CATEGORY_COLOR: Record<string, string> = {
  policy: "bg-blue-50 text-blue-800 border-blue-200",
  legal: "bg-purple-50 text-purple-800 border-purple-200",
  lettre: "bg-amber-50 text-amber-900 border-amber-200",
  onboarding: "bg-emerald-50 text-emerald-800 border-emerald-200",
  nda: "bg-rose-50 text-rose-800 border-rose-200",
  contract: "bg-indigo-50 text-indigo-800 border-indigo-200",
};

const STATUS_COLOR: Record<RowItem["status"], string> = {
  draft: "bg-amber-50 text-amber-900 border-amber-200",
  pending: "bg-blue-50 text-blue-900 border-blue-200",
  signed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  model: "bg-slate-50 text-slate-700 border-slate-200",
  expired: "bg-rose-50 text-rose-800 border-rose-200",
};

// ─── Composant principal ───────────────────────────────────

export function DocumentsAdminViewV2({
  templates,
  pendingRequests,
  uploadRequests,
  isSuper,
}: {
  templates: Template[];
  allSignatures: Signature[];
  employees: Employee[];
  pendingRequests: PendingRequest[];
  completedRequests?: PendingRequest[];
  uploadRequests: UploadRequestAdmin[];
  templateIdsInActiveHandbooks?: number[];
  isSuper: boolean;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  void isSuper;

  // ─── Filtres & navigation ─────────────────────────────────
  const [section, setSection] = useState<SidebarSection>("library");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<RowItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile

  // ─── Dialogs ──────────────────────────────────────────────
  const [startDraftDialog, setStartDraftDialog] = useState<{
    open: boolean; template: Template | null;
  }>({ open: false, template: null });
  const [editorDraftId, setEditorDraftId] = useState<number | null>(null);

  // ─── Construction des rows unifiees ───────────────────────
  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];

    // Templates
    templates.forEach((t) => {
      const sigCount = t._count?.signatures ?? 0;
      out.push({
        id: `tpl-${t.id}`,
        kind: "template",
        title: t.title,
        category: t.category,
        destinataire: null,
        status: "model",
        statusLabel: sigCount > 0 ? `${sigCount} signatures` : "Modèle",
        updatedAt: "",
        templateId: t.id,
        template: t,
      });
    });

    // Pending signature requests
    pendingRequests.forEach((r) => {
      out.push({
        id: `req-${r.id}`,
        kind: "request",
        title: r.template.title,
        category: "legal",
        destinataire: r.targetAdmin?.fullName ?? r.targetAdmin?.email ?? (r.targetAll ? "Tous" : "Équipe"),
        status: "pending",
        statusLabel: r.dueDate ? `Échéance ${formatDate(r.dueDate)}` : "En attente",
        updatedAt: r.requestedAt,
        templateId: r.templateId,
        pendingRequest: r,
      });
    });

    // Upload requests (pending only)
    uploadRequests.filter((u) => u.status === "pending").forEach((u) => {
      out.push({
        id: `up-${u.id}`,
        kind: "upload",
        title: u.title,
        category: u.category,
        destinataire: u.targetAdmin.fullName ?? u.targetAdmin.email,
        status: "pending",
        statusLabel: u.dueDate ? `Échéance ${formatDate(u.dueDate)}` : "Upload demandé",
        updatedAt: u.createdAt,
        uploadRequest: u,
      });
    });

    return out;
  }, [templates, pendingRequests, uploadRequests]);

  // ─── Compteurs pour les chips ─────────────────────────────
  const counts = useMemo(() => {
    return {
      needs_action: rows.filter((r) => r.kind === "request" && r.status === "pending").length,
      in_progress: rows.filter((r) => r.status === "pending").length,
      signed: templates.reduce((acc, t) => acc + (t._count?.signatures ?? 0), 0),
      drafts: 0, // TODO: charger les brouillons via API
    };
  }, [rows, templates]);

  // ─── Filtrage final ───────────────────────────────────────
  const filteredRows = useMemo(() => {
    let r = rows;

    // Filtre section sidebar
    if (section === "actions") {
      r = r.filter((x) => x.status === "pending");
    } else if (section === "library") {
      r = r.filter((x) => x.kind === "template");
    } else if (section === "tracking") {
      r = r.filter((x) => x.kind === "request" || x.kind === "upload");
    } else if (section === "archives") {
      r = r.filter((x) => x.status === "signed");
    }

    // Filtre chips de statut
    if (statusFilter === "needs_action") {
      r = r.filter((x) => x.kind === "request" && x.status === "pending");
    } else if (statusFilter === "in_progress") {
      r = r.filter((x) => x.status === "pending");
    } else if (statusFilter === "signed") {
      r = r.filter((x) => x.status === "signed");
    } else if (statusFilter === "drafts") {
      r = r.filter((x) => x.status === "draft");
    }

    // Filtre catégorie
    if (categoryFilter) {
      r = r.filter((x) => x.category === categoryFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.title.toLowerCase().includes(q)
        || x.destinataire?.toLowerCase().includes(q)
        || x.category.toLowerCase().includes(q));
    }

    return r;
  }, [rows, section, statusFilter, categoryFilter, search]);

  // ─── Categories pour sidebar bibliotheque ─────────────────
  const categories = useMemo(() => {
    const set = new Map<string, number>();
    templates.forEach((t) => set.set(t.category, (set.get(t.category) ?? 0) + 1));
    return Array.from(set.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  // ─── Actions ──────────────────────────────────────────────
  const handleSendForSignature = useCallback((tpl: Template) => {
    const isLong = isLongFormTemplate(tpl.bodyMarkdown);
    const hasPlaceholders = detectPlaceholders(tpl.bodyMarkdown).length > 0;
    if (isLong) {
      setStartDraftDialog({ open: true, template: tpl });
    } else if (hasPlaceholders) {
      toast.info("À implémenter v2 : Compléter champs + envoyer");
      // TODO: re-implémenter avec TemplateFieldsDialog
    } else {
      toast.info("À implémenter v2 : Envoyer signature direct");
      // TODO: SignatureRequestDialog
    }
  }, []);

  const toggleSelectAll = () => {
    if (selectedRowIds.size === filteredRows.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRows.map((r) => r.id)));
    }
  };
  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/20">
      {/* Mini-bar chips + search + bouton + Nouveau */}
      <div className="sticky top-0 z-10 bg-card border-b border-border/60 shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Layers className="h-4 w-4" />
          </Button>

          <Chip
            label="Tout"
            count={rows.length}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <Chip
            label="Action requise"
            count={counts.needs_action}
            tone="amber"
            active={statusFilter === "needs_action"}
            onClick={() => setStatusFilter("needs_action")}
          />
          <Chip
            label="En cours"
            count={counts.in_progress}
            tone="blue"
            active={statusFilter === "in_progress"}
            onClick={() => setStatusFilter("in_progress")}
          />
          <Chip
            label="Signés"
            count={counts.signed}
            tone="green"
            active={statusFilter === "signed"}
            onClick={() => setStatusFilter("signed")}
          />
          <Chip
            label="Brouillons"
            count={counts.drafts}
            tone="amber"
            active={statusFilter === "drafts"}
            onClick={() => setStatusFilter("drafts")}
          />

          <div className="flex-1 min-w-[120px] max-w-md ml-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nouveau
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => toast.info("À implémenter : nouveau template")}>
                <FileText className="h-3.5 w-3.5 mr-2" />
                Nouveau modèle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("À implémenter : demande signature")}>
                <FileSignature className="h-3.5 w-3.5 mr-2" />
                Demander une signature
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("À implémenter : demande upload")}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                Demander un document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Layout principal : sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-[240px] flex-col bg-card border-r border-border/60 overflow-y-auto shrink-0">
          <SidebarContent
            section={section}
            setSection={setSection}
            counts={counts}
            categories={categories}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
          />
        </aside>

        {/* Sidebar mobile (sheet) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3">
              <SheetTitle className="text-white text-sm">Navigation</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-full">
              <SidebarContent
                section={section}
                setSection={(s) => { setSection(s); setSidebarOpen(false); }}
                counts={counts}
                categories={categories}
                categoryFilter={categoryFilter}
                setCategoryFilter={(c) => { setCategoryFilter(c); setSidebarOpen(false); }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main : table */}
        <main className="flex-1 overflow-auto">
          {/* Bulk action bar */}
          {selectedRowIds.size > 0 && (
            <div className="sticky top-0 z-[5] bg-[#0F2D52] text-white px-4 py-2 flex items-center gap-3 shadow-md">
              <span className="text-sm">{selectedRowIds.size} sélectionné{selectedRowIds.size > 1 ? "s" : ""}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => toast.info("À implémenter : envoyer en masse")}
              >
                <Send className="h-3.5 w-3.5 mr-1" /> {tc("send")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setSelectedRowIds(new Set())}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {filteredRows.length === 0 ? (
            <EmptyState section={section} statusFilter={statusFilter} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b sticky top-0 z-[1]">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedRowIds.size === filteredRows.length}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2 hidden md:table-cell">Catégorie</th>
                  <th className="px-3 py-2 hidden lg:table-cell">Destinataire</th>
                  <th className="px-3 py-2">{tc("status")}</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    selected={selectedRowIds.has(row.id)}
                    onToggle={() => toggleSelectRow(row.id)}
                    onOpenDrawer={() => setDrawerRow(row)}
                    onSendForSignature={() => row.template && handleSendForSignature(row.template)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>

      {/* Drawer detail */}
      <Sheet open={drawerRow !== null} onOpenChange={(o) => !o && setDrawerRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 overflow-hidden flex flex-col">
          {drawerRow && <DrawerContent row={drawerRow} onClose={() => setDrawerRow(null)} onSendForSignature={() => drawerRow.template && handleSendForSignature(drawerRow.template)} />}
        </SheetContent>
      </Sheet>

      {/* Dialogs reutilises */}
      <StartDraftDialog
        open={startDraftDialog.open}
        templateId={startDraftDialog.template?.id ?? null}
        templateTitle={startDraftDialog.template?.title ?? ""}
        onClose={() => setStartDraftDialog({ open: false, template: null })}
        onCreated={(draftId) => {
          setStartDraftDialog({ open: false, template: null });
          setEditorDraftId(draftId);
        }}
      />
      <DocumentDraftEditor
        open={editorDraftId !== null}
        draftId={editorDraftId}
        onClose={() => setEditorDraftId(null)}
        onSent={() => router.refresh()}
      />
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────

function SidebarContent({
  section, setSection, counts, categories, categoryFilter, setCategoryFilter,
}: {
  section: SidebarSection;
  setSection: (s: SidebarSection) => void;
  counts: { needs_action: number; in_progress: number; signed: number; drafts: number };
  categories: Array<[string, number]>;
  categoryFilter: string | null;
  setCategoryFilter: (c: string | null) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(true);

  return (
    <nav className="py-3 px-2 space-y-1">
      <SidebarItem
        icon={<Inbox className="h-4 w-4" />}
        label="Mes actions"
        count={counts.needs_action}
        active={section === "actions"}
        onClick={() => { setSection("actions"); setCategoryFilter(null); }}
      />

      <button
        type="button"
        onClick={() => { setLibraryOpen(!libraryOpen); setSection("library"); setCategoryFilter(null); }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          section === "library" ? "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold" : "hover:bg-muted/60 text-foreground"
        }`}
      >
        {libraryOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <BookOpen className="h-4 w-4" />
        <span className="flex-1 text-left">Bibliothèque</span>
      </button>
      {libraryOpen && (
        <div className="ml-5 space-y-0.5 mb-1">
          <button
            type="button"
            onClick={() => { setSection("library"); setCategoryFilter(null); }}
            className={`w-full text-left text-[12px] px-3 py-1.5 rounded transition-colors ${
              section === "library" && !categoryFilter ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous les modèles
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setSection("library"); setCategoryFilter(cat); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-[12px] transition-colors ${
                categoryFilter === cat ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex-1 text-left truncate">{CATEGORY_LABEL[cat] ?? cat}</span>
              <span className="text-[10px] tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}

      <SidebarItem
        icon={<ClipboardList className="h-4 w-4" />}
        label="Suivi & conformité"
        count={counts.in_progress}
        active={section === "tracking"}
        onClick={() => { setSection("tracking"); setCategoryFilter(null); }}
      />
      <SidebarItem
        icon={<FolderOpen className="h-4 w-4" />}
        label="Archives"
        count={counts.signed}
        active={section === "archives"}
        onClick={() => { setSection("archives"); setCategoryFilter(null); }}
      />

      <div className="pt-3 mt-3 border-t border-border/40 px-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-2">Raccourcis</div>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        >
          <Users className="h-3.5 w-3.5" /> Dossiers employés
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="h-3.5 w-3.5" /> Cahiers de l'employé
        </button>
      </div>
    </nav>
  );
}

function SidebarItem({
  icon, label, count, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active ? "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold" : "hover:bg-muted/60 text-foreground"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          active ? "bg-[#0F2D52] text-white" : "bg-muted text-muted-foreground"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Chip filtre statut ───────────────────────────────────

function Chip({
  label, count, active, tone = "slate", onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "slate" | "amber" | "blue" | "green";
  onClick: () => void;
}) {
  const activeColors: Record<string, string> = {
    slate: "bg-[#0F2D52] text-white border-[#0F2D52]",
    amber: "bg-amber-500 text-white border-amber-500",
    blue: "bg-blue-600 text-white border-blue-600",
    green: "bg-emerald-600 text-white border-emerald-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? activeColors[tone]
          : "bg-card border-border hover:border-foreground/30 text-foreground"
      }`}
    >
      {label}
      <span className={`text-[10px] tabular-nums px-1 ${active ? "opacity-90" : "opacity-60"}`}>
        {count}
      </span>
    </button>
  );
}

// ─── Table row ────────────────────────────────────────────

function TableRow({
  row, selected, onToggle, onOpenDrawer, onSendForSignature,
}: {
  row: RowItem;
  selected: boolean;
  onToggle: () => void;
  onOpenDrawer: () => void;
  onSendForSignature: () => void;
}) {
  return (
    <tr
      className={`border-b hover:bg-muted/40 transition-colors cursor-pointer ${
        selected ? "bg-[#0F2D52]/5" : ""
      }`}
      onClick={onOpenDrawer}
    >
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-border"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-foreground truncate max-w-md">{row.title}</div>
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell">
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[row.category] ?? "bg-muted text-muted-foreground border-border"}`}>
          {CATEGORY_LABEL[row.category] ?? row.category}
        </span>
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
        {row.destinataire ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLOR[row.status]}`}>
          {row.statusLabel}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpenDrawer}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Aperçu
            </DropdownMenuItem>
            {row.kind === "template" && (
              <DropdownMenuItem onClick={onSendForSignature}>
                <Send className="h-3.5 w-3.5 mr-2" /> Envoyer pour signature
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-700">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Archiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Drawer detail ────────────────────────────────────────

function DrawerContent({ row, onClose, onSendForSignature }: {
  row: RowItem; onClose: () => void; onSendForSignature: () => void;
}) {
  const tc = useTranslations("common");
  const pdfUrl = row.templateId
    ? `/api/admin/document-templates/preview-pdf?templateId=${row.templateId}`
    : null;

  return (
    <>
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 shrink-0">
        <SheetHeader>
          <SheetTitle className="text-white text-sm flex items-center gap-2 pr-8">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{row.title}</span>
          </SheetTitle>
          <p className="text-white/80 text-[11px] mt-1">{row.statusLabel}</p>
        </SheetHeader>
      </div>
      <div className="flex-1 overflow-hidden bg-white">
        {pdfUrl ? (
          <iframe src={pdfUrl} title={row.title} className="w-full h-full border-0" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Aperçu PDF non disponible pour ce type
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t bg-muted/30 shrink-0 flex gap-2 flex-wrap [&>button]:flex-1">
        <Button variant="outline" size="sm" onClick={onClose}>{tc("close")}</Button>
        {row.kind === "template" && (
          <Button size="sm" onClick={onSendForSignature} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Send className="h-3.5 w-3.5 mr-1.5" /> {tc("send")}
          </Button>
        )}
      </div>
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────

function EmptyState({ section, statusFilter }: { section: SidebarSection; statusFilter: StatusFilter }) {
  void statusFilter;
  const config = {
    actions: { icon: Inbox, title: "Aucune action en attente", text: "Tout est à jour. Reviens ici quand de nouveaux documents arrivent." },
    library: { icon: BookOpen, title: "Aucun modèle", text: "Crée ton premier modèle ou importe depuis la bibliothèque starter." },
    tracking: { icon: ClipboardList, title: "Aucun suivi en cours", text: "Les demandes de signature et upload apparaîtront ici." },
    archives: { icon: FolderOpen, title: "Pas encore d'archives", text: "Les documents signés s'archivent automatiquement ici." },
  }[section];
  const Icon = config.icon;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <Icon className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <h3 className="text-base font-semibold text-foreground mb-1">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{config.text}</p>
    </div>
  );
}
