// ─────────────────────────────────────────────────────────
// CRON · Notifications expiration documents personnels
// Pour chaque EmployeePersonalDocument avec expiresAt à
// EXACTEMENT 60, 30, 7 ou 1 jour(s) :
//   - notifie l'employé concerné (graduation : info → warning → critical)
//   - à 30j ET 7j : notifie aussi les admin RH (users.write/hr.write/super)
//   - à 1j : escalade critique RH
// Anti-doublon : skip si une notif équivalente a été créée
// dans les dernières 24h pour ce document.
//
// Sécurité : token Bearer requis (CRON_SECRET).
// Schedule recommandé : daily 03:30 UTC (commentaire railway.toml).
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { getLocale } from "next-intl/server";
import { dateLocale } from "@/lib/i18n-format";

export const dynamic = "force-dynamic";

type Threshold = { days: number; severity: "info" | "warning" | "critical"; notifyHr: boolean };

const THRESHOLDS: Threshold[] = [
  { days: 60, severity: "info", notifyHr: false },
  { days: 30, severity: "warning", notifyHr: true },
  { days: 7, severity: "warning", notifyHr: true },
  { days: 1, severity: "critical", notifyHr: true },
];

function dayBoundary(daysFromNow: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

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
  const dup = await alreadyNotified({
    recipientId: data.recipientId,
    title: data.title,
    link: data.link,
  });
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

async function getHrRecipients(): Promise<Array<{ id: number }>> {
  // Tous les actifs ayant un rôle système super_admin OU un permission custom
  // sur users.write / hr.write. Simplification : on prend super_admin + tous
  // les admins dont le customRole.permissions contient users:write.
  const all = await prisma.admin.findMany({
    where: { isActive: true },
    include: { customRole: true },
  });
  return all
    .filter((a) => {
      if (a.customRole?.name === "super_admin") return true;
      const perms = (a.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
      return (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");
    })
    .map((a) => ({ id: a.id }));
}

export async function POST(req: Request) {
  const dateTag = dateLocale(await getLocale());
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configure" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return unauthorizedJson();
  }

  const results = {
    employeeNotified: 0,
    hrNotified: 0,
    skipped: 0,
  };

  const hrRecipients = await getHrRecipients();

  for (const t of THRESHOLDS) {
    const { start, end } = dayBoundary(t.days);

    const docs = await prisma.employeePersonalDocument.findMany({
      where: { expiresAt: { gte: start, lt: end } },
      include: { admin: { select: { id: true, isActive: true, fullName: true, email: true } } },
    });

    for (const doc of docs) {
      if (!doc.admin?.isActive) continue;
      const label = doc.title + (doc.referenceNumber ? ` (#${doc.referenceNumber})` : "");
      const dueStr = doc.expiresAt?.toLocaleDateString(dateTag) ?? "";

      // ── Notif employé ───────────────────────────────────
      const titleEmp = t.days === 1
        ? "Document expire DEMAIN"
        : `Document expire dans ${t.days} jour${t.days > 1 ? "s" : ""}`;
      const bodyEmp = `${label} arrive à échéance le ${dueStr}.`;
      const notifType: "info" | "warning" | "error" = t.severity === "critical"
        ? "error"
        : t.severity === "warning"
          ? "warning"
          : "info";
      const created = await notifyOnce({
        recipientId: doc.adminId,
        type: notifType,
        title: titleEmp,
        body: bodyEmp,
        link: "/admin/mon-espace/documents",
        icon: t.severity === "critical" ? "alert-triangle" : "calendar",
      });
      if (created) results.employeeNotified += 1;
      else results.skipped += 1;

      // ── Notif RH (sauf docs privés sans super_admin) ────
      if (t.notifyHr) {
        for (const hr of hrRecipients) {
          // Si doc privé : skipper RH non super_admin
          if (doc.isPrivate) {
            const isSuper = await prisma.admin.findUnique({
              where: { id: hr.id },
              include: { customRole: true },
            }).then((a) => a?.customRole?.name === "super_admin");
            if (!isSuper) continue;
          }
          const titleHr = t.days === 1
            ? `Doc employé expire DEMAIN — ${doc.admin.fullName ?? "?"}`
            : `Doc employé expire dans ${t.days} jours`;
          const bodyHr = `${doc.admin.fullName ?? doc.admin.email ?? "?"} · ${label} · échéance ${dueStr}`;
          const ok = await notifyOnce({
            recipientId: hr.id,
            type: notifType,
            title: titleHr,
            body: bodyHr,
            link: "/admin/employes/documents",
            icon: t.severity === "critical" ? "alert-triangle" : "shield",
          });
          if (ok) results.hrNotified += 1;
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

// GET — dry-run : compte ce qui SERAIT notifié sans rien créer
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configure" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return unauthorizedJson();
  }

  const counts: Record<string, { docs: number }> = {};
  for (const t of THRESHOLDS) {
    const { start, end } = dayBoundary(t.days);
    const c = await prisma.employeePersonalDocument.count({
      where: { expiresAt: { gte: start, lt: end }, admin: { isActive: true } },
    });
    counts[`d${t.days}`] = { docs: c };
  }
  return NextResponse.json({
    mode: "dry-run",
    thresholds: THRESHOLDS,
    wouldNotify: counts,
  });
}
