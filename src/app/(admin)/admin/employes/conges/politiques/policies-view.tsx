"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Plus, Edit2, Trash2, Star, Users, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import { useConfirm } from "@/hooks/use-confirm";
import {
  createLeavePolicyAction, updateLeavePolicyAction, deleteLeavePolicyAction, assignPolicyToAdminAction,
} from "@/app/actions/hr-leave-policies";

type Policy = {
  id: number;
  name: string;
  referenceMonthStart: number;
  accrualRateBelow3y: number;
  accrualRateAbove3y: number;
  vacationNoticeDays: number;
  minConsecutiveDays: number;
  maxConsecutiveDays: number;
  carryOverDays: number;
  carryOverMonths: number;
  sickDaysPerYear: number | null;
  personalDaysPerYear: number | null;
  isDefault: boolean;
};

type AdminLite = { id: number; fullName: string | null; email: string; leavePolicyId: number | null };

const MONTHS = ["", "Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

export function PoliciesView({ policies, admins }: { policies: Policy[]; admins: AdminLite[] }) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [editing, setEditing] = useState<Policy | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Sticky compress-on-scroll : sentinel + IntersectionObserver (pattern Finance).
  // rootMargin -64px top compense le topbar sticky (h-[64px], z-30) : le sentinel est
  // considéré "out" dès qu'il passe SOUS le topbar, pas seulement hors viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      {/* P1-5 : header navy gradient (pattern VNK) */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Politiques de congés</h1>
              <p className="text-xs text-white/80">
                Définissez les règles d&apos;accrual, carry-over, demi-journées (CNESST).
              </p>
            </div>
          </div>
          <Button
            onClick={() => setCreating(true)}
            variant="secondary"
            size="sm"
            className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />Nouvelle politique
          </Button>
        </div>
      </div>

      {/* Sentinel discret + sticky bar : on ne rend RIEN dans le flow tant que !scrolled
          (sinon vide fantôme entre hero et contenu). */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[108px] lg:top-[64px] z-20 py-2 bg-background shadow-sm border-b animate-overlay-fade-in">
          <div className="flex items-center gap-3 flex-wrap px-3">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Politiques de congés</span>
              <span className="sm:hidden">Politiques</span>
            </span>
            <div className="ml-auto">
              <Button
                size="sm"
                className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Nouvelle politique</span>
                <span className="sm:hidden">Nouvelle</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {policies.length === 0 ? (
          <Card className="p-10 text-center col-span-full">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#0F2D52]/10 flex items-center justify-center mb-3">
              <FileSearch className="h-6 w-6 text-[#0F2D52]" />
            </div>
            <p className="text-sm font-medium text-foreground">Aucune politique configuree</p>
            <p className="text-xs text-muted-foreground mt-1">
              Creez votre premiere politique CNESST pour fixer les regles d&apos;accumulation, quotas et reports.
            </p>
            <Button onClick={() => setCreating(true)} className="mt-4 bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
              <Plus className="h-4 w-4 mr-1.5" />Creer une politique
            </Button>
          </Card>
        ) : (
          policies.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              adminsCount={admins.filter((a) => a.leavePolicyId === p.id).length}
              busy={deletingId === p.id}
              onEdit={() => setEditing(p)}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Supprimer "${p.name}" ?`,
                  description: `Les employes lies repasseront sur la politique par defaut. Cette action est definitive.`,
                  variant: "destructive",
                  confirmLabel: "Supprimer",
                });
                if (!ok) return;
                setDeletingId(p.id);
                const res = await deleteLeavePolicyAction({ id: p.id });
                setDeletingId(null);
                if (res.success) { toast.success("Politique supprimee"); router.refresh(); }
                else toast.error(res.error || "Erreur lors de la suppression");
              }}
            />
          ))
        )}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F2D52]">Affectations</h2>
        </div>
        <div className="divide-y">
          {admins.map((a) => (
            <div key={a.id} className="py-2 flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{a.fullName || a.email}</span>
              <Select
                value={a.leavePolicyId ? String(a.leavePolicyId) : "none"}
                onValueChange={async (v) => {
                  const policyId = v === "none" ? null : Number(v);
                  const res = await assignPolicyToAdminAction({ adminId: a.id, policyId });
                  if (res.success) { toast.success("Mise à jour"); router.refresh(); }
                  else toast.error(res.error || "");
                }}
              >
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Aucune (défaut)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (défaut)</SelectItem>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      {creating && <PolicyDialog open onClose={() => setCreating(false)} onSaved={() => { setCreating(false); router.refresh(); }} />}
      {editing && <PolicyDialog open policy={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}

      {ConfirmModal}
    </div>
  );
}

function PolicyCard({ policy, adminsCount, onEdit, onDelete, busy }: {
  policy: Policy; adminsCount: number; onEdit: () => void; onDelete: () => void; busy?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#0F2D52]/10 text-[#0F2D52]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{policy.name}</h3>
            {policy.isDefault && <Badge className="text-[10px] bg-emerald-100 text-emerald-700"><Star className="h-2.5 w-2.5 mr-1" />Par défaut</Badge>}
            <Badge variant="outline" className="text-[10px]">{adminsCount} employé{adminsCount > 1 ? "s" : ""}</Badge>
          </div>
          <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
            <li>Période : 1<sup>er</sup> {MONTHS[policy.referenceMonthStart]} → 30 {MONTHS[((policy.referenceMonthStart - 2 + 12) % 12) + 1]}</li>
            <li>Accumulation : {policy.accrualRateBelow3y}% (&lt;3 ans) → {policy.accrualRateAbove3y}% (≥3 ans)</li>
            <li>Préavis vacances : {policy.vacationNoticeDays} jours</li>
            <li>Report max : {policy.carryOverDays} jours sur {policy.carryOverMonths} mois</li>
            {policy.sickDaysPerYear !== null && <li>Quota maladie : {policy.sickDaysPerYear} j/an</li>}
            {policy.personalDaysPerYear !== null && <li>Quota personnel : {policy.personalDaysPerYear} j/an</li>}
          </ul>
        </div>
        <div className="flex gap-1 shrink-0">
          <ActionTooltip label="Modifier cette politique">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onEdit} disabled={busy}>
              <Edit2 className="h-3 w-3" />
            </Button>
          </ActionTooltip>
          <ActionTooltip label="Supprimer cette politique">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </ActionTooltip>
        </div>
      </div>
    </Card>
  );
}

function PolicyDialog({ open, policy, onClose, onSaved }: { open: boolean; policy?: Policy; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(policy?.name ?? "");
  const [refMonth, setRefMonth] = useState(policy?.referenceMonthStart ?? 5);
  const [rateBelow, setRateBelow] = useState(policy?.accrualRateBelow3y ?? 4);
  const [rateAbove, setRateAbove] = useState(policy?.accrualRateAbove3y ?? 6);
  const [notice, setNotice] = useState(policy?.vacationNoticeDays ?? 7);
  const [minCons, setMinCons] = useState(policy?.minConsecutiveDays ?? 1);
  const [maxCons, setMaxCons] = useState(policy?.maxConsecutiveDays ?? 30);
  const [carryDays, setCarryDays] = useState(policy?.carryOverDays ?? 0);
  const [carryMonths, setCarryMonths] = useState(policy?.carryOverMonths ?? 12);
  const [sickQuota, setSickQuota] = useState<number | "">(policy?.sickDaysPerYear ?? "");
  const [personalQuota, setPersonalQuota] = useState<number | "">(policy?.personalDaysPerYear ?? "");
  const [isDefault, setIsDefault] = useState(policy?.isDefault ?? false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const payload = {
      name,
      referenceMonthStart: Number(refMonth),
      accrualRateBelow3y: Number(rateBelow),
      accrualRateAbove3y: Number(rateAbove),
      vacationNoticeDays: Number(notice),
      minConsecutiveDays: Number(minCons),
      maxConsecutiveDays: Number(maxCons),
      carryOverDays: Number(carryDays),
      carryOverMonths: Number(carryMonths),
      sickDaysPerYear: sickQuota === "" ? null : Number(sickQuota),
      personalDaysPerYear: personalQuota === "" ? null : Number(personalQuota),
      isDefault,
    };
    const res = policy
      ? await updateLeavePolicyAction({ id: policy.id, ...payload })
      : await createLeavePolicyAction(payload);
    setPending(false);
    if (res.success) { toast.success(policy ? "Mise à jour" : "Créée"); onSaved(); }
    else toast.error(res.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />{policy ? "Modifier la politique" : "Nouvelle politique"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Configurez les règles CNESST applicables à un groupe d&apos;employés.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <FormSection icon={ShieldCheck} title="Identité">
            <Field label="Nom" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Standard CNESST" /></Field>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
              <span>Politique par défaut (appliquée aux nouveaux employés)</span>
            </label>
          </FormSection>

          <FormSection icon={ShieldCheck} title="Période de référence">
            <Field label="Mois de début" hint="CNESST par défaut : Mai (5)">
              <Select value={String(refMonth)} onValueChange={(v) => setRefMonth(Number(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{MONTHS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection icon={ShieldCheck} title="Accumulation">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux <3 ans (%)" hint="CNESST : 4%"><Input type="number" step="0.1" value={rateBelow} onChange={(e) => setRateBelow(Number(e.target.value))} /></Field>
              <Field label="Taux ≥3 ans (%)" hint="CNESST : 6%"><Input type="number" step="0.1" value={rateAbove} onChange={(e) => setRateAbove(Number(e.target.value))} /></Field>
            </div>
          </FormSection>

          <FormSection icon={ShieldCheck} title="Règles d'utilisation">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Préavis vacances (j)"><Input type="number" value={notice} onChange={(e) => setNotice(Number(e.target.value))} /></Field>
              <Field label="Carry-over max (j)"><Input type="number" value={carryDays} onChange={(e) => setCarryDays(Number(e.target.value))} /></Field>
              <Field label="Min consécutifs (j)"><Input type="number" value={minCons} onChange={(e) => setMinCons(Number(e.target.value))} /></Field>
              <Field label="Max consécutifs (j)"><Input type="number" value={maxCons} onChange={(e) => setMaxCons(Number(e.target.value))} /></Field>
              <Field label="Carry-over durée (mois)"><Input type="number" value={carryMonths} onChange={(e) => setCarryMonths(Number(e.target.value))} /></Field>
            </div>
          </FormSection>

          <FormSection icon={ShieldCheck} title="Quotas (optionnels)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maladie (j/an)" hint="Laisser vide = pas de quota"><Input type="number" value={sickQuota} onChange={(e) => setSickQuota(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
              <Field label="Personnel (j/an)"><Input type="number" value={personalQuota} onChange={(e) => setPersonalQuota(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
            </div>
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button
            onClick={submit}
            disabled={pending || !name.trim()}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? "Enregistrement..." : (policy ? "Enregistrer" : "Creer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
