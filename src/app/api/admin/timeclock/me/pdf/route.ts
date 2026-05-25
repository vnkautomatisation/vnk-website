// GET /api/admin/timeclock/me/pdf
// PDF "Releve d'heures personnel" pour l'employe connecte.
// Auth : tout admin (consulte uniquement ses propres entrees).
// Query : ?from=YYYY-MM-DD&to=YYYY-MM-DD (defaut: 30 derniers jours)
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePersonalTimesheetPdf } from "@/lib/services/pdf-hr";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = fromStr ? new Date(fromStr) : defaultFrom;
  const to = toStr ? new Date(toStr + "T23:59:59") : now;
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true, email: true, title: true, position: { select: { name: true } } },
  });
  if (!admin) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const entries = await prisma.timeClock.findMany({
    where: { adminId, clockIn: { gte: from, lte: to } },
    orderBy: { clockIn: "asc" },
    select: {
      clockIn: true, clockOut: true, durationMin: true,
      category: true, notes: true, approvedAt: true,
    },
  });

  const pdf = await generatePersonalTimesheetPdf({
    admin: {
      fullName: admin.fullName,
      email: admin.email,
      position: admin.position?.name ?? admin.title ?? null,
    },
    from,
    to,
    entries,
  });

  await logAudit({
    adminId,
    action: "export",
    entityType: "time_clock_personal_pdf",
    entityId: 0,
    changes: { count: entries.length, from: from.toISOString(), to: to.toISOString() },
  }).catch(() => {});

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `releve-pointage-${datePart}.pdf`;
  // Convert Buffer to a Uint8Array so it matches the BodyInit ArrayBufferView signature
  // expected by NextResponse (works in Node 20+ and Edge alike).
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
