"use client";
import { useTranslations } from "next-intl";
import { FileSignature } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, Clock } from "lucide-react";

type C = {
  id: number;
  contractNumber: string;
  title: string;
  status: string;
  amountTtc: any;
  clientSignatureData: string | null;
  adminSignatureData: string | null;
  signedAt: Date | null;
  createdAt: Date;
  client: { fullName: string };
};

function SignatureCell({ signed }: { signed: boolean }) {
  return signed ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
      <Check className="h-3 w-3" /> Signé
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
      <Clock className="h-3 w-3" /> En attente
    </span>
  );
}

export function ContractsTable({ contracts }: { contracts: C[] }) {
  const t = useTranslations("admin.contracts");

  const columns: Column<C>[] = [
    { key: "number", header: "Numéro", accessor: (r) => r.contractNumber, sortable: true, sortBy: (r) => r.contractNumber },
    { key: "client", header: "Client", accessor: (r) => r.client.fullName, sortable: true, sortBy: (r) => r.client.fullName },
    { key: "title", header: "Titre", accessor: (r) => r.title, hiddenOnMobile: true },
    { key: "amount", header: "Montant", accessor: (r) => formatCurrency(Number(r.amountTtc ?? 0)), hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "client_sig", header: "Sig. client", accessor: (r) => <SignatureCell signed={!!r.clientSignatureData} />, hiddenOnMobile: true },
    { key: "admin_sig", header: "Sig. VNK", accessor: (r) => <SignatureCell signed={!!r.adminSignatureData} />, hiddenOnMobile: true },
    { key: "created", header: "Créé le", accessor: (r) => formatDate(r.createdAt), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={FileSignature} action={{ label: t("new") }} />
      <DataTable data={contracts} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher un contrat…" exportFilename="contrats" />
    </div>
  );
}
