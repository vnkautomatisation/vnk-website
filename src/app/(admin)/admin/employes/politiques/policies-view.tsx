"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus, Edit, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { upsertHrPolicyAction } from "@/app/actions/hr-communications";

type Policy = {
  id: number; key: string; title: string; version: string;
  bodyMarkdown: string; effectiveFrom: string; isActive: boolean;
  publisher: { fullName: string | null; email: string };
};

export function PoliciesAdminView({ policies }: { policies: Policy[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; existing: Policy | null }>({ open: false, existing: null });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-[#0F2D52]" />Politiques RH</h1>
          <p className="text-sm text-muted-foreground">
            Politiques internes (harcÃ¨lement, tÃ©lÃ©travail, IT, code de conduite) â€” consultables par tout le personnel.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, existing: null })}><Plus className="h-4 w-4 mr-1.5" />Nouvelle politique</Button>
      </div>

      {policies.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Aucune politique publiÃ©e.</Card>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{p.title}</h3>
                    <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                    {!p.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    En vigueur depuis le {new Date(p.effectiveFrom).toLocaleDateString("fr-CA")}
                    Â· clÃ© : <code className="bg-muted px-1 rounded text-[10px]">{p.key}</code>
                  </p>
                  <p className="text-sm mt-2 line-clamp-3">{p.bodyMarkdown}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, existing: p })} aria-label="Modifier">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PolicyDialog
        open={dialog.open}
        existing={dialog.existing}
        onClose={() => setDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function PolicyDialog({ open, existing, onClose, onSaved }: { open: boolean; existing: Policy | null; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState(existing?.key ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [version, setVersion] = useState(existing?.version ?? "1.0");
  const [body, setBody] = useState(existing?.bodyMarkdown ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(existing?.effectiveFrom?.split("T")[0] ?? new Date().toISOString().slice(0, 10));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setKey(existing?.key ?? "");
      setTitle(existing?.title ?? "");
      setVersion(existing?.version ?? "1.0");
      setBody(existing?.bodyMarkdown ?? "");
      setEffectiveFrom(existing?.effectiveFrom?.split("T")[0] ?? new Date().toISOString().slice(0, 10));
      setIsActive(existing?.isActive ?? true);
    }
  }, [open, existing]);

  const submit = async () => {
    if (!key || !title || !body) { toast.error("Champs requis"); return; }
    setPending(true);
    const r = await upsertHrPolicyAction({
      id: existing?.id, key, title, version, bodyMarkdown: body, effectiveFrom, isActive,
    });
    setPending(false);
    if (r.success) { toast.success("EnregistrÃ©"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><FileText className="h-4 w-4" />{existing ? "Modifier" : "Nouvelle"} politique</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">ClÃ© technique *</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="harassment" disabled={!!existing} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Version *</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Politique de prÃ©vention du harcÃ¨lement" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">En vigueur depuis *</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-6">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Politique active
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Contenu Markdown *</Label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
