import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { HandbooksAdminView } from "./handbooks-admin-view";

export const metadata: Metadata = { title: "Employes - Cahiers" };
export const dynamic = "force-dynamic";

export default async function HandbooksAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) redirect("/admin/login");

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  if (!isHr) redirect("/admin/mon-espace/documents");

  const [handbooks, templates, employees] = await Promise.all([
    prisma.documentHandbook.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
          include: {
            template: {
              select: { id: true, title: true, version: true, category: true },
            },
          },
        },
        signatures: {
          select: { id: true, adminId: true, signedAt: true, version: true, finalPdfUrl: true },
        },
      },
    }),
    prisma.legalDocumentTemplate.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      // Demande 7 : bodyMarkdown necessaire pour detecter les placeholders
      // [CHAMP] et exposer la UI de remplissage RH.
      select: {
        id: true,
        title: true,
        category: true,
        version: true,
        bodyMarkdown: true,
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return (
    <HandbooksAdminView
      handbooks={JSON.parse(JSON.stringify(handbooks))}
      templates={JSON.parse(JSON.stringify(templates))}
      employees={JSON.parse(JSON.stringify(employees))}
    />
  );
}
