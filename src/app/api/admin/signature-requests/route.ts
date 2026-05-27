// GET /api/admin/signature-requests
// Liste des DocumentSignatureRequest avec filtres optionnels.
// Filtres : status, employee (adminId cible), template (templateId).
// - Admin RH : voit toutes les demandes
// - Employé non-RH : voit uniquement ses pending (individuelles + équipe + all)
//   et masque celles déjà signées (auto-completed côté individuel).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");

  const url = req.nextUrl;
  const statusParam = url.searchParams.get("status"); // pending|completed|cancelled|null
  const employeeParam = url.searchParams.get("employee");
  const templateParam = url.searchParams.get("template");

  const where: Prisma.DocumentSignatureRequestWhereInput = {};
  if (statusParam && ["pending", "completed", "cancelled"].includes(statusParam)) {
    where.status = statusParam;
  }
  if (employeeParam) {
    const eid = Number(employeeParam);
    if (Number.isFinite(eid)) where.targetAdminId = eid;
  }
  if (templateParam) {
    const tid = Number(templateParam);
    if (Number.isFinite(tid)) where.templateId = tid;
  }

  if (!isHr) {
    // Employé : ne voit que pending qui le concerne (lui / son équipe / all)
    // ET pour lesquelles il n'a pas déjà signé la version courante
    where.status = "pending";
    where.OR = [
      { targetAdminId: actorId },
      ...(me.teamId ? [{ targetTeamId: me.teamId }] : []),
      { targetAll: true },
    ];
  }

  const rows = await prisma.documentSignatureRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { requestedAt: "desc" }],
    include: {
      template: { select: { id: true, key: true, title: true, version: true, isRequired: true } },
      requestedBy: { select: { id: true, fullName: true, email: true } },
      targetAdmin: { select: { id: true, fullName: true, email: true } },
    },
    take: 500,
  });

  // Pour l'employé : filtrer celles déjà signées
  let filtered = rows;
  if (!isHr) {
    const tplIdsVersions = rows.map((r) => ({ tid: r.template.id, ver: r.template.version }));
    const tplIds = Array.from(new Set(tplIdsVersions.map((p) => p.tid)));
    const signedRows = await prisma.legalDocumentSignature.findMany({
      where: { adminId: actorId, templateId: { in: tplIds } },
      select: { templateId: true, version: true },
    });
    const signedSet = new Set(signedRows.map((s) => `${s.templateId}|${s.version}`));
    filtered = rows.filter((r) => !signedSet.has(`${r.template.id}|${r.template.version}`));
  }

  return NextResponse.json({
    requests: filtered.map((r) => ({
      id: r.id,
      templateId: r.templateId,
      template: r.template,
      requestedAt: r.requestedAt,
      requestedBy: r.requestedBy,
      dueDate: r.dueDate,
      reason: r.reason,
      status: r.status,
      completedAt: r.completedAt,
      targetAdminId: r.targetAdminId,
      targetAdmin: r.targetAdmin,
      targetTeamId: r.targetTeamId,
      targetAll: r.targetAll,
    })),
  });
}
