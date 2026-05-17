// Mes contrats — vue filtrée sur soi-même.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContractsView } from "../../employes/contrats/contracts-view";

export default async function MyContratsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const contracts = await prisma.employeeContract.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, contractType: true, status: true,
      startDate: true, endDate: true, probationEndDate: true,
      salaryAnnual: true, hourlyRate: true, hoursPerWeek: true, vacationPct: true,
      employeeSignedAt: true, employerSignedAt: true, terminatedAt: true, adminId: true,
      admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      template: { select: { id: true, name: true } },
      employer: { select: { fullName: true, email: true } },
    },
  });

  return (
    <ContractsView
      contracts={JSON.parse(JSON.stringify(contracts))}
      templates={[]}
      employees={[]}
      positions={[]}
      currentAdminId={adminId}
      isHr={false}
    />
  );
}
