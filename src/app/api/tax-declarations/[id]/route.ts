// GET /api/tax-declarations/[id] — detail declaration
// PATCH /api/tax-declarations/[id] — mettre a jour (interdit apres soumission)
// DELETE /api/tax-declarations/[id] — supprimer une declaration draft
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  periodLabel: z.string().min(1).optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const declaration = await prisma.taxDeclaration.findUnique({ where: { id: Number(id) } });
  if (!declaration) {
    return NextResponse.json({ error: "Declaration introuvable" }, { status: 404 });
  }
  return NextResponse.json({ declaration });
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
  const declId = Number(id);

  const existing = await prisma.taxDeclaration.findUnique({ where: { id: declId } });
  if (!existing) {
    return NextResponse.json({ error: "Declaration introuvable" }, { status: 404 });
  }
  if (existing.status === "submitted" && existing.submittedAt) {
    return NextResponse.json({ error: "Declaration deja soumise — non modifiable" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "submitted" && !existing.submittedAt) {
    data.submittedAt = new Date();
  }

  const updated = await prisma.taxDeclaration.update({ where: { id: declId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "tax_declarations",
    entityId: declId,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, declaration: updated });
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
  const declId = Number(id);

  const existing = await prisma.taxDeclaration.findUnique({ where: { id: declId } });
  if (!existing) {
    return NextResponse.json({ error: "Declaration introuvable" }, { status: 404 });
  }
  if (existing.status === "submitted" || existing.submittedAt) {
    return NextResponse.json(
      { error: "Declaration soumise — impossible de supprimer" },
      { status: 409 }
    );
  }

  await prisma.taxDeclaration.delete({ where: { id: declId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "tax_declarations",
    entityId: declId,
  });

  return NextResponse.json({ success: true });
}
