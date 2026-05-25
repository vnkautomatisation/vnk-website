// GET /api/admin/me/delegation/candidates
// Liste des admins eligibles a recevoir une delegation d'approbation
// pour l'utilisateur courant (actifs, hors soi-meme). Utilise par DelegationBanner.
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

  const candidates = await prisma.admin.findMany({
    where: { isActive: true, id: { not: actorId } },
    select: { id: true, fullName: true, email: true },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
  });

  return NextResponse.json({ candidates });
}
