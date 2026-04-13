// Portail client layout — sidebar + bottom nav (PublicNav fournie par le parent)
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

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "client") {
    redirect("/portail/login");
  }

  const client = await getClient(session!.user.clientId!);

  return (
    <div className="h-[calc(100vh-70px)] overflow-hidden">
      <div className="flex h-full">
        <PortalSidebar
          clientName={client?.fullName ?? ""}
          clientCompany={client?.companyName ?? undefined}
        />
        <main className="flex-1 overflow-y-auto lg:pl-[240px] pb-[64px] lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <PortalBottomNav />
    </div>
  );
}
