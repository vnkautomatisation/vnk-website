// Admin · Statistiques avancées avec graphiques temps réel.
// Charge les agrégats côté serveur, délègue le rendu graphique au client.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StatisticsView } from "./statistics-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Statistiques — VNK" };

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const params = await searchParams;
  const range = params.range ?? "12m"; // 30d | 90d | 6m | 12m | ytd | all
  const now = new Date();

  let from: Date;
  switch (range) {
    case "30d": from = new Date(now); from.setDate(from.getDate() - 30); break;
    case "90d": from = new Date(now); from.setDate(from.getDate() - 90); break;
    case "6m": from = addMonths(startOfMonth(now), -5); break;
    case "ytd": from = new Date(now.getFullYear(), 0, 1); break;
    case "all": from = new Date(2020, 0, 1); break;
    case "12m":
    default: from = addMonths(startOfMonth(now), -11); break;
  }

  // KPIs principaux (cumul depuis "from")
  const [
    totalInvoices, paidInvoices, totalQuotes, acceptedQuotes,
    totalClients, activeMandates,
    revenueAgg, outstandingAgg,
    invoicesByMonth, clientsByMonth,
    topClients, statusBreakdown, serviceBreakdown,
  ] = await Promise.all([
    prisma.invoice.count({ where: { createdAt: { gte: from } } }),
    prisma.invoice.count({ where: { paidAt: { gte: from, not: null } } }),
    prisma.quote.count({ where: { createdAt: { gte: from } } }),
    prisma.quote.count({ where: { createdAt: { gte: from }, status: "accepted" } }),
    prisma.client.count({ where: { createdAt: { gte: from } } }),
    prisma.mandate.count({ where: { status: { not: "completed" } } }),

    prisma.invoice.aggregate({
      where: { paidAt: { gte: from, not: null } },
      _sum: { amountTtc: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["unpaid", "partially_paid", "overdue"] } },
      _sum: { amountTtc: true },
    }),

    // Évolution mensuelle factures payées
    prisma.$queryRaw<Array<{ month: Date; revenue: string; count: bigint }>>`
      SELECT DATE_TRUNC('month', paid_at) AS month,
             COALESCE(SUM(amount_ttc), 0)::text AS revenue,
             COUNT(*) AS count
      FROM invoices
      WHERE paid_at >= ${from}
      GROUP BY DATE_TRUNC('month', paid_at)
      ORDER BY month ASC
    `,

    // Nouveaux clients par mois
    prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
      SELECT DATE_TRUNC('month', created_at) AS month,
             COUNT(*) AS count
      FROM clients
      WHERE created_at >= ${from}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,

    // Top 10 clients par CA
    prisma.$queryRaw<Array<{ id: number; name: string; company: string | null; total: string }>>`
      SELECT c.id, c.full_name AS name, c.company_name AS company,
             COALESCE(SUM(i.amount_ttc), 0)::text AS total
      FROM clients c
      JOIN invoices i ON i.client_id = c.id
      WHERE i.paid_at >= ${from}
      GROUP BY c.id, c.full_name, c.company_name
      ORDER BY SUM(i.amount_ttc) DESC
      LIMIT 10
    `,

    // Répartition par statut de facture
    prisma.$queryRaw<Array<{ status: string; count: bigint; total: string }>>`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_ttc), 0)::text AS total
      FROM invoices
      WHERE created_at >= ${from}
      GROUP BY status
      ORDER BY COUNT(*) DESC
    `,

    // Répartition par type de service
    prisma.$queryRaw<Array<{ service: string | null; count: bigint; total: string }>>`
      SELECT service_type AS service, COUNT(*) AS count, COALESCE(SUM(amount_ttc), 0)::text AS total
      FROM invoices
      WHERE created_at >= ${from} AND service_type IS NOT NULL
      GROUP BY service_type
      ORDER BY SUM(amount_ttc) DESC
      LIMIT 10
    `,
  ]);

  const revenue = Number(revenueAgg._sum.amountTtc ?? 0);
  const outstanding = Number(outstandingAgg._sum.amountTtc ?? 0);

  const conversionRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
  const paymentRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

  // Sérialiser les BigInt
  const seriesInvoices = invoicesByMonth.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    revenue: Number(r.revenue),
    count: Number(r.count),
  }));
  const seriesClients = clientsByMonth.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    count: Number(r.count),
  }));
  const top = topClients.map((r) => ({
    id: r.id, name: r.name, company: r.company,
    total: Number(r.total),
  }));
  const statusRows = statusBreakdown.map((r) => ({
    status: r.status, count: Number(r.count), total: Number(r.total),
  }));
  const serviceRows = serviceBreakdown.map((r) => ({
    service: r.service ?? "Non catégorisé", count: Number(r.count), total: Number(r.total),
  }));

  return (
    <StatisticsView
      range={range}
      kpis={{
        revenue, outstanding,
        totalInvoices, paidInvoices, paymentRate,
        totalQuotes, acceptedQuotes, conversionRate,
        totalClients, activeMandates,
      }}
      seriesInvoices={seriesInvoices}
      seriesClients={seriesClients}
      topClients={top}
      statusBreakdown={statusRows}
      serviceBreakdown={serviceRows}
    />
  );
}
