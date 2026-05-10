// GET /api/disputes/[id] — detail litige
// PATCH /api/disputes/[id] — mettre a jour
// DELETE /api/disputes/[id] — supprimer
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  resolution: z.string().nullable().optional(),
  type: z.enum(["chargeback", "invoice", "service", "refund", "warranty", "legal", "other"]).optional(),
  category: z.string().max(80).nullable().optional(),
  amountDisputed: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  stripeReason: z.string().max(60).nullable().optional(),
  evidenceDueBy: z.string().nullable().optional(),
  evidenceSubmittedAt: z.string().nullable().optional(),
  outcome: z.string().max(40).nullable().optional(),
  cardBrand: z.string().max(20).nullable().optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  estimatedResolutionDate: z.string().nullable().optional(),
  escalatedAt: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  evidenceDocumentIds: z.array(z.number().int().positive()).nullable().optional(),
  lastClientContactAt: z.string().nullable().optional(),
  nextActionDue: z.string().nullable().optional(),
  contactMethod: z.string().max(40).nullable().optional(),
  lawFirmInvolved: z.string().max(120).nullable().optional(),
  caseNumber: z.string().max(80).nullable().optional(),
  tribunal: z.string().max(80).nullable().optional(),
  smallClaimsFiledAt: z.string().nullable().optional(),
  invoiceId: z.number().int().positive().nullable().optional(),
  mandateId: z.number().int().positive().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const dispute = await prisma.dispute.findUnique({
    where: { id: Number(id) },
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      invoice: { select: { id: true, invoiceNumber: true, amountTtc: true } },
      mandate: { select: { id: true, title: true } },
    },
  });
  if (!dispute) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }
  return NextResponse.json({ dispute });
}

const DATE_FIELDS = ["evidenceDueBy", "evidenceSubmittedAt", "estimatedResolutionDate", "escalatedAt", "lastClientContactAt", "nextActionDue", "smallClaimsFiledAt"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const disputeId = Number(id);

  const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!existing) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  // Auto-set resolvedAt si transition vers resolved
  if (parsed.data.status && (parsed.data.status === "resolved" || parsed.data.status === "won" || parsed.data.status === "lost") && !existing.resolvedAt) {
    data.resolvedAt = new Date();
  }
  // Convert ISO date strings to Date
  for (const field of DATE_FIELDS) {
    if (typeof data[field] === "string") data[field] = new Date(data[field] as string);
  }

  const updated = await prisma.dispute.update({ where: { id: disputeId }, data });

  // Workflow event sur statut critique
  if (parsed.data.status && parsed.data.status !== existing.status) {
    if (parsed.data.status === "resolved" || parsed.data.status === "won" || parsed.data.status === "lost") {
      await createWorkflowEvent({
        clientId: updated.clientId,
        eventType: "dispute_resolved",
        eventLabel: `Litige résolu (${parsed.data.status}) : ${updated.title}`,
        triggeredBy: "admin",
        metadata: { disputeId: updated.id, outcome: parsed.data.outcome ?? null },
      });
    }
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "disputes",
    entityId: disputeId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, dispute: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const disputeId = Number(id);

  const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!existing) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }

  await prisma.dispute.delete({ where: { id: disputeId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "disputes",
    entityId: disputeId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
