// POST /api/invoices/:id/mark-paid
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { markInvoicePaid } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  paymentMethod: z.string().default("manual"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  try {
    const invoice = await markInvoicePaid(
      Number(id),
      parsed.success ? parsed.data.paymentMethod : "manual"
    );

    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "invoices",
      entityId: invoice.id,
      changes: { status: "paid" },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
