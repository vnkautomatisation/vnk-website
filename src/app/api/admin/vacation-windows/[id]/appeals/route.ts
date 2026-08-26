// GET /api/admin/vacation-windows/[id]/appeals
// Liste des appels (pending) pour les preferences d'une fenetre de vacances.
// Auth : super_admin OU role avec permissions leaves.write/users.write/hr.write.
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

async function canReviewAppeals(adminId: number): Promise<boolean> {
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return false;
  if (me.customRole?.name === "super_admin") return true;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (perms.leaves ?? []).includes("write")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;
  const allowed = await canReviewAppeals(actorId);
  if (!allowed) return forbiddenJson();

  const { id } = await params;
  const windowId = Number(id);
  if (!Number.isFinite(windowId) || windowId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const w = await prisma.vacationSelectionWindow.findUnique({
    where: { id: windowId },
    select: { id: true, name: true, status: true },
  });
  if (!w) return NextResponse.json({ error: "Fenetre introuvable" }, { status: 404 });

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending"; // pending | approved | rejected | all

  const where: Record<string, unknown> = { windowId };
  if (statusFilter === "all") {
    where.appealStatus = { not: null };
  } else if (["pending", "approved", "rejected"].includes(statusFilter)) {
    where.appealStatus = statusFilter;
  } else {
    where.appealStatus = "pending";
  }

  const appeals = await prisma.vacationPreference.findMany({
    where,
    orderBy: [{ appealedAt: "desc" }],
    select: {
      id: true,
      adminId: true,
      rank: true,
      startDate: true,
      endDate: true,
      daysCount: true,
      status: true,
      appealStatus: true,
      appealReason: true,
      appealedAt: true,
      appealReviewedBy: true,
      appealReviewedAt: true,
      appealReviewNotes: true,
      admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  // Resoudre les noms des reviewers
  const reviewerIds = Array.from(
    new Set(appeals.map((a) => a.appealReviewedBy).filter((id): id is number => id !== null)),
  );
  const reviewers = reviewerIds.length > 0
    ? await prisma.admin.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, fullName: true, email: true },
      })
    : [];
  const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

  return NextResponse.json({
    window: { id: w.id, name: w.name, status: w.status },
    appeals: appeals.map((a) => ({
      preferenceId: a.id,
      adminId: a.adminId,
      employee: a.admin,
      rank: a.rank,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      daysCount: Number(a.daysCount),
      preferenceStatus: a.status,
      appealStatus: a.appealStatus,
      appealReason: a.appealReason,
      appealedAt: a.appealedAt?.toISOString() ?? null,
      appealReviewedAt: a.appealReviewedAt?.toISOString() ?? null,
      appealReviewNotes: a.appealReviewNotes,
      appealReviewer: a.appealReviewedBy ? reviewerMap.get(a.appealReviewedBy) ?? null : null,
    })),
  });
}
