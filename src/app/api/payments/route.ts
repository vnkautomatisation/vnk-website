// GET /api/payments — liste paginee + filtres
// Filtres: ?status=succeeded,failed&method=stripe,interac&clientId=X&from=&to=&search=&limit=50&offset=0
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("payments", "read")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status")?.split(",").filter(Boolean);
  const methodFilter = searchParams.get("method")?.split(",").filter(Boolean);
  const clientId = searchParams.get("clientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter.length > 0) where.status = { in: statusFilter };
  if (methodFilter && methodFilter.length > 0) where.paymentMethod = { in: methodFilter };
  if (clientId) where.clientId = Number(clientId);

  if (from || to) {
    const dateWhere: Record<string, Date> = {};
    if (from) dateWhere.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      dateWhere.lte = end;
    }
    where.createdAt = dateWhere;
  }

  // Recherche dans stripePaymentIntentId + invoice number + client name (via OR sur relations)
  if (search) {
    where.OR = [
      { stripePaymentIntentId: { contains: search, mode: "insensitive" } },
      { invoice: { invoiceNumber: { contains: search, mode: "insensitive" } } },
      { client: { fullName: { contains: search, mode: "insensitive" } } },
      { client: { companyName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [payments, total, allForKpis] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, title: true, amountTtc: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.payment.count({ where }),
    // KPIs globaux (sans filtres pour avoir une vue d'ensemble)
    prisma.payment.findMany({
      select: { amount: true, status: true, paidAt: true, createdAt: true, paymentMethod: true },
    }),
  ]);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const succeeded = allForKpis.filter((p) => p.status === "succeeded" || p.status === "paid");
  const totalReceived = succeeded.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonth = succeeded.filter((p) => (p.paidAt ?? p.createdAt) >= firstOfMonth);
  const thisMonthAmount = thisMonth.reduce((s, p) => s + Number(p.amount), 0);
  const successRate = allForKpis.length > 0
    ? Math.round((succeeded.length / allForKpis.length) * 1000) / 10
    : 0;
  // Delai moyen entre createdAt et paidAt (jours) sur paiements reussis
  const withDelay = succeeded.filter((p) => p.paidAt && p.createdAt);
  const avgDelayDays = withDelay.length > 0
    ? Math.round(
        withDelay.reduce((s, p) => {
          const d = (new Date(p.paidAt!).getTime() - new Date(p.createdAt).getTime()) / 86400000;
          return s + d;
        }, 0) / withDelay.length * 10
      ) / 10
    : 0;

  return NextResponse.json({
    payments,
    total,
    limit,
    offset,
    kpis: {
      totalReceived,
      thisMonthAmount,
      thisMonthCount: thisMonth.length,
      totalCount: allForKpis.length,
      succeededCount: succeeded.length,
      successRate,
      avgDelayDays,
    },
  });
}
