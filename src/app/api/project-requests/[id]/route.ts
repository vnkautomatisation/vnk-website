// GET /api/project-requests/[id] — detail demande (admin + client proprietaire)
// PATCH /api/project-requests/[id] — mettre a jour (status, urgence, notes admin, etc.) — admin only
// DELETE /api/project-requests/[id] — supprimer une demande — admin only
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const updateSchema = z.object({
  status: z.enum(["new", "in_progress", "converted", "closed"]).optional(),
  urgency: z.enum(["normal", "urgent", "critical"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  serviceType: z.string().nullable().optional(),
  plcBrand: z.string().nullable().optional(),
  budgetRange: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "aucune_donnee_a_mettre_a_jour" });

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En traitement",
  converted: "Convertie",
  closed: "statut_fermee",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }
  const { id } = await params;
  const requestId = Number(id);

  const request = await prisma.projectRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && request.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }

  // Lookup client manuel (pas de relation directe)
  const client = await prisma.client.findUnique({
    where: { id: request.clientId },
    select: { id: true, fullName: true, companyName: true, email: true, phone: true },
  });

  return NextResponse.json({ request: { ...request, client } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("requests", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const requestId = Number(id);

  const existing = await prisma.projectRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  const updated = await prisma.projectRequest.update({
    where: { id: requestId },
    data: parsed.data,
  });

  // Workflow event sur changement de statut
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await createWorkflowEvent({
      clientId: updated.clientId,
      eventType: "project_request_received",
      eventLabel: `Demande "${updated.title}" — ${STATUS_LABELS[parsed.data.status] ?? parsed.data.status}`,
      labelKey: "workflow_events.demande_statut",
      labelParams: { title: updated.title, status: STATUS_LABELS[parsed.data.status] ?? parsed.data.status },
      triggeredBy: "admin",
      metadata: { requestId: updated.id, from: existing.status, to: parsed.data.status },
    });
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "project_requests",
    entityId: requestId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, request: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("requests", "delete")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const requestId = Number(id);

  const existing = await prisma.projectRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  await prisma.projectRequest.delete({ where: { id: requestId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "project_requests",
    entityId: requestId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
