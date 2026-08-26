// GET /api/payouts/[id] — detail versement avec paiements groupes
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("finance", "read")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const payoutId = Number(id);
  if (!Number.isInteger(payoutId) || payoutId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
  });
  if (!payout) {
    return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
  }

  // Paiements liés via stripePayoutId
  const payments = await prisma.payment.findMany({
    where: { stripePayoutId: payout.stripePayoutId },
    orderBy: { paidAt: "asc" },
    include: {
      client: { select: { id: true, fullName: true, companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  return NextResponse.json({ payout, payments });
}
