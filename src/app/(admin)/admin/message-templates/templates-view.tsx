"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Plus, Search, Pencil, Trash2, Copy, MoreHorizontal, BarChart3, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { StatCard } from "@/components/admin/stat-card";
import { FormSection } from "@/components/admin/client-form-fields";
import { cn } from "@/lib/utils";

type Template = {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  category: string | null;
  usageCount: number;
  createdAt: string;
};

const CATEGORIES = [
  { value: "greetings", label: "Salutations" },
  { value: "followup", label: "Relance / Suivi" },
  { value: "billing", label: "Facturation" },
  { value: "scheduling", label: "Rendez-vous" },
  { value: "technical", label: "Technique" },
  { value: "other", label: "Autre" },
];

export function TemplatesView({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const { ConfirmModal } = useConfirm();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const [fShortcut, setFShortcut] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [fCategory, setFCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => { setFShortcut(""); setFTitle(""); setFBody(""); setFCategory(""); };

  const openEdit = (t: Template) => {
    setEditing(t);
    setFShortcut(t.shortcut);
    setFTitle(t.title);
    setFBody(t.body);
    setFCategory(t.category ?? "");
  };

  const handleCreate = async () => {
    if (submitting || !fShortcut.trim() || !fTitle.trim() || !fBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortcut: fShortcut.trim(),
          title: fTitle.trim(),
          body: fBody,
          category: fCategory || undefined,
        }),
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortcut: fShortcut.trim(),
          title: fTitle.trim(),
          body: fBody,
          category: fCategory || null,
        }),
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

  const copyShortcut = (sc: string) => {
    navigator.clipboard.writeText(`/${sc}`).then(() => toast.success(`/${sc} copié`));
  };

  const filtered = useMemo(() => {
    let r = templates;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) =>
        t.shortcut.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    }
    if (filterCat !== "all") r = r.filter((t) => (t.category ?? "other") === filterCat);
    return r;
  }, [templates, search, filterCat]);

  const totalUses = templates.reduce((s, t) => s + t.usageCount, 0);
  const mostUsed = [...templates].sort((a, b) => b.usageCount - a.usageCount)[0];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Templates de messages</h1>
              <p className="text-white/70 text-sm mt-0.5">Réponses rapides accessibles via <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">/raccourci</span> dans le chat</p>
            </div>
          </div>
          <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />Nouveau template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total templates" value={templates.length} icon={Zap} accent="bg-indigo-500" />
        <StatCard label="Utilisations totales" value={totalUses} icon={BarChart3} accent="bg-blue-500" />
        <StatCard label="Catégories" value={new Set(templates.map((t) => t.category ?? "other")).size} icon={Tag} accent="bg-emerald-500" />
        <StatCard label="Plus utilisé" value={mostUsed?.usageCount ?? 0} icon={Zap} accent="bg-amber-500" deltaLabel={mostUsed?.shortcut ? `/${mostUsed.shortcut}` : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Raccourci, titre, contenu..." className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{templates.length === 0 ? "Aucun template — créez votre premier !" : "Aucun template trouvé"}</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <Card key={t.id} className="p-4 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => copyShortcut(t.shortcut)}
                  title="Copier le raccourci"
                  className="font-mono text-xs px-2 py-0.5 rounded bg-[#0F2D52] text-white hover:bg-[#1a3a66]"
                >
                  /{t.shortcut}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => copyShortcut(t.shortcut)}>
                      <Copy className="h-3.5 w-3.5 mr-2" />Copier raccourci
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />Modifier
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
              <div className="flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-muted-foreground">
                {t.category && (
                  <span className="bg-muted px-1.5 py-0.5 rounded-full">{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</span>
                )}
                <span className="ml-auto">{t.usageCount} utilisation{t.usageCount > 1 ? "s" : ""}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        submitting={submitting}
        values={{ shortcut: fShortcut, title: fTitle, body: fBody, category: fCategory }}
        setters={{ setShortcut: setFShortcut, setTitle: setFTitle, setBody: setFBody, setCategory: setFCategory }}
        onSubmit={handleCreate}
      />
      <TemplateFormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        mode="edit"
        submitting={submitting}
        values={{ shortcut: fShortcut, title: fTitle, body: fBody, category: fCategory }}
        setters={{ setShortcut: setFShortcut, setTitle: setFTitle, setBody: setFBody, setCategory: setFCategory }}
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

      {ConfirmModal}
    </div>
  );
}

function TemplateFormDialog({
  open, onOpenChange, mode, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  submitting: boolean;
  values: { shortcut: string; title: string; body: string; category: string };
  setters: { setShortcut: (v: string) => void; setTitle: (v: string) => void; setBody: (v: string) => void; setCategory: (v: string) => void };
  onSubmit: () => void;
}) {
  const isCreate = mode === "create";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
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
          <FormSection title="Raccourci & titre" icon={<Zap className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Raccourci *</Label>
                <Input
                  value={values.shortcut}
                  onChange={(e) => setters.setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="devis_pret"
                  className="font-mono"
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
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Devis prêt à signer" />
            </div>
          </FormSection>
          <FormSection title="Contenu" icon={<Pencil className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Corps du message *</Label>
              <Textarea value={values.body} onChange={(e) => setters.setBody(e.target.value)} rows={10} placeholder="Bonjour, votre devis est prêt et disponible dans votre portail..." />
            </div>
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

void cn;
