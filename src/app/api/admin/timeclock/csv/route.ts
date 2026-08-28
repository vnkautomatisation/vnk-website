// GET /api/admin/timeclock/csv
// CSV export of approved punches (UTF-8 BOM so Excel opens it correctly).
// Auth: admin with payroll/users write permission.
// Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
import "server-only";
import { getTranslations, getLocale } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getTimesheetScope, timeClockScopeWhere } from "@/lib/services/timesheet-scope";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

export const dynamic = "force-dynamic";

const CSV_MAX_ROWS = 50000;

function csv(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, " ")}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const t = await getTranslations("admin.action_errors");
  const dateTag = dateLocale(await getLocale());
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isPayrollAdmin = me?.customRole?.name === "super_admin" || (perms.payroll ?? []).includes("write") || (perms.users ?? []).includes("write");
  if (!isPayrollAdmin) {
    return NextResponse.json({ error: "Permission paie/RH requise" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr + "T23:59:59") : null;

  // A manager exports only their reports; a non-founder HR excludes self.
  const scope = await getTimesheetScope(adminId);
  const scopeWhere = timeClockScopeWhere(scope);

  const where: Record<string, unknown> = {
    ...scopeWhere,
    approvedAt: { not: null },
  };
  const clockInWhere: { gte?: Date; lte?: Date } = {};
  if (from && !isNaN(from.getTime())) clockInWhere.gte = from;
  if (to && !isNaN(to.getTime())) clockInWhere.lte = to;
  if (clockInWhere.gte || clockInWhere.lte) where.clockIn = clockInWhere;

  const entries = await prisma.timeClock.findMany({
    where,
    orderBy: { clockIn: "desc" },
    take: CSV_MAX_ROWS,
    include: {
      admin: { select: { fullName: true, email: true } },
      approver: { select: { fullName: true, email: true } },
    },
  });

  const lines: string[] = [
    [
      t("exp_h_employe"), t("csvh_date_debut"), t("csvh_heure_debut"),
      t("csvh_date_fin"), t("csvh_heure_fin"), t("csvh_duree_min"),
      t("csvh_categorie"), t("exp_h_approuve_par"), t("csvh_notes"),
    ].join(","),
  ];
  for (const e of entries) {
    const row = [
      csv(e.admin.fullName || e.admin.email),
      e.clockIn.toLocaleDateString(dateTag),
      e.clockIn.toLocaleTimeString(dateTag, { hour: "2-digit", minute: "2-digit" }),
      e.clockOut ? e.clockOut.toLocaleDateString(dateTag) : "",
      e.clockOut ? e.clockOut.toLocaleTimeString(dateTag, { hour: "2-digit", minute: "2-digit" }) : "",
      String(e.durationMin ?? ""),
      e.category,
      e.approver ? (e.approver.fullName || e.approver.email) : "",
      csv(e.notes ?? ""),
    ].join(",");
    lines.push(row);
  }

  const body = "﻿" + lines.join("\n");

  await logAudit({
    adminId,
    action: "export",
    entityType: "time_clock_csv",
    entityId: 0,
    changes: { count: entries.length, from: fromStr ?? null, to: toStr ?? null },
  }).catch(() => {});

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `pointages-${datePart}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
