import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PoliciesView } from "./policies-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Congés — Politiques" };

export default async function PoliciesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const canManage = me?.customRole?.name === "super_admin" || (perms.users ?? []).includes("write") || (perms.leaves ?? []).includes("write");
  if (!canManage) redirect("/admin/employes/conges");

  const [policies, admins] = await Promise.all([
    prisma.leavePolicy.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true, leavePolicyId: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <PoliciesView
      policies={JSON.parse(JSON.stringify(policies))}
      admins={admins}
    />
  );
}
