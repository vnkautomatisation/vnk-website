// POST /api/cron/auto-close-shifts
// Ferme automatiquement les pointages laisses ouverts depuis plus de 16h.
// Duree par defaut : 8h (480 min) a partir du clockIn.
// Notifie l'employe pour qu'il ajuste si necessaire.
//
// A executer toutes les heures via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/auto-close-shifts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const STALE_HOURS = 16;
const DEFAULT_DURATION_MIN = 8 * 60; // 8h
const AUTO_NOTE = "[AUTO-FERME : pointage oublié, durée par défaut 8h]";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return unauthorizedJson();
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_HOURS * 60 * 60 * 1000);

  const stale = await prisma.timeClock.findMany({
    where: { clockOut: null, clockIn: { lt: cutoff } },
    select: { id: true, adminId: true, clockIn: true, notes: true, totalBreakMin: true },
  });

  let closed = 0;
  for (const tc of stale) {
    const newClockOut = new Date(tc.clockIn.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
    const notes = `${AUTO_NOTE}\n${tc.notes ?? ""}`.slice(0, 500);
    // Si une pause cumulee existe, on la soustrait de la duree par defaut
    const netDuration = Math.max(0, DEFAULT_DURATION_MIN - (tc.totalBreakMin ?? 0));
    await prisma.timeClock.update({
      where: { id: tc.id },
      data: {
        clockOut: newClockOut,
        durationMin: netDuration,
        // Libere une pause oubliee (pausedAt non null bloquerait toute future action)
        pausedAt: null,
        notes,
      },
    });
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: tc.adminId,
        type: "warning",
        title: "Pointage auto-fermé",
        body: `Votre pointage du ${tc.clockIn.toLocaleDateString("fr-CA")} a été fermé automatiquement (durée par défaut 8h). Ajustez si vous avez travaillé plus ou moins.`,
        link: "/admin/mon-espace/pointage",
        icon: "alert-triangle",
      },
    }).catch(() => null);
    await logAudit({
      action: "update",
      entityType: "time_clock",
      entityId: tc.id,
      changes: { autoClosed: true, durationMin: DEFAULT_DURATION_MIN },
    }).catch(() => {});
    closed++;
  }

  return NextResponse.json({ success: true, closed, timestamp: now.toISOString() });
}
