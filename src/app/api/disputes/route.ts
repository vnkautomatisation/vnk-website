// GET /api/disputes — liste litiges (admin)
// POST /api/disputes — creer un litige (admin)
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  invoiceId: z.number().int().positive().nullable().optional(),
  mandateId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  type: z.enum(["chargeback", "invoice", "service", "refund", "warranty", "legal", "other"]).default("other"),
  category: z.string().max(80).nullable().optional(),
  amountDisputed: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  stripeReason: z.string().max(60).nullable().optional(),
  evidenceDueBy: z.string().nullable().optional(),
  cardBrand: z.string().max(20).nullable().optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  estimatedResolutionDate: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  contactMethod: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("disputes", "read")) {
    return forbiddenJson();
  }

  const disputes = await prisma.dispute.findMany({
    include: {
      client: { select: { id: true, fullName: true, companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true, amountTtc: true } },
      mandate: { select: { id: true, title: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json({ disputes });
}

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("disputes", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  const dispute = await prisma.dispute.create({
    data: {
      clientId: parsed.data.clientId,
      invoiceId: parsed.data.invoiceId ?? undefined,
      mandateId: parsed.data.mandateId ?? undefined,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: "open",
      type: parsed.data.type,
      category: parsed.data.category ?? undefined,
      amountDisputed: parsed.data.amountDisputed ?? undefined,
      currency: parsed.data.currency ?? "CAD",
      stripeReason: parsed.data.stripeReason ?? undefined,
      evidenceDueBy: parsed.data.evidenceDueBy ? new Date(parsed.data.evidenceDueBy) : undefined,
      cardBrand: parsed.data.cardBrand ?? undefined,
      assignedTo: parsed.data.assignedTo ?? session.user.email ?? undefined,
      estimatedResolutionDate: parsed.data.estimatedResolutionDate ? new Date(parsed.data.estimatedResolutionDate) : undefined,
      internalNotes: parsed.data.internalNotes ?? undefined,
      contactMethod: parsed.data.contactMethod ?? undefined,
    },
  });

  await createWorkflowEvent({
    clientId: dispute.clientId,
    eventType: "dispute_opened",
    eventLabel: `Litige ouvert : ${dispute.title}`,
    triggeredBy: "admin",
    metadata: { disputeId: dispute.id, type: dispute.type },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "disputes",
    entityId: dispute.id,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, dispute });
}
