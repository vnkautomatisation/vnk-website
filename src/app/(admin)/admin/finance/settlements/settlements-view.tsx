"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Download, Calendar, TrendingUp, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Row = {
  id: number;
  paidAt: string | null;
  settledAt: string | null;
  payoutAt: string | null;
  clientName: string;
  cardholderName: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  processingFee: number | null;
  netAmount: number | null;
  stripePaymentIntentId: string | null;
  paymentMethod: string | null;
  stripeBalanceTxId: string | null;
  stripePayoutId: string | null;
  invoiceNumber: string | null;
};

type Kpis = {
  count: number;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  chargeCount: number;
  refundCount: number;
  chargebackCount: number;
};

const TYPE_LABELS: Record<string, string> = {
  charge: "Vente",
  refund: "Remboursement",
  chargeback: "Rétrofacturation",
  chargeback_fee: "Frais rétrofact.",
  adjustment: "Ajustement",
  topup: "Fonds ajoutés",
};

const STATUS_LABELS: Record<string, string> = {
  succeeded: "Payé",
  paid: "Payé",
  pending: "En attente",
  refunded: "Remboursé",
  failed: "Échoué",
};

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "N/A";
  return iso.slice(0, 10);
}

export function SettlementsView({ rows, kpis, dateRange }: { rows: Row[]; kpis: Kpis; dateRange: { from: string; to: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);

  // Sticky scroll detection
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const applyDates = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    router.push(`/admin/finance/settlements?${params.toString()}`);
  };

  const exportCsv = () => {
    const headers = [
      "Date de paiement",
      "Date de règlement",
      "Date de versement",
      "Nom du client",
      "Nom du titulaire de la carte",
      "Type",
      "Statut",
      "Montant",
      "Devise",
      "Frais de traitement",
      "Montant net",
      "ID de paiement",
      "Moyen de paiement",
      "ID de transaction",
      "ID de versement",
      "N° de commande",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    rows.forEach((r) => {
      lines.push([
        formatDateOnly(r.paidAt),
        formatDateOnly(r.settledAt),
        formatDateOnly(r.payoutAt),
        r.clientName,
        r.cardholderName,
        TYPE_LABELS[r.type] ?? r.type,
        STATUS_LABELS[r.status] ?? r.status,
        r.amount.toFixed(2),
        r.currency,
        r.processingFee != null ? r.processingFee.toFixed(2) : "0,00",
        (r.netAmount != null ? r.netAmount : r.amount).toFixed(2),
        r.stripePaymentIntentId ?? "",
        r.paymentMethod ?? "",
        r.stripeBalanceTxId ?? "",
        r.stripePayoutId ?? "N/A",
        r.invoiceNumber ?? "N/A",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-reglement_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagination simple
  const [pageSize] = useState(50);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [rows, page, pageSize]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rapport de règlement
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Détail comptable des transactions Stripe avec dates de paiement / règlement / versement, frais et chaînage des IDs externes.
            </p>
          </div>
          <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
            <Download className="h-4 w-4 mr-1.5" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Brut</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.totalGross)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.count} transaction{kpis.count > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frais Stripe</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">−{formatCurrency(kpis.totalFees)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.totalGross > 0 ? ((kpis.totalFees / kpis.totalGross) * 100).toFixed(2) : "0,00"}% effectif</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.totalNet)}</p>
          <p className="text-[10px] text-muted-foreground">déposé en banque</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> Ventes</span>
            <span className="font-semibold tabular-nums">{kpis.chargeCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-500" /> Remb.</span>
            <span className="font-semibold tabular-nums">{kpis.refundCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Rétrofact.</span>
            <span className="font-semibold tabular-nums">{kpis.chargebackCount}</span>
          </div>
        </div>
      </div>

      {/* Sentinel + sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileText className="h-4 w-4" />
              Rapport de règlement
            </span>
            <span className="font-semibold">{kpis.count} tx</span>
            <span className="text-muted-foreground">Brut <span className="font-semibold">{formatCurrency(kpis.totalGross)}</span></span>
            <span className="text-muted-foreground">Frais <span className="font-semibold text-red-600">{formatCurrency(kpis.totalFees)}</span></span>
            <span className="text-muted-foreground">Net <span className="font-semibold text-emerald-600">{formatCurrency(kpis.totalNet)}</span></span>
            <span className="ml-auto">{from} → {to}</span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[10px]">Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <Label className="text-[10px]">Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
          </div>
          <Button onClick={applyDates} size="sm" className="h-9">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Appliquer
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length > 0 ? `Page ${page + 1} / ${pageCount}` : "Aucune donnée"}
          </span>
        </div>
      </div>

      {/* Table CSV-like : 14 colonnes Wix */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Date paiement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Date règlement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Date versement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Client</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Titulaire carte</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Type</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Statut</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Montant</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Frais</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Net</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID paiement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Méthode</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID transaction</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID versement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">N° commande</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center py-8 text-muted-foreground italic">
                  Aucune transaction sur la période sélectionnée.
                </td>
              </tr>
            ) : pageRows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-2 py-1.5 whitespace-nowrap">{r.paidAt ? formatDate(new Date(r.paidAt)) : "—"}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{r.settledAt ? formatDate(new Date(r.settledAt)) : <span className="italic">N/A</span>}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{r.payoutAt ? formatDate(new Date(r.payoutAt)) : <span className="italic">N/A</span>}</td>
                <td className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                <td className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate text-muted-foreground" title={r.cardholderName}>{r.cardholderName}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{TYPE_LABELS[r.type] ?? r.type}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{STATUS_LABELS[r.status] ?? r.status}</td>
                <td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", r.amount < 0 ? "text-red-600" : "")}>
                  {r.amount < 0 ? "−" : ""}{Math.abs(r.amount).toFixed(2)} {r.currency}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.processingFee != null ? r.processingFee.toFixed(2) : "0,00"}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{(r.netAmount ?? r.amount).toFixed(2)}</td>
                <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate" title={r.stripePaymentIntentId ?? ""}>{r.stripePaymentIntentId ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.paymentMethod ?? "—"}</td>
                <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate" title={r.stripeBalanceTxId ?? ""}>{r.stripeBalanceTxId ?? "—"}</td>
                <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate text-muted-foreground" title={r.stripePayoutId ?? ""}>{r.stripePayoutId ?? "N/A"}</td>
                <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{r.invoiceNumber ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">{rows.length} transactions au total</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Précédent</Button>
              <span className="px-2 text-muted-foreground">Page {page + 1} / {pageCount}</span>
              <Button size="sm" variant="ghost" disabled={page === pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Suivant →</Button>
            </div>
          </div>
        )}
      </div>

      {/* Note pédagogique */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
        <p className="font-semibold">Comprendre les 3 dates</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Date de paiement</strong> : moment où le client a réglé (autorisation carte / capture).</li>
          <li><strong>Date de règlement</strong> : moment où Stripe rend les fonds disponibles dans votre solde (généralement +2 jours ouvrés au Canada).</li>
          <li><strong>Date de versement</strong> : moment où Stripe transfère les fonds vers votre compte bancaire (déclenchement du virement).</li>
        </ul>
        <p className="pt-1">L&apos;export CSV reproduit exactement les 14 colonnes du rapport Wix pour import direct dans QuickBooks, Sage ou Acomba.</p>
      </div>
    </div>
  );
}
