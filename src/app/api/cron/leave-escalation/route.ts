// POST /api/cron/leave-escalation
// Escalade automatique des demandes de conge restees en attente plus de 48h
// sans revue. Notifie les super_admins.
//
// A executer toutes les heures via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/leave-escalation
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const ESCALATION_HOURS = 48;

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  if (!authorize(req)) {
    return unauthorizedJson();
  }
  const cutoff = new Date(Date.now() - ESCALATION_HOURS * 60 * 60 * 1000);

  const stale = await prisma.leaveRequest.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
      escalatedAt: null,
    },
    select: { id: true, adminId: true, type: true, startDate: true, endDate: true, admin: { select: { fullName: true, email: true } } },
  });

  if (stale.length === 0) {
    return NextResponse.json({ success: true, escalated: 0 });
  }

  const superAdmins = await prisma.admin.findMany({
    where: { isActive: true, customRole: { name: "super_admin" } },
    select: { id: true },
  });

  let escalated = 0;
  for (const r of stale) {
    await prisma.leaveRequest.update({ where: { id: r.id }, data: { escalatedAt: new Date() } });
    const employeeName = r.admin?.fullName || r.admin?.email || `Admin #${r.adminId}`;
    if (superAdmins.length > 0) {
      await prisma.notification.createMany({
        data: superAdmins.map((s) => ({
          recipientType: "admin",
          recipientId: s.id,
          type: "warning",
          title: t("demande_de_conge_en_attente_depuis_48h"),
          body: `${employeeName} · ${r.type} · ${r.startDate.toLocaleDateString("fr-CA")} → ${r.endDate.toLocaleDateString("fr-CA")}`,
          link: "/admin/employes/conges",
          icon: "alert-triangle",
        })),
        skipDuplicates: true,
      }).catch(() => null);
    }
    escalated++;
  }

  return NextResponse.json({ success: true, escalated });
}
