// GET /api/contracts/[id] — detail contrat
// PATCH /api/contracts/[id] — mettre a jour (interdit apres signature client)
// DELETE /api/contracts/[id] — supprimer un contrat non signe
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  status: z.string().optional(),
  amountTtc: z.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true, companyName: true, email: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }
  return NextResponse.json({ contract });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const contractId = Number(id);

  const existing = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!existing) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (existing.clientSignatureData || existing.signedAt) {
    return NextResponse.json({ error: "Contrat deja signe par le client — non modifiable" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.expiresAt === "string") data.expiresAt = new Date(data.expiresAt);

  const updated = await prisma.contract.update({ where: { id: contractId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "contracts",
    entityId: contractId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, contract: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const contractId = Number(id);

  const existing = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { signedAt: true, clientSignatureData: true, _count: { select: { invoices: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  if (existing.signedAt || existing.clientSignatureData || existing._count.invoices > 0) {
    return NextResponse.json(
      { error: "Contrat signe ou lie a des factures — impossible de supprimer" },
      { status: 409 }
    );
  }

  await prisma.contract.delete({ where: { id: contractId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "contracts",
    entityId: contractId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}
