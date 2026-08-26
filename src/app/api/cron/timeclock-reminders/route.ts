// POST /api/cron/timeclock-reminders
// Cron quotidien : choisit l'action selon le jour de la semaine.
//  - Vendredi : rappel aux employes ayant des entries non-soumises
//  - Dimanche : auto-soumission des semaines non-soumises
//  - Lundi    : alerte super_admin/payroll si timesheets en attente d'approbation
//
// Appel via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/timeclock-reminders
import { NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "@/lib/week";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}


const SUBMITTABLE = new Set(["work", "meeting", "training"]);

async function sendReminderUnsubmitted(weekStart: Date, weekEnd: Date): Promise<number> {
  // Une seule requete : recupere les adminId distincts qui ont au moins une
  // entry eligible. Evite le N+1 (1 findFirst par admin).
  const candidates = await prisma.admin.findMany({
    where: { isActive: true, role: "admin" },
    select: { id: true },
  });
  if (candidates.length === 0) return 0;
  const candidateIds = candidates.map((c) => c.id);

  const openEntries = await prisma.timeClock.findMany({
    where: {
      adminId: { in: candidateIds },
      clockIn: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
      submittedAt: null,
      approvedAt: null,
      category: { in: ["work", "meeting", "training"] },
    },
    select: { adminId: true },
  });
  const needsReminder = Array.from(new Set(openEntries.map((e) => e.adminId)));
  if (needsReminder.length === 0) return 0;

  await prisma.notification.createMany({
    data: needsReminder.map((adminId) => ({
      recipientType: "admin",
      recipientId: adminId,
      type: "warning",
      title: "Soumettez votre semaine",
      body: "Soumettez vos heures avant lundi pour la prochaine paie.",
      link: "/admin/mon-espace/pointage",
      icon: "clock",
    })),
  }).catch(() => null);

  return needsReminder.length;
}

async function autoSubmitOpenWeeks(weekStart: Date, weekEnd: Date): Promise<number> {
  const candidates = await prisma.admin.findMany({
    where: { isActive: true, role: "admin" },
    select: { id: true, fullName: true, email: true, managerId: true },
  });
  let total = 0;
  for (const emp of candidates) {
    const ids = await prisma.timeClock.findMany({
      where: {
        adminId: emp.id,
        clockIn: { gte: weekStart, lt: weekEnd },
        clockOut: { not: null },
        submittedAt: null,
        approvedAt: null,
        category: { in: ["work", "meeting", "training"] },
      },
      select: { id: true, durationMin: true, category: true },
    });
    if (ids.length === 0) continue;
    const targetIds = ids.map((e) => e.id);
    const workMin = ids.reduce(
      (s, e) => s + (SUBMITTABLE.has(e.category) ? e.durationMin ?? 0 : 0),
      0,
    );
    const r = await prisma.timeClock.updateMany({
      where: { id: { in: targetIds }, submittedAt: null, approvedAt: null },
      data: { submittedAt: new Date() },
    });
    total += r.count;

    // Notifier l'employe
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: emp.id,
        type: "info",
        title: "Semaine auto-soumise",
        body: `Votre semaine a été soumise automatiquement (${(workMin / 60).toFixed(1)}h).`,
        link: "/admin/mon-espace/pointage",
        icon: "clock",
      },
    }).catch(() => null);

    // ── Notifier d'abord le manager direct, puis fallback super_admins si absent.
    // Pattern identique a submitWeekTimeClocksAction (coherence).
    const recipientIds: number[] = [];
    if (emp.managerId) {
      recipientIds.push(emp.managerId);
    } else {
      const supers = await prisma.admin.findMany({
        where: { customRole: { name: "super_admin" }, isActive: true },
        select: { id: true },
      });
      recipientIds.push(...supers.map((s) => s.id));
    }
    const empName = emp.fullName || emp.email;
    const weekLabel = weekStart.toLocaleDateString("fr-CA");
    if (recipientIds.length > 0) {
      await prisma.notification.createMany({
        data: recipientIds.map((rid) => ({
          recipientType: "admin",
          recipientId: rid,
          type: "info",
          title: "Semaine soumise (auto)",
          body: `${empName} : semaine du ${weekLabel} auto-soumise (${(workMin / 60).toFixed(1)}h).`,
          link: `/admin/employes/pointage?focus=${emp.id}`,
          icon: "clock",
        })),
      }).catch(() => null);
    }
  }
  return total;
}

async function notifyPendingApprovals(): Promise<number> {
  const pendingCount = await prisma.timeClock.count({
    where: { submittedAt: { not: null }, approvedAt: null, clockOut: { not: null } },
  });
  if (pendingCount === 0) return 0;
  const recipients = await prisma.admin.findMany({
    where: {
      isActive: true,
      OR: [{ customRole: { name: "super_admin" } }],
    },
    select: { id: true },
  });
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        recipientType: "admin",
        recipientId: r.id,
        type: "info",
        title: "Timesheets à approuver",
        body: `${pendingCount} pointage(s) en attente d'approbation.`,
        link: "/admin/employes/pointage",
        icon: "clock",
      })),
    }).catch(() => null);
  }
  return recipients.length;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return unauthorizedJson();
  }

  const now = new Date();
  const dow = now.getDay(); // 0 dim, 1 lun, ..., 5 ven, 6 sam
  const hour = now.getHours();
  const currentWeekStart = startOfWeek(now);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const result: Record<string, number | string> = { dow: String(dow), hour: String(hour) };

  // Vendredi (5) : rappel
  if (dow === 5) {
    result.reminded = await sendReminderUnsubmitted(currentWeekStart, currentWeekEnd);
  }

  // Sunday (0): auto-submit the week that just ENDED (previous Sunday ->
  // Saturday). Project week = Sunday -> Saturday, so on Sunday morning the
  // current week has just started and the finished week is [lastWeekStart,
  // currentWeekStart).
  if (dow === 0) {
    result.autoSubmitted = await autoSubmitOpenWeeks(lastWeekStart, currentWeekStart);
  }

  // Lundi (1) : alerte admin
  if (dow === 1) {
    result.adminAlerted = await notifyPendingApprovals();
  }

  // Daily 48h escalation: entries submitted 48-72h ago and still unapproved
  // -> renotify the direct manager (copy to super_admins when no manager).
  // The [48h, 72h) window + daily run = one escalation per submission batch;
  // older stragglers are covered by the Monday alert above.
  {
    const from72 = new Date(now.getTime() - 72 * 3600 * 1000);
    const to48 = new Date(now.getTime() - 48 * 3600 * 1000);
    const stale = await prisma.timeClock.findMany({
      where: {
        submittedAt: { gte: from72, lte: to48 },
        approvedAt: null,
        payStubId: null,
      },
      select: {
        adminId: true,
        admin: { select: { fullName: true, email: true, managerId: true } },
      },
      distinct: ["adminId"],
      take: 100,
    });
    let escalated = 0;
    for (const s of stale) {
      const name = s.admin?.fullName ?? s.admin?.email ?? `Admin#${s.adminId}`;
      const recipients: number[] = [];
      if (s.admin?.managerId) {
        recipients.push(s.admin.managerId);
      } else {
        const supers = await prisma.admin.findMany({
          where: { customRole: { name: "super_admin" }, isActive: true },
          select: { id: true },
        });
        recipients.push(...supers.map((x) => x.id));
      }
      await Promise.all(
        recipients.map((rid) =>
          prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: rid,
              type: "warning",
              title: "Heures soumises depuis plus de 48 h",
              body: `Les heures de ${name} attendent votre approbation depuis plus de 48 h.`,
              link: `/admin/employes/pointage?tab=to-approve&focus=${s.adminId}`,
              icon: "clock",
            },
          }).catch(() => null),
        ),
      );
      escalated++;
    }
    result.escalated48h = escalated;
  }

  await logAudit({ action: "update", entityType: "cron_timeclock_reminders", changes: result }).catch(() => {});

  result.lastWeekStart = lastWeekStart.toISOString();

  return NextResponse.json({ success: true, ...result, timestamp: now.toISOString() });
}
