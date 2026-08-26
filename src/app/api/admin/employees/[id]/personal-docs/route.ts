// GET /api/admin/employees/[id]/personal-docs
// Liste les documents personnels d'un employé.
// Auth: employé lui-même OU admin RH (users.write|hr.write|super_admin).
// Les docs marqués isPrivate ne sont visibles que par l'employé propriétaire
// (super_admin peut voir tous les docs, y compris privés).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const actorId = session.user.adminId!;

  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return unauthorizedJson();

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");
  const isSelf = actorId === targetId;

  if (!isSelf && !isHr) {
    return forbiddenJson();
  }

  const docs = await prisma.employeePersonalDocument.findMany({
    where: {
      adminId: targetId,
      // Si pas self et pas super_admin, masque les docs privés
      ...(isSelf || isSuper ? {} : { isPrivate: false }),
    },
    orderBy: [{ category: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
    include: {
      verifiedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  return NextResponse.json({
    docs: docs.map((d) => ({
      id: d.id,
      adminId: d.adminId,
      category: d.category,
      title: d.title,
      description: d.description,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      fileSize: d.fileSize,
      fileMimeType: d.fileMimeType,
      issuedAt: d.issuedAt,
      expiresAt: d.expiresAt,
      issuer: d.issuer,
      referenceNumber: d.referenceNumber,
      isVerified: d.isVerified,
      verifiedAt: d.verifiedAt,
      verifiedBy: d.verifiedBy,
      verificationNotes: d.verificationNotes,
      isPrivate: d.isPrivate,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
}
