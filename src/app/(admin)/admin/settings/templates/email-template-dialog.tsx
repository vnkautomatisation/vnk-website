"use client";
// Dialog création/édition d'un EmailTemplate avec rich editor + variables.
import { useState, useEffect, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Mail, Code, Variable, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/admin/rich-editor";
import { upsertEmailTemplateAction } from "@/app/actions/templates";
import type { EmailTemplateRow } from "./templates-view";

export function EmailTemplateDialog({
  open, onOpenChange, template, defaultKey, defaultLabel, commonVars, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplateRow | null;
  defaultKey?: string;
  defaultLabel?: string;
  commonVars: Record<string, string>;
  onSaved: () => void;
}) {
  const mode = template ? "edit" : "create";
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"edit" | "text" | "vars" | "preview">("edit");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const [key, setKey] = useState("");
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [bodyText, setBodyText] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTab("edit");
    if (template) {
      setKey(template.key); setLocale(template.locale as "fr" | "en");
      setSubject(template.subject); setBodyHtml(template.bodyHtml);
      setBodyText(template.bodyText ?? ""); setIsEnabled(template.isEnabled);
    } else {
      setKey(defaultKey ?? ""); setLocale("fr");
      setSubject(""); setBodyHtml("<p>Bonjour {{client_name}},</p>\n<p></p>\n<p>Cordialement,<br />L'équipe VNK Automatisation</p>");
      setBodyText(""); setIsEnabled(true);
    }
  }, [open, template, defaultKey]);

  const handleSave = () => {
    startTransition(async () => {
      const r = await upsertEmailTemplateAction({
        ...(template?.id ? { id: template.id } : {}),
        key, locale, subject, bodyHtml,
        bodyText: bodyText || null,
        variables: commonVars,
        isEnabled,
      });
      if (r.success) {
        toast.success("Modèle enregistré");
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  const insertVar = (v: string) => {
    setBodyHtml((b) => `${b}{{${v}}}`);
  };

  // Génère le HTML de prévisualisation à chaque fois que l'onglet preview est ouvert
  useEffect(() => {
    if (tab !== "preview" || !open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/templates/email/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyHtml, subject, variables: commonVars }),
        });
        if (!res.ok) {
          toast.error("Erreur prévisualisation");
          return;
        }
        const html = await res.text();
        if (cancelled) return;
        // Créer un blob URL pour l'iframe
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) toast.error("Erreur réseau");
      }
    })();
    return () => { cancelled = true; };
  }, [tab, open, bodyHtml, subject, commonVars]);

  // Cleanup blob URL au démontage
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-500 flex items-center justify-center">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base">
              {defaultLabel ?? (mode === "create" ? "Nouveau modèle email" : template?.key)}
            </DialogTitle>
            <p className="text-xs text-white/70">Courriel transactionnel · variables : {`{{nom_variable}}`}</p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} aria-label="Activé" />
        </div>

        <div className="border-b px-6">
          <div className="flex gap-1">
            <button onClick={() => setTab("edit")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "edit" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              <Mail className="h-3.5 w-3.5 inline mr-1" />HTML
            </button>
            <button onClick={() => setTab("text")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "text" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              <Code className="h-3.5 w-3.5 inline mr-1" />Texte brut
            </button>
            <button onClick={() => setTab("vars")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "vars" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              <Variable className="h-3.5 w-3.5 inline mr-1" />Variables
            </button>
            <button onClick={() => setTab("preview")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "preview" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              <Eye className="h-3.5 w-3.5 inline mr-1" />Aperçu
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "edit" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Clé interne</Label>
                  <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))} disabled={mode === "edit"} className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Langue</Label>
                  <Select value={locale} onValueChange={(v) => setLocale(v as "fr" | "en")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Objet *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Votre devis #{{quote_number}} est prêt" className="mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Corps HTML *</Label>
                <div className="mt-1">
                  <RichEditor value={bodyHtml} onChange={setBodyHtml} rows={14} />
                </div>
              </div>
            </>
          )}

          {tab === "text" && (
            <>
              <p className="text-xs text-muted-foreground">
                Version texte du courriel pour les clients ayant désactivé HTML. Laissez vide pour génération automatique depuis le HTML.
              </p>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={18}
                placeholder="Bonjour {{client_name}},&#10;&#10;..."
                className="font-mono text-xs"
              />
            </>
          )}

          {tab === "preview" && (
            <div className="space-y-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">
                <Eye className="h-3.5 w-3.5 inline mr-1.5" />
                Aperçu avec données fictives (Jean Tremblay, Acme Inc., facture FAC-2026-0042...). Les variables sans valeur apparaissent surlignées en jaune.
              </div>
              <iframe
                ref={previewIframeRef}
                src={previewUrl}
                sandbox="allow-same-origin"
                className="w-full h-[500px] rounded-md border bg-white"
                title="Aperçu du courriel"
              />
            </div>
          )}

          {tab === "vars" && (
            <>
              <p className="text-xs text-muted-foreground">
                Cliquez sur une variable pour l&apos;insérer dans le corps HTML. Format : <code className="bg-muted px-1.5 py-0.5 rounded">{`{{nom_variable}}`}</code>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(commonVars).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => insertVar(key)}
                    className="flex items-center justify-between p-2.5 rounded-md border bg-card hover:bg-muted/40 text-left"
                  >
                    <div>
                      <code className="text-xs font-mono font-semibold text-[#0F2D52]">{`{{${key}}}`}</code>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Insérer</Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSave} disabled={pending || !key.trim() || !subject.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
