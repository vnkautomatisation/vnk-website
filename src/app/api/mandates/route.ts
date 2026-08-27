// GET /api/mandates — liste mandats
// POST /api/mandates — créer un mandat
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
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  serviceType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  hourlyRate: z.number().optional(),
  status: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const isAdmin = session.user.role === "admin";
  const { searchParams } = new URL(req.url);
  const clientIdParam = searchParams.get("clientId");

  const mandates = await prisma.mandate.findMany({
    where: isAdmin
      ? clientIdParam
        ? { clientId: Number(clientIdParam) }
        : {}
      : { clientId: session.user.clientId! },
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ mandates });
}

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("mandates", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("donnees_invalides") }, { status: 400 });
  }

  const mandate = await prisma.mandate.create({
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    },
  });

  await createWorkflowEvent({
    clientId: mandate.clientId,
    mandateId: mandate.id,
    eventType: "mandate_created",
    eventLabel: `Mandat ouvert — ${mandate.title}`,
    triggeredBy: "admin",
  });

  // Premier log d'activite pour le mandate panel
  await prisma.mandateLog.create({
    data: {
      mandateId: mandate.id,
      action: "CREATED",
      description: `Mandat créé pour ${parsed.data.title}`,
      createdBy: "admin",
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "mandates",
    entityId: mandate.id,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, mandate });
}
