import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MyPayrollView } from "./my-payroll-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("mon_espace_ma_paie") };
}
export const dynamic = "force-dynamic";

export default async function MyPaiePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [stubs, taxDocs] = await Promise.all([
    prisma.payStub.findMany({
      where: { adminId, releasedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { period: { select: { id: true, startDate: true, endDate: true, payDate: true } } },
    }),
    prisma.taxDocument.findMany({
      where: { adminId },
      orderBy: [{ taxYear: "desc" }, { issuedAt: "desc" }],
      select: {
        id: true,
        type: true,
        taxYear: true,
        title: true,
        fileUrl: true,
        issuedAt: true,
      },
    }),
  ]);

  return (
    <MyPayrollView
      stubs={JSON.parse(JSON.stringify(stubs))}
      taxDocs={JSON.parse(JSON.stringify(taxDocs))}
    />
  );
}
