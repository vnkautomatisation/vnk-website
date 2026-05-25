"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createJobCodeAction, updateJobCodeAction, deleteJobCodeAction, toggleJobCodeActiveAction,
} from "@/app/actions/hr-job-codes";

type Position = { id: number; name: string; color: string | null };
type JobCode = {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  position: Position;
  _count: { timeClocks: number };
};

export function JobCodesView({
  positions, jobCodes,
}: {
  positions: Position[];
  jobCodes: JobCode[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterPositionId, setFilterPositionId] = useState<string>("all");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [editing, setEditing] = useState<JobCode | null>(null);
  const [creating, setCreating] = useState(false);

  // Groupe par poste
  const grouped = useMemo(() => {
    const filtered = jobCodes.filter((jc) => {
      if (filterPositionId !== "all" && jc.position.id !== Number(filterPositionId)) return false;
      if (showOnlyActive && !jc.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return jc.code.toLowerCase().includes(q) || jc.label.toLowerCase().includes(q);
      }
      return true;
    });
    const map = new Map<number, { position: Position; codes: JobCode[] }>();
    for (const jc of filtered) {
      if (!map.has(jc.position.id)) map.set(jc.position.id, { position: jc.position, codes: [] });
      map.get(jc.position.id)!.codes.push(jc);
    }
    return Array.from(map.values()).sort((a, b) => a.position.name.localeCompare(b.position.name));
  }, [jobCodes, search, filterPositionId, showOnlyActive]);

  const handleToggle = async (id: number) => {
    const r = await toggleJobCodeActiveAction({ id });
    if (r.success) { toast.success(r.data.isActive ? "Code activé" : "Code désactivé"); router.refresh(); }
    else toast.error(r.error);
  };
  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Supprimer le code "${code}" ?`)) return;
    const r = await deleteJobCodeAction({ id });
    if (r.success) { toast.success("Code supprimé"); router.refresh(); }
    else toast.error(r.error);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">Codes de tâche</h1>
            <p className="text-xs text-white/80">Codes par poste. Obligatoires au pointage de l&apos;employé.</p>
          </div>
          <Button onClick={() => setCreating(true)} variant="secondary" size="sm">
            <Plus className="h-4 w-4 mr-1" />Nouveau code
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher code ou libellé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPositionId} onValueChange={setFilterPositionId}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les postes</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showOnlyActive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyActive((v) => !v)}
        >
          Actifs uniquement
        </Button>
      </div>

      {/* Liste groupée par poste */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun code. Cliquez sur <strong>Nouveau code</strong> pour en créer.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ position, codes }) => (
            <div key={position.id} className="rounded-lg border overflow-hidden">
              <div
                className="px-4 py-2 text-sm font-semibold flex items-center gap-2"
                style={{ backgroundColor: (position.color ?? "#0F2D52") + "15", color: position.color ?? "#0F2D52" }}
              >
                {position.name} <span className="text-xs font-normal text-muted-foreground">({codes.length})</span>
              </div>
              <div className="divide-y">
                {codes.map((jc) => (
                  <div key={jc.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{jc.code}</span>
                    <span className="flex-1 text-sm">{jc.label}</span>
                    {!jc.isActive && <Badge variant="outline" className="text-xs">Inactif</Badge>}
                    {jc._count.timeClocks > 0 && (
                      <span className="text-xs text-muted-foreground">{jc._count.timeClocks} usage(s)</span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(jc.id)} title={jc.isActive ? "Désactiver" : "Activer"}>
                      <Power className={`h-4 w-4 ${jc.isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(jc)} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(jc.id, jc.code)} title="Supprimer" disabled={jc._count.timeClocks > 0}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create */}
      {creating && (
        <JobCodeFormDialog
          positions={positions}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); router.refresh(); }}
        />
      )}

      {/* Modal Edit */}
      {editing && (
        <JobCodeFormDialog
          positions={positions}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Dialog form (create + edit) ─────────────────────────────
function JobCodeFormDialog({
  positions, existing, onClose, onSaved,
}: {
  positions: Position[];
  existing?: JobCode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(existing?.code ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [positionId, setPositionId] = useState<string>(existing ? String(existing.position.id) : "");
  const [sortOrder, setSortOrder] = useState(String(existing?.sortOrder ?? 0));
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!code.trim() || !label.trim() || !positionId) {
      toast.error("Tous les champs sont requis");
      return;
    }
    setPending(true);
    const r = existing
      ? await updateJobCodeAction({
          id: existing.id,
          code: code.trim().toUpperCase(),
          label: label.trim(),
          positionId: Number(positionId),
          sortOrder: Number(sortOrder) || 0,
        })
      : await createJobCodeAction({
          code: code.trim().toUpperCase(),
          label: label.trim(),
          positionId: Number(positionId),
          sortOrder: Number(sortOrder) || 0,
        });
    setPending(false);
    if (r.success) { toast.success(existing ? "Code mis à jour" : "Code créé"); onSaved(); }
    else toast.error(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier le code" : "Nouveau code de tâche"}</DialogTitle>
          <DialogDescription>Lié à un poste. Les employés du poste devront le choisir au pointage.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="jc-code">Code (lettres maj, chiffres, - et _)</Label>
            <Input
              id="jc-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="COMPTA-001"
              className="font-mono"
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-label">Libellé descriptif</Label>
            <Input
              id="jc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Saisie des écritures mensuelles"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Poste</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger><SelectValue placeholder="Choisir un poste…" /></SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-order">Ordre d&apos;affichage (optionnel)</Label>
            <Input
              id="jc-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "…" : (existing ? "Enregistrer" : "Créer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
