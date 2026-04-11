// GET /api/clients — liste clients (admin seulement)
// POST /api/clients — créer un client (admin seulement, avec bcrypt + audit)
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createClientSchema = z.object({
  fullName: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(12),
  companyName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  sector: z.string().max(100).optional(),
  technologies: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";
  const archived = searchParams.get("archived") === "true";
  const search = searchParams.get("q")?.trim();

  const clients = await prisma.client.findMany({
    where: {
      ...(activeOnly && { isActive: true, archived: false }),
      ...(archived && { archived: true }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.client.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Un client avec ce courriel existe déjà" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const { password, ...rest } = parsed.data;

  const client = await prisma.client.create({
    data: { ...rest, passwordHash },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "clients",
    entityId: client.id,
  });

  // Event
  await prisma.workflowEvent.create({
    data: {
      clientId: client.id,
      eventType: "client_created",
      eventLabel: `Nouveau client: ${client.fullName}`,
      triggeredBy: "admin",
    },
  });

  return NextResponse.json({ success: true, client });
}
