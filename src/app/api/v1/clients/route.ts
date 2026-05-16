// API publique v1 · Clients — list + create.
// Auth : Bearer token (AdminApiToken) avec scope read:clients ou write:clients.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiToken } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const listSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req, "read:clients");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const where = parsed.data.search
    ? {
        OR: [
          { fullName: { contains: parsed.data.search, mode: "insensitive" as const } },
          { email: { contains: parsed.data.search, mode: "insensitive" as const } },
          { companyName: { contains: parsed.data.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      take: parsed.data.limit,
      skip: parsed.data.offset,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, fullName: true, email: true, companyName: true,
        phone: true, city: true, province: true, isActive: true, archived: true,
        createdAt: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    pagination: { total, limit: parsed.data.limit, offset: parsed.data.offset },
  });
}

const createSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  companyName: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(3).optional().default("QC"),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateApiToken(req, "write:clients");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  }

  // Génère un mot de passe temporaire random
  const tempPassword = crypto.randomBytes(16).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const created = await prisma.client.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      companyName: parsed.data.companyName ?? null,
      phone: parsed.data.phone ?? null,
      city: parsed.data.city ?? null,
      province: parsed.data.province ?? "QC",
    },
    select: { id: true, fullName: true, email: true, companyName: true, createdAt: true },
  });

  return NextResponse.json({ data: created, tempPassword }, { status: 201 });
}
