export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalQuotesList } from "./quotes-list";

export default async function PortalQuotesPage() {
  const session = await auth();
  const rawQuotes = await prisma.quote.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  const quotes = rawQuotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    title: q.title,
    status: q.status,
    amountHt: Number(q.amountHt),
    tpsAmount: Number(q.tpsAmount),
    tvqAmount: Number(q.tvqAmount),
    amountTtc: Number(q.amountTtc),
    discountAmount: q.discountAmount != null ? Number(q.discountAmount) : null,
    expiryDate: q.expiryDate?.toISOString() ?? null,
    acceptedAt: q.acceptedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
  }));
  return <PortalQuotesList quotes={quotes} />;
}
