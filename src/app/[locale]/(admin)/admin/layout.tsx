// Admin layout : sidebar + topbar + main content
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  // Redirect to login if not authenticated or not admin
  if (!session?.user || session.user.role !== "admin") {
    redirect({ href: "/admin/login", locale });
  }

  const adminId = session!.user.adminId;
  const admin = adminId
    ? await prisma.admin.findUnique({
        where: { id: adminId },
        select: { fullName: true, email: true },
      })
    : null;

  // Count overdue invoices for the topbar badge
  const overdueCount = await prisma.invoice.count({
    where: {
      status: "overdue",
      dueDate: { lt: new Date() },
    },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminSidebar />
      <AdminTopbar
        adminName={admin?.fullName ?? admin?.email ?? "Admin"}
        adminEmail={admin?.email ?? ""}
        overdueCount={overdueCount}
      />
      <main className="lg:pl-[240px]">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
