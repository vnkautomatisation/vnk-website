// GET /api/admin/employment-letters/[id]/pdf
// Genere et retourne le PDF d'une lettre d'emploi (EmploymentLetterRequest).
// Auth: admin proprietaire OU permission hr/users en ecriture.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEmploymentLetterPdf, type LetterPurpose } from "@/lib/services/pdf-hr";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const [me, letter] = await Promise.all([
    prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } }),
    prisma.employmentLetterRequest.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true, fullName: true, email: true, title: true, startDate: true,
            position: { select: { name: true } },
          },
        },
        issuer: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  if (!letter) {
    return NextResponse.json({ error: "Lettre introuvable" }, { status: 404 });
  }

  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    me?.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  const isOwner = letter.adminId === adminId;

  if (!isOwner && !isHr) {
    return forbiddenJson();
  }

  // Recupere le contrat actif pour les infos salariales (si includeSalary)
  let contractInfo: { salaryAnnual: number | null; hourlyRate: number | null; hoursPerWeek: number | null } | null = null;
  if (letter.includeSalary) {
    const activeContract = await prisma.employeeContract.findFirst({
      where: { adminId: letter.adminId, status: { in: ["active", "signed_employer"] } },
      orderBy: { startDate: "desc" },
      select: { salaryAnnual: true, hourlyRate: true, hoursPerWeek: true },
    });
    if (activeContract) {
      contractInfo = {
        salaryAnnual: activeContract.salaryAnnual != null ? Number(activeContract.salaryAnnual) : null,
        hourlyRate: activeContract.hourlyRate != null ? Number(activeContract.hourlyRate) : null,
        hoursPerWeek: activeContract.hoursPerWeek,
      };
    }
  }

  const signedBy = letter.issuer ?? { fullName: me?.fullName ?? null, email: me?.email ?? "" };
  const purpose = letter.purpose as LetterPurpose;

  const pdf = await generateEmploymentLetterPdf({
    admin: {
      fullName: letter.admin.fullName,
      email: letter.admin.email,
      position: letter.admin.title || letter.admin.position?.name || null,
      startDate: letter.admin.startDate,
    },
    purpose,
    language: "fr",
    contract: contractInfo,
    customBody: letter.notes,
    signedBy: { fullName: signedBy.fullName, email: signedBy.email },
  });

  await logAudit({
    adminId,
    action: "export",
    entityType: "employment_letter",
    entityId: letter.id,
    changes: { letterAdminId: letter.adminId, purpose: letter.purpose },
  }).catch(() => {});

  const safePurpose = letter.purpose.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const filename = `lettre-emploi-${safePurpose}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
