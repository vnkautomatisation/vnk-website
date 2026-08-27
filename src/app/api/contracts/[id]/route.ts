// GET /api/contracts/[id] — detail contrat
// PATCH /api/contracts/[id] — mettre a jour (interdit apres signature client)
// DELETE /api/contracts/[id] — supprimer un contrat non signe
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { createWorkflowEvent } from "@/lib/workflow";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  status: z.string().optional(),
  amountTtc: z.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  mandateId: z.number().int().positive().nullable().optional(),
  quoteId: z.number().int().positive().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "aucune_donnee_a_mettre_a_jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true, companyName: true, email: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }
  return NextResponse.json({ contract });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("contracts", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const contractId = Number(id);

  const existing = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!existing) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (existing.clientSignatureData || existing.signedAt) {
    return NextResponse.json({ error: t("contrat_deja_signe_par_le_client_non") }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.expiresAt === "string") data.expiresAt = new Date(data.expiresAt);

  const updated = await prisma.contract.update({ where: { id: contractId }, data });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    if (parsed.data.status === "cancelled") {
      await createWorkflowEvent({
        clientId: updated.clientId,
        contractId: updated.id,
        eventType: "contract_cancelled",
        eventLabel: `Contrat ${updated.contractNumber} annulé`,
        triggeredBy: "admin",
      });
    }
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "contracts",
    entityId: contractId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, contract: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("contracts", "delete")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const contractId = Number(id);

  const existing = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { signedAt: true, clientSignatureData: true, _count: { select: { invoices: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (existing.signedAt || existing.clientSignatureData || existing._count.invoices > 0) {
    return NextResponse.json(
      { error: t("contrat_signe_ou_lie_a_des_factures") },
      { status: 409 }
    );
  }

  await prisma.contract.delete({ where: { id: contractId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "contracts",
    entityId: contractId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
