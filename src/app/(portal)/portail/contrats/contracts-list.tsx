"use client";

import { FileSignature, PenLine, Download, Check, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────
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

// ── Status color mapping for card top bar ────────────────
const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  signed: "bg-emerald-600",
  expired: "bg-gray-400",
  cancelled: "bg-red-600",
  draft: "bg-gray-300",
  sent: "bg-sky-500",
};

// ── Filter options ───────────────────────────────────────
const filterOptions: FilterOption[] = [
  { value: "pending", label: "En attente" },
  { value: "signed", label: "Signe" },
  { value: "expired", label: "Expire" },
  { value: "cancelled", label: "Annule" },
];

// ── Signature indicator ──────────────────────────────────
function SignatureCheck({ signed, label }: { signed: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {signed ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground/40" />
      )}
      <span className={signed ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </span>
  );
}

// ── Component ────────────────────────────────────────────
export function PortalContractsList({ contracts }: { contracts: Contract[] }) {
  const handleSign = (c: Contract) => {
    toast.info("Signature en cours de developpement");
  };

  const handleViewPdf = (c: Contract) => {
    if (c.fileUrl) {
      window.open(c.fileUrl, "_blank");
    } else {
      window.open(`/api/portal/contracts/${c.id}/pdf`, "_blank");
    }
  };

  // ── Columns ──────────────────────────────────────────
  const columns: Column<Contract>[] = [
    {
      key: "number",
      header: "Numero",
      accessor: (r) => (
        <span className="font-mono text-sm">{r.contractNumber}</span>
      ),
      sortable: true,
      sortBy: (r) => r.contractNumber,
    },
    {
      key: "title",
      header: "Titre",
      accessor: (r) => r.title,
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => (
        <span className="font-semibold text-[#0F2D52]">
          {formatCurrency(r.amountTtc)}
        </span>
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
      header: "Actions",
      accessor: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && !r.clientSignatureData && (
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#0a1f3a] text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleSign(r);
              }}
            >
              <PenLine className="h-3 w-3 mr-1" />
              Signer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleViewPdf(r);
            }}
          >
            <Download className="h-3 w-3 mr-1" />
            Voir PDF
          </Button>
        </div>
      ),
    },
  ];

  // ── Card renderer ────────────────────────────────────
  const renderCard = (c: Contract) => (
    <Card className="overflow-hidden">
      <div
        className={`h-1.5 ${STATUS_BAR_COLORS[c.status] ?? "bg-gray-300"}`}
      />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">
              {c.contractNumber}
            </p>
            <p className="font-semibold text-sm truncate">{c.title}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>

        <p className="text-lg font-bold text-[#0F2D52]">
          {formatCurrency(c.amountTtc)}
        </p>

        <div className="flex gap-3">
          <SignatureCheck signed={!!c.adminSignedAt} label="VNK" />
          <SignatureCheck signed={c.clientSignatureData} label="Client" />
        </div>

        <div className="flex gap-2">
          {c.status === "pending" && !c.clientSignatureData && (
            <Button
              size="sm"
              className="flex-1 bg-[#0F2D52] hover:bg-[#0a1f3a] text-white"
              onClick={() => handleSign(c)}
            >
              <PenLine className="h-4 w-4 mr-1" />
              Signer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className={
              c.status === "pending" && !c.clientSignatureData ? "" : "w-full"
            }
            onClick={() => handleViewPdf(c)}
          >
            <Download className="h-4 w-4 mr-1" />
            Voir PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileSignature className="h-6 w-6 text-[#0F2D52]" />
        <div>
          <h1 className="text-2xl font-bold">Mes contrats</h1>
          <p className="text-sm text-muted-foreground">
            Signez et consultez vos contrats
          </p>
        </div>
      </div>

      <DataTable
        data={contracts}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-contracts"
        searchPlaceholder="Rechercher par numero ou titre..."
        searchFn={(r) => `${r.contractNumber} ${r.title}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        filterLabel="Tous les statuts"
        exportFilename="contrats"
        emptyMessage="Aucun contrat"
        emptyIcon={
          <FileSignature className="h-12 w-12 text-muted-foreground/40 mb-4" />
        }
      />
    </div>
  );
}
