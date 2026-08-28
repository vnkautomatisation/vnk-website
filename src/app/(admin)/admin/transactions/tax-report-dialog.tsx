"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Calendar, Download } from "lucide-react";


type TaxReport = {
  period: { from: string; to: string };
  summary: {
    revenue: { ht: number; tps: number; tvq: number; ttc: number; count: number };
    refunds: { ht: number; tps: number; tvq: number; ttc: number; count: number };
    net: { ht: number; tps: number; tvq: number; ttc: number };
  };
  byMonth: Array<{ month: string; ht: number; tps: number; tvq: number; ttc: number; count: number }>;
  byMethod: Array<{ method: string; count: number; total: number }>;
  topClients: Array<{ clientId: number; name: string; count: number; total: number }>;
};

function presetRange(p: string): { from: string; to: string } {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  switch (p) {
    case "this_month":
      return { from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIso(now) };
    case "last_month":
      return {
        from: toIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toIso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "q1":
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-03-31` };
    case "q2":
      return { from: `${now.getFullYear()}-04-01`, to: `${now.getFullYear()}-06-30` };
    case "q3":
      return { from: `${now.getFullYear()}-07-01`, to: `${now.getFullYear()}-09-30` };
    case "q4":
      return { from: `${now.getFullYear()}-10-01`, to: `${now.getFullYear()}-12-31` };
    case "this_year":
      return { from: `${now.getFullYear()}-01-01`, to: toIso(now) };
    case "last_year":
      return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
    default:
      return { from: "", to: "" };
  }
}

export function TaxReportDialog({
  open,
  onOpenChange,
  defaultFrom,
  defaultTo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultFrom: string;
  defaultTo: string;
}) {
  const t = useTranslations("admin.transactions");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(false);
  const formatCurrency = useCurrency();

  useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
      setTo(defaultTo);
      setReport(null);
    }
  }, [open, defaultFrom, defaultTo]);

  const fetchReport = async () => {
    if (!from || !to) {
      toast.error(t("periode_requise"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/tax-report?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(t("erreur"));
      const data = await res.json();
      setReport(data);
    } catch {
      toast.error(t("impossible_charger_rapport"));
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p: string) => {
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const exportCsv = () => {
    if (!report) return;
    const rows: string[][] = [];
    rows.push([t("rapport_fiscal_vnk_automatisation_inc")]);
    rows.push([t("tax_report_dialog_periode_p0_au_p1", { p0: report.period.from, p1: report.period.to })]);
    rows.push([]);
    rows.push(["SOMMAIRE"]);
    rows.push(["", "HT", "TPS (5%)", "TVQ (9.975%)", "Total TTC", "Nb"]);
    rows.push([t("revenus"), report.summary.revenue.ht.toFixed(2), report.summary.revenue.tps.toFixed(2), report.summary.revenue.tvq.toFixed(2), report.summary.revenue.ttc.toFixed(2), String(report.summary.revenue.count)]);
    rows.push([t("remboursements"), report.summary.refunds.ht.toFixed(2), report.summary.refunds.tps.toFixed(2), report.summary.refunds.tvq.toFixed(2), report.summary.refunds.ttc.toFixed(2), String(report.summary.refunds.count)]);
    rows.push([t("net_declarer"), report.summary.net.ht.toFixed(2), report.summary.net.tps.toFixed(2), report.summary.net.tvq.toFixed(2), report.summary.net.ttc.toFixed(2), ""]);
    rows.push([]);
    rows.push([t("detail_mois")]);
    rows.push([t("mois"), "HT", "TPS", "TVQ", "TTC", t("nb")]);
    report.byMonth.forEach((m) => rows.push([m.month, m.ht.toFixed(2), m.tps.toFixed(2), m.tvq.toFixed(2), m.ttc.toFixed(2), String(m.count)]));
    rows.push([]);
    rows.push([t("detail_methode")]);
    rows.push([t("methode"), t("total"), t("nb")]);
    report.byMethod.forEach((m) => rows.push([m.method, m.total.toFixed(2), String(m.count)]));

    const csv = "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-tps-tvq_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("rapport_fiscal_tps_tvq")}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs">
            {t("totaux_declarer_gouvernements_revenu_canada")}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">

          <div className="space-y-2">
            <Label className="text-xs">{t("periode")}</Label>
            <div className="flex flex-wrap gap-2 items-end">
              <Select onValueChange={applyPreset}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("prereglage")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">{t("mois")}</SelectItem>
                  <SelectItem value="last_month">{t("mois_dernier")}</SelectItem>
                  <SelectItem value="q1">{t("t1_jan_mar")}</SelectItem>
                  <SelectItem value="q2">{t("t2_avr_juin")}</SelectItem>
                  <SelectItem value="q3">{t("t3_juil_sept")}</SelectItem>
                  <SelectItem value="q4">{t("t4_oct_dec")}</SelectItem>
                  <SelectItem value="this_year">{t("annee")}</SelectItem>
                  <SelectItem value="last_year">{t("annee_derniere")}</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Label className="text-[10px] text-muted-foreground">{t("du")}</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px]" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">{t("au")}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px]" />
              </div>
              <Button size="sm" onClick={fetchReport} disabled={loading || !from || !to}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {loading ? t("calcul") : t("calculer")}
              </Button>
              {report && (
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {t("export_csv")}
                </Button>
              )}
            </div>
          </div>

          {report && (
            <>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {t("net_declarer")}
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-md border bg-emerald-50">
                    <p className="text-[10px] text-muted-foreground">{t("ht_revenus")}</p>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(report.summary.net.ht)}</p>
                  </div>
                  <div className="p-3 rounded-md border bg-blue-50">
                    <p className="text-[10px] text-muted-foreground">{t("tps_percue")}</p>
                    <p className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(report.summary.net.tps)}</p>
                  </div>
                  <div className="p-3 rounded-md border bg-violet-50">
                    <p className="text-[10px] text-muted-foreground">{t("tvq_percue")}</p>
                    <p className="text-lg font-bold text-violet-700 mt-1">{formatCurrency(report.summary.net.tvq)}</p>
                  </div>
                  <div className="p-3 rounded-md border bg-[#0F2D52] text-white">
                    <p className="text-[10px] text-white/60">{t("total_ttc")}</p>
                    <p className="text-lg font-bold mt-1">{formatCurrency(report.summary.net.ttc)}</p>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground italic">
                  {t("net_revenus_encaisses_remboursements_emis")}
                </div>
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-xs uppercase tracking-wider font-semibold text-emerald-600">Revenus ({report.summary.revenue.count})</p>
                  <div className="mt-2 space-y-0.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("ht")}</span><span>{formatCurrency(report.summary.revenue.ht)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("tps")}</span><span>{formatCurrency(report.summary.revenue.tps)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq")}</span><span>{formatCurrency(report.summary.revenue.tvq)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>{t("ttc")}</span><span>{formatCurrency(report.summary.revenue.ttc)}</span></div>
                  </div>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-xs uppercase tracking-wider font-semibold text-red-600">Remboursements ({report.summary.refunds.count})</p>
                  <div className="mt-2 space-y-0.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("ht")}</span><span>-{formatCurrency(report.summary.refunds.ht)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("tps")}</span><span>-{formatCurrency(report.summary.refunds.tps)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq")}</span><span>-{formatCurrency(report.summary.refunds.tvq)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>{t("ttc")}</span><span>-{formatCurrency(report.summary.refunds.ttc)}</span></div>
                  </div>
                </div>
              </div>


              {report.byMonth.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("detail_mois")}</p>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr className="text-left">
                          <th className="p-2">{t("mois_2")}</th>
                          <th className="p-2 text-right">{t("ht")}</th>
                          <th className="p-2 text-right">{t("tps")}</th>
                          <th className="p-2 text-right">{t("tvq")}</th>
                          <th className="p-2 text-right">{t("ttc")}</th>
                          <th className="p-2 text-right">{t("nb")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byMonth.map((m) => (
                          <tr key={m.month} className="border-t">
                            <td className="p-2 font-mono">{m.month}</td>
                            <td className="p-2 text-right">{formatCurrency(m.ht)}</td>
                            <td className="p-2 text-right">{formatCurrency(m.tps)}</td>
                            <td className="p-2 text-right">{formatCurrency(m.tvq)}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(m.ttc)}</td>
                            <td className="p-2 text-right">{m.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {report.byMethod.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("methode_paiement")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {report.byMethod.map((m) => (
                      <div key={m.method} className="p-2 rounded-md border bg-card">
                        <p className="text-[10px] text-muted-foreground capitalize">{m.method}</p>
                        <p className="text-sm font-bold">{formatCurrency(m.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{m.count} transaction(s)</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {report.topClients.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("top_10_clients_periode")}</p>
                  <div className="space-y-1">
                    {report.topClients.map((c, i) => (
                      <div key={c.clientId} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono w-5">#{i + 1}</span>
                          {c.name}
                        </span>
                        <span className="text-right">
                          <span className="font-bold">{formatCurrency(c.total)}</span>
                          <span className="text-muted-foreground"> · {c.count}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
