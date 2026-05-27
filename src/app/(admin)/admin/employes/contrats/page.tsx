// Page Contrats — templates + contrats individuels + double signature.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContractsView } from "./contracts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Contrats" };

export default async function ContratsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [contracts, templates, employees, positions, me] = await Promise.all([
    prisma.employeeContract.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, contractType: true, status: true,
        startDate: true, endDate: true, probationEndDate: true,
        salaryAnnual: true, hourlyRate: true, hoursPerWeek: true, vacationPct: true,
        employeeSignedAt: true, employerSignedAt: true, terminatedAt: true,
        adminId: true,
        admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        template: { select: { id: true, name: true } },
        employer: { select: { fullName: true, email: true } },
      },
    }),
    prisma.contractTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { position: { select: { id: true, name: true } } },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        department: true,
        position: { select: { name: true } },
        team: { select: { name: true } },
      },
    }),
    prisma.position.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.admin.findUnique({
      where: { id: adminId },
      include: { customRole: true },
    }),
  ]);

  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");

  return (
    <ContractsView
      contracts={JSON.parse(JSON.stringify(contracts))}
      templates={JSON.parse(JSON.stringify(templates))}
      employees={employees}
      positions={positions}
      currentAdminId={adminId}
      isHr={isHr}
    />
  );
}
