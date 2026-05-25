// GET /api/admin/pay-stubs/[id]/pdf
// Genere et retourne le PDF d'un bulletin de paie.
// Auth: admin proprietaire du bulletin OU permission payroll en ecriture.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePayStubPdf } from "@/lib/services/pdf-hr";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const [me, stub] = await Promise.all([
    prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } }),
    prisma.payStub.findUnique({
      where: { id },
      include: {
        period: true,
        admin: { select: { id: true, fullName: true, email: true, title: true, position: { select: { name: true } } } },
      },
    }),
  ]);

  if (!stub) {
    return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
  }

  // Verification permissions: proprietaire OU permission payroll
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isPayrollAdmin =
    me?.customRole?.name === "super_admin" || (perms.payroll ?? []).includes("write");
  const isOwner = stub.adminId === adminId;

  if (!isOwner && !isPayrollAdmin) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  // L'employe ne voit que les bulletins publies
  if (isOwner && !isPayrollAdmin && !stub.releasedAt) {
    return NextResponse.json({ error: "Bulletin non publie" }, { status: 403 });
  }

  const pdf = await generatePayStubPdf({
    stub: {
      id: stub.id,
      hoursRegular: Number(stub.hoursRegular),
      hoursOvertime: Number(stub.hoursOvertime),
      hoursVacation: Number(stub.hoursVacation),
      hoursSick: Number(stub.hoursSick),
      rate: Number(stub.rate),
      grossPay: Number(stub.grossPay),
      deductionFederal: Number(stub.deductionFederal),
      deductionProvincial: Number(stub.deductionProvincial),
      deductionRrq: Number(stub.deductionRrq),
      deductionAe: Number(stub.deductionAe),
      deductionRqap: Number(stub.deductionRqap),
      deductionOther: Number(stub.deductionOther),
      netPay: Number(stub.netPay),
      releasedAt: stub.releasedAt,
    },
    admin: {
      fullName: stub.admin.fullName,
      email: stub.admin.email,
      position: stub.admin.title || stub.admin.position?.name || null,
    },
    period: {
      startDate: stub.period.startDate,
      endDate: stub.period.endDate,
      payDate: stub.period.payDate,
      status: stub.period.status,
    },
  });

  await logAudit({
    adminId,
    action: "export",
    entityType: "pay_stub",
    entityId: stub.id,
    changes: { stubAdminId: stub.adminId, periodId: stub.periodId },
  }).catch(() => {});

  const startStr = stub.period.startDate.toISOString().slice(0, 10);
  const filename = `bulletin-paie-${startStr}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
