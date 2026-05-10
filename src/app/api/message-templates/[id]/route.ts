// PATCH /api/message-templates/[id] — modifier
// DELETE /api/message-templates/[id] — supprimer
// POST /api/message-templates/[id] — incrementer usageCount (sans audit)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  shortcut: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i).optional(),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(10000).optional(),
  category: z.string().max(40).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée" });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const data = { ...parsed.data };
  if (data.shortcut) data.shortcut = data.shortcut.toLowerCase();

  try {
    const tpl = await prisma.messageTemplate.update({ where: { id: Number(id) }, data });
    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "message_templates",
      entityId: tpl.id,
    });
    return NextResponse.json({ success: true, template: tpl });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: "Ce raccourci existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.messageTemplate.delete({ where: { id: Number(id) } });
  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "message_templates",
    entityId: Number(id),
  });
  return NextResponse.json({ success: true });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.messageTemplate.update({
    where: { id: Number(id) },
    data: { usageCount: { increment: 1 } },
  });
  return NextResponse.json({ success: true });
}
