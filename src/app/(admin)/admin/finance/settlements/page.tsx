import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SettlementsView } from "./settlements-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("rapport_reglement") };
}

// Champs date filtrables (selon ce que le user veut voir)
type DateField = "paidAt" | "settledAt" | "payoutAt";
const VALID_DATE_FIELDS: DateField[] = ["paidAt", "settledAt", "payoutAt"];

// Types de transaction filtrables
const VALID_TYPES = ["all", "charge", "refund", "chargeback", "chargeback_fee", "adjustment", "topup"] as const;
type TypeFilter = typeof VALID_TYPES[number];

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; filterBy?: string; type?: string }>;
}) {
  const params = await searchParams;

  // Validation defensive — new Date("foo") retourne Invalid Date qui plante Prisma
  function parseSafe(s: string | undefined, fallback: Date): Date {
    if (!s) return fallback;
    const d = new Date(s);
    return isNaN(d.getTime()) ? fallback : d;
  }
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  let from = parseSafe(params.from, defaultFrom);
  let to = parseSafe(params.to, new Date());
  if (from > to) [from, to] = [to, from];

  // Champ date à utiliser pour le filtre (default paidAt)
  const filterBy: DateField = VALID_DATE_FIELDS.includes(params.filterBy as DateField)
    ? (params.filterBy as DateField)
    : "paidAt";

  // Filtre type (default all)
  const typeFilter: TypeFilter = (VALID_TYPES as readonly string[]).includes(params.type ?? "all")
    ? ((params.type ?? "all") as TypeFilter)
    : "all";

  // Build where dynamique selon le filtre
  const where: Record<string, unknown> = {
    [filterBy]: { gte: from, lte: to },
    status: { in: ["succeeded", "paid", "refunded"] },
  };
  if (typeFilter !== "all") where.type = typeFilter;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { [filterBy]: "asc" },
    include: {
      client: { select: { fullName: true, companyName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    take: 5000,
  });

  const rows = payments.map((p) => ({
    id: p.id,
    paidAt: p.paidAt?.toISOString() ?? null,
    settledAt: p.settledAt?.toISOString() ?? null,
    payoutAt: p.payoutAt?.toISOString() ?? null,
    clientName: p.client?.fullName ?? "—",
    cardholderName: p.cardholderName ?? p.client?.fullName ?? "—",
    type: p.type ?? "charge",
    status: p.status,
    amount: Number(p.amount),
    currency: (p.currency ?? "cad").toUpperCase(),
    processingFee: p.processingFee != null ? Number(p.processingFee) : null,
    netAmount: p.netAmount != null ? Number(p.netAmount) : null,
    stripePaymentIntentId: p.stripePaymentIntentId,
    paymentMethod: p.paymentMethod,
    stripeBalanceTxId: p.stripeBalanceTxId,
    stripePayoutId: p.stripePayoutId,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
  }));

  // KPIs
  let totalGross = 0, totalFees = 0, totalNet = 0;
  let chargeCount = 0, refundCount = 0, chargebackCount = 0;
  rows.forEach((r) => {
    totalGross += r.amount;
    totalFees += r.processingFee ?? 0;
    totalNet += r.netAmount ?? r.amount;
    if (r.type === "charge") chargeCount++;
    else if (r.type === "refund") refundCount++;
    else if (r.type === "chargeback") chargebackCount++;
  });

  return (
    <SettlementsView
      rows={rows}
      kpis={{ totalGross, totalFees, totalNet, chargeCount, refundCount, chargebackCount, count: rows.length }}
      dateRange={{ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }}
      filterBy={filterBy}
      typeFilter={typeFilter}
    />
  );
}
