"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus, Edit, Trash2, CheckCircle2, AlertCircle, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SignaturePad } from "../contrats/signature-pad";
import { MarkdownView } from "@/components/admin/markdown-view";
import { upsertLegalDocAction, deleteLegalDocAction, signLegalDocAction } from "@/app/actions/hr-legal-docs";

type Template = {
  id: number;
  key: string;
  title: string;
  category: string;
  version: string;
  bodyMarkdown: string;
  isRequired: boolean;
  _count: { signatures: number };
};
type Signature = { templateId: number; version: string; signedAt: string };

export function LegalDocsView({
  templates, mySignatures, isHr,
}: {
  templates: Template[];
  mySignatures: Signature[];
  isHr: boolean;
}) {
  const router = useRouter();
  const [editDialog, setEditDialog] = useState<{ open: boolean; existing: Template | null }>({ open: false, existing: null });
  const [signDialog, setSignDialog] = useState<Template | null>(null);
  const [confirmDel, setConfirmDel] = useState<Template | null>(null);

  const signedIds = new Map(mySignatures.map((s) => [s.templateId, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#0F2D52]" />
            Documents légaux
          </h1>
          <p className="text-sm text-muted-foreground">
            NDA, politiques, codes de conduite — chaque employé doit signer les documents obligatoires.
          </p>
        </div>
        {isHr && (
          <Button onClick={() => setEditDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Nouveau document
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((t) => {
          const signed = signedIds.get(t.id);
          const upToDate = signed && signed.version === t.version;
          return (
            <Card key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm">{t.title}</h3>
                    {t.isRequired && <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50">Obligatoire</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    v{t.version} · {t.category} · {t._count.signatures} signature{t._count.signatures !== 1 ? "s" : ""}
                  </p>
                </div>
                {isHr && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDialog({ open: true, existing: t })} aria-label="Modifier">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(t)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground border-t pt-2 line-clamp-3">
                {t.bodyMarkdown.slice(0, 200)}…
              </div>

              <div className="flex items-center justify-between pt-1">
                {upToDate ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Signé le {new Date(signed.signedAt).toLocaleDateString("fr-CA")}
                  </Badge>
                ) : signed ? (
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Nouvelle version (v{t.version}) à signer
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertCircle className="h-3 w-3 mr-1" />Non signé
                  </Badge>
                )}
                {!upToDate && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => setSignDialog(t)}>
                    <FileSignature className="h-3 w-3 mr-1" />Lire & signer
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {templates.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground col-span-full">
            Aucun document légal défini.
          </Card>
        )}
      </div>

      {/* Edition template */}
      <EditDialog
        open={editDialog.open}
        existing={editDialog.existing}
        onClose={() => setEditDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      {/* Signature */}
      <SignDocDialog
        template={signDialog}
        onClose={() => setSignDialog(null)}
        onSigned={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.title} ?`}
        description="Si déjà signé par des employés, le document sera désactivé au lieu d'être supprimé."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const r = await deleteLegalDocAction({ id: confirmDel.id });
          if (r.success) { toast.success("Supprimé"); router.refresh(); } else toast.error(r.error || "");
          setConfirmDel(null);
        }}
      />
    </div>
  );
}

function EditDialog({
  open, existing, onClose, onSaved,
}: { open: boolean; existing: Template | null; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState(existing?.key ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "policy");
  const [version, setVersion] = useState(existing?.version ?? "1.0");
  const [body, setBody] = useState(existing?.bodyMarkdown ?? "");
  const [isRequired, setIsRequired] = useState(existing?.isRequired ?? true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setKey(existing?.key ?? "");
      setTitle(existing?.title ?? "");
      setCategory(existing?.category ?? "policy");
      setVersion(existing?.version ?? "1.0");
      setBody(existing?.bodyMarkdown ?? "");
      setIsRequired(existing?.isRequired ?? true);
    }
  }, [open, existing]);

  const submit = async () => {
    if (!key.trim() || !title.trim() || !body.trim()) { toast.error("Clé, titre et corps requis"); return; }
    setPending(true);
    const r = await upsertLegalDocAction({
      id: existing?.id,
      key: key.trim(),
      title: title.trim(),
      category: category as "policy" | "nda" | "acknowledgment",
      version: version.trim(),
      bodyMarkdown: body,
      isRequired,
    });
    setPending(false);
    if (r.success) { toast.success(existing ? "Modifié" : "Créé"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {existing ? "Modifier document légal" : "Nouveau document légal"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Si vous modifiez le contenu, augmentez la version (v1.0 → v1.1) pour forcer une re-signature.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Clé technique *</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="nda_principal"
                disabled={!!existing}
              />
              <p className="text-[10px] text-muted-foreground">Immuable une fois créé.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">Politique</SelectItem>
                  <SelectItem value="nda">NDA</SelectItem>
                  <SelectItem value="acknowledgment">Accusé de réception</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Accord de confidentialité (NDA)" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Version *</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} className="w-24" placeholder="1.0" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer h-9">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Document obligatoire</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Contenu Markdown *</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y"
              placeholder={"# Accord de confidentialité\n\n..."}
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : existing ? "Enregistrer" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignDocDialog({
  template, onClose, onSigned,
}: { template: Template | null; onClose: () => void; onSigned: () => void }) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);

  if (!template) return null;

  const submit = async () => {
    if (!acknowledged) { toast.error("Cochez « J'ai lu » pour confirmer"); return; }
    if (!signatureData) { toast.error("Signez avant de soumettre"); return; }
    setPending(true);
    const r = await signLegalDocAction({ templateId: template.id, signatureData });
    setPending(false);
    if (r.success) { toast.success("Document signé"); onSigned(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              {template.title} <span className="text-white/70 text-xs">v{template.version}</span>
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-lg border bg-muted/20 p-4 max-h-72 overflow-y-auto">
            <MarkdownView>{template.bodyMarkdown}</MarkdownView>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer p-3 rounded-md border bg-muted/10">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-input flex-shrink-0"
            />
            <span>
              J&apos;ai lu intégralement le document ci-dessus et j&apos;accepte ses termes en toute connaissance de cause.
            </span>
          </label>
          <SignaturePad onChange={setSignatureData} />
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || !acknowledged || !signatureData}>
            {pending ? "..." : "Confirmer ma signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
