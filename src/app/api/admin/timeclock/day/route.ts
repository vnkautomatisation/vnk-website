// GET /api/admin/timeclock/day?date=YYYY-MM-DD
// Retourne TOUS les pointages d'une journée pour TOUS les admins du scope hiérarchique
// du manager/HR connecté, ET la liste des admins du scope qui n'ont AUCUNE entry ce jour
// (utile pour identifier les oublis).
//
// Auth : même scope que la page admin/employes/pointage (HR ou manager hierarchique).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const currentAdminId = session.user.adminId!;
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Paramètre 'date' (YYYY-MM-DD) manquant ou invalide" }, { status: 400 });
  }

  const day = new Date(dateParam + "T00:00:00");
  if (isNaN(day.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const scope = await getTimesheetScope(currentAdminId);

  // Si manager sans subordonné, on retourne vide proprement.
  if (!scope.isHr && (scope.allowedAdminIds ?? []).length === 0) {
    return NextResponse.json({ entries: [], adminsWithoutEntries: [], date: dateParam });
  }

  // ── Where commun : scope + exclude self (non-founder) ──
  // Reprend exactement la logique de pointage/page.tsx pour rester cohérent.
  const timeClockScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {})
    : { adminId: { in: scope.allowedAdminIds! } };

  const adminScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { id: { not: scope.excludeSelfId } } : {})
    : { id: { in: scope.allowedAdminIds! } };

  // ── Entries du jour ──
  const entries = await prisma.timeClock.findMany({
    where: {
      ...timeClockScopeWhere,
      clockIn: { gte: day, lt: nextDay },
    },
    include: {
      admin: {
        select: {
          id: true,
          fullName: true,
          email: true,
          title: true,
          avatarUrl: true,
          position: { select: { name: true } },
          team: { select: { id: true, name: true, color: true } },
        },
      },
      approver: { select: { id: true, fullName: true, email: true } },
      jobCode: { select: { id: true, code: true, label: true } },
      history: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
    orderBy: [{ adminId: "asc" }, { clockIn: "asc" }],
  });

  // ── Admins du scope qui n'ont aucune entry ce jour ──
  const adminIdsWithEntries = new Set(entries.map((e) => e.adminId));
  const allScopedAdmins = await prisma.admin.findMany({
    where: { ...adminScopeWhere, isActive: true },
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      title: true,
      position: { select: { name: true } },
      team: { select: { id: true, name: true, color: true } },
    },
    orderBy: { fullName: "asc" },
  });
  const adminsWithoutEntries = allScopedAdmins.filter((a) => !adminIdsWithEntries.has(a.id));

  return NextResponse.json({
    date: dateParam,
    entries: JSON.parse(JSON.stringify(entries)),
    adminsWithoutEntries,
  });
}
