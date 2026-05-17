import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PayrollView } from "../../employes/paie/payroll-view";

export default async function MyPaiePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const myStubs = await prisma.payStub.findMany({
    where: { adminId, releasedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { period: { select: { startDate: true, endDate: true, payDate: true } } },
  });

  return (
    <PayrollView
      periods={[]}
      myStubs={JSON.parse(JSON.stringify(myStubs))}
      allStubs={[]}
      isPayrollAdmin={false}
    />
  );
}
