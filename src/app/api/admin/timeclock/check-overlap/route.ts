// GET /api/admin/timeclock/check-overlap
// Detection live de chevauchement pour le modal de saisie manuelle.
// Auth: admin (cherche dans ses propres pointages).
// Query: ?from=ISO&to=ISO[&excludeId=N]
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const excludeIdStr = url.searchParams.get("excludeId");

  if (!fromStr || !toStr) {
    return NextResponse.json({ overlap: false });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ overlap: false });
  }
  const excludeId = excludeIdStr ? Number(excludeIdStr) : null;

  const overlap = await prisma.timeClock.findFirst({
    where: {
      adminId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        // Cas 1 : entry fermee qui chevauche [from, to]
        { AND: [{ clockOut: { not: null } }, { clockIn: { lt: to } }, { clockOut: { gt: from } }] },
        // Cas 2 : entry ouverte dont le clockIn precede to (peut courir jusqu'a maintenant)
        { clockOut: null, clockIn: { lt: to } },
      ],
    },
    select: { id: true, clockIn: true },
  });

  if (!overlap) return NextResponse.json({ overlap: false });
  return NextResponse.json({
    overlap: true,
    with: { id: overlap.id, clockIn: overlap.clockIn.toISOString() },
  });
}
