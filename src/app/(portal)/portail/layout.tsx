// Portail client layout : topbar VNK + sidebar + bottom nav mobile
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "client") {
    redirect("/portail/login");
  }

  const client = await prisma.client.findUnique({
    where: { id: session!.user.clientId! },
    select: { fullName: true, companyName: true },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <PortalTopbar
        clientName={client?.fullName ?? ""}
        clientCompany={client?.companyName ?? undefined}
      />
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
