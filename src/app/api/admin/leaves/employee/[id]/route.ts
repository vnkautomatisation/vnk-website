// GET /api/admin/leaves/employee/[id]
// Retourne toutes les demandes de congé d'un employé (drill-down admin).
// Filtre par l'autorité de l'acteur : assertCanReviewLeave.
// Inclut le solde courant + dernières demandes (limite 50).
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";
import { getLeaveBalance } from "@/lib/services/leave-balance";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: "Id invalide" }, { status: 400 });
  }

  const ok = await assertCanReviewLeave(actorId, employeeId);
  if (!ok) return forbiddenJson();

  const [employee, requests, balance] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: employeeId },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true,
        title: true, department: true, isActive: true,
        leavePolicyId: true,
        leaveBlockedUntil: true, leaveBlockedReason: true,
        team: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { adminId: employeeId },
      orderBy: { startDate: "desc" },
      take: 50,
      select: {
        id: true, type: true, status: true,
        startDate: true, endDate: true, daysCount: true,
        halfDay: true, reason: true,
        reviewedAt: true, reviewNotes: true,
        attachmentUrl: true, attachmentName: true,
        createdAt: true,
        reviewer: { select: { id: true, fullName: true, email: true } },
      },
    }),
    getLeaveBalance(employeeId, "vacation").catch(() => null),
  ]);

  if (!employee) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

  // Détection paySLA : pour chaque demande approuvée payée, indique si on peut encore éditer
  const noteStubs = requests
    .filter((r) => r.status === "approved")
    .map((r) => `[CONGÉ AUTO - LeaveRequest #${r.id}]`);
  let lockedIds = new Set<number>();
  if (noteStubs.length > 0) {
    const paidClocks = await prisma.timeClock.findMany({
      where: {
        adminId: employeeId,
        payStubId: { not: null },
        OR: noteStubs.map((s) => ({ notes: { startsWith: s } })),
      },
      select: { notes: true },
    });
    const m = /LeaveRequest #(\d+)/;
    lockedIds = new Set(
      paidClocks
        .map((c) => c.notes ? m.exec(c.notes)?.[1] : null)
        .filter(Boolean)
        .map(Number),
    );
  }

  return NextResponse.json({
    employee: {
      ...employee,
      leaveBlockedUntil: employee.leaveBlockedUntil?.toISOString() ?? null,
    },
    balance,
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      daysCount: Number(r.daysCount),
      halfDay: r.halfDay,
      reason: r.reason,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewNotes: r.reviewNotes,
      attachmentUrl: r.attachmentUrl,
      attachmentName: r.attachmentName,
      createdAt: r.createdAt.toISOString(),
      reviewer: r.reviewer,
      isLockedByPaid: lockedIds.has(r.id),
    })),
  });
}
