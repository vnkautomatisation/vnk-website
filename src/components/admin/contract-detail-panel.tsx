"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSignature, Calendar, User, ExternalLink, PenTool, UserCheck, ShieldCheck, Send,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase } from "@/components/admin/detail-panel-base";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { SignatureDialog } from "@/components/signature/signature-dialog";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type ContractFull = {
  id: number;
  contractNumber: string;
  title: string;
  content: string | null;
  status: string;
  amountTtc: number | string | null;
  signedAt: string | null;
  clientSignatureData: string | null;
  clientSignatureIp: string | null;
  adminSignatureData: string | null;
  adminSignedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  client: { id: number; fullName: string; companyName: string | null; email: string };
};

export function ContractDetailPanel({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  useEffect(() => {
    if (!contractId || !open) return;
    setLoading(true);
    fetch(`/api/contracts/${contractId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setContract(data.contract))
      .finally(() => setLoading(false));
  }, [contractId, open]);

  const refresh = async () => {
    if (!contractId) return;
    const res = await fetch(`/api/contracts/${contractId}`, { cache: "no-store" });
    const data = await res.json();
    setContract(data.contract);
    router.refresh();
  };

  const sign = () => {
    if (!contract) return;
    setSignOpen(true);
  };

  return (
    <>
      <DetailPanelBase
        open={open}
        onOpenChange={onOpenChange}
        loading={loading || !contract}
        title={contract?.title ?? "Contrat"}
        subtitle={contract ? `${contract.contractNumber} · ${contract.client.fullName}` : undefined}
        icon={<FileSignature className="h-7 w-7 text-white" />}
        preventClose={pdfOpen}
        headerActions={
          contract ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => openEntity("client", contract.client.id)}>
                <User className="h-3 w-3" />Voir client
              </Button>
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => setPdfOpen(true)}>
                <ExternalLink className="h-3 w-3" />PDF
              </Button>
              {!contract.adminSignatureData && contract.status !== "cancelled" && (
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={sign}>
                  <PenTool className="h-3 w-3" />Signer admin
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => router.push(`/admin/messages?clientId=${contract.client.id}`)}>
                <Send className="h-3 w-3" />Message
              </Button>
            </div>
          ) : undefined
        }
      >
        {contract && (
          <Tabs defaultValue="info">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Infos</TabsTrigger>
              <TabsTrigger value="signatures">Signatures</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{tc("status")}</span>
                  <StatusBadge status={contract.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Numero</span>
                  <span className="text-sm font-mono">{contract.contractNumber}</span>
                </div>
                {contract.amountTtc != null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Montant TTC</span>
                    <span className="text-sm font-bold">{formatCurrency(Number(contract.amountTtc))}</span>
                  </div>
                )}
                {contract.expiresAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />Expiration
                    </span>
                    <span className="text-sm">{formatDate(new Date(contract.expiresAt))}</span>
                  </div>
                )}
              </div>

              {contract.content && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Contenu / Clauses</p>
                  <div className="p-3 rounded-md bg-muted/30 border text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {contract.content}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signatures" className="space-y-3 mt-4">
              <SigCard
                label="Client"
                icon={UserCheck}
                signed={!!contract.clientSignatureData}
                date={contract.signedAt}
                meta={contract.clientSignatureIp ? `IP: ${contract.clientSignatureIp}` : undefined}
              />
              <SigCard
                label="Administrateur"
                icon={ShieldCheck}
                signed={!!contract.adminSignatureData}
                date={contract.adminSignedAt}
              />
            </TabsContent>
          </Tabs>
        )}
        {ConfirmModal}
      </DetailPanelBase>

      {contract && pdfOpen && (
        <PdfViewerModal
          open
          onClose={() => setPdfOpen(false)}
          pdfUrl={`/api/contracts/${contract.id}/pdf`}
          title={`Contrat ${contract.contractNumber}`}
          documentNumber={contract.contractNumber}
          downloadName={`contrat-${contract.contractNumber}`}
        />
      )}

      {contract && signOpen && (
        <SignatureDialog
          contractId={contract.id}
          contractNumber={contract.contractNumber}
          contractTitle={contract.title}
          contractAmount={contract.amountTtc != null ? Number(contract.amountTtc) : undefined}
          open={true}
          onOpenChange={(o) => {
            if (!o) {
              setSignOpen(false);
              refresh();
            }
          }}
        />
      )}
    </>
  );
}

function SigCard({ label, icon: Icon, signed, date, meta }: { label: string; icon: React.ComponentType<{ className?: string }>; signed: boolean; date: string | null; meta?: string }) {
  return (
    <div className={cn("p-4 rounded-lg border-2", signed ? "border-emerald-300 bg-emerald-50" : "border-dashed bg-muted/30")}>
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", signed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn("text-sm font-bold", signed ? "text-emerald-700" : "text-muted-foreground")}>
            {signed ? `Signé le ${date ? formatDate(new Date(date)) : "?"}` : "Non signé"}
          </p>
          {meta && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{meta}</p>}
        </div>
      </div>
    </div>
  );
}
