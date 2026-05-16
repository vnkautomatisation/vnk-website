// API publique v1 · Factures — list.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiToken } from "@/lib/api-auth";

const listSchema = z.object({
  status: z.string().optional(),
  clientId: z.coerce.number().int().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req, "read:invoices");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.status) where.status = parsed.data.status;
  if (parsed.data.clientId) where.clientId = parsed.data.clientId;
  if (parsed.data.fromDate || parsed.data.toDate) {
    const range: { gte?: Date; lte?: Date } = {};
    if (parsed.data.fromDate) range.gte = new Date(parsed.data.fromDate);
    if (parsed.data.toDate) range.lte = new Date(parsed.data.toDate);
    where.createdAt = range;
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      take: parsed.data.limit,
      skip: parsed.data.offset,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, invoiceNumber: true, title: true,
        amountHt: true, tpsAmount: true, tvqAmount: true, amountTtc: true,
        currency: true, status: true, dueDate: true, paidAt: true,
        clientId: true, createdAt: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  // Sérialiser les Decimal
  const data = items.map((i) => ({
    ...i,
    amountHt: Number(i.amountHt),
    tpsAmount: Number(i.tpsAmount),
    tvqAmount: Number(i.tvqAmount),
    amountTtc: Number(i.amountTtc),
  }));

  return NextResponse.json({
    data,
    pagination: { total, limit: parsed.data.limit, offset: parsed.data.offset },
  });
}
