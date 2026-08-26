// GET /api/admin/leaves/export.csv
// Export CSV des demandes de congé (UTF-8 BOM + ; pour Excel FR).
// Auth : admin avec autorité revue des congés. Scope hiérarchique via getLeavesScope.
// Query optionnels : ?from=YYYY-MM-DD&to=YYYY-MM-DD&type=&status=
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getLeavesScope } from "@/lib/services/timesheet-scope";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const CSV_MAX_ROWS = 50000;
const SEP = ";"; // Excel FR

function csv(v: string | number): string {
  const s = String(v ?? "");
  if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, " ")}"`;
  }
  return s;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("fr-CA"); // yyyy-mm-dd
}

const TYPE_LABEL: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  parental: "Parental",
  unpaid: "Sans solde",
  bereavement: "Décès",
  other: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  cancelled: "Annulé",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  // Autorité : on réutilise la logique scope pour décider si on a droit d'exporter.
  const scope = await getLeavesScope(adminId);
  const isReviewer = scope.isHr || (scope.allowedAdminIds?.length ?? 0) > 0;
  if (!isReviewer) {
    return NextResponse.json({ error: "Permission RH ou manager requise" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");

  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr + "T23:59:59") : null;

  const where: Record<string, unknown> = {};

  // Scope
  if (!scope.isHr && scope.allowedAdminIds) {
    where.adminId = { in: scope.allowedAdminIds };
  } else if (scope.isHr && scope.excludeSelfId) {
    where.adminId = { not: scope.excludeSelfId };
  }

  // Période : chevauchement (un congé qui touche la période)
  if (from && !isNaN(from.getTime()) && to && !isNaN(to.getTime())) {
    where.startDate = { lte: to };
    where.endDate = { gte: from };
  } else if (from && !isNaN(from.getTime())) {
    where.endDate = { gte: from };
  } else if (to && !isNaN(to.getTime())) {
    where.startDate = { lte: to };
  }

  if (typeFilter) where.type = typeFilter;
  if (statusFilter) where.status = statusFilter;

  const entries = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: CSV_MAX_ROWS,
    include: {
      admin: {
        select: {
          fullName: true,
          email: true,
          team: { select: { name: true } },
        },
      },
      reviewer: { select: { fullName: true, email: true } },
    },
  });

  const headerCells = [
    "Employé",
    "Email",
    "Équipe",
    "Type",
    "Date début",
    "Date fin",
    "Demi-journée",
    "Jours",
    "Statut",
    "Approuvé par",
    "Demandé le",
    "Motif",
  ];
  const lines: string[] = [headerCells.map((h) => csv(h)).join(SEP)];

  for (const e of entries) {
    const row = [
      e.admin.fullName || e.admin.email,
      e.admin.email,
      e.admin.team?.name ?? "",
      TYPE_LABEL[e.type] ?? e.type,
      fmtDate(e.startDate),
      fmtDate(e.endDate),
      e.halfDay ?? "",
      String(Number(e.daysCount)).replace(".", ","),
      STATUS_LABEL[e.status] ?? e.status,
      e.reviewer ? (e.reviewer.fullName || e.reviewer.email) : "",
      fmtDate(e.createdAt),
      e.reason ?? "",
    ].map((c) => csv(c as string)).join(SEP);
    lines.push(row);
  }

  const body = "﻿" + lines.join("\r\n");

  await logAudit({
    adminId,
    action: "export",
    entityType: "leave_request_csv",
    entityId: 0,
    changes: { count: entries.length, from: fromStr ?? null, to: toStr ?? null, type: typeFilter, status: statusFilter },
  }).catch(() => {});

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `conges-${datePart}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
