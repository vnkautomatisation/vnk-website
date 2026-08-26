// POST /api/cron/delegation-routing
// Quotidien : pour chaque admin ayant configuré delegateApprovalTo, vérifie s'il est
// en congé approuvé aujourd'hui. Si oui, prévient le delegate des demandes pending
// dont il est responsable (manager direct ou super_admin pour son équipe).
//
// Idempotent : une notif par paire (delegate, jour) — utilise une clef synthetique
// dans le corps pour eviter le doublon via skipDuplicates n'est pas possible sans
// table dédiée ; on utilise donc createdAt + type pour dedupe applicatif.
//
// A executer 1×/jour via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/delegation-routing
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return unauthorizedJson();
  }

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // 1) Tous les admins actifs avec une delegation configurée
  const delegators = await prisma.admin.findMany({
    where: {
      isActive: true,
      delegateApprovalTo: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      delegateApprovalTo: true,
    },
  });

  if (delegators.length === 0) {
    return NextResponse.json({ success: true, routed: 0, checked: 0 });
  }

  let routed = 0;
  const summary: Array<{ delegator: string; delegate: number; pendingCount: number }> = [];

  for (const delegator of delegators) {
    // 2) L'admin est-il en conge approuve aujourd'hui ?
    const onLeave = await prisma.leaveRequest.findFirst({
      where: {
        adminId: delegator.id,
        status: "approved",
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: { id: true },
    });
    if (!onLeave) continue;

    // 3) Quelles demandes pending devraient passer par lui ?
    //    Toutes celles de ses directReports + (s'il est super_admin) tout pending
    const directReports = await prisma.admin.findMany({
      where: { managerId: delegator.id, isActive: true },
      select: { id: true },
    });
    if (directReports.length === 0) continue;

    const pendingCount = await prisma.leaveRequest.count({
      where: {
        status: "pending",
        adminId: { in: directReports.map((r) => r.id) },
      },
    });
    if (pendingCount === 0) continue;

    // 4) Dédupe applicatif : si la notif a deja ete envoyee aujourd'hui pour ce delegate
    //    par ce cron (titre identique), skip.
    const delegateId = delegator.delegateApprovalTo!;
    const already = await prisma.notification.findFirst({
      where: {
        recipientType: "admin",
        recipientId: delegateId,
        title: { startsWith: "Délégation active" },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { id: true },
    });
    if (already) continue;

    const delegatorLabel = delegator.fullName || delegator.email || `Admin #${delegator.id}`;
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: delegateId,
        type: "info",
        title: `Délégation active — ${delegatorLabel} en congé`,
        body: `${pendingCount} demande${pendingCount > 1 ? "s" : ""} de congé en attente est déléguée à votre approbation aujourd'hui.`,
        link: "/admin/employes/conges",
        icon: "shield",
      },
    }).catch(() => null);

    routed++;
    summary.push({
      delegator: delegatorLabel,
      delegate: delegateId,
      pendingCount,
    });
  }

  return NextResponse.json({ success: true, routed, checked: delegators.length, summary });
}
