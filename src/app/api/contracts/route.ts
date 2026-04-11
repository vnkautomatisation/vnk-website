// GET /api/contracts — liste contrats
// POST /api/contracts — créer un contrat (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { generateDocumentNumber } from "@/lib/utils";
import { getSetting } from "@/lib/settings";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().optional(),
  quoteId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  fileUrl: z.string().url().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const contracts = await prisma.contract.findMany({
    where:
      session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! },
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contracts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const prefix = (await getSetting<string>("billing", "contract_number_prefix")) ?? "CT-{YYYY}-";
  const year = new Date().getFullYear();
  const last = await prisma.contract.findFirst({
    where: { contractNumber: { startsWith: prefix.replace("{YYYY}", String(year)) } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.contractNumber.split("-").pop()) + 1 : 1;
  const contractNumber = generateDocumentNumber(prefix, nextSeq);

  const contract = await prisma.contract.create({
    data: {
      clientId: parsed.data.clientId,
      mandateId: parsed.data.mandateId,
      quoteId: parsed.data.quoteId,
      contractNumber,
      title: parsed.data.title,
      content: parsed.data.content,
      fileUrl: parsed.data.fileUrl,
    },
  });

  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    eventType: "contract_created",
    eventLabel: `Contrat ${contractNumber} créé`,
    triggeredBy: "admin",
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "contracts",
    entityId: contract.id,
  });

  return NextResponse.json({ success: true, contract });
}
