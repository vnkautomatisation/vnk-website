// GET /api/payments/tax-report?from=&to= — totaux TPS/TVQ + revenus pour une periode
// Pour declaration TPS/TVQ trimestrielle/annuelle aux gouvernements
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "read")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: t("periode_requise_from_to") }, { status: 400 });
  }

  const start = new Date(from);
  const end = new Date(to);
  end.setDate(end.getDate() + 1);

  // Paiements reussis dans la periode (basé sur paidAt)
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["succeeded", "paid"] },
      paidAt: { gte: start, lt: end },
    },
    include: {
      invoice: { select: { invoiceNumber: true, amountHt: true, tpsAmount: true, tvqAmount: true, amountTtc: true, title: true } },
      client: { select: { id: true, fullName: true, companyName: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  // Remboursements dans la periode
  const refunds = await prisma.refund.findMany({
    where: {
      status: { in: ["processed", "confirmed"] },
      processedAt: { gte: start, lt: end },
    },
    include: {
      invoice: { select: { invoiceNumber: true } },
      client: { select: { id: true, fullName: true } },
    },
  });

  // Agrégats
  let totalHt = 0;
  let totalTps = 0;
  let totalTvq = 0;
  let totalTtc = 0;
  payments.forEach((p) => {
    if (p.invoice) {
      totalHt += Number(p.invoice.amountHt);
      totalTps += Number(p.invoice.tpsAmount);
      totalTvq += Number(p.invoice.tvqAmount);
      totalTtc += Number(p.invoice.amountTtc);
    } else {
      // Pas de facture liée : on prend le montant comme TTC sans répartition fiscale
      totalTtc += Number(p.amount);
    }
  });

  const totalRefundedHt = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const totalRefundedTps = refunds.reduce((s, r) => s + Number(r.tpsAmount), 0);
  const totalRefundedTvq = refunds.reduce((s, r) => s + Number(r.tvqAmount), 0);
  const totalRefundedTtc = refunds.reduce((s, r) => s + Number(r.totalAmount), 0);

  // Net (à déclarer)
  const netHt = totalHt - totalRefundedHt;
  const netTps = totalTps - totalRefundedTps;
  const netTvq = totalTvq - totalRefundedTvq;
  const netTtc = totalTtc - totalRefundedTtc;

  // Détail par mois (pour split trimestre / année)
  const byMonth = new Map<string, { ht: number; tps: number; tvq: number; ttc: number; count: number }>();
  payments.forEach((p) => {
    const d = p.paidAt ?? p.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { ht: 0, tps: 0, tvq: 0, ttc: 0, count: 0 };
    if (p.invoice) {
      cur.ht += Number(p.invoice.amountHt);
      cur.tps += Number(p.invoice.tpsAmount);
      cur.tvq += Number(p.invoice.tvqAmount);
      cur.ttc += Number(p.invoice.amountTtc);
    } else {
      cur.ttc += Number(p.amount);
    }
    cur.count += 1;
    byMonth.set(key, cur);
  });

  // Détail par méthode de paiement (pour réconciliation bancaire)
  const byMethod = new Map<string, { count: number; total: number }>();
  payments.forEach((p) => {
    const m = p.paymentMethod ?? "inconnu";
    const cur = byMethod.get(m) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(p.amount);
    byMethod.set(m, cur);
  });

  // Détail par client (top 10)
  const byClient = new Map<number, { name: string; count: number; total: number }>();
  payments.forEach((p) => {
    if (!p.client) return;
    const cur = byClient.get(p.client.id) ?? { name: p.client.companyName ?? p.client.fullName, count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(p.amount);
    byClient.set(p.client.id, cur);
  });
  const topClients = Array.from(byClient.entries())
    .map(([id, v]) => ({ clientId: id, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    period: { from, to },
    summary: {
      revenue: { ht: totalHt, tps: totalTps, tvq: totalTvq, ttc: totalTtc, count: payments.length },
      refunds: { ht: totalRefundedHt, tps: totalRefundedTps, tvq: totalRefundedTvq, ttc: totalRefundedTtc, count: refunds.length },
      net: { ht: netHt, tps: netTps, tvq: netTvq, ttc: netTtc },
    },
    byMonth: Array.from(byMonth.entries()).map(([month, v]) => ({ month, ...v })),
    byMethod: Array.from(byMethod.entries()).map(([method, v]) => ({ method, ...v })),
    topClients,
    transactions: payments.map((p) => ({
      id: p.id,
      paidAt: p.paidAt,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
      clientName: p.client?.fullName ?? null,
      amount: Number(p.amount),
      method: p.paymentMethod,
      ht: p.invoice ? Number(p.invoice.amountHt) : null,
      tps: p.invoice ? Number(p.invoice.tpsAmount) : null,
      tvq: p.invoice ? Number(p.invoice.tvqAmount) : null,
    })),
  });
}
