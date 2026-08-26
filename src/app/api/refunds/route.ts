// GET /api/refunds — liste remboursements
// POST /api/refunds — creer un remboursement (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calculateTaxes, generateDocumentNumber } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  invoiceId: z.number().int().positive().optional(),
  reason: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("refunds", "read")) {
    return forbiddenJson();
  }

  const refunds = await prisma.refund.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ refunds });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("refunds", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const { tps, tvq, ttc } = calculateTaxes(parsed.data.amount);

  const prefix = (await getSetting("billing", "refund_number_format")) || "RMB-{YYYY}{MM}-{SEQ}";
  const lastRefund = await prisma.refund.findFirst({ orderBy: { id: "desc" } });
  const seq = (lastRefund?.id ?? 0) + 1;
  const refundNumber = generateDocumentNumber(prefix, seq);

  const refund = await prisma.refund.create({
    data: {
      clientId: parsed.data.clientId,
      invoiceId: parsed.data.invoiceId,
      refundNumber,
      reason: parsed.data.reason,
      amount: parsed.data.amount,
      tpsAmount: tps,
      tvqAmount: tvq,
      totalAmount: ttc,
      notes: parsed.data.notes,
      status: "pending",
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "refunds",
    entityId: refund.id,
  });

  return NextResponse.json({ success: true, refund });
}
