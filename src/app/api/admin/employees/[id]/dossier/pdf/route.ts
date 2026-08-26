// GET /api/admin/employees/[id]/dossier/pdf
// Genere le PDF complet du dossier employe (identite + contrats + evaluations + notes + ...).
// Auth: super_admin OU permission users.write OU hr.write.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateEmployeeDossierPdf } from "@/lib/services/pdf-hr";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return unauthorizedJson();

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const canHr = isSuper || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");
  if (!canHr) {
    return forbiddenJson();
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  // Periode : 12 derniers mois pour agregat heures
  const monthlyHoursFrom = (() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - 11);
    return d;
  })();

  const [
    admin, notes, contracts, reviews, payAgg, leaves, equipment,
    licenses, trainings, cnesst, timeClocks,
  ] = await Promise.all([
    prisma.admin.findUnique({
      where: { id },
      include: {
        position: { select: { name: true } },
        customRole: { select: { name: true } },
        team: { select: { name: true } },
        manager: { select: { fullName: true, email: true } },
      },
    }),
    prisma.employeeNote.findMany({
      where: { adminId: id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { fullName: true, email: true } } },
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
      include: { reviewer: { select: { fullName: true, email: true } } },
    }),
    prisma.payStub.aggregate({
      where: { adminId: id, releasedAt: { not: null } },
      _count: true,
      _sum: { netPay: true, grossPay: true },
    }),
    prisma.leaveRequest.findMany({
      where: { adminId: id },
      orderBy: { startDate: "desc" },
      take: 30,
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
    prisma.timeClock.findMany({
      where: {
        adminId: id,
        clockIn: { gte: monthlyHoursFrom },
        clockOut: { not: null },
        category: { in: ["work", "meeting", "training"] },
      },
      select: { clockIn: true, durationMin: true, category: true },
    }),
  ]);

  // Agrege les heures par mois (YYYY-MM) — 12 derniers mois
  const monthlyMap = new Map<string, { workMin: number; meetingMin: number; trainingMin: number }>();
  for (const t of timeClocks) {
    const d = t.clockIn;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let slot = monthlyMap.get(ym);
    if (!slot) {
      slot = { workMin: 0, meetingMin: 0, trainingMin: 0 };
      monthlyMap.set(ym, slot);
    }
    const dur = t.durationMin ?? 0;
    slot.workMin += dur; // total effectif (inclut meeting + training)
    if (t.category === "meeting") slot.meetingMin += dur;
    else if (t.category === "training") slot.trainingMin += dur;
  }
  const monthlyHours = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v]) => ({ ym, ...v }));

  if (!admin) {
    return NextResponse.json({ error: "Employe introuvable" }, { status: 404 });
  }

  const pdf = await generateEmployeeDossierPdf({
    admin: {
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      title: admin.title,
      department: admin.department,
      birthdate: admin.birthdate,
      startDate: admin.startDate,
      endDate: admin.endDate,
      position: admin.position ? { name: admin.position.name } : null,
      customRole: admin.customRole ? { name: admin.customRole.name } : null,
      team: admin.team ? { name: admin.team.name } : null,
      manager: admin.manager,
    },
    notes: notes.map((n) => ({
      id: n.id,
      category: n.category,
      severity: n.severity,
      title: n.title,
      body: n.body,
      isConfidential: n.isConfidential,
      acknowledgedAt: n.acknowledgedAt,
      occurredAt: n.occurredAt,
      createdAt: n.createdAt,
      author: n.author,
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      title: c.title,
      contractType: c.contractType,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      salaryAnnual: c.salaryAnnual != null ? Number(c.salaryAnnual) : null,
      hourlyRate: c.hourlyRate != null ? Number(c.hourlyRate) : null,
      hoursPerWeek: c.hoursPerWeek,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status,
      rating: r.rating,
      managerComments: r.managerComments,
      strengths: r.strengths,
      improvements: r.improvements,
      reviewer: r.reviewer,
    })),
    leaves: leaves.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      startDate: l.startDate,
      endDate: l.endDate,
      daysCount: Number(l.daysCount),
      reason: l.reason,
    })),
    equipment: equipment.map((e) => ({
      id: e.id,
      category: e.category,
      name: e.name,
      serialNumber: e.serialNumber,
      brand: e.brand,
      model: e.model,
      assignedAt: e.assignedAt,
    })),
    licenses: licenses.map((l) => ({
      id: l.id,
      type: l.type,
      number: l.number,
      issuer: l.issuer,
      issuedAt: l.issuedAt,
      expiresAt: l.expiresAt,
    })),
    trainings: trainings.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      provider: t.provider,
      completedAt: t.completedAt,
      expiresAt: t.expiresAt,
      isMandatory: t.isMandatory,
    })),
    cnesst: cnesst.map((c) => ({
      id: c.id,
      incidentDate: c.incidentDate,
      location: c.location,
      description: c.description,
      injuryType: c.injuryType,
      status: c.status,
      daysAbsent: c.daysAbsent,
    })),
    payAgg: {
      count: payAgg._count ?? 0,
      grossPay: payAgg._sum?.grossPay ? Number(payAgg._sum.grossPay) : 0,
      netPay: payAgg._sum?.netPay ? Number(payAgg._sum.netPay) : 0,
    },
    monthlyHours,
  });

  await logAudit({
    adminId: actorId,
    action: "export",
    entityType: "employee_dossier",
    entityId: admin.id,
    changes: { targetAdminId: admin.id },
  }).catch(() => {});

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `dossier-${admin.id}-${datePart}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
