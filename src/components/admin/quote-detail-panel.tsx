"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText, Receipt, FileSignature, Calendar, User, ExternalLink, CheckCircle2, Send,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase, PanelEmptyState } from "@/components/admin/detail-panel-base";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { formatCurrency, formatDate } from "@/lib/utils";

type QuoteFull = {
  id: number;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: string;
  amountHt: number | string;
  tpsAmount: number | string;
  tvqAmount: number | string;
  amountTtc: number | string;
  expiryDate: string | null;
  acceptedAt: string | null;
  createdAt: string;
  client: { id: number; fullName: string; companyName: string | null; email: string };
};

export function QuoteDetailPanel({
  quoteId,
  open,
  onOpenChange,
}: {
  quoteId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [quote, setQuote] = useState<QuoteFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (!quoteId || !open) return;
    setLoading(true);
    fetch(`/api/quotes/${quoteId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setQuote(data.quote))
      .finally(() => setLoading(false));
  }, [quoteId, open]);

  const refresh = async () => {
    if (!quoteId) return;
    const res = await fetch(`/api/quotes/${quoteId}`, { cache: "no-store" });
    const data = await res.json();
    setQuote(data.quote);
    router.refresh();
  };

  const accept = async () => {
    if (!quote) return;
    const ok = await confirm({
      title: t("accepter_devis"),
      description: `Le devis ${quote.quoteNumber} sera marqué comme accepté et un contrat sera généré.`,
      confirmLabel: t("accepter"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/accept`, { method: "POST" });
      if (res.ok) { toast.success(t("devis_accepte")); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusy(false); }
  };

  return (
    <>
      <DetailPanelBase
        open={open}
        onOpenChange={onOpenChange}
        loading={loading || !quote}
        title={quote?.title ?? t("devis")}
        subtitle={quote ? `${quote.quoteNumber} · ${quote.client.fullName}` : undefined}
        icon={<FileText className="h-7 w-7 text-white" />}
        preventClose={pdfOpen}
        headerActions={
          quote ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => openEntity("client", quote.client.id)}>
                <User className="h-3 w-3" />Voir client
              </Button>
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => setPdfOpen(true)}>
                <ExternalLink className="h-3 w-3" />PDF
              </Button>
              {quote.status === "pending" && (
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={accept}>
                  <CheckCircle2 className="h-3 w-3" />Accepter
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => router.push(`/admin/messages?clientId=${quote.client.id}`)}>
                <Send className="h-3 w-3" />Message
              </Button>
            </div>
          ) : undefined
        }
      >
        {quote && (
          <Tabs defaultValue="info">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">{t("infos")}</TabsTrigger>
              <TabsTrigger value="amounts">{t("montants")}</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{tc("status")}</span>
                  <StatusBadge status={quote.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("numero")}</span>
                  <span className="text-sm font-mono">{quote.quoteNumber}</span>
                </div>
                {quote.expiryDate && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />Expiration
                    </span>
                    <span className="text-sm">{formatDate(new Date(quote.expiryDate))}</span>
                  </div>
                )}
                {quote.acceptedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("accepte")}</span>
                    <span className="text-sm">{formatDate(new Date(quote.acceptedAt))}</span>
                  </div>
                )}
              </div>

              {quote.description && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("description")}</p>
                  <p className="text-sm whitespace-pre-wrap">{quote.description}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="amounts" className="space-y-2 mt-4">
              <Row label={t("sous_total_ht")} value={formatCurrency(Number(quote.amountHt))} />
              <Row label="TPS" value={formatCurrency(Number(quote.tpsAmount))} muted />
              <Row label="TVQ" value={formatCurrency(Number(quote.tvqAmount))} muted />
              <Row label={t("total_ttc")} value={formatCurrency(Number(quote.amountTtc))} bold />
            </TabsContent>
          </Tabs>
        )}
        {ConfirmModal}
      </DetailPanelBase>

      {quote && pdfOpen && (
        <PdfViewerModal
          open
          onClose={() => setPdfOpen(false)}
          pdfUrl={`/api/quotes/${quote.id}/pdf`}
          title={quote.title}
          documentNumber={quote.quoteNumber}
          downloadName={`devis-${quote.quoteNumber}`}
        />
      )}
    </>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded ${bold ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
      <span className={`text-xs ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? "font-bold text-primary" : ""}`}>{value}</span>
    </div>
  );
}

// PanelEmptyState satisfies eslint
void PanelEmptyState;
