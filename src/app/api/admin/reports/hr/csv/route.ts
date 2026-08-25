// GET /api/admin/reports/hr/csv
// Export CSV du rapport RH (UTF-8 BOM pour Excel).
// Auth : admin connecte.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { getHrReportData } from "@/lib/services/hr-reports";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Echappement CSV minimal : double-quote si contient virgule, guillemet ou retour ligne.
function csv(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  // Rapports RH : reserves RH (super_admin / users.write / hr.write).
  if (!(await isHrAdmin(session.user.adminId!))) {
    return NextResponse.json({ error: "Permission refusée (RH requis)" }, { status: 403 });
  }
  const adminId = session.user.adminId!;

  const data = await getHrReportData();

  const lines: string[] = [];

  // Bloc principal : Metrique, Valeur
  lines.push("Metrique,Valeur");
  lines.push(`${csv("Headcount actifs")},${csv(data.headcountActive)}`);
  lines.push(`${csv("Headcount inactifs")},${csv(data.headcountInactive)}`);
  lines.push(`${csv("Embauches 12 mois")},${csv(data.hiresLast12Months)}`);
  lines.push(`${csv("Departs 12 mois")},${csv(data.departuresLast12Months)}`);
  lines.push(`${csv("Turnover (%)")},${csv(data.turnoverPct.toFixed(1))}`);
  lines.push(`${csv("Anciennete moyenne (ans)")},${csv(data.avgTenureYears.toFixed(1))}`);
  lines.push(`${csv("Conges en attente")},${csv(data.pendingLeaves)}`);
  lines.push(`${csv("Conges approuves ce mois")},${csv(data.approvedLeavesThisMonth)}`);
  lines.push(`${csv("Cas CNESST ouverts")},${csv(data.openCnesstCases)}`);
  lines.push(`${csv("Anniversaires a venir (30 j)")},${csv(data.upcomingAnniversaries)}`);

  // Section postes
  lines.push("");
  lines.push("Poste,Effectif");
  for (const p of data.positionsBreakdown) {
    lines.push(`${csv(p.name)},${csv(p.count)}`);
  }

  // Section equipes
  lines.push("");
  lines.push("Equipe,Effectif");
  for (const t of data.teamsBreakdown) {
    lines.push(`${csv(t.name)},${csv(t.count)}`);
  }

  // BOM UTF-8 pour Excel
  const csvBody = "﻿" + lines.join("\n");

  await logAudit({
    adminId,
    action: "export",
    entityType: "hr_report",
    entityId: 0,
    changes: { format: "csv", period: data.periodLabel },
  }).catch(() => {});

  const datePart = data.generatedAt.toISOString().slice(0, 10);
  const filename = `rapport-rh-${datePart}.csv`;

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
