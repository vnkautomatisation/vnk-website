"use client";
// Dialog création/édition d'un code promo (DiscountCode).
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ticket, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createPromoAction, updatePromoAction } from "@/app/actions/services";
import type { PromoRow } from "./catalogs-view";

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function PromoDialog({
  open, onOpenChange, promo, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: PromoRow | null;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.catalogs");
  const tc = useTranslations("common");
  const mode = promo ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    if (!open) return;
    if (promo) {
      setCode(promo.code);
      setDescription(promo.description ?? "");
      setDiscountType(promo.discountType as "percent" | "fixed");
      setValue(promo.value);
      setMaxUses(promo.maxUses?.toString() ?? "");
      setValidFrom(promo.validFrom ? promo.validFrom.split("T")[0] : "");
      setValidUntil(promo.validUntil ? promo.validUntil.split("T")[0] : "");
    } else {
      setCode(generateCode()); setDescription("");
      setDiscountType("percent"); setValue("10");
      setMaxUses(""); setValidFrom(""); setValidUntil("");
    }
  }, [open, promo]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        code,
        description: description || null,
        discountType,
        value: Number(value),
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
      };
      const result =
        mode === "create"
          ? await createPromoAction(payload)
          : await updatePromoAction({ id: promo!.id, ...payload });
      if (result.success) {
        toast.success(mode === "create" ? t("code_promo_cree") : t("code_promo_mis_jour"));
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? t("nouveau_code_promo") : promo?.code}
            </DialogTitle>
            <p className="text-xs text-white/70">{t("reduction_applicable_devis_factures")}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("code")}</Label>
            <div className="flex gap-2 mt-1">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase" disabled={mode === "edit"} />
              {mode === "create" && (
                <Button type="button" variant="outline" size="icon" onClick={() => setCode(generateCode())} title={t("regenerer")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("type")}</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{t("pourcentage")}</SelectItem>
                  <SelectItem value="fixed">{t("montant_fixe")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Valeur ({discountType === "percent" ? "%" : "$"}) *
              </Label>
              <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("nb_apos_utilisations_max")}</Label>
            <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder={t("illimite")} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("valide_partir")}</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("valide_jusqu_apos")}</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !code.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? t("creer") : t("enregistrer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
