// POST /api/contracts/[id]/create-balance-invoice — emet la facture de solde (phase 2)
// A appeler manuellement par admin a la livraison des travaux.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { createBalanceInvoice } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("contracts", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const contractId = Number(id);

  try {
    const invoice = await createBalanceInvoice(contractId, session.user.email ?? "admin");

    await logAudit({
      adminId: session.user.adminId,
      action: "create",
      entityType: "invoices",
      entityId: invoice.id,
      changes: { type: "balance_invoice_generated", contractId, invoiceNumber: invoice.invoiceNumber },
    });

    revalidateAdminViews();

    return NextResponse.json({ success: true, invoice });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 400 },
    );
  }
}
