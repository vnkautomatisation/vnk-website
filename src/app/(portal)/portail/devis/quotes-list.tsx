"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Eye, Download, CheckCircle } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type Q = {
  id: number;
  quoteNumber: string;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  discountAmount: number | null;
  expiryDate: string | null;
  createdAt: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "pending", label: "En attente" },
  { value: "accepted", label: "Accepte" },
  { value: "expired", label: "Expire" },
  { value: "declined", label: "Refuse" },
];

export function PortalQuotesList({ quotes }: { quotes: Q[] }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAccept = (quoteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Voulez-vous accepter ce devis ? Un contrat sera automatiquement genere.")) return;

    setAccepting(quoteId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quotes/${quoteId}/accept`, { method: "POST" });
        if (res.ok) {
          toast.success("Devis accepte — contrat genere automatiquement");
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Erreur lors de l'acceptation");
        }
      } catch {
        toast.error("Erreur de connexion");
      } finally {
        setAccepting(null);
      }
    });
  };

  const handleDownload = async (quoteId: number, quoteNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`);
      if (!res.ok) { toast.error("PDF non disponible"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis-${quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur de telechargement");
    }
  };

  const columns: Column<Q>[] = [
    {
      key: "number",
      header: "Numero",
      accessor: (r) => (
        <span className="font-mono text-xs font-medium">{r.quoteNumber}</span>
      ),
      sortable: true,
      sortBy: (r) => r.quoteNumber,
    },
    {
      key: "title",
      header: "Titre",
      accessor: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: "amount",
      header: "Montant TTC",
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
      key: "expiry",
      header: "Expire le",
      accessor: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.expiryDate ? formatDate(new Date(r.expiryDate)) : "—"}
        </span>
      ),
      hiddenOnMobile: true,
      sortable: true,
      sortBy: (r) => r.expiryDate ? new Date(r.expiryDate).getTime() : 0,
    },
    {
      key: "actions",
      header: "",
      className: "w-[180px]",
      accessor: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === "pending" ? (
            <Button
              size="sm"
              onClick={(e) => handleAccept(r.id, e)}
              disabled={accepting === r.id}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {accepting === r.id ? "..." : "Accepter"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={(e) => handleDownload(r.id, r.quoteNumber, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => handleDownload(r.id, r.quoteNumber, e)}
            title="Telecharger PDF"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (q: Q) => (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="h-1"
        style={{
          background:
            q.status === "pending"
              ? "#D97706"
              : q.status === "accepted"
              ? "#059669"
              : q.status === "expired"
              ? "#94A3B8"
              : "#DC2626",
        }}
      />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{q.quoteNumber}</p>
            <p className="font-semibold truncate">{q.title}</p>
          </div>
          <StatusBadge status={q.status} />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-[#0F2D52]">
              {formatCurrency(q.amountTtc)}
            </p>
            {q.expiryDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Expire le {formatDate(new Date(q.expiryDate))}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          {q.status === "pending" ? (
            <>
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => handleAccept(q.id, e)}
                disabled={accepting === q.id}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Accepter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => handleDownload(q.id, q.quoteNumber, e)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => handleDownload(q.id, q.quoteNumber, e)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir PDF
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-[#0F2D52]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes devis</h1>
          <p className="text-sm text-muted-foreground">
            Consultez et acceptez vos devis en attente
          </p>
        </div>
      </div>

      <DataTable
        data={quotes}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-quotes"
        searchPlaceholder="Rechercher un devis..."
        searchFn={(r) => `${r.quoteNumber} ${r.title}`}
        filterOptions={FILTER_OPTIONS}
        filterFn={(r) => r.status}
        emptyMessage="Aucun devis"
      />
    </div>
  );
}
