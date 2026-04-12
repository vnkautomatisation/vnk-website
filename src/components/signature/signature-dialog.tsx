"use client";
// Modal de signature de contrat — utilisable côté admin ET portail
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignatureCanvas } from "./signature-canvas";
import { FileSignature } from "lucide-react";

export function SignatureDialog({
  contractId,
  contractNumber,
  contractTitle,
  open,
  onOpenChange,
}: {
  contractId: number;
  contractNumber: string;
  contractTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

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
        throw new Error(err.error ?? "Erreur signature");
      }
      const data = await res.json();
      toast.success(
        data.fullySigned
          ? "Contrat signé par les deux parties — facture générée"
          : "Votre signature a été enregistrée"
      );
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg vnk-gradient flex items-center justify-center text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Signer le contrat</DialogTitle>
              <DialogDescription>
                {contractNumber} — {contractTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <SignatureCanvas
            onSave={handleSave}
            disabled={sending}
            legalText="les conditions du contrat"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
