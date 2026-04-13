"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Lock, Shield, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

type Invoice = {
  id: number;
  invoiceNumber: string;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  dueDate: string | null;
  createdAt: string;
  paidAt: string | null;
};

export function PaymentModal({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;

  const handleProceed = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error("URL de paiement non disponible");
          setLoading(false);
        }
      } else {
        toast.error("Erreur lors de la creation du paiement");
        setLoading(false);
      }
    } catch {
      toast.error("Erreur de connexion");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md">
        {/* Header */}
        <div className="bg-[#0F2D52] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Paiement de facture
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm mt-0.5">
                {invoice.invoiceNumber} — {invoice.title}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Invoice recap */}
        <div className="px-6 py-5 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant HT</span>
              <span className="font-medium">{formatCurrency(invoice.amountHt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TPS (5%)</span>
              <span className="font-medium">{formatCurrency(invoice.tpsAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVQ (9.975%)</span>
              <span className="font-medium">{formatCurrency(invoice.tvqAmount)}</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-muted-foreground">Total TTC</span>
              <span className="text-2xl font-bold text-[#0F2D52]">
                {formatCurrency(invoice.amountTtc)}
              </span>
            </div>
            {invoice.dueDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Echeance : {formatDate(new Date(invoice.dueDate))}
              </p>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="mx-6 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 px-4 py-3 flex gap-3 items-start">
          <div className="h-8 w-8 rounded-full bg-[#0F2D52]/10 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-[#0F2D52]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F2D52] flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Paiement securise via Stripe
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Vous allez etre redirige vers la page de paiement securisee Stripe
              pour completer la transaction.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 mt-2 flex justify-end gap-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            className="bg-[#0F2D52] hover:bg-[#1a3a66]"
            onClick={handleProceed}
            disabled={loading}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {loading ? "Redirection..." : "Proceder au paiement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
