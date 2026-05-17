import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LegalDocsView } from "./legal-docs-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Documents légaux" };

export default async function LegalDocsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [templates, mySignatures, me] = await Promise.all([
    prisma.legalDocumentTemplate.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      include: {
        _count: { select: { signatures: true } },
      },
    }),
    prisma.legalDocumentSignature.findMany({
      where: { adminId },
      select: { templateId: true, version: true, signedAt: true },
    }),
    prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } }),
  ]);

  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.users ?? []).includes("write");

  return (
    <LegalDocsView
      templates={JSON.parse(JSON.stringify(templates))}
      mySignatures={JSON.parse(JSON.stringify(mySignatures))}
      isHr={isHr}
    />
  );
}
