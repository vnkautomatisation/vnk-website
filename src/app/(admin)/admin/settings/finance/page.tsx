// Settings · Finance · Fiscalité · Loi 25
// Charge tous les paramètres regroupés des catégories finance, fiscal, legal.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceView } from "./finance-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finance & Fiscalité — VNK" };

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const rows = await prisma.setting.findMany({
    where: { category: { in: ["finance", "fiscal", "legal", "billing"] } },
  });
  const settings: Record<string, string> = {};
  for (const r of rows) settings[`${r.category}.${r.key}`] = r.value ?? "";

  return <FinanceView initial={settings} />;
}
