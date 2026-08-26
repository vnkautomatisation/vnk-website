// GET /api/project-requests — liste demandes (admin: toutes, client: les siennes)
// POST /api/project-requests — creer une demande (client)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { notifyNewRequest } from "@/lib/integrations/slack";
import { triggerZap } from "@/lib/integrations/zapier";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const createSchema = z.object({
  serviceType: z.string().min(1),
  description: z.string().min(1).max(5000),
  urgencyLevel: z.enum(["normal", "urgent", "critical"]),
  plcBrand: z.string().max(255).optional(),
  budget: z.string().max(255).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const requests = await prisma.projectRequest.findMany({
    where:
      session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const clientId = session.user.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const SERVICE_LABELS: Record<string, string> = {
    "plc-support": "Support PLC",
    "plc-programming": "Programmation PLC",
    "scada": "SCADA",
    "hmi": "Interface HMI",
    "web-development": "Developpement Web",
    "automation": "Automatisation",
    "consulting": "Consultation",
    "maintenance": "Maintenance",
  };

  const title = SERVICE_LABELS[parsed.data.serviceType] ?? parsed.data.serviceType;

  const request = await prisma.projectRequest.create({
    data: {
      clientId,
      title,
      description: parsed.data.description,
      serviceType: parsed.data.serviceType,
      urgency: parsed.data.urgencyLevel,
      plcBrand: parsed.data.plcBrand || null,
      budgetRange: parsed.data.budget || null,
    },
  });

  await createWorkflowEvent({
    clientId,
    eventType: "project_request_received",
    eventLabel: `Nouvelle demande — ${title}`,
    triggeredBy: session.user.role,
    metadata: { requestId: request.id, urgency: parsed.data.urgencyLevel },
  });

  // Notifications externes (non bloquantes)
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true, companyName: true } });
  const clientName = client?.companyName ?? client?.fullName ?? "Client inconnu";
  void notifyNewRequest({
    clientName,
    title,
    serviceType: parsed.data.serviceType,
    urgency: parsed.data.urgencyLevel,
    requestId: request.id,
  });
  void triggerZap("requests.created", { id: request.id, clientId, title, serviceType: parsed.data.serviceType, urgency: parsed.data.urgencyLevel });

  revalidateAdminViews();

  return NextResponse.json({ success: true, request });
}
