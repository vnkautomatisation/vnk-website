// GET /api/admin/leaves/[id]/conflicts
// Liste des collegues (meme scope que getLeavesScope) qui ont un conge
// approved/pending chevauchant les dates de la demande [id].
// Auth : auteur de la demande OU reviewer autorise.
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanReviewLeave, getLeavesScope } from "@/lib/services/timesheet-scope";
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
  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: { id: true, adminId: true, startDate: true, endDate: true },
  });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Auth : auteur OU reviewer autorise
  const isOwner = leave.adminId === actorId;
  if (!isOwner) {
    const ok = await assertCanReviewLeave(actorId, leave.adminId);
    if (!ok) return forbiddenJson();
  }

  // Scope : on prend la liste des collegues visibles par le PROPRIETAIRE de la demande
  // pour que la vue "conflits sur ma demande" reflete les pairs de l'auteur, pas de l'acteur.
  const scope = await getLeavesScope(leave.adminId);

  const where: Record<string, unknown> = {
    status: { in: ["approved", "pending"] },
    startDate: { lte: leave.endDate },
    endDate: { gte: leave.startDate },
    id: { not: leave.id },
    adminId: { not: leave.adminId },
  };

  // Restreint par scope
  if (!scope.isHr && scope.allowedAdminIds) {
    where.adminId = { in: scope.allowedAdminIds, not: leave.adminId };
  }

  const conflicts = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ startDate: "asc" }],
    take: 100,
    select: {
      id: true,
      adminId: true,
      type: true,
      status: true,
      startDate: true,
      endDate: true,
      halfDay: true,
      admin: { select: { id: true, fullName: true, email: true, avatarUrl: true, team: { select: { name: true, color: true } } } },
    },
  });

  return NextResponse.json({
    leaveId: leave.id,
    period: {
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
    },
    conflicts: conflicts.map((c) => ({
      leaveId: c.id,
      adminId: c.adminId,
      fullName: c.admin.fullName,
      email: c.admin.email,
      avatarUrl: c.admin.avatarUrl,
      team: c.admin.team,
      type: c.type,
      status: c.status,
      startDate: c.startDate.toISOString().slice(0, 10),
      endDate: c.endDate.toISOString().slice(0, 10),
      halfDay: c.halfDay,
    })),
  });
}
