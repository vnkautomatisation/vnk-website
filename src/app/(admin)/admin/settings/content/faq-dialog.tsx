"use client";
// Dialog création/édition d'une question FAQ.
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/admin/rich-editor";
import { createFaqAction, updateFaqAction } from "@/app/actions/cms";
import type { FaqRow } from "./content-view";

export function FaqDialog({
  open, onOpenChange, faq, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq: FaqRow | null;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const mode = faq ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("<p></p>");
  const [category, setCategory] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (faq) {
      setLocale(faq.locale as "fr" | "en");
      setQuestion(faq.question);
      setAnswer(faq.answer);
      setCategory(faq.category ?? "");
      setIsPublished(faq.isPublished);
    } else {
      setLocale("fr"); setQuestion(""); setAnswer("<p></p>");
      setCategory(""); setIsPublished(true);
    }
  }, [open, faq]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        locale, question, answer,
        category: category || null,
        isPublished,
      };
      const r = mode === "create"
        ? await createFaqAction(payload)
        : await updateFaqAction({ id: faq!.id, ...payload });
      if (r.success) {
        toast.success(mode === "create" ? "Question ajoutée" : "Question mise à jour");
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouvelle question" : "Modifier la question"}
            </DialogTitle>
            <p className="text-xs text-white/70">Foire aux questions</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Question *</Label>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Comment se déroule..." className="mt-1" />
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
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Catégorie</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Facturation, Technique..." className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Réponse *</Label>
            <div className="mt-1">
              <RichEditor value={answer} onChange={setAnswer} rows={8} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Visible sur le site</p>
              <p className="text-xs text-muted-foreground">Décocher pour masquer cette question</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !question.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
