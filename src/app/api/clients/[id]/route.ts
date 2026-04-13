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
  companyName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().optional(),
  postalCode: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  technologies: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
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
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const clientId = Number(id);

  // Client peut modifier uniquement son propre profil
  if (session.user.role === "client" && session.user.clientId !== clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  // Client ne peut pas changer isActive, archived, internalNotes
  const data = session.user.role === "client"
    ? (({ isActive, archived, internalNotes, ...rest }) => rest)(parsed.data as Record<string, unknown>)
    : parsed.data;

  const client = await prisma.client.update({
    where: { id: clientId },
    data,
  });

  if (session.user.role === "admin") {
    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "clients",
      entityId: client.id,
      changes: parsed.data,
    });
  }

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
