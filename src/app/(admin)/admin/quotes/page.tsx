import { prisma } from "@/lib/prisma";
import { QuotesTable } from "./quotes-table";

export default async function QuotesPage() {
  const rawQuotes = await prisma.quote.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const quotes = rawQuotes.map((q) => ({
    ...q,
    amountHt: Number(q.amountHt),
    tpsAmount: Number(q.tpsAmount),
    tvqAmount: Number(q.tvqAmount),
    amountTtc: Number(q.amountTtc),
    discountAmount: q.discountAmount != null ? Number(q.discountAmount) : null,
  }));

  return <QuotesTable quotes={quotes} />;
}
