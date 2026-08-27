"use client";
// Bandeau permanent qui montre l'état de délégation de l'utilisateur courant.
//  - Outgoing : "Vous déléguez vos approbations à X jusqu'à nouvel ordre"
//  - Incoming : "Y vous a délégué ses approbations (en plus des vôtres)"
// Fetch GET /api/admin/me/delegation
// Modal "Gérer mes délégations" depuis le bandeau (réutilise delegateLeaveApprovalAction).
//
// Si pas de délégation outgoing ni incoming → ne render rien (collapsable).

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Shield, ShieldCheck, Pencil, UserMinus, UserPlus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { delegateLeaveApprovalAction } from "@/app/actions/hr-leaves";

export type DelegationState = {
  outgoing: {
    delegateAdmin: { id: number; fullName: string | null; email: string } | null;
  };
  incoming: Array<{ id: number; fullName: string | null; email: string }>;
};

type Candidate = { id: number; fullName: string | null; email: string };

export function DelegationBanner({ onChange }: { onChange?: () => void }) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [state, setState] = useState<DelegationState | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/me/delegation")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/admin/me/delegation/candidates")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([s, c]) => {
        if (s && typeof s === "object") setState(s as DelegationState);
        if (c && Array.isArray(c?.candidates)) setCandidates(c.candidates as Candidate[]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  if (loading || !state) return null;

  const hasOutgoing = !!state.outgoing?.delegateAdmin;
  const hasIncoming = (state.incoming?.length ?? 0) > 0;
  if (!hasOutgoing && !hasIncoming) return null;

  const handleSaved = () => {
    refresh();
    onChange?.();
  };

  return (
    <>
      <Card className="border-l-4 border-l-[#0F2D52] bg-gradient-to-r from-slate-50/60 to-transparent p-3 sm:p-4">
        <div className="space-y-2">
          {hasOutgoing && (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F2D52]">
                  {t("vous_deleguez_approbations")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  À <strong>{state.outgoing.delegateAdmin?.fullName || state.outgoing.delegateAdmin?.email}</strong>
                  {" "}jusqu&apos;à nouvel ordre.
                </p>
              </div>
              <ActionTooltip label={t("modifier_delegation")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageOpen(true)}
                  className="h-8 text-xs shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{tc("edit")}</span>
                </Button>
              </ActionTooltip>
            </div>
          )}
          {hasIncoming && (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  {t("n_delegations_recues", { count: state.incoming.length })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {state.incoming
                    .map((d) => d.fullName || d.email)
                    .join(", ")}
                  {" "}{t("vous_ont_delegue_approbations", { count: state.incoming.length })}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {manageOpen && (
        <ManageDelegationDialog
          currentDelegate={state.outgoing.delegateAdmin}
          candidates={candidates}
          onClose={() => setManageOpen(false)}
          onSaved={() => {
            setManageOpen(false);
            handleSaved();
          }}
        />
      )}
    </>
  );
}

function ManageDelegationDialog({
  currentDelegate,
  candidates,
  onClose,
  onSaved,
}: {
  currentDelegate: { id: number; fullName: string | null; email: string } | null;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [sel, setSel] = useState<string>(currentDelegate ? String(currentDelegate.id) : "");
  const [pending, startTransition] = useTransition();

  const save = (delegateId: number | null) => {
    startTransition(async () => {
      const r = await delegateLeaveApprovalAction({ delegateId });
      if (r.success) {
        toast.success(delegateId === null ? t("delegation_desactivee") : t("delegation_enregistree"));
        onSaved();
      } else {
        toast.error(r.error || t("erreur"));
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("gerer_mes_delegations")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("designez_collegue_pourra_approuver_conges")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          {currentDelegate && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              Délégué actuel :{" "}
              <strong className="text-[#0F2D52]">
                {currentDelegate.fullName || currentDelegate.email}
              </strong>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {currentDelegate ? t("changer_delegue") : t("designer_delegue")}
            </Label>
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("selectionner_administrateur")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground italic">
                    {t("aucun_candidat_eligible")}
                  </div>
                ) : (
                  candidates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.fullName || c.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap">
          {currentDelegate && (
            <Button
              variant="outline"
              onClick={() => save(null)}
              disabled={pending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <UserMinus className="h-3.5 w-3.5 mr-1" />
              {t("retirer")}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!sel) {
                toast.error(t("selectionnez_delegue"));
                return;
              }
              save(Number(sel));
            }}
            disabled={
              pending || !sel || String(currentDelegate?.id ?? "") === sel
            }
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                {currentDelegate ? t("mettre_jour") : t("activer")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
