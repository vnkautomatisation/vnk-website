import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MyPayrollView } from "./my-payroll-view";

export const metadata: Metadata = { title: "Mon espace — Ma paie" };
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
