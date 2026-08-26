// GET /api/admin/leaves/[id]/pdf-letter
// Genere une lettre PDF de confirmation pour un conge approuve.
// Auth : auteur de la demande OU reviewer (assertCanReviewLeave).
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";
import { generateLeaveLetterPdf } from "@/lib/services/pdf-hr";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      admin: {
        select: {
          id: true, fullName: true, email: true, title: true,
          position: { select: { name: true } },
        },
      },
      reviewer: { select: { fullName: true, email: true } },
    },
  });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Auth : auteur OU reviewer
  if (leave.adminId !== actorId) {
    const ok = await assertCanReviewLeave(actorId, leave.adminId);
    if (!ok) return forbiddenJson();
  }

  if (leave.status !== "approved") {
    return NextResponse.json({ error: "Seuls les congés approuvés peuvent générer une lettre." }, { status: 400 });
  }

  const pdf = await generateLeaveLetterPdf({
    id: leave.id,
    type: leave.type,
    startDate: leave.startDate,
    endDate: leave.endDate,
    daysCount: Number(leave.daysCount),
    halfDay: leave.halfDay,
    reviewedAt: leave.reviewedAt,
    reviewer: leave.reviewer,
    admin: {
      fullName: leave.admin.fullName,
      email: leave.admin.email,
      position: leave.admin.position?.name ?? leave.admin.title ?? null,
    },
  });

  await logAudit({
    adminId: actorId,
    action: "export",
    entityType: "leave_request_pdf_letter",
    entityId: leave.id,
  }).catch(() => null);

  // Inline par défaut pour permettre l'aperçu dans le PdfPreviewModal (iframe).
  // Le bouton "Télécharger" du modal utilise la balise <a download> côté client
  // pour forcer le téléchargement avec le bon nom de fichier.
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lettre-conge-${leave.id}.pdf"`,
    },
  });
}
