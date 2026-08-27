import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PayrollView } from "./payroll-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("employes_paie") };
}
export const dynamic = "force-dynamic";

export default async function PaiePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isPayrollAdmin = me?.customRole?.name === "super_admin" || (perms.payroll ?? []).includes("write");

  // Pour l'employé : ses propres bulletins
  // Pour RH/compta : tous les bulletins + périodes
  const [periods, myStubs, allStubs] = await Promise.all([
    isPayrollAdmin
      ? prisma.payPeriod.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { stubs: true } } } })
      : Promise.resolve([]),
    prisma.payStub.findMany({
      where: { adminId, releasedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { period: { select: { startDate: true, endDate: true, payDate: true } } },
    }),
    isPayrollAdmin
      ? prisma.payStub.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            period: { select: { id: true, startDate: true, endDate: true, status: true } },
            admin: { select: { id: true, fullName: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <PayrollView
      periods={JSON.parse(JSON.stringify(periods))}
      myStubs={JSON.parse(JSON.stringify(myStubs))}
      allStubs={JSON.parse(JSON.stringify(allStubs))}
      isPayrollAdmin={isPayrollAdmin}
    />
  );
}
