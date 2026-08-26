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
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState(!current);
  const [institutionLabel, setInstitutionLabel] = useState(current?.institutionLabel ?? "");
  const [institution, setInstitution] = useState("");
  const [transit, setTransit] = useState("");
  const [account, setAccount] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!institution || !transit || !account) { toast.error("Tous les champs requis"); return; }
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
      toast.success("Information bancaire enregistrée");
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
          Compte pour dépôt direct de votre paie. Données chiffrées au repos (AES-256).
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-3 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span className="text-sm font-semibold">Chiffrement actif</span>
          {current?.verifiedAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />Vérifié
            </span>
          )}
        </div>

        {!editing && current ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {current.institutionLabel && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Institution</p>
                  <p className="font-medium">{current.institutionLabel}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">N° d&apos;institution</p>
                <p className="font-mono">{current.institutionMasked}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Transit</p>
                <p className="font-mono">{current.transitMasked}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">N° de compte</p>
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
              <Lightbulb className="h-3.5 w-3.5 inline mr-1.5 text-amber-600" />Trouvez ces numéros sur un <strong>chèque spécimen</strong> (en bas) ou dans votre application bancaire.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Institution (banque)</Label>
              <Input value={institutionLabel} onChange={(e) => setInstitutionLabel(e.target.value)} placeholder="Ex : Desjardins, Banque Nationale" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">N° d&apos;institution *</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value.replace(/\D/g, ""))} maxLength={3} placeholder="815" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">3 chiffres</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">Transit *</Label>
                <Input value={transit} onChange={(e) => setTransit(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="30312" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">5 chiffres</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">N° de compte *</Label>
                <Input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} placeholder="1234567" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">7-12 chiffres</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {current && (
                <Button variant="outline" onClick={() => setEditing(false)}>{tc("cancel")}</Button>
              )}
              <Button onClick={submit} disabled={pending}>
                {pending ? "..." : current ? "Mettre à jour" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 inline mr-1.5 text-emerald-600" />Vos numéros bancaires sont chiffrés avec AES-256-GCM avant stockage. Seuls vous et les RH/comptabilité y avez accès.
        Les RH peuvent voir le compte masqué mais ne peuvent pas le déchiffrer sans la clé de production.
      </p>
    </div>
  );
}
