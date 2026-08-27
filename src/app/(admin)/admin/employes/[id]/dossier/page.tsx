// Dossier employe — page complete (server component).
// Auth : super_admin OU permission users.write OU hr.write.
// Charge en parallele toutes les donnees RH liees a l'employe cible.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { DossierView } from "./dossier-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("dossier_employe") };
}

export const dynamic = "force-dynamic";

export default async function EmployeeDossierPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const actorId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) redirect("/admin/login");
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const canHr = isSuper || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");
  if (!canHr) redirect("/admin");

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [
    admin, notes, files, contracts, reviews, payAgg, leaves, equipment,
    licenses, trainings, cnesst, emergencyContacts, family, bank,
  ] = await Promise.all([
    prisma.admin.findUnique({
      where: { id },
      include: {
        position: { select: { id: true, name: true, color: true } },
        customRole: { select: { id: true, name: true, color: true } },
        team: { select: { id: true, name: true, color: true } },
        manager: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.employeeNote.findMany({
      where: { adminId: id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.employeeFile.findMany({
      where: { adminId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employeeContract.findMany({
      where: { adminId: id },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    prisma.performanceReview.findMany({
      where: { adminId: id },
      orderBy: { periodEnd: "desc" },
      take: 10,
      include: { reviewer: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.payStub.aggregate({
      where: { adminId: id, releasedAt: { not: null } },
      _count: true,
      _sum: { netPay: true, grossPay: true },
    }),
    prisma.leaveRequest.findMany({
      where: { adminId: id },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    prisma.assignedEquipment.findMany({
      where: { adminId: id, returnedAt: null },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.professionalLicense.findMany({
      where: { adminId: id },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.trainingRecord.findMany({
      where: { adminId: id },
      orderBy: { completedAt: "desc" },
    }),
    prisma.cnesstIncident.findMany({
      where: { adminId: id },
      orderBy: { incidentDate: "desc" },
    }),
    prisma.emergencyContact.findMany({
      where: { adminId: id },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    }),
    prisma.familyDependent.findMany({
      where: { adminId: id },
      orderBy: { fullName: "asc" },
    }),
    prisma.bankInfo.findUnique({
      where: { adminId: id },
      select: { institutionLabel: true, accountLast4: true, verifiedAt: true },
    }),
  ]);

  if (!admin) notFound();

  return (
    <DossierView
      actorId={actorId}
      isSuper={isSuper}
      admin={JSON.parse(JSON.stringify(admin))}
      notes={JSON.parse(JSON.stringify(notes))}
      files={JSON.parse(JSON.stringify(files))}
      contracts={JSON.parse(JSON.stringify(contracts))}
      reviews={JSON.parse(JSON.stringify(reviews))}
      payAgg={{
        count: payAgg._count ?? 0,
        netPay: payAgg._sum?.netPay ? Number(payAgg._sum.netPay) : 0,
        grossPay: payAgg._sum?.grossPay ? Number(payAgg._sum.grossPay) : 0,
      }}
      leaves={JSON.parse(JSON.stringify(leaves))}
      equipment={JSON.parse(JSON.stringify(equipment))}
      licenses={JSON.parse(JSON.stringify(licenses))}
      trainings={JSON.parse(JSON.stringify(trainings))}
      cnesst={JSON.parse(JSON.stringify(cnesst))}
      emergencyContacts={JSON.parse(JSON.stringify(emergencyContacts))}
      family={JSON.parse(JSON.stringify(family))}
      bank={JSON.parse(JSON.stringify(bank))}
    />
  );
}
