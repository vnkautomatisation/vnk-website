// Portail client layout — sidebar + contenu scrollable
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";
import { PortalUserMenu } from "@/components/portal/portal-user-menu";
import { ChatWidget } from "@/components/chat/chat-widget";

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
        where: { clientId, status: "pending" },
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
      <style>{`
        body, html { overflow: hidden !important; height: 100vh !important; }
      `}</style>

      {/* Avatar utilisateur dans la nav — devant EN + hamburger */}
      <div className="fixed top-0 right-[105px] sm:right-[116px] lg:right-[220px] z-[35] h-[72px] flex items-center">
        <PortalUserMenu
          name={client?.fullName ?? ""}
          initials={(client?.fullName ?? "C").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
        />
      </div>

      <div className="fixed inset-0 top-[72px] flex">
        <PortalSidebar
          clientName={client?.fullName ?? ""}
          clientCompany={client?.companyName ?? undefined}
          badges={badges}
        />
        <main className="flex-1 lg:pl-[240px] overflow-hidden pb-14 lg:pb-0 flex flex-col">
          <div className="p-3 sm:p-4 lg:p-8 max-w-full portal-content flex-1 overflow-y-auto">
            <Suspense>{children}</Suspense>
          </div>
        </main>
      </div>
      <PortalBottomNav badges={badges} />
      <ChatWidget clientId={clientId} clientName={client?.fullName ?? ""} />
    </>
  );
}
