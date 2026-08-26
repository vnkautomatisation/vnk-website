"use client";
// Dialog création/édition d'un témoignage client.
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageSquareQuote, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createTestimonialAction, updateTestimonialAction } from "@/app/actions/cms";
import type { TestimonialRow } from "./content-view";

export function TestimonialDialog({
  open, onOpenChange, testimonial, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial: TestimonialRow | null;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const mode = testimonial ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientTitle, setClientTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isApproved, setIsApproved] = useState(true);
  const [locale, setLocale] = useState<"fr" | "en">("fr");

  useEffect(() => {
    if (!open) return;
    if (testimonial) {
      setClientName(testimonial.clientName);
      setClientCompany(testimonial.clientCompany ?? "");
      setClientTitle(testimonial.clientTitle ?? "");
      setContent(testimonial.content);
      setRating(testimonial.rating);
      setAvatarUrl(testimonial.avatarUrl ?? "");
      setIsFeatured(testimonial.isFeatured);
      setIsApproved(testimonial.isApproved);
      setLocale(testimonial.locale as "fr" | "en");
    } else {
      setClientName(""); setClientCompany(""); setClientTitle("");
      setContent(""); setRating(5); setAvatarUrl("");
      setIsFeatured(false); setIsApproved(true); setLocale("fr");
    }
  }, [open, testimonial]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        clientName,
        clientCompany: clientCompany || null,
        clientTitle: clientTitle || null,
        content,
        rating,
        avatarUrl: avatarUrl || null,
        isFeatured, isApproved, locale,
      };
      const r = mode === "create"
        ? await createTestimonialAction(payload)
        : await updateTestimonialAction({ id: testimonial!.id, ...payload });
      if (r.success) {
        toast.success(mode === "create" ? "Témoignage ajouté" : "Témoignage mis à jour");
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <MessageSquareQuote className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouveau témoignage" : testimonial?.clientName}
            </DialogTitle>
            <p className="text-xs text-white/70">Avis client à afficher sur le site</p>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nom du client *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jean Tremblay" className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Entreprise</Label>
              <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Acme Manufacturing" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Titre / Poste</Label>
              <Input value={clientTitle} onChange={(e) => setClientTitle(e.target.value)} placeholder="Directeur de production" className="mt-1" />
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
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avatar (URL)</Label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Témoignage *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} placeholder="Le projet d'automatisation a transformé..." className="mt-1 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">{content.length}/2000 caractères</p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Note</Label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                >
                  <Star className={cn("h-6 w-6 transition-colors", n <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Approuvé pour publication</p>
                <p className="text-xs text-muted-foreground">Décocher pour mettre en attente de modération</p>
              </div>
              <Switch checked={isApproved} onCheckedChange={setIsApproved} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Mettre en vitrine</p>
                <p className="text-xs text-muted-foreground">Affiché en priorité sur la page d&apos;accueil</p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !clientName.trim() || !content.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
