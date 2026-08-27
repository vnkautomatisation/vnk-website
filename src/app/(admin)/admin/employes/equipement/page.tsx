// Page admin Équipement — RH assigne du matériel aux employés.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EquipmentView } from "./equipment-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("employes_equipement") };
}

export default async function HrEquipmentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [items, employees, me] = await Promise.all([
    prisma.assignedEquipment.findMany({
      include: { admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: [{ returnedAt: "asc" }, { assignedAt: "desc" }],
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.admin.findUnique({
      where: { id: adminId },
      include: { customRole: true },
    }),
  ]);

  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");

  return (
    <EquipmentView
      items={JSON.parse(JSON.stringify(items))}
      employees={employees}
      isHr={isHr}
    />
  );
}
