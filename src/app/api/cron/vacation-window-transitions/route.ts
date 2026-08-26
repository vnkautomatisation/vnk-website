// POST /api/cron/vacation-window-transitions
// Transitions automatiques des VacationSelectionWindow :
//   - draft -> open quand openingDate <= now : notifier tous les employes actifs
//   - open -> closed quand closingDate < now : notifier les super_admins
//
// A executer toutes les heures via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//        https://<APP>.up.railway.app/api/cron/vacation-window-transitions
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

export async function POST(req: Request) {
  if (!authorize(req)) {
    return unauthorizedJson();
  }
  const now = new Date();
  let opened = 0;
  let closed = 0;

  // ── 1. draft -> open ──
  const toOpen = await prisma.vacationSelectionWindow.findMany({
    where: { status: "draft", openingDate: { lte: now } },
    select: { id: true, name: true, closingDate: true },
  });

  if (toOpen.length > 0) {
    const actives = await prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    for (const w of toOpen) {
      await prisma.vacationSelectionWindow.update({
        where: { id: w.id },
        data: { status: "open" },
      });
      opened++;
      if (actives.length > 0) {
        await prisma.notification.createMany({
          data: actives.map((a) => ({
            recipientType: "admin",
            recipientId: a.id,
            type: "info",
            title: `Fenetre de vacances ouverte : ${w.name}`,
            body: `Soumettez vos preferences avant le ${w.closingDate.toLocaleDateString("fr-CA")}.`,
            link: "/admin/mon-espace/conges",
            icon: "calendar",
          })),
          skipDuplicates: true,
        }).catch(() => null);
      }
    }
  }

  // ── 2. open -> closed ──
  const toClose = await prisma.vacationSelectionWindow.findMany({
    where: { status: "open", closingDate: { lt: now } },
    select: { id: true, name: true, preferences: { select: { adminId: true } } },
  });

  if (toClose.length > 0) {
    // Pre-charger les RH (super_admins) une seule fois
    const supers = await prisma.admin.findMany({
      where: { isActive: true, customRole: { name: "super_admin" } },
      select: { id: true },
    });
    for (const w of toClose) {
      await prisma.vacationSelectionWindow.update({
        where: { id: w.id },
        data: { status: "closed" },
      });
      closed++;
      const uniqueSubmitters = new Set(w.preferences.map((p) => p.adminId)).size;
      if (supers.length > 0) {
        await prisma.notification.createMany({
          data: supers.map((s) => ({
            recipientType: "admin",
            recipientId: s.id,
            type: "warning",
            title: `Periode fermee : ${w.name}`,
            body: `${uniqueSubmitters} employe${uniqueSubmitters > 1 ? "s ont" : " a"} soumis. Lancez la revue puis l'attribution.`,
            link: "/admin/employes/conges/fenetres",
            icon: "calendar",
          })),
          skipDuplicates: true,
        }).catch(() => null);
      }
    }
  }

  return NextResponse.json({ success: true, opened, closed });
}
