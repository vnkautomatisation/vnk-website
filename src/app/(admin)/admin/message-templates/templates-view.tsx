"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
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
  { value: "greetings", labelKey: "salutations", color: "bg-blue-100 text-blue-700" },
  { value: "followup", labelKey: "relance_suivi", color: "bg-amber-100 text-amber-700" },
  { value: "billing", labelKey: "facturation", color: "bg-emerald-100 text-emerald-700" },
  { value: "scheduling", labelKey: "rendez_vous", color: "bg-violet-100 text-violet-700" },
  { value: "technical", labelKey: "technique", color: "bg-indigo-100 text-indigo-700" },
  { value: "other", labelKey: "autre", color: "bg-gray-100 text-gray-700" },
];

function formatRelativeDate(iso: string | null, t: (k: string) => string): string {
  if (!iso) return t("jamais");
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("aujourd_hui");
  if (days === 1) return t("hier");
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
  return d.toLocaleDateString("fr-CA");
}

export function TemplatesView({ templates }: { templates: Template[] }) {
  const t = useTranslations("admin.message_templates");
  const tc = useTranslations("common");
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
      if (res.ok) { toast.success(t("template_cree")); setCreateOpen(false); resetForm(); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
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
      if (res.ok) { toast.success(t("template_modifie")); setEditing(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/message-templates/${deleting.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("template_supprime")); setDeleting(null); router.refresh(); }
    else { toast.error(t("erreur")); }
  };

  const handleDuplicate = async (tpl: Template) => {
    const res = await fetch(`/api/message-templates/${tpl.id}/duplicate`, { method: "POST" });
    if (res.ok) { toast.success(t("template_duplique")); router.refresh(); }
    else { toast.error(t("erreur")); }
  };

  const handleToggleActive = async (tpl: Template) => {
    const res = await fetch(`/api/message-templates/${tpl.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    if (res.ok) { toast.success(tpl.isActive ? t("template_desactive") : t("template_active")); router.refresh(); }
    else { toast.error(t("erreur")); }
  };

  const handleTestSend = async (tpl: Template) => {
    const ok = await confirm({
      title: t("envoyer_test_adresse"),
      description: t("template_sera_envoye_courriel_admin"),
      confirmLabel: t("envoyer_test"),
    });
    if (!ok) return;
    const res = await fetch(`/api/message-templates/${tpl.id}/test-send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) { const d = await res.json(); toast.success(`Test envoyé à ${d.sentTo}`); }
    else { const d = await res.json(); toast.error(d.error || t("erreur_smtp")); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} template(s) ?`,
      description: t("action_irreversible"),
      confirmLabel: t("supprimer_tous"),
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
      title: t("installer_15_templates_defaut"),
      description: t("idempotent_si_raccourci_existe_deja"),
      confirmLabel: t("installer"),
    });
    if (!ok) return;
    setSeedingDefaults(true);
    try {
      const res = await fetch("/api/message-templates/seed-defaults", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        toast.success(`${d.created} ajouté(s) · ${d.skipped} ignoré(s) (déjà existant)`);
        router.refresh();
      } else { toast.error(t("erreur")); }
    } finally { setSeedingDefaults(false); }
  };

  const copyShortcut = (sc: string) => {
    navigator.clipboard.writeText(`/${sc}`).then(() => toast.success(`/${sc} copié`));
  };


  const allTags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);


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
              <h1 className="text-xl sm:text-2xl font-bold">{t("templates_messages")}</h1>
              <p className="text-white/70 text-sm mt-0.5">
                <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">/raccourci</span>{t("templates_view_variables_markdown_pieces_jointes_multi_canal")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {templates.length === 0 && (
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={handleSeedDefaults} disabled={seedingDefaults}>
                <Sparkles className="h-4 w-4" />{t("installer_15_templates_btn")}
              </Button>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />{t("nouveau_template")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("total_templates")} value={templates.length} icon={Zap} accent="bg-indigo-500" deltaLabel={systemCount > 0 ? t("n_par_defaut", { count: systemCount }) : undefined} />
        <StatCard label={t("utilisations")} value={totalUses} icon={BarChart3} accent="bg-blue-500" />
        <StatCard label={t("utilises_7j")} value={recentlyUsed} icon={Eye} accent="bg-emerald-500" />
        <StatCard label={t("etiquettes")} value={allTags.length} icon={Tag} accent="bg-amber-500" />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Zap className="h-4 w-4" />
              {t("templates")}
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">{t("total")} <span className="font-semibold text-indigo-600">{templates.length}</span></span>
            <span className="text-muted-foreground">{t("utilisations")} <span className="font-semibold text-blue-600">{totalUses}</span></span>
            <span className="ml-auto text-muted-foreground">{t("7_derniers_jours")} <span className="font-semibold text-emerald-600">{recentlyUsed}</span></span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("raccourci_titre_contenu_etiquette")} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("categorie")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("toutes_categories")}</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>))}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("etiquette")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_etiquettes")}</SelectItem>
              {allTags.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        <div className="flex bg-muted rounded-lg p-0.5">
          {[
            { k: "all" as const, l: t("tous") },
            { k: "active" as const, l: t("actifs") },
            { k: "inactive" as const, l: t("desactives") },
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
            {filtered.every((r) => selectedIds.has(r.id)) ? t("tout_deselectionner") : t("tout_selectionner")}
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
              <X className="h-3.5 w-3.5 mr-1" />{tc("cancel")}
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
          <p className="text-sm text-muted-foreground mb-4">{templates.length === 0 ? t("aucun_template_creez_premier_installez") : t("aucun_template_trouve")}</p>
          {templates.length === 0 && (
            <Button onClick={handleSeedDefaults} disabled={seedingDefaults} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
              <Sparkles className="h-4 w-4" />{t("installer_les_15_templates_defaut")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((tpl) => {
            const cat = CATEGORIES.find((c) => c.value === tpl.category);
            const isSelected = selectedIds.has(tpl.id);
            const attCount = tpl.defaultAttachmentsData?.length ?? 0;
            return (
              <Card key={tpl.id} className={cn(
                "p-4 hover:shadow-md transition-all flex flex-col",
                isSelected && "ring-2 ring-[#0F2D52]",
                !tpl.isActive && "opacity-60 bg-muted/30"
              )}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectId(tpl.id)} aria-label={t("selectionner")} />
                    <button type="button" onClick={() => copyShortcut(tpl.shortcut)} title={t("copier_raccourci")}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-[#0F2D52] text-white hover:bg-[#1a3a66]">
                      /{tpl.shortcut}
                    </button>
                    {tpl.isSystem && (
                      <span title={t("template_systeme")} className="text-amber-600">
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                    {!tpl.isActive && (
                      <span title={t("desactive_n_apparait_pas_slash")}
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
                      <DropdownMenuItem onSelect={() => copyShortcut(tpl.shortcut)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />Copier raccourci
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(tpl)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />{tc("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDuplicate(tpl)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleTestSend(tpl)}>
                        <Send className="h-3.5 w-3.5 mr-2" />{t("templates_view_m_envoyer_un_test")}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setVersionsFor(tpl)}>
                        <History className="h-3.5 w-3.5 mr-2" />Historique
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => handleToggleActive(tpl)}>
                        {tpl.isActive
                          ? <><PowerOff className="h-3.5 w-3.5 mr-2" />{t("desactiver")}</>
                          : <><Power className="h-3.5 w-3.5 mr-2" />{t("activer")}</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDeleting(tpl)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" />{tc("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="text-sm font-semibold mb-1">{tpl.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1 whitespace-pre-wrap">{tpl.body}</p>

                {tpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tpl.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52]">
                        {tag}
                      </span>
                    ))}
                    {tpl.tags.length > 4 && <span className="text-[9px] text-muted-foreground">+{tpl.tags.length - 4}</span>}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t text-[10px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {cat && (
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${cat.color}`}>
                        {tpl.category === "other" && tpl.categoryCustom ? tpl.categoryCustom : t(cat.labelKey)}
                      </span>
                    )}
                    {tpl.defaultChannel === "chat" && <span title={t("chat")} className="text-emerald-600"><MessageCircle className="h-3 w-3" /></span>}
                    {tpl.defaultChannel === "email" && <span title={t("email")} className="text-blue-600"><Mail className="h-3 w-3" /></span>}
                    {tpl.defaultChannel === "both" && <span title={t("chat_email_2")} className="text-violet-600 flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /><Mail className="h-3 w-3" /></span>}
                    {attCount > 0 && <span title={t("pieces_jointes")} className="text-muted-foreground flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{attCount}</span>}
                    {tpl.locale === "en" && <span className="text-[8px] px-1 py-0 rounded bg-muted font-mono">EN</span>}
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">{tpl.usageCount}× · {formatRelativeDate(tpl.lastUsedAt, t)}</span>
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
        title={t("supprimer_template")}
        description={`Le template /${deleting?.shortcut} sera supprimé définitivement.`}
        confirmLabel={tc("delete")}
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
  const t = useTranslations("admin.message_templates");
  const tc = useTranslations("common");
  const isCreate = mode === "create";
  const [showPreview, setShowPreview] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const previewBody = useMemo(() => {
    return expandTemplateVariables(values.body, {
      clientName: t("jean_tremblay"),
      clientFirstName: t("jean"),
      clientLastName: t("tremblay"),
      clientCompany: t("acme_inc"),
      clientEmail: "jean@acme.com",
      adminName: t("yan_verone"),
      adminEmail: "yan@vnkautomatisation.ca",
      quoteNumber: "D-2026-001",
      quoteAmount: "1 250,00 $",
      invoiceNumber: "F-2026-042",
      invoiceAmount: "874,33 $",
      invoiceDueDate: t("15_juin_2026"),
      contractNumber: t("ct_2026_007"),
      appointmentDate: t("12_mai_2026"),
      appointmentTime: "10:00",
    });
  }, [values.body]);

  const previewSubject = useMemo(() => {
    if (!values.subject) return "";
    return expandTemplateVariables(values.subject, {
      clientName: t("jean_tremblay"),
      clientCompany: t("acme_inc"),
      quoteNumber: "D-2026-001",
      invoiceNumber: "F-2026-042",
      contractNumber: t("ct_2026_007"),
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
              <DialogTitle className="text-white text-lg">{isCreate ? t("nouveau_template") : t("modifier_template")}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">{t("templates_view_le_raccourci_s_utilise_dans_le_chat")}<span className="font-mono">/raccourci</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title={t("identite")} icon={<Zap className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("raccourci")}</Label>
                <Input
                  value={values.shortcut}
                  onChange={(e) => setters.setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="devis_pret" className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">{t("lettres_chiffres_uniquement")}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("categorie")}</Label>
                <Select value={values.category} onValueChange={setters.setCategory}>
                  <SelectTrigger><SelectValue placeholder={t("choisir")} /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>))}
                  </SelectContent>
                </Select>
                {values.category === "other" && (
                  <Input
                    value={values.categoryCustom}
                    onChange={(e) => setters.setCategoryCustom(e.target.value)}
                    placeholder={t("nom_personnalise_ex_onboarding")}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("titre")}</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder={t("devis_pret_signer")} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("etiquettes")}</Label>
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
                  placeholder={t("onboarding_devis_urgent")}
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>+</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("canal_defaut")}</Label>
                <Select value={values.channel || "none"} onValueChange={(v) => setters.setChannel(v === "none" ? "" : v as "chat" | "email" | "both")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tc("none")}</SelectItem>
                    <SelectItem value="chat">{t("chat_portail")}</SelectItem>
                    <SelectItem value="email">{t("email")}</SelectItem>
                    <SelectItem value="both">{t("chat_email")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground"><Globe className="h-3 w-3 inline mr-1" />{t("langue")}</Label>
                <Select value={values.locale} onValueChange={(v) => setters.setLocale(v as "fr" | "en")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">{t("francais")}</SelectItem>
                    <SelectItem value="en">{t("english")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch id="append-sig" checked={values.appendSig} onCheckedChange={setters.setAppendSig} />
                <Label htmlFor="append-sig" className="text-xs cursor-pointer">{t("ajouter_signature_auto")}</Label>
              </div>
            </div>
          </FormSection>

          {(values.channel === "email" || values.channel === "both") && (
            <FormSection title={t("email")} icon={<Mail className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("sujet_apos_email")}</Label>
                <Input
                  value={values.subject}
                  onChange={(e) => setters.setSubject(e.target.value)}
                  placeholder={t("devis_quote_number_pret")}
                />
                <p className="text-[10px] text-muted-foreground">{t("variables_supportees_sujet")}</p>
              </div>
            </FormSection>
          )}

          <FormSection title={t("contenu_markdown_variables")} icon={<Pencil className="h-3.5 w-3.5" />}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Tape <span className="font-mono">{`{{`}</span> {t("autocomplete")} <span className="font-mono">{t("gras")}</span> · <span className="font-mono">{t("italique")}</span> · <span className="font-mono">{`{{#if x}}…{{/if}}`}</span> bloc conditionnel
              </p>
              <button type="button" onClick={() => setShowPreview((v) => !v)}
                className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-colors ${showPreview ? "bg-[#0F2D52] text-white border-[#0F2D52]" : "hover:bg-muted"}`}>
                <Eye className="h-3 w-3" />{t("templates_view_apercu")}</button>
            </div>
            <TemplateBodyEditor value={values.body} onChange={setters.setBody} />

            {showPreview && (
              <div className="rounded-lg border-2 border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] mb-2 flex items-center gap-1">
                  <Eye className="h-3 w-3" />{t("templates_view_apercu_jean_tremblay_acme_inc")}</p>
                {previewSubject && (
                  <div className="mb-2 px-2 py-1 bg-white border rounded text-xs">
                    <span className="text-muted-foreground">{t("sujet")} </span>
                    <span className="font-medium">{previewSubject}</span>
                  </div>
                )}
                <div className="bg-white rounded-md border p-3">
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    style={{ whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(previewBody) || "<em style='color:#94a3b8'>Corps vide</em>" }}
                  />
                </div>
              </div>
            )}
          </FormSection>

          <FormSection title={t("pieces_jointes_defaut")} icon={<Paperclip className="h-3.5 w-3.5" />}>
            <TemplateAttachmentsInput attachments={values.attachments} onChange={setters.setAttachments} />
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tc("cancel")}</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.shortcut.trim() || !values.title.trim() || !values.body.trim()}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? t("enregistrement_cours") : (isCreate ? t("creer_template") : t("enregistrer"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function VersionsDialog({ template, onClose, onRestored }: { template: Template; onClose: () => void; onRestored: () => void }) {
  const t = useTranslations("admin.message_templates");
  const tc = useTranslations("common");
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
    if (res.ok) { toast.success(t("version_restauree")); onRestored(); }
    else { toast.error(t("erreur")); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-4 text-white shrink-0">
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <History className="h-5 w-5" />Historique — /{template.shortcut}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-0.5 text-xs">
            {t("version_actuelle_sauvegardee_avant_chaque")}
          </DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tc("loading")}</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("aucune_version_anterieure")}</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-lg border p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("fr-CA")} · par {v.editedBy ?? t("systeme")}
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
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

void FileText;
