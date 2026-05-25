// GET /api/admin/leaves/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Retourne les absences (LeaveRequest approuvees + pending pour soi)
// + jours feries QC sur la plage demandee, filtre par scope hierarchique.
//
// Scope :
//   - founder/super_admin/HR : voit tous les autres employes
//   - manager : voit ses subordonnes + membres des teams qu'il dirige
//   - employe standard : voit son equipe (teamId) et/ou ses peers (managerId)
//
// Reponse : { absences: AbsenceItem[], holidays: HolidayItem[], scope: string }
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeavesScope } from "@/lib/services/timesheet-scope";
import { getHolidaysInRange } from "@/lib/services/holidays";

export const dynamic = "force-dynamic";

function parseISO(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const url = new URL(req.url);
  const from = parseISO(url.searchParams.get("from"));
  const to = parseISO(url.searchParams.get("to"));
  const employeeIdParam = url.searchParams.get("employeeId");
  const employeeIdOverride = employeeIdParam ? Number(employeeIdParam) : null;
  if (!from || !to) return NextResponse.json({ error: "Parametres from/to invalides (YYYY-MM-DD)" }, { status: 400 });
  if (to < from) return NextResponse.json({ error: "to < from" }, { status: 400 });

  // Borne dure : 6 mois max pour eviter requete trop large
  const maxDays = 186;
  const dayDiff = Math.floor((to.getTime() - from.getTime()) / 86400000);
  if (dayDiff > maxDays) {
    return NextResponse.json({ error: `Plage maximale ${maxDays} jours` }, { status: 400 });
  }

  // Scope hierarchique : getLeavesScope gere founder/HR/manager/employe std (avec fallback team -> manager).
  // Si employeeIdOverride : on calcule le scope du POINT DE VUE de cet employé (ses collègues)
  // après avoir vérifié que l'acteur a l'autorité sur cet employé.
  let scope = await getLeavesScope(adminId);
  if (employeeIdOverride && employeeIdOverride !== adminId) {
    const { assertCanReviewLeave } = await import("@/lib/services/timesheet-scope");
    const ok = await assertCanReviewLeave(adminId, employeeIdOverride);
    if (ok) {
      scope = await getLeavesScope(employeeIdOverride);
    }
  }
  const viewerId = employeeIdOverride && employeeIdOverride !== adminId ? employeeIdOverride : adminId;
  let visibleAdminIds: number[] | "all" = "all";
  if (!scope.isFounder && !scope.isHr) {
    // On inclut toujours le viewer pour qu'il voie ses propres demandes pending
    visibleAdminIds = Array.from(new Set([...(scope.allowedAdminIds ?? []), viewerId]));
  }

  // Recupere les conges qui chevauchent la plage
  // Status visible : approved (toujours) + pending pour soi
  const absences = await prisma.leaveRequest.findMany({
    where: {
      ...(visibleAdminIds === "all" ? {} : { adminId: { in: visibleAdminIds } }),
      startDate: { lte: to },
      endDate: { gte: from },
      OR: [
        { status: "approved" },
        { status: "pending", adminId: viewerId },
      ],
    },
    select: {
      id: true,
      adminId: true,
      type: true,
      startDate: true,
      endDate: true,
      halfDay: true,
      status: true,
      admin: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const holidaysMap = await getHolidaysInRange(from, to);
  const holidays = Array.from(holidaysMap.entries()).map(([date, info]) => ({
    date,
    name: info.name,
    isPaid: info.isPaid,
    type: info.type,
  }));

  return NextResponse.json({
    absences: absences.map((a) => ({
      id: a.id,
      adminId: a.adminId,
      fullName: a.admin.fullName || a.admin.email,
      type: a.type,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      halfDay: a.halfDay,
      status: a.status,
      isMine: a.adminId === viewerId,
    })),
    holidays,
    scope: scope.peerSource,
  });
}
