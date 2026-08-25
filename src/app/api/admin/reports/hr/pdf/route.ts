// GET /api/admin/reports/hr/pdf
// Export PDF du rapport RH (people analytics).
// Auth : admin connecte.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { getHrReportData } from "@/lib/services/hr-reports";
import { generateHrReportPdf } from "@/lib/services/pdf-hr-reports";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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
  const pdf = await generateHrReportPdf(data);

  await logAudit({
    adminId,
    action: "export",
    entityType: "hr_report",
    entityId: 0,
    changes: { format: "pdf", period: data.periodLabel },
  }).catch(() => {});

  const datePart = data.generatedAt.toISOString().slice(0, 10);
  const filename = `rapport-rh-${datePart}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
