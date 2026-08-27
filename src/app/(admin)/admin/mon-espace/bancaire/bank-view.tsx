"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Lock, CheckCircle2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { upsertBankInfoAction } from "@/app/actions/hr-employee-file";

export function BankInfoView({ adminId, current }: {
  adminId: number;
  current: { institutionLabel: string | null; institutionMasked: string; transitMasked: string; accountMasked: string; verifiedAt: string | null } | null;
}) {
  const t = useTranslations("admin.my_dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState(!current);
  const [institutionLabel, setInstitutionLabel] = useState(current?.institutionLabel ?? "");
  const [institution, setInstitution] = useState("");
  const [transit, setTransit] = useState("");
  const [account, setAccount] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!institution || !transit || !account) { toast.error(t("tous_champs_requis")); return; }
    setPending(true);
    const r = await upsertBankInfoAction({
      adminId,
      institutionLabel: institutionLabel || undefined,
      institution: institution.trim(),
      transit: transit.trim(),
      account: account.trim(),
    });
    setPending(false);
    if (r.success) {
      toast.success(t("information_bancaire_enregistree"));
      setEditing(false);
      setInstitution(""); setTransit(""); setAccount("");
      router.refresh();
    } else toast.error(r.error || "");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#0F2D52]" />Information bancaire
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("compte_depot_direct_paie_donnees")}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-3 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span className="text-sm font-semibold">{t("chiffrement_actif")}</span>
          {current?.verifiedAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />{t("bank_view_verifie")}</span>
          )}
        </div>

        {!editing && current ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {current.institutionLabel && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("institution")}</p>
                  <p className="font-medium">{current.institutionLabel}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("n_apos_institution")}</p>
                <p className="font-mono">{current.institutionMasked}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("transit")}</p>
                <p className="font-mono">{current.transitMasked}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("n_compte")}</p>
                <p className="font-mono">{current.accountMasked}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setEditing(true)}>
              {tc("edit")}
            </Button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Lightbulb className="h-3.5 w-3.5 inline mr-1.5 text-amber-600" />{t("trouvez_numeros")} <strong>{t("cheque_specimen")}</strong>{t("bank_view_en_bas_ou_dans_votre_application_bancaire")}</div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("institution_banque")}</Label>
              <Input value={institutionLabel} onChange={(e) => setInstitutionLabel(e.target.value)} placeholder={t("ex_desjardins_banque_nationale")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">{t("n_apos_institution_2")}</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value.replace(/\D/g, ""))} maxLength={3} placeholder="815" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("3_chiffres")}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">{t("transit_2")}</Label>
                <Input value={transit} onChange={(e) => setTransit(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="30312" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("5_chiffres")}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">{t("n_compte_2")}</Label>
                <Input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} placeholder="1234567" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("7_12_chiffres")}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {current && (
                <Button variant="outline" onClick={() => setEditing(false)}>{tc("cancel")}</Button>
              )}
              <Button onClick={submit} disabled={pending}>
                {pending ? "..." : current ? t("mettre_jour") : t("enregistrer")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 inline mr-1.5 text-emerald-600" />{t("bank_view_vos_numeros_bancaires_sont_chiffres_avec_aes")}</p>
    </div>
  );
}
