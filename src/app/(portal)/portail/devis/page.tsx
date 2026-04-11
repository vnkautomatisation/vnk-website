import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalQuotesList } from "./quotes-list";

export default async function PortalQuotesPage() {
  const session = await auth();
  const quotes = await prisma.quote.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalQuotesList quotes={quotes} />;
}
