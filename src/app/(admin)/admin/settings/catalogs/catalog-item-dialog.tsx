"use client";
// Dialog création/édition d'un CatalogItem (tags, sources, industries, etc.)
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Tag, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCatalogItemAction, updateCatalogItemAction, type CatalogType } from "@/app/actions/catalogs";
import type { CatalogItemRow } from "./catalogs-view";

const COLORS = ["#0F2D52", "#1A5FB4", "#26A269", "#E5A50A", "#613583", "#C01C28", "#6b7280", "#9333ea"];

export function CatalogItemDialog({
  open, onOpenChange, item, type, typeLabel, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CatalogItemRow | null;
  type: string;
  typeLabel: string;
  onSaved: () => void;
}) {
  const mode = item ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState("");
  const [metaSymbol, setMetaSymbol] = useState(""); // pour devises uniquement
  const [metaIso, setMetaIso] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setDescription(item.description ?? "");
      setColor(item.color ?? COLORS[0]);
      setIcon(item.icon ?? "");
      const meta = item.metadata as Record<string, unknown> | null;
      setMetaSymbol((meta?.symbol as string) ?? "");
      setMetaIso((meta?.iso as string) ?? "");
    } else {
      setName(""); setDescription(""); setColor(COLORS[0]);
      setIcon(""); setMetaSymbol(""); setMetaIso("");
    }
  }, [open, item]);

  const handleSave = () => {
    startTransition(async () => {
      const metadata: Record<string, unknown> = {};
      if (type === "currency") {
        if (metaSymbol) metadata.symbol = metaSymbol;
        if (metaIso) metadata.iso = metaIso.toUpperCase();
      }
      const payload = {
        name,
        description: description || null,
        color,
        icon: icon || null,
        metadata,
      };
      const result =
        mode === "create"
          ? await createCatalogItemAction({ type: type as CatalogType, ...payload })
          : await updateCatalogItemAction({ id: item!.id, ...payload });
      if (result.success) {
        toast.success(mode === "create" ? "Élément créé" : "Élément mis à jour");
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
            <Tag className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? `Nouveau · ${typeLabel}` : item?.name}
            </DialogTitle>
            <p className="text-xs text-white/70">{typeLabel}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={item?.isSystem}
              placeholder={typeLabel.endsWith("s") ? typeLabel.slice(0, -1) : typeLabel}
              className="mt-1"
            />
            {item?.isSystem && (
              <p className="text-[10px] text-amber-700 mt-1">
                Nom verrouillé (élément système). Couleur et description modifiables.
              </p>
            )}
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>

          {/* Champs spécifiques aux devises */}
          {type === "currency" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Symbole</Label>
                <Input value={metaSymbol} onChange={(e) => setMetaSymbol(e.target.value)} placeholder="$" maxLength={5} className="mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Code ISO</Label>
                <Input value={metaIso} onChange={(e) => setMetaIso(e.target.value.toUpperCase())} placeholder="CAD" maxLength={3} className="mt-1 font-mono" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <Palette className="h-3 w-3 inline mr-1" />Couleur
            </Label>
            <div className="flex gap-1.5 mt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-md border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 font-mono text-xs" />
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Icône (optionnel)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Tag, Star, Globe..." className="mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Nom Lucide React ou emoji</p>
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
