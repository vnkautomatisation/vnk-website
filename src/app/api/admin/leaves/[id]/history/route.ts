// GET /api/admin/leaves/[id]/history
// Retourne l'historique audit d'une demande de conge.
// Auth : auteur OU reviewer (assertCanReviewLeave).
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;
  const { id } = await params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId }, select: { adminId: true } });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (leave.adminId !== actorId) {
    const ok = await assertCanReviewLeave(actorId, leave.adminId);
    if (!ok) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "leave_request", entityId: leaveId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
      changes: l.changes,
      actor: l.admin ? { id: l.admin.id, fullName: l.admin.fullName, email: l.admin.email } : null,
    })),
  });
}
