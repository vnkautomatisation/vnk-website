// Portail client layout
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "client") {
    redirect({ href: "/portail/login", locale });
  }

  const client = await prisma.client.findUnique({
    where: { id: session!.user.clientId! },
    select: { fullName: true, companyName: true },
  });

  return (
    <div className="min-h-screen bg-muted/30 pb-[64px] lg:pb-0">
      <PortalSidebar
        clientName={client?.fullName ?? ""}
        clientCompany={client?.companyName ?? undefined}
      />
      <main className="lg:pl-[240px]">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <PortalBottomNav />
    </div>
  );
}
