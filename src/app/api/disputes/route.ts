// GET /api/disputes — liste litiges
// POST /api/disputes — creer un litige (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  invoiceId: z.number().int().positive().optional(),
  mandateId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const disputes = await prisma.dispute.findMany({
    include: { client: { select: { fullName: true } } },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json({ disputes });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const dispute = await prisma.dispute.create({
    data: {
      clientId: parsed.data.clientId,
      invoiceId: parsed.data.invoiceId,
      mandateId: parsed.data.mandateId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: "open",
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "disputes",
    entityId: dispute.id,
  });

  return NextResponse.json({ success: true, dispute });
}
