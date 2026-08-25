import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BibliothequeView } from "./bibliotheque-view";

export const metadata: Metadata = { title: "Documents — Bibliothèque" };
export const dynamic = "force-dynamic";

export default async function BibliothequePage() {
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
    || (perms.hr ?? []).includes("write")
    || (perms.hr_documents ?? []).includes("write");

  if (!isHr) redirect("/admin/mon-espace/documents");

  const [legalTemplates, contractTemplates, hrPolicies, employees, teams] = await Promise.all([
    prisma.legalDocumentTemplate.findMany({
      orderBy: [{ isStarter: "desc" }, { category: "asc" }, { title: "asc" }],
      select: {
        id: true,
        key: true,
        title: true,
        category: true,
        version: true,
        bodyMarkdown: true,
        isActive: true,
        isRequired: true,
        isStarter: true,
        targetPositions: true,
        targetDepartments: true,
        createdAt: true,
        updatedAt: true,
        // Mission 5 : acknowledgmentMode -> bouton "Envoyer pour lecture" vs "Demander signature"
        ...({ acknowledgmentMode: true } as object),
      },
    }),
    prisma.contractTemplate.findMany({
      orderBy: [{ isStarter: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        contractType: true,
        bodyMarkdown: true,
        isActive: true,
        isStarter: true,
        targetPositions: true,
        targetDepartments: true,
        defaultSalary: true,
        defaultHoursPerWeek: true,
        defaultVacationPct: true,
        probationDays: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.hrPolicy.findMany({
      orderBy: [{ isStarter: "desc" }, { title: "asc" }],
      select: {
        id: true,
        key: true,
        title: true,
        bodyMarkdown: true,
        version: true,
        isActive: true,
        isStarter: true,
        effectiveFrom: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        position: true,
        avatarUrl: true,
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <BibliothequeView
      legalTemplates={JSON.parse(JSON.stringify(legalTemplates))}
      contractTemplates={JSON.parse(JSON.stringify(contractTemplates))}
      hrPolicies={JSON.parse(JSON.stringify(hrPolicies))}
      employees={JSON.parse(JSON.stringify(employees))}
      teams={JSON.parse(JSON.stringify(teams))}
    />
  );
}
