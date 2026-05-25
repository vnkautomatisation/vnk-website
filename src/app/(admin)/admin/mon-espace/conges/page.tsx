import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeavesView } from "../../employes/conges/leaves-view";
import { getLeaveBalance } from "@/lib/services/leave-balance";
import { getLeavesScope } from "@/lib/services/timesheet-scope";
import type { OpenWindow } from "@/components/admin/vacation-window-banner";

export default async function MyCongesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const now = new Date();

  // Scope hierarchique : getLeavesScope gere maintenant tous les cas
  // (founder, HR, manager, employe std avec fallback team -> manager -> none).
  // L'employe standard voit ses pairs (memes membres de team ou meme manager).
  const scope = await getLeavesScope(adminId);
  let teamScopeIds: number[] | "all";
  if (scope.isFounder || scope.isHr) {
    teamScopeIds = "all";
  } else {
    teamScopeIds = (scope.allowedAdminIds ?? []).filter((id) => id !== adminId);
  }

  // Borne basse : aujourd'hui à 00:00 (local) pour ne pas perdre les congés qui se terminent aujourd'hui
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizonEnd = new Date(todayStart);
  horizonEnd.setDate(horizonEnd.getDate() + 28);

  const teamWhere =
    teamScopeIds === "all"
      ? { adminId: { not: adminId } }
      : teamScopeIds.length > 0
        ? { adminId: { in: teamScopeIds } }
        : { adminId: { in: [] as number[] } }; // aucun pair → query vide

  const [me, myRequests, balance, teamLeavesUpcoming, teamPeersCount, openWindows] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, leaveBlockedUntil: true, leaveBlockedReason: true },
    }),
    prisma.leaveRequest.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { reviewer: { select: { fullName: true, email: true } } },
    }),
    getLeaveBalance(adminId, "vacation"),
    // Mes pairs sur 4 semaines (approved + pending visibles ; lecture seule mon-espace, scope respecté)
    // P0-2 : on inclut pending pour signaler visuellement les zones a risque (style hachure)
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ["approved", "pending"] },
        endDate: { gte: todayStart },
        startDate: { lte: horizonEnd },
        ...teamWhere,
      },
      orderBy: { startDate: "asc" },
      take: 200,
      include: { admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    }),
    // Nombre de pairs dans le scope (pour afficher dans l'empty state)
    teamScopeIds === "all"
      ? prisma.admin.count({ where: { isActive: true, id: { not: adminId } } })
      : Promise.resolve(teamScopeIds.length),
    // Fenetres pertinentes pour l'employe :
    //  - status "open" (peut soumettre)
    //  - status closed/in_review/allocated avec au moins une preference de l'employe
    //    (pour voir le statut d'attribution)
    prisma.vacationSelectionWindow.findMany({
      where: {
        OR: [
          { status: "open" },
          {
            status: { in: ["closed", "in_review", "allocated"] },
            preferences: { some: { adminId } },
          },
        ],
      },
      include: {
        preferences: {
          where: { adminId },
          orderBy: { rank: "asc" },
        },
      },
      orderBy: { closingDate: "desc" },
      take: 5,
    }),
  ]);

  const openWindowsForBanner: OpenWindow[] = openWindows.map((w) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    openingDate: w.openingDate.toISOString(),
    closingDate: w.closingDate.toISOString(),
    coversFrom: w.coversFrom.toISOString(),
    coversTo: w.coversTo.toISOString(),
    maxDaysPerEmployee: w.maxDaysPerEmployee,
    myPreferences: w.preferences.map((p) => ({
      // R5 : id + appealStatus pour le workflow d'appel
      id: p.id,
      rank: p.rank,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      daysCount: Number(p.daysCount),
      status: p.status,
      appealStatus: p.appealStatus,
    })),
  }));

  const myBlock = (me?.leaveBlockedUntil && me.leaveBlockedUntil.getTime() > Date.now())
    ? { until: me.leaveBlockedUntil.toISOString(), reason: me.leaveBlockedReason }
    : null;

  return (
    <LeavesView
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingReviews={[]}
      teamLeavesUpcoming={JSON.parse(JSON.stringify(teamLeavesUpcoming))}
      isReviewer={false}
      balance={balance}
      teamScopeCount={teamPeersCount}
      myAdminId={adminId}
      myBlock={myBlock}
      openWindows={openWindowsForBanner}
    />
  );
}
