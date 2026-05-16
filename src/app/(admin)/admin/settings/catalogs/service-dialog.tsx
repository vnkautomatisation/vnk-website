"use client";
// Dialog création/édition d'un service du ServiceCatalog.
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createServiceAction, updateServiceAction } from "@/app/actions/services";
import type { ServiceRow } from "./catalogs-view";

export function ServiceDialog({
  open, onOpenChange, service, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceRow | null;
  onSaved: () => void;
}) {
  const mode = service ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("0");
  const [priceUnit, setPriceUnit] = useState<"hour" | "fixed" | "day" | "month" | "year">("hour");
  const [currency, setCurrency] = useState("CAD");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    if (service) {
      setName(service.name);
      setDescription(service.description ?? "");
      setBasePrice(service.basePrice);
      setPriceUnit(service.priceUnit as typeof priceUnit);
      setCurrency(service.currency);
      setCategory(service.category ?? "");
    } else {
      setName(""); setDescription(""); setBasePrice("0");
      setPriceUnit("hour"); setCurrency("CAD"); setCategory("");
    }
  }, [open, service]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        name,
        description: description || null,
        basePrice: Number(basePrice),
        priceUnit,
        currency,
        category: category || null,
      };
      const result =
        mode === "create"
          ? await createServiceAction(payload)
          : await updateServiceAction({ id: service!.id, ...payload });
      if (result.success) {
        toast.success(mode === "create" ? "Service créé" : "Service mis à jour");
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
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouveau service" : service?.name}
            </DialogTitle>
            <p className="text-xs text-white/70">Catalogue de services facturables</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Audit B&R Automation" className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 text-sm" placeholder="Détail du service..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prix de base *</Label>
              <Input type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unité</Label>
              <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as typeof priceUnit)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Par heure</SelectItem>
                  <SelectItem value="day">Par jour</SelectItem>
                  <SelectItem value="fixed">Forfait</SelectItem>
                  <SelectItem value="month">Par mois</SelectItem>
                  <SelectItem value="year">Par année</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Catégorie</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Automatisation, Support, Formation..." className="mt-1" />
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
