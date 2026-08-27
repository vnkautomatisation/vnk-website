"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FileSignature, PenLine, Eye, ClipboardList, CheckCircle, DollarSign, X, ShieldCheck, Download } from "lucide-react";
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
  signedAt: string | null;
  createdAt: string;
};

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  signed: "bg-emerald-600",
  expired: "bg-gray-400",
  cancelled: "bg-red-500",
};

const filterOptions: { value: string; labelKey: string }[] = [
  { value: "pending", labelKey: "opt_en_attente" },
  { value: "signed", labelKey: "opt_signe" },
  { value: "expired", labelKey: "opt_expire" },
  { value: "cancelled", labelKey: "opt_annule" },
];

function SignatureCheck({ signed, label }: { signed: boolean; label: string }) {
  const t = useTranslations("portal");
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${signed ? "text-emerald-700" : "text-muted-foreground/60"}`}>
      <span>{signed ? "\u2713" : "\u25CB"}</span>
      <span>{label}</span>
    </span>
  );
}

export function PortalContractsList({ contracts }: { contracts: Contract[] }) {
  const t = useTranslations("portal");
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
    setSigned(false);
  };

  const [signed, setSigned] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);

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
              ? t("contrat_signe_deux_parties_facture")
              : t("signature_ete_enregistree")
          );

          setShowSignature(false);
          setSigned(true);
          setPdfKey((k) => k + 1);
          router.refresh();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? t("erreur_signature"));
        }
      } catch {
        toast.error(t("erreur_connexion"));
      } finally {
        setSigning(false);
      }
    });
  };

  const columns: Column<Contract>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10", hiddenOnMobile: true,
      accessor: () => (
        <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <FileSignature className="h-4 w-4 text-[#0F2D52]" />
        </div>
      ),
    },
    {
      key: "info",
      header: t("contrat"),
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
      header: t("montant"),
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "status",
      header: t("statut"),
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "signedAt",
      header: t("signe"),
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.signedAt ? formatDate(r.signedAt) : "\u2014"}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.signedAt ? new Date(r.signedAt).getTime() : 0,
      hiddenOnMobile: true,
    },
    {
      key: "signatures",
      header: t("signatures"),
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <SignatureCheck signed={!!r.adminSignedAt} label="VNK" />
          <span className="text-muted-foreground/40 select-none">|</span>
          <SignatureCheck signed={r.clientSignatureData} label={t("vous")} />
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
              {t("signer_2")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={(e) => openPdf(r, e)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t("voir")}
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


        <div className="mx-4 mb-3 rounded-lg bg-muted/40 px-3 py-2.5 flex items-center justify-center gap-3">
          <SignatureCheck signed={!!c.adminSignedAt} label="VNK" />
          <span className="text-muted-foreground/40 select-none">|</span>
          <SignatureCheck signed={c.clientSignatureData} label={t("vous")} />
        </div>


        <div className="border-t px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-[#0F2D52]">{formatCurrency(c.amountTtc)}</p>
          {c.status === "pending" && !c.clientSignatureData ? (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(c, e)}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              {t("signer_2")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={(e) => openPdf(c, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t("voir")}
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
              <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <FileSignature className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="portal-title">{t("contrats")}</h1>
                <p className="text-sm text-muted-foreground">{t("signez_consultez_contrats")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("total_contrats")}</p>
                    <p className="portal-kpi-number">{contractKpis.total}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-amber-100 flex items-center justify-center">
                    <PenLine className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-amber-600">{t("signer")}</p>
                    <p className="portal-kpi-number">{contractKpis.aSigner}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-emerald-600">{t("signes")}</p>
                    <p className="portal-kpi-number">{contractKpis.signes}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("montant_total")}</p>
                    <p className="portal-kpi-number">{formatCurrency(contractKpis.montantTotal)}</p>
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
        searchPlaceholder={t("rechercher_contrat")}
        searchFn={(r) => `${r.contractNumber} ${r.title}`}
        filterOptions={filterOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        filterFn={(r) => r.status}
        emptyMessage={t("aucun_contrat")}
      />


      {pdfContract && (
        <PdfViewerModal
          open={!!pdfContract}
          onClose={closePdf}
          pdfUrl={pdfContract.fileUrl ?? `/api/contracts/${pdfContract.id}/pdf`}
          refreshKey={pdfKey}
          title={pdfContract.title}
          documentNumber={pdfContract.contractNumber}
          date={formatDate(new Date(pdfContract.createdAt))}
          downloadName={`contrat-${pdfContract.contractNumber}`}
          actions={
            signed ? (
              <Button className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white" size="sm" onClick={() => {
                const a = document.createElement("a");
                a.href = pdfContract.fileUrl ?? `/api/contracts/${pdfContract.id}/pdf`;
                a.download = `contrat-${pdfContract.contractNumber}.pdf`;
                a.click();
              }}>
                <Download className="h-4 w-4 mr-1.5" />
                {t("telecharger_contrat")}
              </Button>
            ) : showSignature ? null
              : pdfContract.status === "pending" && !pdfContract.clientSignatureData ? (
              <Button
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                size="sm"
                onClick={startSign}
              >
                <PenLine className="h-4 w-4 mr-1" />
                {t("signer_contrat_2")}
              </Button>
            ) : undefined
          }
        />
      )}


      {pdfContract && showSignature && (
        <div className="fixed inset-0 bottom-14 lg:bottom-0 z-[10000] flex items-end sm:items-center justify-center">
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
                  <h2 className="text-lg font-bold">{t("signer_contrat")}</h2>
                  <p className="text-white/60 text-sm">{pdfContract.contractNumber} — {pdfContract.title}</p>
                </div>
              </div>
              <div className="mt-4 bg-white/10 rounded-lg px-3 py-2 w-fit">
                <span className="text-white/70 text-sm">{t("montant")} </span>
                <span className="text-white font-bold">{formatCurrency(pdfContract.amountTtc)}</span>
              </div>
            </div>
            <div className="px-6 py-5">
              <SignatureCanvas
                onSave={handleSign}
                height={180}
                disabled={signing}
                legalText={t("conditions_contrat")}
              />
              {signing && (
                <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
                  {t("signature_cours")}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{t("signature_juridiquement_valide")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSignature(false)} disabled={signing}>
                {t("annuler")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
