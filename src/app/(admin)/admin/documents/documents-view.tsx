"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Search, FileText, Users, Eye, EyeOff, Calendar, Pencil, Trash2,
  SlidersHorizontal, X, CheckSquare, MoreHorizontal, Send, Download, Image as ImageIcon,
  Music, Video, Archive, FileSpreadsheet, FileType, HardDrive, Upload, Cloud, Server,
  AlertTriangle, Info, Briefcase, Receipt as ReceiptIcon, FileSignature, ExternalLink, ArrowRight, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FormSection } from "@/components/admin/client-form-fields";
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
  uploadedBy: string | null;
  isUploaded: boolean;
  isSystemGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type MandateOption = { id: number; title: string; clientId: number };
type StatusFilter = "all" | "unread" | "read" | "system" | "manual";

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "tous" },
  { key: "unread", labelKey: "non_lus_onglet" },
  { key: "read", labelKey: "lus" },
  { key: "system", labelKey: "auto_generes" },
  { key: "manual", labelKey: "manuels" },
];

const CATEGORY_OPTIONS = [
  { value: "documentation_technique", label: "Documentation technique", color: "bg-indigo-100 text-indigo-700" },
  { value: "livrables", label: "Livrables", color: "bg-emerald-100 text-emerald-700" },
  { value: "factures", label: "Factures", color: "bg-blue-100 text-blue-700" },
  { value: "devis", label: "Devis", color: "bg-violet-100 text-violet-700" },
  { value: "contrats", label: "Contrats", color: "bg-amber-100 text-amber-700" },
  { value: "rapports", label: "Rapports", color: "bg-cyan-100 text-cyan-700" },
  { value: "autres", label: "Autres", color: "bg-gray-100 text-gray-700" },
];

const MAX_UPLOAD_MB = 10;

function fmtBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

type SourceEntity = { type: "quote" | "invoice" | "contract"; id: number; labelKey: string; icon: typeof FileText };

function getSourceEntity(fileUrl: string | null | undefined): SourceEntity | null {
  if (!fileUrl) return null;
  const m = fileUrl.match(/^\/api\/(quotes|invoices|contracts)\/(\d+)\/pdf/);
  if (!m) return null;
  const id = Number(m[2]);
  if (m[1] === "quotes") return { type: "quote", id, labelKey: "devis", icon: FileText };
  if (m[1] === "invoices") return { type: "invoice", id, labelKey: "facture", icon: ReceiptIcon };
  return { type: "contract", id, labelKey: "contrat", icon: FileSignature };
}

function fileIconFor(fileType: string | null | undefined): { Icon: typeof FileText; color: string; bg: string } {
  const ft = (fileType ?? "").toLowerCase();
  if (ft.includes("pdf")) return { Icon: FileText, color: "text-red-600", bg: "bg-red-50" };
  if (ft.startsWith("image")) return { Icon: ImageIcon, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (ft.startsWith("audio")) return { Icon: Music, color: "text-violet-600", bg: "bg-violet-50" };
  if (ft.startsWith("video")) return { Icon: Video, color: "text-pink-600", bg: "bg-pink-50" };
  if (ft.includes("zip") || ft.includes("compressed") || ft.includes("rar")) return { Icon: Archive, color: "text-amber-600", bg: "bg-amber-50" };
  if (ft.includes("sheet") || ft.includes("excel") || ft.includes("csv")) return { Icon: FileSpreadsheet, color: "text-green-700", bg: "bg-green-50" };
  if (ft.includes("word") || ft.includes("document")) return { Icon: FileType, color: "text-blue-600", bg: "bg-blue-50" };
  return { Icon: FileText, color: "text-muted-foreground", bg: "bg-muted/40" };
}

export function DocumentsView({
  documents,
  clients,
  mandates,
  kpis,
}: {
  documents: Doc[];
  clients: ClientOption[];
  mandates: MandateOption[];
  kpis: { total: number; thisMonth: number; unread: number; uniqueClients: number; totalStorageBytes: number };
}) {
  const t = useTranslations("admin.documents");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("documents", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Filtres avances
  const [filterClients, setFilterClients] = useState<Set<number>>(new Set());
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit/Delete + PDF preview + Detail
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);
  const [pdfDoc, setPdfDoc] = useState<Doc | null>(null);
  const [imgDoc, setImgDoc] = useState<Doc | null>(null);
  const [detailDoc, setDetailDoc] = useState<Doc | null>(null);

  // Form state
  const [fClientId, setFClientId] = useState("");
  const [fMandateId, setFMandateId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fFiles, setFFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFClientId(""); setFMandateId(""); setFTitle(""); setFCategory(""); setFDesc(""); setFFiles([]);
  };

  useEffect(() => {
    const newFor = searchParams.get("newFor");
    if (newFor && clients.some((c) => String(c.id) === newFor)) {
      resetForm();
      setFClientId(newFor);
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("newFor");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, clients]);

  const openEdit = (d: Doc) => {
    setEditDoc(d);
    setFTitle(d.title);
    setFCategory(d.category ?? "");
    setFDesc(d.description ?? "");
  };

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(t("lecture_impossible")));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleAddFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) {
      if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`${f.name} : trop volumineux (max ${MAX_UPLOAD_MB} Mo)`);
        continue;
      }
      setFFiles((prev) => [...prev, f]);
    }
  }, []);

  const removeFile = (idx: number) => setFFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId) { toast.error(t("client_requis")); return; }
    if (fFiles.length === 0 && !fTitle.trim()) { toast.error(t("moins_fichier_titre")); return; }
    setSubmitting(true);
    try {
      let success = 0, errors = 0;
      if (fFiles.length === 0) {
        // Doc metadata-only
        const res = await fetch("/api/documents", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: Number(fClientId),
            mandateId: fMandateId ? Number(fMandateId) : undefined,
            title: fTitle.trim(),
            category: fCategory || undefined,
            description: fDesc.trim() || undefined,
            fileUrl: "—",
          }),
        });
        if (res.ok) success++; else errors++;
      } else {
        for (const file of fFiles) {
          try {
            const dataUrl = await fileToDataUrl(file);
            const res = await fetch("/api/documents", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: Number(fClientId),
                mandateId: fMandateId ? Number(fMandateId) : undefined,
                title: (fFiles.length === 1 && fTitle.trim()) ? fTitle.trim() : file.name,
                category: fCategory || undefined,
                description: fDesc.trim() || undefined,
                fileData: dataUrl,
                fileName: file.name,
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
              }),
            });
            if (res.ok) success++; else errors++;
          } catch { errors++; }
        }
      }
      if (success > 0) toast.success(`${success} document(s) déposé(s)${errors > 0 ? ` · ${errors} erreur(s)` : ""}`);
      else toast.error(t("aucun_document_n_pu_etre"));
      setCreateOpen(false);
      resetForm();
      router.refresh();
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editDoc || !fTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${editDoc.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          category: fCategory || null,
          description: fDesc.trim() || null,
        }),
      });
      if (res.ok) { toast.success(t("document_modifie")); setEditDoc(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    const res = await fetch(`/api/documents/${deleteDoc.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("document_supprime")); setDeleteDoc(null); router.refresh(); }
    else { toast.error(t("erreur")); }
  };

  const handleSendToClient = async (d: Doc) => {
    const ok = await confirm({
      title: t("envoyer_document_client"),
      description: `Un message chat + une notification seront créés pour ${d.clientName}.`,
      confirmLabel: t("envoyer"),
    });
    if (!ok) return;
    const res = await fetch(`/api/documents/${d.id}/send`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Document envoyé à ${data.clientName}`);
      router.refresh();
    } else { toast.error(t("erreur")); }
  };

  const handleToggleRead = async (d: Doc) => {
    const res = await fetch(`/api/documents/${d.id}/mark-read`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: !d.isRead }),
    });
    if (res.ok) { toast.success(d.isRead ? t("marque_non_lu") : t("marque_lu")); router.refresh(); }
    else { toast.error(t("erreur")); }
  };

  const handleDownload = (d: Doc) => {
    if (!d.fileUrl) { toast.error(t("aucun_fichier")); return; }
    const a = document.createElement("a");
    a.href = `/api/documents/${d.id}`;
    a.download = d.fileName ?? d.title;
    a.click();
  };

  const handleOpenPreview = (d: Doc) => {
    const ft = (d.fileType ?? "").toLowerCase();
    if (ft.includes("pdf")) setPdfDoc(d);
    else if (ft.startsWith("image")) setImgDoc(d);
    else handleDownload(d);
  };

  // Bulk
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} document(s) ?`,
      description: t("action_irreversible"),
      confirmLabel: t("supprimer_tous"),
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0;
    for (const id of Array.from(selectedIds)) {
      const r = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (r.ok) success++;
    }
    toast.success(`${success}/${selectedIds.size} supprimé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleBulkMarkRead = async (next: boolean) => {
    if (selectedIds.size === 0) return;
    let success = 0;
    for (const id of Array.from(selectedIds)) {
      const r = await fetch(`/api/documents/${id}/mark-read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: next }),
      });
      if (r.ok) success++;
    }
    toast.success(`${success}/${selectedIds.size} marqué(s) ${next ? "lus" : t("non_lus")}`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const toggleSelectId = (id: number) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    setSelectedIds(set);
  };
  const toggleSelectAll = (allIds: number[]) => {
    if (allIds.every((id) => selectedIds.has(id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  // Sticky scroll detection (pattern dashboard finance)
  const stickyBarSentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = stickyBarSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Filter
  const filtered = useMemo(() => {
    let result = documents;
    if (statusFilter === "unread") result = result.filter((d) => !d.isRead);
    else if (statusFilter === "read") result = result.filter((d) => d.isRead);
    else if (statusFilter === "system") result = result.filter((d) => d.isSystemGenerated);
    else if (statusFilter === "manual") result = result.filter((d) => d.isUploaded || (!d.isSystemGenerated && !d.isUploaded));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.companyName ?? "").toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q) ||
        (r.fileName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterClients.size > 0) result = result.filter((r) => filterClients.has(r.clientId));
    if (filterCategories.size > 0) result = result.filter((r) => filterCategories.has(r.category ?? "autres"));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return result;
  }, [documents, statusFilter, searchQuery, filterClients, filterCategories, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterClients.size > 0 ? 1 : 0) +
    (filterCategories.size > 0 ? 1 : 0) +
    (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterClients(new Set());
    setFilterCategories(new Set());
    setFilterDateFrom(""); setFilterDateTo("");
  };

  // Mandates filtered by client
  const availableMandates = useMemo(() => {
    if (!fClientId) return mandates;
    return mandates.filter((m) => m.clientId === Number(fClientId));
  }, [mandates, fClientId]);

  // Actions
  const getActions = useCallback((d: Doc) => {
    const ft = (d.fileType ?? "").toLowerCase();
    const isPreviewable = !!d.fileUrl && (ft.includes("pdf") || ft.startsWith("image"));
    const source = getSourceEntity(d.fileUrl);
    const a: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: t("voir_detail"), icon: <Info className="h-3.5 w-3.5" />, onClick: () => setDetailDoc(d) },
    ];
    if (isPreviewable) {
      a.push({ label: ft.includes("pdf") ? t("voir_pdf") : t("voir_image"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => handleOpenPreview(d) });
    }
    if (d.fileUrl) {
      a.push({ label: t("telecharger"), icon: <Download className="h-3.5 w-3.5" />, onClick: () => handleDownload(d) });
    }
    a.push({ label: t("envoyer_client"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => handleSendToClient(d) });
    a.push({ label: d.isRead ? "Marquer non lu" : "Marquer lu", icon: d.isRead ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />, onClick: () => handleToggleRead(d) });
    a.push({ label: t("voir_client"), icon: <Users className="h-3.5 w-3.5" />, onClick: () => openEntity("client", d.clientId), separator: true });
    if (source) {
      a.push({
        label: `Modifier ${t(source.labelKey).toLowerCase()}`,
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => {
          const path = source.type === "quote" ? "quotes" : source.type === "invoice" ? "invoices" : "contracts";
          router.push(`/admin/${path}?editId=${source.id}`);
        },
      });
    } else {
      a.push({ label: t("modifier_metadonnees"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) });
    }
    a.push({ label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDoc(d), variant: "destructive", separator: true });
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // Columns
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Doc>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label={t("tout_selectionner")} />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Sélectionner ${r.title}`} />
      ),
    },
    {
      key: "icon", header: "",
      accessor: (r) => {
        const { Icon, color, bg } = fileIconFor(r.fileType);
        return (
          <div className={cn("h-9 w-9 rounded flex items-center justify-center shrink-0", bg)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        );
      },
    },
    {
      key: "title", header: t("titre"),
      accessor: (r) => (
        <div>
          <p className="text-sm font-medium">{r.title}</p>
          {r.fileName && r.fileName !== r.title && <p className="text-[10px] text-muted-foreground">{r.fileName}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title,
    },
    {
      key: "client", header: t("client"),
      accessor: (r) => (
        <div>
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.clientName,
    },
    {
      key: "category", header: t("categorie"),
      accessor: (r) => {
        const cat = CATEGORY_OPTIONS.find((c) => c.value === r.category);
        return cat ? (
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", cat.color)}>{cat.label}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
      hiddenOnMobile: true,
    },
    {
      key: "size", header: t("taille"),
      accessor: (r) => <span className="text-xs tabular-nums">{fmtBytes(r.fileSize)}</span>,
      sortable: true, sortBy: (r) => r.fileSize ?? 0,
      hiddenOnMobile: true,
    },
    {
      key: "source", header: t("source"),
      accessor: (r) => r.isSystemGenerated ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          <Server className="h-2.5 w-2.5" />Auto
        </span>
      ) : r.isUploaded ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          <Cloud className="h-2.5 w-2.5" />Upload
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
          <FileText className="h-2.5 w-2.5" />Lien
        </span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "isRead", header: t("statut"),
      accessor: (r) =>
        r.isRead ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Eye className="h-3 w-3" />{t("lu")}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600"><EyeOff className="h-3 w-3" />{t("non_lu")}</span>
        ),
    },
    {
      key: "createdAt", header: t("depose"),
      accessor: (r) => formatDate(new Date(r.createdAt)),
      sortable: true, sortBy: (r) => r.createdAt,
      hiddenOnMobile: true,
    },
    {
      key: "actions", header: "",
      accessor: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors" aria-label={tc("actions")}>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {getActions(r).map((a, i) => (
                <div key={i}>
                  {a.separator && i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={() => a.onClick()} className={a.variant === "destructive" ? "text-destructive" : ""}>
                    <span className="mr-2">{a.icon}</span>{a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero VNK navy */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <FolderOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("documents")}</h1>
              <p className="text-white/70 text-sm mt-0.5">{t("upload_partage_portail_client_auto")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.unread > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <EyeOff className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-semibold text-white">{kpis.unread} non lus</span>
              </div>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
              onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Upload className="h-4 w-4" />{tc("upload")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("total_documents")} value={kpis.total} icon={FileText} accent="bg-blue-500" />
        <StatCard label={t("mois")} value={kpis.thisMonth} icon={Calendar} accent="bg-indigo-500" />
        <StatCard label={t("non_lus")} value={kpis.unread} icon={EyeOff} accent="bg-amber-500" />
        <StatCard label={t("espace_utilise")} value={fmtBytes(kpis.totalStorageBytes)} icon={HardDrive} accent="bg-emerald-500" deltaLabel={`${kpis.uniqueClients} client${kpis.uniqueClients > 1 ? "s" : ""}`} />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={stickyBarSentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileText className="h-4 w-4" />
              {t("documents")}
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">{t("total")} <span className="font-semibold text-blue-600">{kpis.total}</span></span>
            <span className="text-muted-foreground">{t("mois")} <span className="font-semibold text-indigo-600">{kpis.thisMonth}</span></span>
            {kpis.unread > 0 && <span className="text-muted-foreground">{t("non_lus")} <span className="font-semibold text-amber-600">{kpis.unread}</span></span>}
            <span className="ml-auto text-muted-foreground">{fmtBytes(kpis.totalStorageBytes)} · {kpis.uniqueClients} client{kpis.uniqueClients > 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("titre_client_fichier")} className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("filtres")}</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("client")}</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {clients.map((c) => {
                    const isOn = filterClients.has(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => {
                          const set = new Set(filterClients);
                          if (isOn) set.delete(c.id); else set.add(c.id);
                          setFilterClients(set);
                        }}
                        className={cn("px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                        {c.fullName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("categories")}</p>
              <div className="flex flex-wrap gap-1">
                {CATEGORY_OPTIONS.map((c) => {
                  const isOn = filterCategories.has(c.value);
                  return (
                    <button key={c.value} type="button"
                      onClick={() => {
                        const set = new Set(filterCategories);
                        if (isOn) set.delete(c.value); else set.add(c.value);
                        setFilterCategories(set);
                      }}
                      className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                        isOn ? "bg-[#0F2D52] text-white" : c.color)}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("periode")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />{t("documents_view_effacer_les_filtres")}</Button>
            )}
          </PopoverContent>
        </Popover>
        <ViewToggle storageKey="documents" defaultView="list" onChange={setView} />
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />{tc("cancel")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkMarkRead(true)}>
              <Eye className="h-3.5 w-3.5 mr-1" />Marquer lus
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkMarkRead(false)}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />Marquer non lus
            </Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />{tc("delete")}
            </Button>
          </div>
        </div>
      )}

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => {
            const { Icon } = fileIconFor(d.fileType);
            return (
              <EntityCard
                key={d.id}
                title={d.title}
                subtitle={d.clientName}
                icon={<Icon className="h-5 w-5 text-muted-foreground" />}
                badges={[
                  ...(d.category ? [{ label: (CATEGORY_OPTIONS.find((c) => c.value === d.category)?.label ?? d.category), variant: "outline" as const }] : []),
                  ...(!d.isRead ? [{ label: t("non_lu"), variant: "destructive" as const }] : []),
                ]}
                actions={getActions(d)}
                onClick={() => setDetailDoc(d)}
                footer={
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{fmtBytes(d.fileSize)}</span>
                    <span>{formatDate(new Date(d.createdAt))}</span>
                  </div>
                }
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("aucun_document_trouve")}</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => setDetailDoc(r)}
          searchPlaceholder={t("rechercher")}
          exportFilename="documents"
          storageKey="admin-documents"
        />
      )}

      {/* PDF preview */}
      {pdfDoc && (
        <PdfViewerModal
          open
          onClose={() => setPdfDoc(null)}
          pdfUrl={`/api/documents/${pdfDoc.id}`}
          title={pdfDoc.title}
          downloadName={pdfDoc.fileName ?? pdfDoc.title}
        />
      )}

      {/* Image preview */}
      <Dialog open={!!imgDoc} onOpenChange={(o) => { if (!o) setImgDoc(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-3">
          <DialogTitle className="sr-only">{imgDoc?.title}</DialogTitle>
          {imgDoc && (
            <>
              <img src={`/api/documents/${imgDoc.id}`} alt={imgDoc.title} className="max-w-full max-h-[80vh] mx-auto block rounded" />
              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <p className="text-xs text-muted-foreground truncate">{imgDoc.fileName ?? imgDoc.title} · {fmtBytes(imgDoc.fileSize)}</p>
                <Button size="sm" onClick={() => handleDownload(imgDoc)} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                  <Download className="h-3 w-3 mr-1" />{tc("download")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Upload VNK */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
            <div className="relative flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg">{t("televerser_document")}</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  Glisser-déposer ou cliquer · Max {MAX_UPLOAD_MB} Mo par fichier · Multi-fichiers OK
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
            <FormSection title={t("destination")} icon={<Users className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("client_2")}</Label>
                  <Select value={fClientId} onValueChange={(v) => { setFClientId(v); setFMandateId(""); }}>
                    <SelectTrigger><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
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
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("mandat_optionnel")}</Label>
                  <Select value={fMandateId || "none"} onValueChange={(v) => setFMandateId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={tc("none")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("aucun_mandat")}</SelectItem>
                      {availableMandates.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            <FormSection title={t("fichiers")} icon={<Upload className="h-3.5 w-3.5" />}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  if (e.dataTransfer?.files) handleAddFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
                  dragOver ? "border-[#0F2D52] bg-[#0F2D52]/5" : "border-input hover:bg-muted/40"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium">{t("glissez_fichiers_ici")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">ou cliquez pour parcourir · max {MAX_UPLOAD_MB} Mo / fichier</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleAddFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              {fFiles.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {fFiles.map((f, i) => {
                    const { Icon, color, bg } = fileIconFor(f.type);
                    const overSize = f.size > MAX_UPLOAD_MB * 1024 * 1024;
                    return (
                      <li key={i} className={cn("flex items-center gap-2 rounded-md border p-2", overSize && "border-destructive")}>
                        <div className={cn("h-9 w-9 rounded flex items-center justify-center shrink-0", bg)}>
                          <Icon className={cn("h-5 w-5", color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtBytes(f.size)} · {f.type || t("type_inconnu")}</p>
                        </div>
                        {overSize && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        <button type="button" onClick={() => removeFile(i)}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label={t("retirer")}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FormSection>

            <FormSection title={t("metadonnees")} icon={<FileText className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Titre {fFiles.length > 1 ? t("ignore_nom_fichier_sera_utilise") : t("facultatif_si_fichier_joint")}
                </Label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                  placeholder={fFiles[0]?.name ?? t("manuel_utilisation")}
                  disabled={fFiles.length > 1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("categorie")}</Label>
                <Select value={fCategory || "none"} onValueChange={(v) => setFCategory(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={t("choisir")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("aucune")}</SelectItem>
                    {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("description_optionnel")}</Label>
                <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder={t("notes_client")} />
              </div>
            </FormSection>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>{tc("cancel")}</Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !fClientId}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
            >
              {submitting ? t("televersement") : fFiles.length > 0 ? `Téléverser ${fFiles.length} fichier${fFiles.length > 1 ? "s" : ""}` : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit VNK */}
      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">{t("modifier_document")}</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">{editDoc?.title}</DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("titre")}</Label>
              <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("categorie")}</Label>
              <Select value={fCategory || "none"} onValueChange={(v) => setFCategory(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={t("choisir")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("aucune")}</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("description")}</Label>
              <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setEditDoc(null)} disabled={submitting}>{tc("cancel")}</Button>
            <Button onClick={handleEdit} disabled={submitting || !fTitle.trim()} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
              {submitting ? t("enregistrement") : t("enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailDoc && (
        <DocumentDetailDialog
          doc={detailDoc}
          onClose={() => setDetailDoc(null)}
          onPreview={(d) => { setDetailDoc(null); handleOpenPreview(d); }}
          onDownload={handleDownload}
          onSendToClient={(d) => { setDetailDoc(null); handleSendToClient(d); }}
          onToggleRead={(d) => { handleToggleRead(d); setDetailDoc({ ...d, isRead: !d.isRead }); }}
          onEditMeta={(d) => { setDetailDoc(null); openEdit(d); }}
          onDelete={(d) => { setDetailDoc(null); setDeleteDoc(d); }}
          onOpenClient={(d) => { setDetailDoc(null); openEntity("client", d.clientId); }}
          onEditSource={(type, id) => {
            setDetailDoc(null);
            const path = type === "quote" ? "quotes" : type === "invoice" ? "invoices" : "contracts";
            router.push(`/admin/${path}?editId=${id}`);
          }}
          onOpenSourcePanel={(type, id) => { setDetailDoc(null); openEntity(type, id); }}
          onOpenMandate={(d) => { if (d.mandateId) { setDetailDoc(null); openEntity("mandate", d.mandateId); } }}
        />
      )}

      <ConfirmDialog
        open={!!deleteDoc}
        onOpenChange={(o) => { if (!o) setDeleteDoc(null); }}
        title={t("supprimer_document")}
        description={`Le document "${deleteDoc?.title}" sera supprimé définitivement.`}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      {ConfirmModal}
    </div>
  );
}

// ─── DocumentDetailDialog ────────────────────────────────
function DocumentDetailDialog({
  doc, onClose, onPreview, onDownload, onSendToClient, onToggleRead, onEditMeta, onDelete, onOpenClient, onEditSource, onOpenSourcePanel, onOpenMandate,
}: {
  doc: Doc;
  onClose: () => void;
  onPreview: (d: Doc) => void;
  onDownload: (d: Doc) => void;
  onSendToClient: (d: Doc) => void;
  onToggleRead: (d: Doc) => void;
  onEditMeta: (d: Doc) => void;
  onDelete: (d: Doc) => void;
  onOpenClient: (d: Doc) => void;
  onEditSource: (type: "quote" | "invoice" | "contract", id: number) => void;
  onOpenSourcePanel: (type: "quote" | "invoice" | "contract", id: number) => void;
  onOpenMandate: (d: Doc) => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.documents");
  const ft = (doc.fileType ?? "").toLowerCase();
  const isPdf = ft.includes("pdf");
  const isImage = ft.startsWith("image");
  const isPreviewable = !!doc.fileUrl && (isPdf || isImage);
  const source = getSourceEntity(doc.fileUrl);
  const cat = CATEGORY_OPTIONS.find((c) => c.value === doc.category);
  const { Icon, color, bg } = fileIconFor(doc.fileType);
  const SourceIcon = source?.icon;

  // Derived fileName for system docs (no fileName stored)
  const displayFileName = doc.fileName ?? (source ? `${t(source.labelKey).toLowerCase()}-${doc.title.replace(/[^a-z0-9._-]/gi, "_")}.pdf` : doc.title);
  const displayFileSize = doc.fileSize ? fmtBytes(doc.fileSize) : (source ? t("calculee_generation") : "—");

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-start gap-4">
            <div className={cn("h-14 w-14 rounded-xl flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("h-7 w-7", color)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-lg break-words">{doc.title}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5 flex flex-wrap items-center gap-2">
                {cat && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15">{cat.label}</span>}
                {doc.isRead ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100">
                    <Eye className="h-3 w-3" />{t("documents_view_lu_par_le_client")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100">
                    <EyeOff className="h-3 w-3" />Non lu
                  </span>
                )}
                {doc.isSystemGenerated && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/15">
                    <Server className="h-3 w-3" />{t("documents_view_auto_genere")}</span>
                )}
                {doc.isUploaded && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/15">
                    <Cloud className="h-3 w-3" />Upload
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          {/* Source entity card (si auto-genere) avec 2 actions */}
          {source && SourceIcon && (
            <div className="rounded-lg border-2 border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                  <SourceIcon className="h-5 w-5 text-[#0F2D52]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52]">{t("document_genere_depuis")}</p>
                  <p className="text-sm font-medium">{t(source.labelKey)} #{source.id} — pour changer le contenu, modifier l&apos;entité source</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpenSourcePanel(source.type, source.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />Voir le {t(source.labelKey).toLowerCase()}
                </Button>
                <Button size="sm" onClick={() => onEditSource(source.type, source.id)} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                  <Pencil className="h-3.5 w-3.5 mr-1" />Modifier {t(source.labelKey).toLowerCase()}
                </Button>
              </div>
            </div>
          )}

          {/* Aperçu inline */}
          {isPreviewable && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("apercu")}</p>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onPreview(doc)}>
                  <Eye className="h-3 w-3 mr-1" />{t("documents_view_plein_ecran")}</Button>
              </div>
              <div className="aspect-[16/10] bg-muted/40 flex items-center justify-center overflow-hidden">
                {isImage ? (
                  <img src={`/api/documents/${doc.id}`} alt={doc.title} className="max-h-full max-w-full object-contain" />
                ) : (
                  <iframe src={`/api/documents/${doc.id}#toolbar=0`} className="w-full h-full" title={doc.title} />
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {doc.description && (
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{t("description")}</p>
              <p className="text-sm whitespace-pre-wrap">{doc.description}</p>
            </div>
          )}

          {/* Métadonnées */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("fichier")}</p>
              <dl className="space-y-1.5 text-xs">
                <Row label={t("nom")} value={displayFileName} />
                <Row label={t("type")} value={doc.fileType ?? (source ? t("pdf_genere") : "—")} />
                <Row label={t("taille")} value={displayFileSize} />
                <Row label="ID" value={`#${doc.id}`} mono />
                {source && <Row label={t("source")} value={`${t(source.labelKey)} #${source.id}`} mono />}
              </dl>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("depot")}</p>
              <dl className="space-y-1.5 text-xs">
                <Row label={t("depose")} value={formatDate(new Date(doc.createdAt))} />
                <Row label={t("mis_jour")} value={formatDate(new Date(doc.updatedAt))} />
                <Row label={t("par")} value={doc.uploadedBy ?? t("systeme")} />
                <Row label={tc("status")} value={doc.status ?? "disponible"} />
              </dl>
            </div>
          </div>

          {/* Liens entites */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{t("entites_liees")}</p>
            <button type="button" onClick={() => onOpenClient(doc)}
              className="w-full flex items-center gap-2 rounded-md p-2 hover:bg-muted text-left transition-colors group">
              <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.clientName}</p>
                {doc.companyName && <p className="text-[10px] text-muted-foreground truncate">{doc.companyName}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>
            {doc.mandateId && (
              <button type="button" onClick={() => onOpenMandate(doc)}
                className="w-full flex items-center gap-2 rounded-md p-2 hover:bg-muted text-left transition-colors group">
                <div className="h-8 w-8 rounded bg-amber-50 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.mandateTitle ?? `Mandat #${doc.mandateId}`}</p>
                  <p className="text-[10px] text-muted-foreground">{t("mandat_associe")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-card shrink-0 sm:gap-2 flex-wrap">
          <Button variant="ghost" onClick={onClose}>{tc("close")}</Button>
          <div className="flex gap-2 flex-wrap">
            {doc.fileUrl && (
              <Button variant="outline" size="sm" onClick={() => onDownload(doc)}>
                <Download className="h-3.5 w-3.5 mr-1" />{tc("download")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onToggleRead(doc)}>
              {doc.isRead ? <><EyeOff className="h-3.5 w-3.5 mr-1" />{t("marquer_non_lu")}</> : <><Eye className="h-3.5 w-3.5 mr-1" />{t("marquer_lu")}</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSendToClient(doc)}>
              <Send className="h-3.5 w-3.5 mr-1" />{tc("send")}
            </Button>
            {source ? (
              <Button size="sm" onClick={() => onEditSource(source.type, source.id)} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                <Pencil className="h-3.5 w-3.5 mr-1" />Modifier {t(source.labelKey).toLowerCase()}
              </Button>
            ) : (
              <Button size="sm" onClick={() => onEditMeta(doc)} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                <Pencil className="h-3.5 w-3.5 mr-1" />{tc("edit")}
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => onDelete(doc)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />{tc("delete")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={cn("text-right truncate", mono && "font-mono text-[10px]")}>{value}</dd>
    </div>
  );
}

