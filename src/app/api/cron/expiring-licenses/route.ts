// ─────────────────────────────────────────────────────────
// CRON · Notifications expirations permis & formations
// Pour chaque ProfessionalLicense / TrainingRecord qui expire
// dans EXACTEMENT 30, 14 ou 7 jours :
//   - notifie l'employé concerné
//   - à 7 jours : notifie aussi tous les super_admin actifs
// Anti-doublon : skip si une notif identique a déjà été créée
// dans les dernières 24h pour cet item.
//
// Sécurité : token Bearer requis (CRON_SECRET).
// Appel attendu : Railway cron une fois par jour.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const THRESHOLDS = [30, 14, 7] as const;
const NOTIFY_SUPER_ADMIN_AT = 7; // seuil critique : on alerte aussi les RH

function dayBoundary(daysFromNow: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Anti-doublon : true si une notif équivalente (même titre+link, même recipient)
// a déjà été insérée dans les dernières 24h.
async function alreadyNotified(params: {
  recipientId: number;
  title: string;
  link: string;
}): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const found = await prisma.notification.findFirst({
    where: {
      recipientType: "admin",
      recipientId: params.recipientId,
      title: params.title,
      link: params.link,
      createdAt: { gt: dayAgo },
    },
    select: { id: true },
  });
  return !!found;
}

async function notifyOnce(data: {
  recipientId: number;
  type: "info" | "warning" | "success" | "error";
  title: string;
  body: string;
  link: string;
  icon: string;
}): Promise<boolean> {
  const dup = await alreadyNotified({ recipientId: data.recipientId, title: data.title, link: data.link });
  if (dup) return false;
  await prisma.notification
    .create({
      data: {
        recipientType: "admin",
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        icon: data.icon,
      },
    })
    .catch(() => null);
  return true;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configure" }, { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorizedJson();

  const results = {
    licensesEmployee: 0,
    licensesSuperAdmin: 0,
    trainingsEmployee: 0,
    trainingsSuperAdmin: 0,
    skipped: 0,
  };

  // Liste des super_admin actifs (calculée une fois, utilisée seulement à J-7)
  const superAdmins = await prisma.admin.findMany({
    where: { isActive: true, customRole: { name: "super_admin" } },
    select: { id: true },
  });

  for (const days of THRESHOLDS) {
    const { start, end } = dayBoundary(days);

    // ── Permis professionnels ────────────────────────────────
    const licenses = await prisma.professionalLicense.findMany({
      where: { expiresAt: { gte: start, lt: end } },
      include: { admin: { select: { id: true, isActive: true, fullName: true } } },
    });

    for (const lic of licenses) {
      if (!lic.admin?.isActive) continue;
      const label = lic.type + (lic.number ? ` #${lic.number}` : "");
      const titleEmp = `Permis expire dans ${days} jour${days > 1 ? "s" : ""}`;
      const bodyEmp = `${label} arrive à échéance le ${lic.expiresAt?.toLocaleDateString("fr-CA")}.`;
      const created = await notifyOnce({
        recipientId: lic.adminId,
        type: days <= 7 ? "warning" : "info",
        title: titleEmp,
        body: bodyEmp,
        link: "/admin/mon-espace/formations",
        icon: "shield",
      });
      if (created) results.licensesEmployee += 1;
      else results.skipped += 1;

      if (days === NOTIFY_SUPER_ADMIN_AT) {
        for (const sa of superAdmins) {
          const titleSa = `Permis employé expire dans 7 jours`;
          const bodySa = `${lic.admin.fullName ?? "Employé"} · ${label} · échéance ${lic.expiresAt?.toLocaleDateString("fr-CA")}`;
          const ok = await notifyOnce({
            recipientId: sa.id,
            type: "warning",
            title: titleSa,
            body: bodySa,
            link: "/admin/employes/permis",
            icon: "shield",
          });
          if (ok) results.licensesSuperAdmin += 1;
          else results.skipped += 1;
        }
      }
    }

    // ── Formations / certifications ──────────────────────────
    const trainings = await prisma.trainingRecord.findMany({
      where: { expiresAt: { gte: start, lt: end } },
      include: { admin: { select: { id: true, isActive: true, fullName: true } } },
    });

    for (const tr of trainings) {
      if (!tr.admin?.isActive) continue;
      const titleEmp = `Formation expire dans ${days} jour${days > 1 ? "s" : ""}`;
      const bodyEmp = `${tr.title} arrive à échéance le ${tr.expiresAt?.toLocaleDateString("fr-CA")}.`;
      const created = await notifyOnce({
        recipientId: tr.adminId,
        type: days <= 7 ? "warning" : "info",
        title: titleEmp,
        body: bodyEmp,
        link: "/admin/mon-espace/formations",
        icon: "graduation-cap",
      });
      if (created) results.trainingsEmployee += 1;
      else results.skipped += 1;

      if (days === NOTIFY_SUPER_ADMIN_AT) {
        for (const sa of superAdmins) {
          const titleSa = `Formation employé expire dans 7 jours`;
          const bodySa = `${tr.admin.fullName ?? "Employé"} · ${tr.title} · échéance ${tr.expiresAt?.toLocaleDateString("fr-CA")}`;
          const ok = await notifyOnce({
            recipientId: sa.id,
            type: "warning",
            title: titleSa,
            body: bodySa,
            link: "/admin/employes/formations",
            icon: "graduation-cap",
          });
          if (ok) results.trainingsSuperAdmin += 1;
          else results.skipped += 1;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    thresholds: THRESHOLDS,
    notifications: results,
  });
}

// GET — dry-run (compte ce qui SERAIT notifié sans rien créer)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configure" }, { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorizedJson();

  const counts: Record<string, { licenses: number; trainings: number }> = {};
  for (const days of THRESHOLDS) {
    const { start, end } = dayBoundary(days);
    const [lic, tr] = await Promise.all([
      prisma.professionalLicense.count({ where: { expiresAt: { gte: start, lt: end }, admin: { isActive: true } } }),
      prisma.trainingRecord.count({ where: { expiresAt: { gte: start, lt: end }, admin: { isActive: true } } }),
    ]);
    counts[`d${days}`] = { licenses: lic, trainings: tr };
  }
  return NextResponse.json({ mode: "dry-run", thresholds: THRESHOLDS, wouldNotify: counts });
}
