"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, Edit, Trash2, Heart, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { upsertFamilyDependentAction, deleteFamilyDependentAction } from "@/app/actions/hr-employee-file";

type Dep = { id: number; type: string; fullName: string; birthdate: string | null; isInsured: boolean; isTaxDependent: boolean };

const TYPE_META: Record<string, { label: string; icon: typeof Heart }> = {
  spouse: { label: "Conjoint(e)", icon: Heart },
  child: { label: "Enfant", icon: Baby },
  other: { label: "Autre", icon: Users },
};

export function FamilyView({ adminId, dependents }: { adminId: number; dependents: Dep[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; existing: Dep | null }>({ open: false, existing: null });
  const [confirmDel, setConfirmDel] = useState<Dep | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#0F2D52]" />Famille / Dépendants
          </h1>
          <p className="text-sm text-muted-foreground">
            Conjoint(e) et enfants couverts par votre assurance collective ou déclarés au fisc.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, existing: null })}>
          <Plus className="h-4 w-4 mr-1.5" />Ajouter
        </Button>
      </div>

      {dependents.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aucun dépendant enregistré.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dependents.map((d) => {
            const meta = TYPE_META[d.type] ?? TYPE_META.other;
            const Icon = meta.icon;
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3 min-w-0">
                    <Icon className="h-5 w-5 text-[#0F2D52] mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">{d.fullName}</h3>
                      <p className="text-xs text-muted-foreground">{meta.label}{d.birthdate && ` · ${new Date(d.birthdate).toLocaleDateString("fr-CA")}`}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {d.isInsured && <Badge variant="outline" className="text-[10px]">Assuré</Badge>}
                        {d.isTaxDependent && <Badge variant="outline" className="text-[10px]">Dépendant fiscal</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, existing: d })} aria-label="Modifier">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(d)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DepDialog
        open={dialog.open}
        existing={dialog.existing}
        adminId={adminId}
        onClose={() => setDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.fullName} ?`}
        description="Ce dépendant sera retiré de votre dossier."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const r = await deleteFamilyDependentAction({ id: confirmDel.id, adminId });
          if (r.success) { toast.success("Supprimé"); router.refresh(); } else toast.error(r.error || "");
          setConfirmDel(null);
        }}
      />
    </div>
  );
}

function DepDialog({ open, existing, adminId, onClose, onSaved }: { open: boolean; existing: Dep | null; adminId: number; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState(existing?.type ?? "child");
  const [fullName, setFullName] = useState(existing?.fullName ?? "");
  const [birthdate, setBirthdate] = useState(existing?.birthdate?.split("T")[0] ?? "");
  const [isInsured, setIsInsured] = useState(existing?.isInsured ?? false);
  const [isTaxDependent, setIsTaxDependent] = useState(existing?.isTaxDependent ?? false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!fullName.trim()) { toast.error("Nom requis"); return; }
    setPending(true);
    const r = await upsertFamilyDependentAction({
      id: existing?.id,
      adminId,
      type: type as "spouse" | "child" | "other",
      fullName: fullName.trim(),
      birthdate: birthdate || null,
      isInsured,
      isTaxDependent,
    });
    setPending(false);
    if (r.success) { toast.success("Enregistré"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4" />{existing ? "Modifier" : "Nouveau"} dépendant
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Conjoint(e)</SelectItem>
                  <SelectItem value="child">Enfant</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Date de naissance</Label>
              <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Nom complet *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isInsured} onChange={(e) => setIsInsured(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Couvert par l&apos;assurance collective
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isTaxDependent} onChange={(e) => setIsTaxDependent(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Dépendant fiscal (pour T4/Relevé 1)
            </label>
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
