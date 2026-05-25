"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap, Plus, Search, Pencil, Trash2, Copy, MoreHorizontal, BarChart3, Tag,
  Eye, CheckSquare, X, Variable, Mail, MessageCircle, History, Send, Sparkles, Lock,
  Paperclip, FileText, Globe, Download, Power, PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { StatCard } from "@/components/admin/stat-card";
import { FormSection } from "@/components/admin/client-form-fields";
import { TemplateBodyEditor } from "@/components/messages/template-body-editor";
import { TemplateAttachmentsInput } from "@/components/messages/template-attachments-input";
import type { MessageAttachment } from "@/components/messages/message-attachment-display";
import { expandTemplateVariables, markdownToHtml } from "@/lib/template-variables";
import { cn } from "@/lib/utils";

type Template = {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  category: string | null;
  categoryCustom: string | null;
  defaultChannel: "chat" | "email" | "both" | null;
  emailSubject: string | null;
  appendSignature: boolean;
  defaultAttachmentsData: unknown[] | null;
  tags: string[];
  locale: string;
  isSystem: boolean;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
};

const CATEGORIES = [
  { value: "greetings", label: "Salutations", color: "bg-blue-100 text-blue-700" },
  { value: "followup", label: "Relance / Suivi", color: "bg-amber-100 text-amber-700" },
  { value: "billing", label: "Facturation", color: "bg-emerald-100 text-emerald-700" },
  { value: "scheduling", label: "Rendez-vous", color: "bg-violet-100 text-violet-700" },
  { value: "technical", label: "Technique", color: "bg-indigo-100 text-indigo-700" },
  { value: "other", label: "Autre", color: "bg-gray-100 text-gray-700" },
];

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
  return d.toLocaleDateString("fr-CA");
}

export function TemplatesView({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [versionsFor, setVersionsFor] = useState<Template | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Form state
  const [fShortcut, setFShortcut] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [fCategory, setFCategory] = useState<string>("");
  const [fCategoryCustom, setFCategoryCustom] = useState("");
  const [fChannel, setFChannel] = useState<"chat" | "email" | "both" | "">("");
  const [fSubject, setFSubject] = useState("");
  const [fAppendSig, setFAppendSig] = useState(false);
  const [fAttachments, setFAttachments] = useState<MessageAttachment[]>([]);
  const [fTags, setFTags] = useState<string[]>([]);
  const [fLocale, setFLocale] = useState<"fr" | "en">("fr");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFShortcut(""); setFTitle(""); setFBody(""); setFCategory(""); setFCategoryCustom("");
    setFChannel(""); setFSubject(""); setFAppendSig(false); setFAttachments([]);
    setFTags([]); setFLocale("fr");
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setFShortcut(t.shortcut);
    setFTitle(t.title);
    setFBody(t.body);
    setFCategory(t.category ?? "");
    setFCategoryCustom(t.categoryCustom ?? "");
    setFChannel(t.defaultChannel ?? "");
    setFSubject(t.emailSubject ?? "");
    setFAppendSig(t.appendSignature);
    setFAttachments((t.defaultAttachmentsData as MessageAttachment[] | null) ?? []);
    setFTags(t.tags);
    setFLocale((t.locale as "fr" | "en") ?? "fr");
  };

  const buildPayload = () => ({
    shortcut: fShortcut.trim(),
    title: fTitle.trim(),
    body: fBody,
    category: fCategory || undefined,
    categoryCustom: fCategory === "other" && fCategoryCustom.trim() ? fCategoryCustom.trim() : undefined,
    defaultChannel: fChannel || undefined,
    emailSubject: fSubject.trim() || undefined,
    appendSignature: fAppendSig,
    defaultAttachmentsData: fAttachments.length > 0 ? fAttachments : undefined,
    tags: fTags.length > 0 ? fTags : undefined,
    locale: fLocale,
  });

  const handleCreate = async () => {
    if (submitting || !fShortcut.trim() || !fTitle.trim() || !fBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { toast.success("Template créé"); setCreateOpen(false); resetForm(); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editing || !fShortcut.trim() || !fTitle.trim() || !fBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/message-templates/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { toast.success("Template modifié"); setEditing(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/message-templates/${deleting.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Template supprimé"); setDeleting(null); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  const handleDuplicate = async (t: Template) => {
    const res = await fetch(`/api/message-templates/${t.id}/duplicate`, { method: "POST" });
    if (res.ok) { toast.success("Template dupliqué"); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  const handleToggleActive = async (t: Template) => {
    const res = await fetch(`/api/message-templates/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) { toast.success(t.isActive ? "Template désactivé" : "Template activé"); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  const handleTestSend = async (t: Template) => {
    const ok = await confirm({
      title: "Envoyer un test à votre adresse ?",
      description: "Le template sera envoyé à votre courriel admin avec des données d'exemple (Jean Tremblay / ACME Inc.)",
      confirmLabel: "Envoyer test",
    });
    if (!ok) return;
    const res = await fetch(`/api/message-templates/${t.id}/test-send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) { const d = await res.json(); toast.success(`Test envoyé à ${d.sentTo}`); }
    else { const d = await res.json(); toast.error(d.error || "Erreur SMTP"); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} template(s) ?`,
      description: "Action irréversible.",
      confirmLabel: "Supprimer tous",
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0;
    for (const id of Array.from(selectedIds)) {
      const r = await fetch(`/api/message-templates/${id}`, { method: "DELETE" });
      if (r.ok) success++;
    }
    toast.success(`${success}/${selectedIds.size} supprimé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleSeedDefaults = async () => {
    const ok = await confirm({
      title: "Installer les 15 templates par défaut ?",
      description: "Idempotent : si un raccourci existe déjà, il sera ignoré. Aucun template existant ne sera écrasé.",
      confirmLabel: "Installer",
    });
    if (!ok) return;
    setSeedingDefaults(true);
    try {
      const res = await fetch("/api/message-templates/seed-defaults", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        toast.success(`${d.created} ajouté(s) · ${d.skipped} ignoré(s) (déjà existant)`);
        router.refresh();
      } else { toast.error("Erreur"); }
    } finally { setSeedingDefaults(false); }
  };

  const copyShortcut = (sc: string) => {
    navigator.clipboard.writeText(`/${sc}`).then(() => toast.success(`/${sc} copié`));
  };

  // Tags collecte
  const allTags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);

  // Sticky scroll detection (pattern dashboard finance)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let r = templates;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) =>
        t.shortcut.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (filterCat !== "all") r = r.filter((t) => (t.category ?? "other") === filterCat);
    if (filterTag !== "all") r = r.filter((t) => t.tags.includes(filterTag));
    if (filterStatus === "active") r = r.filter((t) => t.isActive);
    else if (filterStatus === "inactive") r = r.filter((t) => !t.isActive);
    return r;
  }, [templates, search, filterCat, filterTag, filterStatus]);

  const totalUses = templates.reduce((s, t) => s + t.usageCount, 0);
  const recentlyUsed = templates.filter((t) => t.lastUsedAt && Date.now() - new Date(t.lastUsedAt).getTime() < 7 * 86400000).length;
  const systemCount = templates.filter((t) => t.isSystem).length;

  const toggleSelectId = (id: number) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    setSelectedIds(set);
  };
  const toggleSelectAll = () => {
    const allIds = filtered.map((t) => t.id);
    if (allIds.every((id) => selectedIds.has(id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Templates de messages</h1>
              <p className="text-white/70 text-sm mt-0.5">
                <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">/raccourci</span> · variables · markdown · pièces jointes · multi-canal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {templates.length === 0 && (
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={handleSeedDefaults} disabled={seedingDefaults}>
                <Sparkles className="h-4 w-4" />Installer 15 templates par défaut
              </Button>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />Nouveau template
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total templates" value={templates.length} icon={Zap} accent="bg-indigo-500" deltaLabel={systemCount > 0 ? `${systemCount} par défaut` : undefined} />
        <StatCard label="Utilisations" value={totalUses} icon={BarChart3} accent="bg-blue-500" />
        <StatCard label="Utilisés (7j)" value={recentlyUsed} icon={Eye} accent="bg-emerald-500" />
        <StatCard label="Étiquettes" value={allTags.length} icon={Tag} accent="bg-amber-500" />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Zap className="h-4 w-4" />
              Templates
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">Total <span className="font-semibold text-indigo-600">{templates.length}</span></span>
            <span className="text-muted-foreground">Utilisations <span className="font-semibold text-blue-600">{totalUses}</span></span>
            <span className="ml-auto text-muted-foreground">7 derniers jours <span className="font-semibold text-emerald-600">{recentlyUsed}</span></span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Raccourci, titre, contenu, étiquette..." className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Étiquette" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes étiquettes</SelectItem>
              {allTags.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        <div className="flex bg-muted rounded-lg p-0.5">
          {[
            { k: "all" as const, l: "Tous" },
            { k: "active" as const, l: "Actifs" },
            { k: "inactive" as const, l: "Désactivés" },
          ].map((tab) => (
            <button key={tab.k} onClick={() => setFilterStatus(tab.k)}
              className={cn("px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap",
                filterStatus === tab.k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab.l}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <button type="button" onClick={toggleSelectAll}
            className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {filtered.every((t) => selectedIds.has(t.id)) ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />Annuler
            </Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer tous
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{templates.length === 0 ? "Aucun template — créez votre premier ou installez les défauts !" : "Aucun template trouvé"}</p>
          {templates.length === 0 && (
            <Button onClick={handleSeedDefaults} disabled={seedingDefaults} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
              <Sparkles className="h-4 w-4" />Installer les 15 templates par défaut
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => {
            const cat = CATEGORIES.find((c) => c.value === t.category);
            const isSelected = selectedIds.has(t.id);
            const attCount = t.defaultAttachmentsData?.length ?? 0;
            return (
              <Card key={t.id} className={cn(
                "p-4 hover:shadow-md transition-all flex flex-col",
                isSelected && "ring-2 ring-[#0F2D52]",
                !t.isActive && "opacity-60 bg-muted/30"
              )}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectId(t.id)} aria-label="Sélectionner" />
                    <button type="button" onClick={() => copyShortcut(t.shortcut)} title="Copier le raccourci"
                      className="font-mono text-xs px-2 py-0.5 rounded bg-[#0F2D52] text-white hover:bg-[#1a3a66]">
                      /{t.shortcut}
                    </button>
                    {t.isSystem && (
                      <span title="Template système" className="text-amber-600">
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                    {!t.isActive && (
                      <span title="Désactivé — n'apparaît pas dans le slash picker"
                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                        <PowerOff className="h-2.5 w-2.5" />Off
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => copyShortcut(t.shortcut)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />Copier raccourci
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDuplicate(t)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleTestSend(t)}>
                        <Send className="h-3.5 w-3.5 mr-2" />M&apos;envoyer un test
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setVersionsFor(t)}>
                        <History className="h-3.5 w-3.5 mr-2" />Historique
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => handleToggleActive(t)}>
                        {t.isActive
                          ? <><PowerOff className="h-3.5 w-3.5 mr-2" />Désactiver</>
                          : <><Power className="h-3.5 w-3.5 mr-2" />Activer</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDeleting(t)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="text-sm font-semibold mb-1">{t.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1 whitespace-pre-wrap">{t.body}</p>

                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52]">
                        {tag}
                      </span>
                    ))}
                    {t.tags.length > 4 && <span className="text-[9px] text-muted-foreground">+{t.tags.length - 4}</span>}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t text-[10px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {cat && (
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${cat.color}`}>
                        {t.category === "other" && t.categoryCustom ? t.categoryCustom : cat.label}
                      </span>
                    )}
                    {t.defaultChannel === "chat" && <span title="Chat" className="text-emerald-600"><MessageCircle className="h-3 w-3" /></span>}
                    {t.defaultChannel === "email" && <span title="Email" className="text-blue-600"><Mail className="h-3 w-3" /></span>}
                    {t.defaultChannel === "both" && <span title="Chat+Email" className="text-violet-600 flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /><Mail className="h-3 w-3" /></span>}
                    {attCount > 0 && <span title="Pièces jointes" className="text-muted-foreground flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{attCount}</span>}
                    {t.locale === "en" && <span className="text-[8px] px-1 py-0 rounded bg-muted font-mono">EN</span>}
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">{t.usageCount}× · {formatRelativeDate(t.lastUsedAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        submitting={submitting}
        values={{ shortcut: fShortcut, title: fTitle, body: fBody, category: fCategory, categoryCustom: fCategoryCustom, channel: fChannel, subject: fSubject, appendSig: fAppendSig, attachments: fAttachments, tags: fTags, locale: fLocale }}
        setters={{ setShortcut: setFShortcut, setTitle: setFTitle, setBody: setFBody, setCategory: setFCategory, setCategoryCustom: setFCategoryCustom, setChannel: setFChannel, setSubject: setFSubject, setAppendSig: setFAppendSig, setAttachments: setFAttachments, setTags: setFTags, setLocale: setFLocale }}
        onSubmit={handleCreate}
      />
      <TemplateFormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        mode="edit"
        submitting={submitting}
        values={{ shortcut: fShortcut, title: fTitle, body: fBody, category: fCategory, categoryCustom: fCategoryCustom, channel: fChannel, subject: fSubject, appendSig: fAppendSig, attachments: fAttachments, tags: fTags, locale: fLocale }}
        setters={{ setShortcut: setFShortcut, setTitle: setFTitle, setBody: setFBody, setCategory: setFCategory, setCategoryCustom: setFCategoryCustom, setChannel: setFChannel, setSubject: setFSubject, setAppendSig: setFAppendSig, setAttachments: setFAttachments, setTags: setFTags, setLocale: setFLocale }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Supprimer ce template ?"
        description={`Le template /${deleting?.shortcut} sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      {versionsFor && <VersionsDialog template={versionsFor} onClose={() => setVersionsFor(null)} onRestored={() => { setVersionsFor(null); router.refresh(); }} />}

      {ConfirmModal}
    </div>
  );
}

// ─── Form dialog ──────────────────────────────────────────
type FormValues = {
  shortcut: string; title: string; body: string;
  category: string; categoryCustom: string;
  channel: "chat" | "email" | "both" | "";
  subject: string; appendSig: boolean;
  attachments: MessageAttachment[]; tags: string[];
  locale: "fr" | "en";
};
type FormSetters = {
  setShortcut: (v: string) => void; setTitle: (v: string) => void; setBody: (v: string) => void;
  setCategory: (v: string) => void; setCategoryCustom: (v: string) => void;
  setChannel: (v: "chat" | "email" | "both" | "") => void;
  setSubject: (v: string) => void; setAppendSig: (v: boolean) => void;
  setAttachments: (v: MessageAttachment[]) => void; setTags: (v: string[]) => void;
  setLocale: (v: "fr" | "en") => void;
};

function TemplateFormDialog({
  open, onOpenChange, mode, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  submitting: boolean;
  values: FormValues;
  setters: FormSetters;
  onSubmit: () => void;
}) {
  const isCreate = mode === "create";
  const [showPreview, setShowPreview] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const previewBody = useMemo(() => {
    return expandTemplateVariables(values.body, {
      clientName: "Jean Tremblay",
      clientFirstName: "Jean",
      clientLastName: "Tremblay",
      clientCompany: "ACME Inc.",
      clientEmail: "jean@acme.com",
      adminName: "Yan Verone",
      adminEmail: "yan@vnkautomatisation.ca",
      quoteNumber: "D-2026-001",
      quoteAmount: "1 250,00 $",
      invoiceNumber: "F-2026-042",
      invoiceAmount: "874,33 $",
      invoiceDueDate: "15 juin 2026",
      contractNumber: "CT-2026-007",
      appointmentDate: "12 mai 2026",
      appointmentTime: "10:00",
    });
  }, [values.body]);

  const previewSubject = useMemo(() => {
    if (!values.subject) return "";
    return expandTemplateVariables(values.subject, {
      clientName: "Jean Tremblay",
      clientCompany: "ACME Inc.",
      quoteNumber: "D-2026-001",
      invoiceNumber: "F-2026-042",
      contractNumber: "CT-2026-007",
    });
  }, [values.subject]);

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (!clean || values.tags.includes(clean) || values.tags.length >= 15) return;
    setters.setTags([...values.tags, clean]);
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <Plus className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">{isCreate ? "Nouveau template" : "Modifier le template"}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                Le raccourci s&apos;utilise dans le chat avec <span className="font-mono">/raccourci</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title="Identité" icon={<Zap className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Raccourci *</Label>
                <Input
                  value={values.shortcut}
                  onChange={(e) => setters.setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="devis_pret" className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Lettres, chiffres, _ et - uniquement</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Catégorie</Label>
                <Select value={values.category} onValueChange={setters.setCategory}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                {values.category === "other" && (
                  <Input
                    value={values.categoryCustom}
                    onChange={(e) => setters.setCategoryCustom(e.target.value)}
                    placeholder="Nom personnalisé (ex: Onboarding)"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Devis prêt à signer" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Étiquettes</Label>
              <div className="flex gap-1 flex-wrap mb-1">
                {values.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center gap-1">
                    {tag}
                    <button type="button" onClick={() => setters.setTags(values.tags.filter((t) => t !== tag))} className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value.toLowerCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="onboarding, devis, urgent…"
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>+</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Canal par défaut</Label>
                <Select value={values.channel || "none"} onValueChange={(v) => setters.setChannel(v === "none" ? "" : v as "chat" | "email" | "both")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="chat">Chat (portail)</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="both">Chat + Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground"><Globe className="h-3 w-3 inline mr-1" />Langue</Label>
                <Select value={values.locale} onValueChange={(v) => setters.setLocale(v as "fr" | "en")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch id="append-sig" checked={values.appendSig} onCheckedChange={setters.setAppendSig} />
                <Label htmlFor="append-sig" className="text-xs cursor-pointer">Ajouter signature auto</Label>
              </div>
            </div>
          </FormSection>

          {(values.channel === "email" || values.channel === "both") && (
            <FormSection title="Email" icon={<Mail className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sujet de l&apos;email</Label>
                <Input
                  value={values.subject}
                  onChange={(e) => setters.setSubject(e.target.value)}
                  placeholder="Votre devis {{quote_number}} est prêt"
                />
                <p className="text-[10px] text-muted-foreground">Variables supportées dans le sujet</p>
              </div>
            </FormSection>
          )}

          <FormSection title="Contenu (markdown + variables)" icon={<Pencil className="h-3.5 w-3.5" />}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Tape <span className="font-mono">{`{{`}</span> pour autocomplete · <span className="font-mono">**gras**</span> · <span className="font-mono">*italique*</span> · <span className="font-mono">{`{{#if x}}…{{/if}}`}</span> bloc conditionnel
              </p>
              <button type="button" onClick={() => setShowPreview((v) => !v)}
                className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-colors ${showPreview ? "bg-[#0F2D52] text-white border-[#0F2D52]" : "hover:bg-muted"}`}>
                <Eye className="h-3 w-3" />Aperçu
              </button>
            </div>
            <TemplateBodyEditor value={values.body} onChange={setters.setBody} />

            {showPreview && (
              <div className="rounded-lg border-2 border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] mb-2 flex items-center gap-1">
                  <Eye className="h-3 w-3" />Aperçu (Jean Tremblay / ACME Inc.)
                </p>
                {previewSubject && (
                  <div className="mb-2 px-2 py-1 bg-white border rounded text-xs">
                    <span className="text-muted-foreground">Sujet : </span>
                    <span className="font-medium">{previewSubject}</span>
                  </div>
                )}
                <div className="bg-white rounded-md border p-3">
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    style={{ whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(previewBody) || "<em style='color:#94a3b8'>(Le corps est vide)</em>" }}
                  />
                </div>
              </div>
            )}
          </FormSection>

          <FormSection title="Pièces jointes par défaut" icon={<Paperclip className="h-3.5 w-3.5" />}>
            <TemplateAttachmentsInput attachments={values.attachments} onChange={setters.setAttachments} />
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.shortcut.trim() || !values.title.trim() || !values.body.trim()}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le template" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Versions dialog ───────────────────────────────────────
function VersionsDialog({ template, onClose, onRestored }: { template: Template; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<{ id: number; body: string; emailSubject: string | null; editedBy: string | null; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/message-templates/${template.id}/versions`)
      .then((r) => r.ok ? r.json() : { versions: [] })
      .then((d) => { setVersions(d.versions ?? []); setLoading(false); });
  }, [template.id]);

  const restore = async (versionId: number) => {
    const res = await fetch(`/api/message-templates/${template.id}/versions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (res.ok) { toast.success("Version restaurée"); onRestored(); }
    else { toast.error("Erreur"); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-4 text-white shrink-0">
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <History className="h-5 w-5" />Historique — /{template.shortcut}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-0.5 text-xs">
            La version actuelle est sauvegardée avant chaque restauration
          </DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune version antérieure</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-lg border p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("fr-CA")} · par {v.editedBy ?? "système"}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(v.id)} className="h-7 text-xs">
                    <Download className="h-3 w-3 mr-1" />Restaurer
                  </Button>
                </div>
                {v.emailSubject && <p className="text-xs italic text-muted-foreground mb-1">Sujet : {v.emailSubject}</p>}
                <pre className="text-xs whitespace-pre-wrap line-clamp-6 bg-background border rounded p-2">{v.body}</pre>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="px-4 py-3 border-t bg-card shrink-0">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

void FileText;
