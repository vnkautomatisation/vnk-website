// Mes contrats - vue mon-espace dediee (employe).
// Refonte VNK : header navy + KPIs + bandeau urgent + cartes contrats.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MesContratsView } from "./mes-contrats-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon espace - Mes contrats" };

export default async function MyContratsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [me, contracts] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.employeeContract.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        contractType: true,
        status: true,
        startDate: true,
        endDate: true,
        probationEndDate: true,
        salaryAnnual: true,
        hourlyRate: true,
        hoursPerWeek: true,
        vacationPct: true,
        employeeSignedAt: true,
        employerSignedAt: true,
        terminatedAt: true,
      },
    }),
  ]);

  if (!me) redirect("/admin/login");

  return (
    <MesContratsView
      contracts={JSON.parse(JSON.stringify(contracts))}
      meName={me.fullName ?? me.email}
    />
  );
}
