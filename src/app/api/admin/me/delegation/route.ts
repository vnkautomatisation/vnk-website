// GET /api/admin/me/delegation
// Retourne la visibilite de delegation pour l'utilisateur courant :
//   - outgoing : a qui JE delegue mes approbations
//   - incoming : qui me delegue ses approbations
// Utilise dans le bandeau de delegation Mon espace.
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const actorId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    select: {
      delegateApprovalTo: true,
      delegate: { select: { id: true, fullName: true, email: true, isActive: true } },
    },
  });
  if (!me) return NextResponse.json({ error: "Admin introuvable" }, { status: 404 });

  const incoming = await prisma.admin.findMany({
    where: { delegateApprovalTo: actorId, isActive: true },
    select: { id: true, fullName: true, email: true },
    orderBy: [{ fullName: "asc" }],
  });

  return NextResponse.json({
    outgoing: {
      delegateAdmin: me.delegate
        ? {
            id: me.delegate.id,
            fullName: me.delegate.fullName,
            email: me.delegate.email,
            isActive: me.delegate.isActive,
          }
        : null,
    },
    incoming: incoming.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      email: a.email,
    })),
  });
}
