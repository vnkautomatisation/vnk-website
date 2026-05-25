// GET /api/admin/leaves/employee/[id]/export/csv
// Export CSV des demandes de conge d'un seul employe.
// Auth : l'employe lui-meme OU un reviewer autorise (assertCanReviewLeave).
// Headers : id, type, status, startDate, endDate, daysCount, halfDay, reason,
//           reviewedBy, reviewedAt, reviewNotes.
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

const CSV_MAX_ROWS = 10000;
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
  return d.toLocaleDateString("fr-CA");
}

const TYPE_LABEL: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  parental: "Parental",
  unpaid: "Sans solde",
  bereavement: "Deces",
  other: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuve",
  rejected: "Refuse",
  cancelled: "Annule",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  // Auth : soi-meme OU reviewer autorise
  if (employeeId !== actorId) {
    const ok = await assertCanReviewLeave(actorId, employeeId);
    if (!ok) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const employee = await prisma.admin.findUnique({
    where: { id: employeeId },
    select: { id: true, fullName: true, email: true },
  });
  if (!employee) return NextResponse.json({ error: "Employe introuvable" }, { status: 404 });

  const entries = await prisma.leaveRequest.findMany({
    where: { adminId: employeeId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: CSV_MAX_ROWS,
    include: {
      reviewer: { select: { fullName: true, email: true } },
    },
  });

  const headerCells = [
    "ID",
    "Type",
    "Statut",
    "Date debut",
    "Date fin",
    "Jours",
    "Demi-journee",
    "Motif",
    "Revise par",
    "Revise le",
    "Notes revue",
    "Demande le",
  ];
  const lines: string[] = [headerCells.map((h) => csv(h)).join(SEP)];

  for (const e of entries) {
    const row = [
      String(e.id),
      TYPE_LABEL[e.type] ?? e.type,
      STATUS_LABEL[e.status] ?? e.status,
      fmtDate(e.startDate),
      fmtDate(e.endDate),
      String(Number(e.daysCount)).replace(".", ","),
      e.halfDay ?? "",
      e.reason ?? "",
      e.reviewer ? (e.reviewer.fullName || e.reviewer.email) : "",
      fmtDate(e.reviewedAt),
      e.reviewNotes ?? "",
      fmtDate(e.createdAt),
    ].map((c) => csv(c)).join(SEP);
    lines.push(row);
  }

  const body = "﻿" + lines.join("\r\n");

  await logAudit({
    adminId: actorId,
    action: "export",
    entityType: "leave_request_csv_employee",
    entityId: employeeId,
    changes: { count: entries.length, employeeId },
  }).catch(() => null);

  const datePart = new Date().toISOString().slice(0, 10);
  const slug = (employee.fullName || employee.email || `emp-${employeeId}`)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  const filename = `conges-${slug}-${datePart}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
