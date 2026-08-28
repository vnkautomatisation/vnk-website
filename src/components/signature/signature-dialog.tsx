"use client";
// Modal de signature de contrat — design pro VNK
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignatureCanvas } from "./signature-canvas";
import { Button } from "@/components/ui/button";
import { FileSignature, X, ShieldCheck } from "lucide-react";


export function SignatureDialog({
  contractId,
  contractNumber,
  contractTitle,
  contractAmount,
  open,
  onOpenChange,
}: {
  contractId: number;
  contractNumber: string;
  contractTitle: string;
  contractAmount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const formatCurrency = useCurrency();

  const handleSave = async (signatureDataUrl: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData: signatureDataUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t("erreur_signature"));
      }
      const data = await res.json();
      toast.success(
        data.fullySigned
          ? t("contrat_signe_deux_parties")
          : t("signature_enregistree")
      );
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden z-[10015]">
        <DialogTitle className="sr-only">Signer le contrat {contractNumber}</DialogTitle>
        <DialogDescription className="sr-only">
          Apposez votre signature pour le contrat {contractTitle}
        </DialogDescription>
        {/* Header navy */}
        <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <FileSignature className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t("signer_le_contrat")}</h2>
              <p className="text-white/60 text-sm mt-0.5">
                {contractNumber} — {contractTitle}
              </p>
            </div>
          </div>
          {contractAmount != null && contractAmount > 0 && (
            <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 w-fit">
              <span className="text-white/70 text-sm">{t("montant_deux_points")}</span>
              <span className="text-white font-bold">{formatCurrency(contractAmount)}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <SignatureCanvas
            onSave={handleSave}
            disabled={sending}
            legalText={t("conditions_du_contrat")}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t("signature_juridiquement_valide")}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
