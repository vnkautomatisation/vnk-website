"use server";
// Actions paie : périodes de paie + génération des bulletins.
// Calcul DAS Québec : valeurs provisoires (à raffiner avec service WebRAS / outils CRA réels en prod).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calculateOvertimeForEntries } from "@/lib/services/overtime";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requirePayrollWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.payroll ?? []).includes("write")) ? adminId : null;
}

// ── Création période de paie ───────────────────────────────
const periodSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  payDate: z.string(),
});

export async function createPayPeriodAction(input: z.infer<typeof periodSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  const pay = new Date(parsed.data.payDate);
  if (end < start) return { success: false, error: "Date de fin avant date de début" };

  const p = await prisma.payPeriod.create({
    data: { startDate: start, endDate: end, payDate: pay, status: "open" },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "pay_period", entityId: p.id });
  revalidatePath("/admin/employes/paie");
  return { success: true, data: { id: p.id } };
}

// ── Génération des bulletins (un par employé avec heures) ──
//
// Approche : pour chaque admin qui a des TimeClock approuvés dans la période
// et sans payStubId, on agrège heures × taux. Le taux vient de son contrat actif.
// Calculs DAS Québec — taux 2025 indicatifs (à valider chaque année) :
//   RRQ : 6.4% sur revenu entre 3 500$ et 73 200$
//   AE : 1.66% (taux salarié 2025)
//   RQAP : 0.494%
//   Fédéral + Provincial : approx 15% combiné si bracket inférieur
export async function generatePayStubsAction(input: { periodId: number }): Promise<Result<{ stubsCreated: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  const period = await prisma.payPeriod.findUnique({ where: { id: input.periodId } });
  if (!period) return { success: false, error: "Période introuvable" };
  if (period.status !== "open") return { success: false, error: "Période non ouverte" };

  // Trouver tous les pointages approuvés dans la période non encore facturés
  const clocks = await prisma.timeClock.findMany({
    where: {
      clockIn: { gte: period.startDate, lte: new Date(period.endDate.getTime() + 24 * 60 * 60 * 1000) },
      clockOut: { not: null },
      approvedAt: { not: null },
      payStubId: null,
    },
    select: { id: true, adminId: true, clockIn: true, durationMin: true, category: true },
  });
  if (clocks.length === 0) return { success: false, error: "Aucun pointage approuvé à facturer" };

  // Grouper par employé
  const byAdmin = new Map<number, typeof clocks>();
  for (const c of clocks) {
    if (!byAdmin.has(c.adminId)) byAdmin.set(c.adminId, []);
    byAdmin.get(c.adminId)!.push(c);
  }

  let stubsCreated = 0;
  for (const [adminId, entries] of byAdmin) {
    // Récupérer taux du contrat actif
    const contract = await prisma.employeeContract.findFirst({
      where: { adminId, status: { in: ["active", "signed_employer"] } },
      orderBy: { startDate: "desc" },
    });
    if (!contract) continue;
    const hourlyRate = contract.hourlyRate ? Number(contract.hourlyRate)
      : contract.salaryAnnual ? Number(contract.salaryAnnual) / 2080
        : 0;
    if (hourlyRate <= 0) continue;

    let mWork = 0, mVacation = 0, mSick = 0;
    for (const e of entries) {
      const min = e.durationMin ?? 0;
      if (e.category === "vacation") mVacation += min;
      else if (e.category === "sick") mSick += min;
      else mWork += min;
    }
    // ── Heures supp : calculees semaine par semaine via le service centralise.
    // Une seule source de verite (vs duplication inline du seuil 40h/semaine).
    const weeklyOvertime = calculateOvertimeForEntries(entries);
    const mOvertime = weeklyOvertime.reduce((s, w) => s + w.overtimeMin, 0);
    const mRegular = Math.max(0, mWork - mOvertime);
    const hRegular = mRegular / 60;
    const hOvertime = mOvertime / 60;
    const hVacation = mVacation / 60;
    const hSick = mSick / 60;
    const overtimeRate = hourlyRate * 1.5;

    const grossPay = (hRegular * hourlyRate) + (hOvertime * overtimeRate) + ((hVacation + hSick) * hourlyRate);

    // DAS provisoires (lin. simplifié — à remplacer par calc CRA en prod)
    const deductionRrq = Math.max(0, (grossPay - (3500 / 26)) * 0.064);
    const deductionAe = grossPay * 0.0166;
    const deductionRqap = grossPay * 0.00494;
    const deductionFederal = grossPay * 0.10; // approx tax bracket 1
    const deductionProvincial = grossPay * 0.05;
    const netPay = grossPay - deductionRrq - deductionAe - deductionRqap - deductionFederal - deductionProvincial;

    const stub = await prisma.payStub.upsert({
      where: { periodId_adminId: { periodId: period.id, adminId } },
      create: {
        periodId: period.id,
        adminId,
        hoursRegular: hRegular,
        hoursOvertime: hOvertime,
        hoursVacation: hVacation,
        hoursSick: hSick,
        rate: hourlyRate,
        grossPay,
        deductionRrq, deductionAe, deductionRqap,
        deductionFederal, deductionProvincial,
        netPay,
      },
      update: {
        hoursRegular: hRegular,
        hoursOvertime: hOvertime,
        hoursVacation: hVacation,
        hoursSick: hSick,
        rate: hourlyRate,
        grossPay,
        deductionRrq, deductionAe, deductionRqap,
        deductionFederal, deductionProvincial,
        netPay,
      },
      select: { id: true },
    });

    // Lier les TimeClock au bulletin
    await prisma.timeClock.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { payStubId: stub.id },
    });
    stubsCreated++;
  }

  await logAudit({ adminId: actorId, action: "create", entityType: "pay_stubs_bulk", entityId: period.id, changes: { stubsCreated } });
  revalidatePath("/admin/employes/paie");
  return { success: true, data: { stubsCreated } };
}

export async function lockPayPeriodAction(input: { id: number }): Promise<Result> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.payPeriod.update({
    where: { id: input.id },
    data: { status: "locked", lockedAt: new Date() },
  });
  await logAudit({ adminId, action: "update", entityType: "pay_period", entityId: input.id, changes: { locked: true } });
  revalidatePath("/admin/employes/paie");
  return { success: true };
}

export async function markPayPeriodPaidAction(input: { id: number }): Promise<Result> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.payPeriod.update({
    where: { id: input.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await prisma.payStub.updateMany({
    where: { periodId: input.id },
    data: { releasedAt: new Date() },
  });

  // Notifier chaque employé que son bulletin de paie est disponible
  const stubs = await prisma.payStub.findMany({
    where: { periodId: input.id },
    select: { adminId: true, netPay: true },
  });
  await Promise.all(
    stubs.map((s) =>
      prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: s.adminId,
          type: "success",
          title: "Nouveau bulletin de paie disponible",
          body: `Net : ${Number(s.netPay).toFixed(2)} $`,
          link: "/admin/mon-espace/paie",
          icon: "wallet",
        },
      }).catch(() => null),
    ),
  );

  await logAudit({ adminId, action: "update", entityType: "pay_period", entityId: input.id, changes: { paid: true } });
  revalidatePath("/admin/employes/paie");
  return { success: true };
}
