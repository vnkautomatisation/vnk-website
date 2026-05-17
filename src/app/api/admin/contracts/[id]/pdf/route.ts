// GET /api/admin/contracts/[id]/pdf
// Genere et retourne le PDF d'un contrat d'employe (EmployeeContract).
// Auth: admin proprietaire OU permission hr/users en ecriture.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContractPdf } from "@/lib/services/pdf-hr";
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

  const [me, contract] = await Promise.all([
    prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } }),
    prisma.employeeContract.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
        employer: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    me?.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  const isOwner = contract.adminId === adminId;

  if (!isOwner && !isHr) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const pdf = await generateContractPdf({
    contract: {
      id: contract.id,
      title: contract.title,
      contractType: contract.contractType,
      bodyMarkdown: contract.bodyMarkdown,
      startDate: contract.startDate,
      endDate: contract.endDate,
      probationEndDate: contract.probationEndDate,
      salaryAnnual: contract.salaryAnnual != null ? Number(contract.salaryAnnual) : null,
      hourlyRate: contract.hourlyRate != null ? Number(contract.hourlyRate) : null,
      hoursPerWeek: contract.hoursPerWeek,
      vacationPct: contract.vacationPct != null ? Number(contract.vacationPct) : null,
      employeeSignedAt: contract.employeeSignedAt,
      employerSignedAt: contract.employerSignedAt,
    },
    admin: {
      fullName: contract.admin.fullName,
      email: contract.admin.email,
    },
    employer: contract.employer ?? null,
  });

  await logAudit({
    adminId,
    action: "export",
    entityType: "employee_contract",
    entityId: contract.id,
    changes: { contractAdminId: contract.adminId, title: contract.title },
  }).catch(() => {});

  const safeTitle = contract.title.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase().slice(0, 80);
  const filename = `contrat-${safeTitle || contract.id}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
