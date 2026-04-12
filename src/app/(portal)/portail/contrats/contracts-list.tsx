"use client";

import { useState } from "react";
import { FileSignature, PenLine, Eye, Check, X as XIcon, ClipboardList, CheckCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
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
    <div className="flex items-center gap-1.5 text-xs">
      {signed ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <XIcon className="h-3 w-3 text-muted-foreground/50" />
      )}
      <span className={signed ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

export function PortalContractsList({ contracts }: { contracts: Contract[] }) {
  const [pdfContract, setPdfContract] = useState<Contract | null>(null);

  const openPdf = (c: Contract, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfContract(c);
  };

  const handleSign = () => {
    toast.info("Signature en cours de developpement");
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
        <div className="flex flex-col gap-0.5">
          <SignatureCheck signed={!!r.adminSignedAt} label="VNK" />
          <SignatureCheck signed={r.clientSignatureData} label="Client" />
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
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{c.contractNumber}</p>
            <p className="font-semibold truncate">{c.title}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <p className="text-xl font-bold text-[#0F2D52]">{formatCurrency(c.amountTtc)}</p>
        <div className="flex gap-4">
          <SignatureCheck signed={!!c.adminSignedAt} label="VNK" />
          <SignatureCheck signed={c.clientSignatureData} label="Client" />
        </div>
        <div className="pt-1">
          {c.status === "pending" && !c.clientSignatureData ? (
            <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(c, e)}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Signer
            </Button>
          ) : (
            <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(c, e)}>
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
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
          <FileSignature className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes contrats</h1>
          <p className="text-sm text-muted-foreground">Signez et consultez vos contrats</p>
        </div>
      </div>

      {/* KPI strip */}
      {(() => {
        const total = contracts.length;
        const aSigner = contracts.filter((c) => c.status === "pending" && !c.clientSignatureData).length;
        const signes = contracts.filter((c) => c.status === "signed").length;
        const montantTotal = contracts
          .filter((c) => c.status === "signed")
          .reduce((sum, c) => sum + c.amountTtc, 0);

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="vnk-kpi-card vnk-stat-blue bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <ClipboardList className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total contrats</p>
                  <p className="text-xl font-bold tracking-tight">{total}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-amber bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                  <PenLine className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">A signer</p>
                  <p className="text-xl font-bold tracking-tight">{aSigner}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-emerald bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Signes</p>
                  <p className="text-xl font-bold tracking-tight">{signes}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-slate bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-sm">
                  <DollarSign className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Montant total</p>
                  <p className="text-xl font-bold tracking-tight">{formatCurrency(montantTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <DataTable
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
          onClose={() => setPdfContract(null)}
          pdfUrl={pdfContract.fileUrl ?? `/api/contracts/${pdfContract.id}/pdf`}
          title={pdfContract.title}
          documentNumber={pdfContract.contractNumber}
          date={formatDate(new Date(pdfContract.createdAt))}
          downloadName={`contrat-${pdfContract.contractNumber}`}
          actions={
            pdfContract.status === "pending" && !pdfContract.clientSignatureData ? (
              <Button
                className="bg-[#0F2D52] hover:bg-[#1a3a66]"
                size="sm"
                onClick={handleSign}
              >
                <PenLine className="h-4 w-4 mr-1" />
                Signer ce contrat
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
