import { prisma } from "@/lib/prisma";
import { FinanceView } from "./finance-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tableau de bord finance" };

const DAYS_WINDOW = 30; // fenêtre du graphique d'évolution journalière (comme Wix)

export default async function FinancePage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last90 = new Date();
  last90.setDate(last90.getDate() - 90);

  // Fenêtre courante (30 derniers jours) + fenêtre précédente (jours -60 à -30) pour calcul de variation
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - DAYS_WINDOW + 1);
  windowStart.setHours(0, 0, 0, 0);

  const previousWindowStart = new Date(windowStart);
  previousWindowStart.setDate(previousWindowStart.getDate() - DAYS_WINDOW);
  const previousWindowEnd = new Date(windowStart);
  previousWindowEnd.setMilliseconds(previousWindowEnd.getMilliseconds() - 1);

  const [
    paid, unpaid, overdue, invoiced,
    paidThisMonth, paidLastMonth, paidYear,
    payments, refundsAgg, disputes,
    byMonthRaw,
    paymentsWindow, paymentsPrevWindow,
  ] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, _count: true, where: { status: "paid" } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, _count: true, where: { status: "unpaid" } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, _count: true, where: { status: "overdue" } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: monthStart } } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: yearStart } } }),
    prisma.payment.findMany({
      where: { status: { in: ["succeeded", "paid"] }, paidAt: { gte: last90 } },
      include: {
        client: { select: { id: true, fullName: true, companyName: true, country: true, city: true, createdAt: true } },
        invoice: { select: { invoiceNumber: true, amountHt: true, tpsAmount: true, tvqAmount: true, currency: true, serviceType: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 1000,
    }),
    prisma.refund.aggregate({ _sum: { amount: true }, _count: true, where: { status: { in: ["processed", "confirmed"] } } }),
    prisma.dispute.aggregate({ _sum: { amountDisputed: true }, _count: true, where: { status: "open" } }),
    prisma.payment.findMany({
      where: { status: { in: ["succeeded", "paid"] }, paidAt: { gte: new Date(now.getFullYear() - 1, 0, 1) } },
      select: { paidAt: true, amount: true, currency: true },
      orderBy: { paidAt: "asc" },
    }),
    // Fenêtre courante (30 jours)
    prisma.payment.findMany({
      where: { status: { in: ["succeeded", "paid"] }, paidAt: { gte: windowStart } },
      select: { paidAt: true, amount: true, amountCad: true, currency: true, paymentMethod: true, clientId: true },
    }),
    // Fenêtre précédente (jours -60 à -30) pour delta %
    prisma.payment.findMany({
      where: { status: { in: ["succeeded", "paid"] }, paidAt: { gte: previousWindowStart, lte: previousWindowEnd } },
      select: { amount: true, amountCad: true },
    }),
  ]);

  // ─── Évolution journalière (30 jours, AreaChart) ───────────
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < DAYS_WINDOW; i++) {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  paymentsWindow.forEach((p) => {
    if (!p.paidAt) return;
    const key = p.paidAt.toISOString().slice(0, 10);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(p.amountCad ?? p.amount));
    }
  });
  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total }));

  const windowTotal = paymentsWindow.reduce((s, p) => s + Number(p.amountCad ?? p.amount), 0);
  const previousWindowTotal = paymentsPrevWindow.reduce((s, p) => s + Number(p.amountCad ?? p.amount), 0);
  const windowDeltaPct = previousWindowTotal > 0
    ? Math.round(((windowTotal - previousWindowTotal) / previousWindowTotal) * 1000) / 10
    : null;

  // ─── Répartition par moyen de paiement (30 jours) ──────────
  const methodMap = new Map<string, { count: number; total: number }>();
  paymentsWindow.forEach((p) => {
    const method = (p.paymentMethod ?? "autre").toLowerCase();
    const cur = methodMap.get(method) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(p.amountCad ?? p.amount);
    methodMap.set(method, cur);
  });
  const byPaymentMethod = Array.from(methodMap.entries())
    .map(([method, v]) => ({ method, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);

  // ─── Nouveaux vs récurrents (30 jours) ─────────────────────
  // Un client est "nouveau" si son premier paiement est dans la fenêtre courante.
  // Utilise un groupBy SQL pour éviter un full-table scan.
  const clientsInWindow = new Set<number>();
  paymentsWindow.forEach((p) => p.clientId && clientsInWindow.add(p.clientId));
  let newClientCount = 0;
  let returningClientCount = 0;
  if (clientsInWindow.size > 0) {
    const firstPayments = await prisma.payment.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: Array.from(clientsInWindow) },
        status: { in: ["succeeded", "paid"] },
      },
      _min: { paidAt: true },
    });
    firstPayments.forEach((row) => {
      const first = row._min.paidAt;
      if (first && first >= windowStart) newClientCount++;
      else returningClientCount++;
    });
  }

  // ─── Répartition mensuelle (12 derniers mois) ──────────────
  const monthMap = new Map<string, { ttc: number; count: number }>();
  byMonthRaw.forEach((p) => {
    if (!p.paidAt) return;
    const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, "0")}`;
    const cur = monthMap.get(key) ?? { ttc: 0, count: 0 };
    cur.ttc += Number(p.amount);
    cur.count += 1;
    monthMap.set(key, cur);
  });
  const monthlyRevenue = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, ttc: v.ttc, count: v.count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ─── Répartition par juridiction (pays client) ─────────────
  const jurisdictionMap = new Map<string, { count: number; total: number; clients: Set<number> }>();
  payments.forEach((p) => {
    const country = p.client?.country || "CA";
    const cur = jurisdictionMap.get(country) ?? { count: 0, total: 0, clients: new Set() };
    cur.count += 1;
    cur.total += Number(p.amountCad ?? p.amount);
    if (p.client?.id) cur.clients.add(p.client.id);
    jurisdictionMap.set(country, cur);
  });
  const byJurisdiction = Array.from(jurisdictionMap.entries())
    .map(([country, v]) => ({ country, count: v.count, total: v.total, clientCount: v.clients.size }))
    .sort((a, b) => b.total - a.total);

  // ─── Répartition par devise (séparée, sans conversion) ─────
  const currencyMap = new Map<string, { count: number; total: number; totalCad: number; clients: Set<number> }>();
  payments.forEach((p) => {
    const cur = (p.currency || "CAD").toUpperCase();
    const m = currencyMap.get(cur) ?? { count: 0, total: 0, totalCad: 0, clients: new Set() };
    m.count += 1;
    m.total += Number(p.amount);
    m.totalCad += Number(p.amountCad ?? p.amount);
    if (p.client?.id) m.clients.add(p.client.id);
    currencyMap.set(cur, m);
  });
  const byCurrency = Array.from(currencyMap.entries())
    .map(([currency, v]) => ({ currency, count: v.count, total: v.total, totalCad: v.totalCad, clientCount: v.clients.size }))
    .sort((a, b) => b.totalCad - a.totalCad);

  // ─── Top villes (90 jours, équivalent carte Wix) ───────────
  const cityMap = new Map<string, { city: string; country: string; total: number; count: number }>();
  payments.forEach((p) => {
    const city = p.client?.city?.trim();
    if (!city) return;
    const country = p.client?.country || "CA";
    const key = `${country}|${city}`;
    const cur = cityMap.get(key) ?? { city, country, total: 0, count: 0 };
    cur.total += Number(p.amountCad ?? p.amount);
    cur.count += 1;
    cityMap.set(key, cur);
  });
  const topCities = Array.from(cityMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

  // ─── Répartition par type de service ───────────────────────
  const serviceMap = new Map<string, { total: number; count: number }>();
  payments.forEach((p) => {
    const svc = p.invoice?.serviceType ?? "Non catégorisé";
    const cur = serviceMap.get(svc) ?? { total: 0, count: 0 };
    cur.total += Number(p.amountCad ?? p.amount);
    cur.count += 1;
    serviceMap.set(svc, cur);
  });
  const byService = Array.from(serviceMap.entries())
    .map(([service, v]) => ({ service, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  // ─── Top clients (90 jours) ────────────────────────────────
  const clientMap = new Map<number, { id: number; name: string; company: string | null; total: number; count: number; city: string | null; country: string }>();
  payments.forEach((p) => {
    if (!p.client?.id) return;
    const cur = clientMap.get(p.client.id) ?? {
      id: p.client.id,
      name: p.client.fullName,
      company: p.client.companyName,
      city: p.client.city,
      country: p.client.country || "CA",
      total: 0,
      count: 0,
    };
    cur.total += Number(p.amountCad ?? p.amount);
    cur.count += 1;
    clientMap.set(p.client.id, cur);
  });
  const topClients = Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

  const thisMonth = Number(paidThisMonth._sum.amountTtc ?? 0);
  const lastMonth = Number(paidLastMonth._sum.amountTtc ?? 0);
  const monthDelta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : null;

  return (
    <FinanceView
      kpis={{
        totalPaid: Number(paid._sum.amountTtc ?? 0),
        totalPaidCount: paid._count,
        totalUnpaid: Number(unpaid._sum.amountTtc ?? 0),
        totalUnpaidCount: unpaid._count,
        totalOverdue: Number(overdue._sum.amountTtc ?? 0),
        totalOverdueCount: overdue._count,
        totalInvoiced: Number(invoiced._sum.amountTtc ?? 0),
        paidThisMonth: thisMonth,
        paidLastMonth: lastMonth,
        monthDeltaPct: monthDelta,
        paidThisYear: Number(paidYear._sum.amountTtc ?? 0),
        totalRefunded: Number(refundsAgg._sum.amount ?? 0),
        refundedCount: refundsAgg._count,
        totalDisputed: Number(disputes._sum.amountDisputed ?? 0),
        disputedCount: disputes._count,
        // Fenêtre 30 jours
        windowTotal,
        windowDeltaPct,
        windowDays: DAYS_WINDOW,
        newClientCount,
        returningClientCount,
      }}
      dailyRevenue={dailyRevenue}
      monthlyRevenue={monthlyRevenue}
      byJurisdiction={byJurisdiction}
      byCurrency={byCurrency}
      byPaymentMethod={byPaymentMethod}
      byService={byService}
      topCities={topCities}
      topClients={topClients}
    />
  );
}
