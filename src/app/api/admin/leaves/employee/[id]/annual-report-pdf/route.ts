// GET /api/admin/leaves/employee/[id]/annual-report-pdf
// PDF "Releve annuel de conges" pour un employe sur sa periode CNESST courante.
// Query : ?period=YYYY (annee de debut, defaut: annee courante).
// Auth : assertCanReviewLeave OU l'employe lui-meme.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";
import { getLeaveBalance, getCurrentReferencePeriod } from "@/lib/services/leave-balance";
import { generateLeaveAnnualReportPdf } from "@/lib/services/pdf-hr";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  if (employeeId !== actorId) {
    const ok = await assertCanReviewLeave(actorId, employeeId);
    if (!ok) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const url = new URL(req.url);
  const periodYearStr = url.searchParams.get("period");
  const periodYear = periodYearStr ? Number(periodYearStr) : null;
  const refDate = periodYear && Number.isFinite(periodYear)
    ? new Date(periodYear, 5, 1) // 1er juin de l'annee demandee → tombe dans la periode (1er mai → 30 avril)
    : new Date();
  const period = getCurrentReferencePeriod(refDate, 5);

  const [admin, requests, balance] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: employeeId },
      select: {
        fullName: true, email: true, title: true,
        position: { select: { name: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        adminId: employeeId,
        startDate: { lte: period.end },
        endDate: { gte: period.start },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true, type: true, status: true,
        startDate: true, endDate: true, daysCount: true, halfDay: true,
      },
    }),
    getLeaveBalance(employeeId, "vacation").catch(() => null),
  ]);

  if (!admin) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

  const pdf = await generateLeaveAnnualReportPdf({
    admin: {
      fullName: admin.fullName,
      email: admin.email,
      position: admin.position?.name ?? admin.title ?? null,
    },
    periodStart: period.start,
    periodEnd: period.end,
    balance,
    requests: requests.map((r) => ({
      ...r,
      daysCount: Number(r.daysCount),
    })),
  });

  await logAudit({
    adminId: actorId,
    action: "export",
    entityType: "leave_annual_report_pdf",
    entityId: employeeId,
    changes: { period: `${period.start.toISOString().slice(0, 10)}->${period.end.toISOString().slice(0, 10)}`, count: requests.length },
  }).catch(() => null);

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `releve-conges-${employeeId}-${datePart}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
