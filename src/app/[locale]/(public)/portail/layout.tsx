// Portail client layout — sidebar + bottom nav (PublicNav fournie par le parent)
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
    <div className="min-h-screen bg-muted/30">
      <div className="pb-[64px] lg:pb-0">
        <PortalSidebar
          clientName={client?.fullName ?? ""}
          clientCompany={client?.companyName ?? undefined}
        />
        <main className="lg:pl-[240px]">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
        <PortalBottomNav />
      </div>
    </div>
  );
}
