// Admin layout : sidebar + topbar + main content
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

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
  const [admin, overdueCount] = await Promise.all([
    adminId ? getAdmin(adminId) : null,
    getOverdueCount(),
  ]);

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
