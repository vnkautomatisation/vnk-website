// GET/PUT/DELETE /api/clients/:id — un client
// Correction des endpoints manquants identifiés dans l'audit
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  sector: z.string().optional(),
  technologies: z.string().optional(),
  internalNotes: z.string().optional(),
  isActive: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const clientId = Number(id);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      mandates: { orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const client = await prisma.client.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "clients",
    entityId: client.id,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, client });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const clientId = Number(id);

  // Soft archive plutôt que delete réel
  const client = await prisma.client.update({
    where: { id: clientId },
    data: { archived: true, isActive: false },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "clients",
    entityId: client.id,
  });

  return NextResponse.json({ success: true });
}
