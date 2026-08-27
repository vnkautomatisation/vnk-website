import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WindowsView } from "./windows-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("conges_fenetres_selection") };
}

export default async function VacationWindowsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const canManage = me?.customRole?.name === "super_admin" || (perms.users ?? []).includes("write") || (perms.leaves ?? []).includes("write");
  if (!canManage) redirect("/admin/employes/conges");

  const windows = await prisma.vacationSelectionWindow.findMany({
    orderBy: [{ status: "asc" }, { openingDate: "desc" }],
    include: {
      preferences: {
        include: {
          admin: { select: { id: true, fullName: true, email: true } },
          leaveRequest: { select: { id: true } },
        },
        orderBy: [{ adminId: "asc" }, { rank: "asc" }],
      },
    },
  });

  return <WindowsView windows={JSON.parse(JSON.stringify(windows))} />;
}
