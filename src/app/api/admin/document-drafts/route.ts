// GET /api/admin/document-drafts
// Liste les brouillons crees par l'utilisateur courant (ou tous si admin RH).
// Filtres : ?status=draft|ready|sent  ?templateId=X  ?targetAdminId=Y
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const me = (session.user as { adminId?: number }).adminId ?? 0;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const templateId = searchParams.get("templateId");
  const targetAdminId = searchParams.get("targetAdminId");
  const includeOthers = searchParams.get("includeOthers") === "1";

  // includeOthers=1 : reserve aux RH (perms users/hr write ou super_admin).
  // Sans ce garde-fou, n'importe quel admin verrait les brouillons (et notes
  // internes) des autres managers.
  let canSeeOthers = false;
  if (includeOthers) {
    const meRow = await prisma.admin.findUnique({
      where: { id: me },
      include: { customRole: true },
    });
    const perms = (meRow?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
    canSeeOthers =
      meRow?.customRole?.name === "super_admin"
      || (perms.users ?? []).includes("write")
      || (perms.hr ?? []).includes("write");
  }

  const where: Record<string, unknown> = {};
  if (!includeOthers || !canSeeOthers) where.authorId = me;
  if (status && ["draft", "ready", "sent"].includes(status)) where.status = status;
  if (templateId) where.templateId = Number(templateId);
  if (targetAdminId) where.targetAdminId = Number(targetAdminId);

  const drafts = await prisma.documentDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      templateId: true,
      authorId: true,
      targetAdminId: true,
      customFieldValues: true,
      status: true,
      scheduledFor: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      sentAt: true,
      template: { select: { id: true, title: true, key: true, category: true } },
      author: { select: { id: true, fullName: true, email: true } },
      target: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  // Compteur de champs remplis pour chaque brouillon (pour KPI / progress bar UI)
  const items = drafts.map((d) => {
    const vals = (d as { customFieldValues?: Record<string, string> | null }).customFieldValues;
    const filledCount = vals && typeof vals === "object"
      ? Object.values(vals).filter((v) => typeof v === "string" && v.trim() !== "").length
      : 0;
    return {
      id: d.id,
      template: d.template,
      author: d.author,
      target: d.target,
      status: d.status,
      scheduledFor: d.scheduledFor,
      notes: d.notes,
      filledCount,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      sentAt: d.sentAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ items });
}
