"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, PenLine, Eye, ClipboardList, CheckCircle, DollarSign, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { SignatureCanvas } from "@/components/signature/signature-canvas";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type Contract = {
  id: number;
  contractNumber: string;
  title: string;
  status: string;
  amountTtc: number;
  fileUrl: string | null;
  adminSignedAt: string | null;
  clientSignatureData: boolean;
  createdAt: string;
};

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  signed: "bg-emerald-600",
  expired: "bg-gray-400",
  cancelled: "bg-red-500",
};

const filterOptions: FilterOption[] = [
  { value: "pending", label: "En attente" },
  { value: "signed", label: "Signe" },
  { value: "expired", label: "Expire" },
  { value: "cancelled", label: "Annule" },
];

function SignatureCheck({ signed, label }: { signed: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${signed ? "text-emerald-700" : "text-muted-foreground/60"}`}>
      <span>{signed ? "\u2713" : "\u25CB"}</span>
      <span>{label}</span>
    </span>
  );
}

export function PortalContractsList({ contracts }: { contracts: Contract[] }) {
  const router = useRouter();
  const [pdfContract, setPdfContract] = useState<Contract | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [signing, setSigning] = useState(false);
  const [, startTransition] = useTransition();

  const contractKpis = useMemo(() => {
    const total = contracts.length;
    const aSigner = contracts.filter((c) => c.status === "pending" && !c.clientSignatureData).length;
    const signes = contracts.filter((c) => c.status === "signed").length;
    const montantTotal = contracts
      .filter((c) => c.status === "signed")
      .reduce((sum, c) => sum + c.amountTtc, 0);
    return { total, aSigner, signes, montantTotal };
  }, [contracts]);

  const openPdf = (c: Contract, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfContract(c);
  };

  const startSign = () => {
    setShowSignature(true);
  };

  const closePdf = () => {
    setPdfContract(null);
    setShowSignature(false);
  };

  const handleSign = async (signatureDataUrl: string) => {
    if (!pdfContract) return;
    setSigning(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/contracts/${pdfContract.id}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureData: signatureDataUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          toast.success(
            data.fullySigned
              ? "Contrat signe par les deux parties — facture generee"
              : "Votre signature a ete enregistree"
          );
          closePdf();
          router.refresh();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? "Erreur signature");
        }
      } catch {
        toast.error("Erreur de connexion");
      } finally {
        setSigning(false);
      }
    });
  };

  const columns: Column<Contract>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: () => (
        <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <FileSignature className="h-4 w-4 text-[#0F2D52]" />
        </div>
      ),
    },
    {
      key: "info",
      header: "Contrat",
      accessor: (r) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground">{r.contractNumber}</span>
          <p className="font-medium text-sm">{r.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(new Date(r.createdAt))}</p>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.contractNumber,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "signatures",
      header: "Signatures",
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <SignatureCheck signed={!!r.adminSignedAt} label="VNK" />
          <span className="text-muted-foreground/40 select-none">|</span>
          <SignatureCheck signed={r.clientSignatureData} label="Vous" />
        </div>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      className: "w-[120px]",
      accessor: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === "pending" && !r.clientSignatureData ? (
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={(e) => openPdf(r, e)}
            >
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Signer
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={(e) => openPdf(r, e)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (c: Contract) => (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-1.5 ${STATUS_BAR_COLORS[c.status] ?? "bg-gray-300"}`} />
      <CardContent className="p-0">
        {/* Header: contract number + date + badge */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-mono">{c.contractNumber}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(new Date(c.createdAt))}</p>
            </div>
            <StatusBadge status={c.status} />
          </div>
          <p className="font-semibold truncate mt-2">{c.title}</p>
        </div>

        {/* Signatures */}
        <div className="mx-4 mb-3 rounded-lg bg-muted/40 px-3 py-2.5 flex items-center justify-center gap-3">
          <SignatureCheck signed={!!c.adminSignedAt} label="VNK" />
          <span className="text-muted-foreground/40 select-none">|</span>
          <SignatureCheck signed={c.clientSignatureData} label="Vous" />
        </div>

        {/* Footer: amount + action */}
        <div className="border-t px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-[#0F2D52]">{formatCurrency(c.amountTtc)}</p>
          {c.status === "pending" && !c.clientSignatureData ? (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(c, e)}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Signer
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={(e) => openPdf(c, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <DataTable
        stickyHeader={
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <FileSignature className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Mes contrats</h1>
                <p className="text-sm text-muted-foreground">Signez et consultez vos contrats</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total contrats</p>
                    <p className="text-2xl font-bold">{contractKpis.total}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <PenLine className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-600">A signer</p>
                    <p className="text-2xl font-bold">{contractKpis.aSigner}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">Signes</p>
                    <p className="text-2xl font-bold">{contractKpis.signes}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Montant total</p>
                    <p className="text-2xl font-bold">{formatCurrency(contractKpis.montantTotal)}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
        data={contracts}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-contracts"
        searchPlaceholder="Rechercher un contrat..."
        searchFn={(r) => `${r.contractNumber} ${r.title}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        emptyMessage="Aucun contrat"
      />

      {/* PDF preview — Signer button in footer if pending */}
      {pdfContract && (
        <PdfViewerModal
          open={!!pdfContract}
          onClose={closePdf}
          pdfUrl={pdfContract.fileUrl ?? `/api/contracts/${pdfContract.id}/pdf`}
          title={pdfContract.title}
          documentNumber={pdfContract.contractNumber}
          date={formatDate(new Date(pdfContract.createdAt))}
          downloadName={`contrat-${pdfContract.contractNumber}`}
          actions={
            pdfContract.status === "pending" && !pdfContract.clientSignatureData && !showSignature ? (
              <Button
                className="bg-[#0F2D52] hover:bg-[#1a3a66]"
                size="sm"
                onClick={startSign}
              >
                <PenLine className="h-4 w-4 mr-1" />
                Signer ce contrat
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Signature overlay — SUR le PDF modal */}
      {pdfContract && showSignature && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignature(false)} />
          <div className="relative z-10 w-full max-w-xl mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
              <button
                onClick={() => setShowSignature(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
                  <FileSignature className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Signer le contrat</h2>
                  <p className="text-white/60 text-sm">{pdfContract.contractNumber} — {pdfContract.title}</p>
                </div>
              </div>
              <div className="mt-4 bg-white/10 rounded-lg px-3 py-2 w-fit">
                <span className="text-white/70 text-sm">Montant : </span>
                <span className="text-white font-bold">{formatCurrency(pdfContract.amountTtc)}</span>
              </div>
            </div>
            <div className="px-6 py-5">
              <SignatureCanvas
                onSave={handleSign}
                width={480}
                height={180}
                disabled={signing}
                legalText="les conditions du contrat"
              />
              {signing && (
                <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
                  Signature en cours...
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Signature juridiquement valide</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSignature(false)} disabled={signing}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
