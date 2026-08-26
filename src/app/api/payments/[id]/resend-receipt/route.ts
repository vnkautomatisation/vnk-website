// POST /api/payments/[id]/resend-receipt — renvoie le PDF du recu au client par courriel
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendPaymentReceipt } from "@/lib/workflow";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { client: { select: { id: true, email: true } } },
  });

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }
  if (payment.status !== "succeeded" && payment.status !== "paid") {
    return NextResponse.json({ error: "Le paiement n'est pas complété — pas de reçu à envoyer" }, { status: 400 });
  }
  if (!payment.client?.email) {
    return NextResponse.json({ error: "Aucun courriel client associé" }, { status: 400 });
  }

  try {
    await sendPaymentReceipt(paymentId);
    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "payments",
      entityId: paymentId,
      changes: { type: "receipt_resent", email: payment.client.email },
    });
    return NextResponse.json({ success: true, email: payment.client.email });
  } catch (err) {
    console.error("[resend-receipt] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'envoi" },
      { status: 500 },
    );
  }
}
