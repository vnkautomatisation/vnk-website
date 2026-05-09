// GET /api/mandates/[id] — detail mandat
// PATCH /api/mandates/[id] — mettre a jour (statut, progression, notes, etc.)
// DELETE /api/mandates/[id] — supprimer si aucun enfant lie
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent, type WorkflowEventType } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

// Map statut -> workflow event + label francais pour mandate_log
const STATUS_TO_EVENT: Record<string, { eventType: WorkflowEventType; logAction: string; label: string }> = {
  in_progress: { eventType: "mandate_started", logAction: "STARTED", label: "Démarré" },
  active: { eventType: "mandate_started", logAction: "STARTED", label: "Activé" },
  paused: { eventType: "mandate_paused", logAction: "PAUSED", label: "Mis en pause" },
  completed: { eventType: "mandate_completed", logAction: "COMPLETED", label: "Complété" },
  cancelled: { eventType: "mandate_cancelled", logAction: "CANCELLED", label: "Annulé" },
};

const updateSchema = z.object({
  status: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  serviceType: z.string().optional(),
  notes: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  hourlyRate: z.number().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const mandate = await prisma.mandate.findUnique({
    where: { id: Number(id) },
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      quotes: { select: { id: true, quoteNumber: true, title: true, status: true, amountTtc: true, expiryDate: true }, orderBy: { createdAt: "desc" } },
      contracts: { select: { id: true, contractNumber: true, title: true, status: true, amountTtc: true, signedAt: true }, orderBy: { createdAt: "desc" } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, amountTtc: true, dueDate: true }, orderBy: { createdAt: "desc" } },
      documents: { select: { id: true, title: true, fileType: true, category: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      logs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!mandate) {
    return NextResponse.json({ error: "Mandat introuvable" }, { status: 404 });
  }

  return NextResponse.json({ mandate });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const mandateId = Number(id);
  const existing = await prisma.mandate.findUnique({ where: { id: mandateId } });
  if (!existing) {
    return NextResponse.json({ error: "Mandat introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.startDate) data.startDate = new Date(data.startDate as string);
  if (data.endDate) data.endDate = new Date(data.endDate as string);

  const updated = await prisma.mandate.update({
    where: { id: mandateId },
    data,
  });

  // Workflow events + mandate_logs sur changements significatifs
  const statusChanged = parsed.data.status !== undefined && parsed.data.status !== existing.status;
  const progressChanged = parsed.data.progress !== undefined && parsed.data.progress !== existing.progress;

  if (statusChanged) {
    const newStatus = parsed.data.status!;
    const meta = STATUS_TO_EVENT[newStatus];
    if (meta) {
      await createWorkflowEvent({
        clientId: updated.clientId,
        mandateId: updated.id,
        eventType: meta.eventType,
        eventLabel: `Mandat ${updated.title} — ${meta.label.toLowerCase()}`,
        triggeredBy: "admin",
      });
      await prisma.mandateLog.create({
        data: {
          mandateId: updated.id,
          action: meta.logAction,
          description: `Statut : ${existing.status} → ${newStatus}`,
          createdBy: "admin",
        },
      });
    }
  }

  if (progressChanged) {
    await prisma.mandateLog.create({
      data: {
        mandateId: updated.id,
        action: "PROGRESS_UPDATE",
        description: `Progression : ${existing.progress}% → ${updated.progress}%`,
        createdBy: "admin",
      },
    });
    // Workflow event seulement si changement majeur (>= 10% ou completed)
    if (Math.abs(updated.progress - existing.progress) >= 10) {
      await createWorkflowEvent({
        clientId: updated.clientId,
        mandateId: updated.id,
        eventType: "mandate_progress_update",
        eventLabel: `Mandat ${updated.title} — progression ${updated.progress}%`,
        triggeredBy: "admin",
      });
    }
  }

  // Mandate_log generique si autre changement (titre, description, dates, etc.)
  if (!statusChanged && !progressChanged) {
    const fieldsChanged = Object.keys(parsed.data).filter((k) => k !== "status" && k !== "progress");
    if (fieldsChanged.length > 0) {
      await prisma.mandateLog.create({
        data: {
          mandateId: updated.id,
          action: "UPDATED",
          description: `Champs modifiés : ${fieldsChanged.join(", ")}`,
          createdBy: "admin",
        },
      });
    }
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "mandates",
    entityId: mandateId,
    changes: {
      before: { status: existing.status, progress: existing.progress },
      after: { status: updated.status, progress: updated.progress },
    },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, mandate: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const mandateId = Number(id);

  const counts = await prisma.mandate.findUnique({
    where: { id: mandateId },
    select: {
      _count: { select: { invoices: true, contracts: true, quotes: true, documents: true } },
    },
  });
  if (!counts) {
    return NextResponse.json({ error: "Mandat introuvable" }, { status: 404 });
  }
  const total =
    counts._count.invoices + counts._count.contracts + counts._count.quotes + counts._count.documents;
  if (total > 0) {
    return NextResponse.json(
      { error: "Mandat lie a des factures/contrats/devis/documents — impossible de supprimer" },
      { status: 409 }
    );
  }

  await prisma.mandate.delete({ where: { id: mandateId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "mandates",
    entityId: mandateId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
