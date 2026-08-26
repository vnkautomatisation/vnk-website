"use client";
// Vue RH Équipement — 2 onglets (Actifs / Retournés), assignation + retour.
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, Laptop, Smartphone, Wrench, HardHat, Car, CreditCard,
  Plus, Edit, Trash2, PackageOpen, Search, Package, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { FormSection, Field } from "@/components/admin/form-section";
import {
  upsertEquipmentAction, returnEquipmentAction, deleteEquipmentAction,
} from "@/app/actions/hr-employee-file";

type EmpLite = { id: number; fullName: string | null; email: string };
type Equipment = {
  id: number;
  adminId: number;
  category: string;
  name: string;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedAt: string;
  returnedAt: string | null;
  conditionOnReturn: string | null;
  value: number | null;
  notes: string | null;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
};

type Category = "laptop" | "phone" | "tool" | "epi" | "vehicle" | "card" | "license" | "other";

const CAT_META: Record<string, { label: string; icon: LucideIcon }> = {
  laptop: { label: "Ordinateur", icon: Laptop },
  phone: { label: "Téléphone", icon: Smartphone },
  tool: { label: "Outil", icon: Wrench },
  epi: { label: "EPI", icon: HardHat },
  vehicle: { label: "Véhicule", icon: Car },
  card: { label: "Carte corpo", icon: CreditCard },
  license: { label: "Licence logiciel", icon: Briefcase },
  other: { label: "Autre", icon: Briefcase },
};

type Tab = "active" | "returned";

export function EquipmentView({
  items, employees, isHr,
}: {
  items: Equipment[];
  employees: EmpLite[];
  isHr: boolean;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [editDialog, setEditDialog] = useState<{ open: boolean; existing: Equipment | null }>({ open: false, existing: null });
  const [returnDialog, setReturnDialog] = useState<Equipment | null>(null);
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "lost">("good");
  const [deleteConfirm, setDeleteConfirm] = useState<Equipment | null>(null);

  const [searchEmp, setSearchEmp] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const activeItems = useMemo(() => items.filter((i) => !i.returnedAt), [items]);
  const returnedItems = useMemo(() => items.filter((i) => i.returnedAt), [items]);

  const currentList = tab === "active" ? activeItems : returnedItems;

  const filtered = useMemo(() => {
    const q = searchEmp.trim().toLowerCase();
    return currentList.filter((i) => {
      if (filterCat !== "all" && i.category !== filterCat) return false;
      if (q) {
        const name = (i.admin.fullName || i.admin.email).toLowerCase();
        const label = i.name.toLowerCase();
        if (!name.includes(q) && !label.includes(q)) return false;
      }
      return true;
    });
  }, [currentList, searchEmp, filterCat]);

  const TABS: TabItem<Tab>[] = [
    { key: "active", label: "Actifs", icon: Package, count: activeItems.length },
    { key: "returned", label: "Retournés", icon: PackageOpen, count: returnedItems.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-[#0F2D52]" />
            Équipement attribué
          </h1>
          <p className="text-sm text-muted-foreground">
            Matériel d&apos;entreprise sous la responsabilité des employés. Géré par les RH.
          </p>
        </div>
        {isHr && (
          <Button onClick={() => setEditDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Assigner du matériel
          </Button>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="Rechercher employé ou matériel..."
              className="h-9 text-sm pl-7"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(CAT_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {currentList.length === 0
            ? tab === "active"
              ? "Aucun équipement assigné actuellement."
              : "Aucun équipement retourné."
            : "Aucun résultat avec ces filtres."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((eq) => (
            <EquipmentCard
              key={eq.id}
              eq={eq}
              isHr={isHr}
              onEdit={() => setEditDialog({ open: true, existing: eq })}
              onReturn={() => { setReturnCondition("good"); setReturnDialog(eq); }}
              onDelete={() => setDeleteConfirm(eq)}
            />
          ))}
        </div>
      )}

      <EquipmentDialog
        open={editDialog.open}
        existing={editDialog.existing}
        employees={employees}
        onClose={() => setEditDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!returnDialog}
        onOpenChange={(o) => !o && setReturnDialog(null)}
        title={`Marquer comme retourné ?`}
        description={returnDialog ? `${returnDialog.name} — ${returnDialog.admin.fullName || returnDialog.admin.email}` : ""}
        confirmLabel="Marquer retourné"
        variant="default"
        onConfirm={async () => {
          if (!returnDialog) return;
          const r = await returnEquipmentAction({ id: returnDialog.id, condition: returnCondition });
          if (r.success) { toast.success("Équipement retourné"); router.refresh(); }
          else toast.error(r.error || "Erreur");
          setReturnDialog(null);
        }}
      >
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">État au retour</label>
          <Select value={returnCondition} onValueChange={(v) => setReturnCondition(v as "good" | "damaged" | "lost")}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Bon état</SelectItem>
              <SelectItem value="damaged">Endommagé</SelectItem>
              <SelectItem value="lost">Perdu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
        title={`Supprimer cet équipement ?`}
        description={deleteConfirm ? `${deleteConfirm.name} — supprimera l'enregistrement définitivement.` : ""}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!deleteConfirm) return;
          const r = await deleteEquipmentAction({ id: deleteConfirm.id });
          if (r.success) { toast.success("Équipement supprimé"); router.refresh(); }
          else toast.error(r.error || "Erreur");
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}

function EquipmentCard({
  eq, isHr, onEdit, onReturn, onDelete,
}: {
  eq: Equipment;
  isHr: boolean;
  onEdit: () => void;
  onReturn: () => void;
  onDelete: () => void;
}) {
  const tc = useTranslations("common");
  const meta = CAT_META[eq.category] ?? CAT_META.other;
  const Icon = meta.icon;
  const isReturned = !!eq.returnedAt;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {eq.admin.avatarUrl ? (
            <img
              src={eq.admin.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-[#0F2D52]/10 flex items-center justify-center text-[#0F2D52] font-semibold text-sm shrink-0">
              {(eq.admin.fullName || eq.admin.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{eq.admin.fullName || eq.admin.email}</p>
            <p className="text-[11px] text-muted-foreground truncate">{eq.admin.email}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            <Icon className="h-3 w-3 mr-1" />{meta.label}
          </Badge>
        </div>

        <div className="border-t pt-2 space-y-1">
          <p className="font-bold text-sm">{eq.name}</p>
          {(eq.brand || eq.model) && (
            <p className="text-xs text-muted-foreground">{[eq.brand, eq.model].filter(Boolean).join(" · ")}</p>
          )}
          {eq.serialNumber && (
            <p className="text-[11px] font-mono text-muted-foreground">S/N : {eq.serialNumber}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Assigné le {new Date(eq.assignedAt).toLocaleDateString("fr-CA")}
          </p>
          {isReturned && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Retourné {new Date(eq.returnedAt!).toLocaleDateString("fr-CA")}
              </Badge>
              {eq.conditionOnReturn && (
                <Badge variant="outline" className={`text-[10px] ${
                  eq.conditionOnReturn === "good" ? "text-emerald-700 border-emerald-300 bg-emerald-50" :
                  eq.conditionOnReturn === "damaged" ? "text-amber-700 border-amber-300 bg-amber-50" :
                  "text-red-700 border-red-300 bg-red-50"
                }`}>
                  {eq.conditionOnReturn === "good" ? "Bon état" : eq.conditionOnReturn === "damaged" ? "Endommagé" : "Perdu"}
                </Badge>
              )}
            </div>
          )}
          {eq.notes && <p className="text-[11px] italic text-muted-foreground">{eq.notes}</p>}
        </div>

        {isHr && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
              <Edit className="h-3 w-3 mr-1" />{tc("edit")}
            </Button>
            {!isReturned && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReturn}>
                <PackageOpen className="h-3 w-3 mr-1" />Marquer retourné
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs hover:text-destructive ml-auto"
              onClick={onDelete}
              aria-label={tc("delete")}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function EquipmentDialog({
  open, existing, employees, onClose, onSaved,
}: {
  open: boolean;
  existing: Equipment | null;
  employees: EmpLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [category, setCategory] = useState<Category>("laptop");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assignedAt, setAssignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setEmployeeId(String(existing.adminId));
      setCategory(existing.category as Category);
      setName(existing.name);
      setBrand(existing.brand ?? "");
      setModel(existing.model ?? "");
      setSerialNumber(existing.serialNumber ?? "");
      setAssignedAt(new Date(existing.assignedAt).toISOString().slice(0, 10));
      setValue(existing.value != null ? String(existing.value) : "");
      setNotes(existing.notes ?? "");
    } else {
      setEmployeeId("");
      setCategory("laptop");
      setName("");
      setBrand("");
      setModel("");
      setSerialNumber("");
      setAssignedAt(new Date().toISOString().slice(0, 10));
      setValue("");
      setNotes("");
    }
  }, [open, existing]);

  const submit = async () => {
    if (!employeeId || !name.trim()) {
      toast.error("Employé et étiquette requis");
      return;
    }
    setPending(true);
    const r = await upsertEquipmentAction({
      id: existing?.id,
      adminId: Number(employeeId),
      category,
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      serialNumber: serialNumber.trim() || null,
      assignedAt,
      value: value ? Number(value) : null,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (r.success) {
      toast.success(existing ? "Équipement modifié" : "Équipement assigné");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Package className="h-4 w-4" />
              {existing ? "Modifier l'équipement" : "Assigner du matériel"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {existing ? "Mettre à jour les informations de l'équipement assigné." : "Attribuer un équipement à un employé. Tracé pour responsabilité."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <FormSection icon={Package} title="Attribution">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Employé" required>
                <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!existing}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Type" required>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAT_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Étiquette / Nom" required hint="Ex : MacBook Pro 14 M3">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" placeholder="MacBook Pro 14 M3" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Marque">
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 text-sm" placeholder="Apple" />
              </Field>
              <Field label="Modèle">
                <Input value={model} onChange={(e) => setModel(e.target.value)} className="h-9 text-sm" placeholder="A2918" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={Briefcase} title="Détails">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Numéro de série">
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="h-9 text-sm font-mono" placeholder="SN-..." />
              </Field>
              <Field label="Date assignation">
                <Input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} className="h-9 text-sm" />
              </Field>
              <Field label="Valeur ($)">
                <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-sm" placeholder="—" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y"
                placeholder="Observations particulières, accessoires inclus..."
              />
            </Field>
          </FormSection>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "..." : existing ? "Enregistrer" : "Assigner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
