// Admin layout — topbar pleine largeur + sidebar sous topbar + main content
// Meme structure que le portail
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { CommandPalette } from "@/components/admin/command-palette";
import { EntityPanelsRoot } from "@/components/admin/entity-panels-host";
import { AdminThemeProvider } from "@/components/admin/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const getAdmin = cache(async (adminId: number) =>
  prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true, email: true },
  })
);

const getOverdueCount = cache(async () =>
  prisma.invoice.count({
    where: { status: "overdue", dueDate: { lt: new Date() } },
  })
);

const getSidebarCounts = cache(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [unreadMessages, overdueInvoices, pendingQuotes, pendingContracts, activeMandates, newRequests, openDisputes, todayAppointments] = await Promise.all([
    prisma.message.count({ where: { sender: "client", isRead: false } }),
    prisma.invoice.count({ where: { status: "overdue" } }),
    prisma.quote.count({ where: { status: "pending" } }),
    prisma.contract.count({ where: { status: "pending" } }),
    prisma.mandate.count({ where: { status: { in: ["active", "in_progress"] } } }),
    prisma.projectRequest.count({ where: { status: "new" } }),
    prisma.dispute.count({ where: { status: "open" } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lt: todayEnd }, status: "confirmed" } }),
  ]);

  return { unreadMessages, overdueInvoices, pendingQuotes, pendingContracts, activeMandates, newRequests, openDisputes, todayAppointments };
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    redirect("/admin/login");
  }

  const adminId = session!.user.adminId;
  const [admin, overdueCount, sidebarCounts] = await Promise.all([
    adminId ? getAdmin(adminId) : null,
    getOverdueCount(),
    getSidebarCounts(),
  ]);

  return (
    <TooltipProvider delayDuration={300}>
      <AdminThemeProvider>
      <EntityPanelsRoot>
        <div className="min-h-screen bg-muted/40">
          <CommandPalette />

          {/* Topbar pleine largeur — toujours en haut */}
          <AdminTopbar
            adminName={admin?.fullName ?? admin?.email ?? "Admin"}
            adminEmail={admin?.email ?? ""}
            overdueCount={overdueCount}
          />

          {/* Sidebar — sous le topbar */}
          <AdminSidebar counts={sidebarCounts} />

          {/* Contenu principal — sous le topbar, suit dynamiquement la largeur de la sidebar
              via la CSS variable --admin-sidebar-w (mise à jour par AdminSidebar selon mode compact) */}
          <main
            className="transition-[padding] duration-200 lg:pl-[var(--admin-sidebar-w,240px)]"
          >
            <div className="p-4 sm:p-5 lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </EntityPanelsRoot>
      </AdminThemeProvider>
    </TooltipProvider>
  );
}
