// Portail client layout — sidebar + contenu scrollable (nav publique fournie par parent)
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";

const getClient = cache(async (clientId: number) =>
  prisma.client.findUnique({
    where: { id: clientId },
    select: { fullName: true, companyName: true },
  })
);

const getBadgeCounts = cache(async (clientId: number) => {
  const [unpaidInvoices, pendingQuotes, pendingContracts, unreadDocs] =
    await Promise.all([
      prisma.invoice.count({
        where: { clientId, status: { in: ["unpaid", "overdue"] } },
      }),
      prisma.quote.count({
        where: { clientId, status: "pending" },
      }),
      prisma.contract.count({
        where: { clientId, status: "pending", clientSignatureData: null },
      }),
      prisma.document.count({
        where: { clientId, isRead: false },
      }),
    ]);
  return { unpaidInvoices, pendingQuotes, pendingContracts, unreadDocs };
});

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "client") {
    redirect("/portail/login");
  }

  const clientId = session!.user.clientId!;
  const [client, badges] = await Promise.all([
    getClient(clientId),
    getBadgeCounts(clientId),
  ]);

  return (
    <>
      {/* Force le parent (main du layout public) a ne pas scroller */}
      <style>{`
        body, html { overflow: hidden !important; height: 100vh !important; }
      `}</style>

      <div className="fixed inset-0 top-[70px] flex">
        <PortalSidebar
          clientName={client?.fullName ?? ""}
          clientCompany={client?.companyName ?? undefined}
          badges={badges}
        />
        <main className="flex-1 lg:pl-[240px] overflow-y-auto no-scrollbar pb-[64px] lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <PortalBottomNav />
    </>
  );
}
