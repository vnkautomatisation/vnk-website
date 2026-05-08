"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Receipt, Calendar, User, ExternalLink, CreditCard, Send, AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase } from "@/components/admin/detail-panel-base";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { formatCurrency, formatDate } from "@/lib/utils";

type InvoiceFull = {
  id: number;
  invoiceNumber: string;
  title: string;
  description: string | null;
  status: string;
  amountHt: number | string;
  tpsAmount: number | string;
  tvqAmount: number | string;
  amountTtc: number | string;
  dueDate: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  client: { id: number; fullName: string; companyName: string | null; email: string };
};

export function InvoiceDetailPanel({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (!invoiceId || !open) return;
    setLoading(true);
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((data) => setInvoice(data.invoice))
      .finally(() => setLoading(false));
  }, [invoiceId, open]);

  const refresh = async () => {
    if (!invoiceId) return;
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    setInvoice(data.invoice);
    router.refresh();
  };

  const markPaid = async () => {
    if (!invoice) return;
    const ok = await confirm({
      title: "Marquer comme payee ?",
      description: `La facture ${invoice.invoiceNumber} sera marquee comme payee.`,
      confirmLabel: "Marquer payee",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, { method: "POST" });
      if (res.ok) { toast.success("Facture marquee payee"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const isOverdue = invoice?.status === "overdue";
  const isPaid = invoice?.status === "paid";

  return (
    <>
      <DetailPanelBase
        open={open}
        onOpenChange={onOpenChange}
        loading={loading || !invoice}
        title={invoice?.title ?? "Facture"}
        subtitle={invoice ? `${invoice.invoiceNumber} · ${invoice.client.fullName}` : undefined}
        icon={<Receipt className="h-7 w-7 text-white" />}
        preventClose={pdfOpen}
        headerActions={
          invoice ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => openEntity("client", invoice.client.id)}>
                <User className="h-3 w-3" />Voir client
              </Button>
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => setPdfOpen(true)}>
                <ExternalLink className="h-3 w-3" />PDF
              </Button>
              {!isPaid && (
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={markPaid}>
                  <CreditCard className="h-3 w-3" />Marquer payee
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => router.push(`/admin/messages?clientId=${invoice.client.id}`)}>
                <Send className="h-3 w-3" />{isOverdue ? "Relancer" : "Message"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {invoice && (
          <Tabs defaultValue="info">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Infos</TabsTrigger>
              <TabsTrigger value="amounts">Montants</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              {isOverdue && (
                <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-900">Paiement en retard</p>
                    <p className="text-xs text-red-700">Echeance depuis le {invoice.dueDate ? formatDate(new Date(invoice.dueDate)) : "?"}</p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Statut</span>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Numero</span>
                  <span className="text-sm font-mono">{invoice.invoiceNumber}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />Echeance
                    </span>
                    <span className="text-sm">{formatDate(new Date(invoice.dueDate))}</span>
                  </div>
                )}
                {invoice.paidAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Payee le</span>
                    <span className="text-sm">{formatDate(new Date(invoice.paidAt))}</span>
                  </div>
                )}
                {invoice.paymentMethod && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Methode</span>
                    <span className="text-sm capitalize">{invoice.paymentMethod}</span>
                  </div>
                )}
              </div>

              {invoice.description && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{invoice.description}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="amounts" className="space-y-2 mt-4">
              <AmtRow label="Sous-total HT" value={formatCurrency(Number(invoice.amountHt))} />
              <AmtRow label="TPS" value={formatCurrency(Number(invoice.tpsAmount))} muted />
              <AmtRow label="TVQ" value={formatCurrency(Number(invoice.tvqAmount))} muted />
              <AmtRow label="Total TTC" value={formatCurrency(Number(invoice.amountTtc))} bold />
            </TabsContent>
          </Tabs>
        )}
        {ConfirmModal}
      </DetailPanelBase>

      {invoice && pdfOpen && (
        <PdfViewerModal
          open
          onClose={() => setPdfOpen(false)}
          pdfUrl={`/api/invoices/${invoice.id}/pdf`}
          title={`Facture ${invoice.invoiceNumber}`}
          documentNumber={invoice.invoiceNumber}
          downloadName={`facture-${invoice.invoiceNumber}`}
        />
      )}
    </>
  );
}

function AmtRow({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded ${bold ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
      <span className={`text-xs ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? "font-bold text-primary" : ""}`}>{value}</span>
    </div>
  );
}
