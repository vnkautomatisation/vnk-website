// GET /api/message-templates — liste des templates (admin)
// POST /api/message-templates — creer un template
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  shortcut: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i, "Lettres, chiffres, _ et - uniquement"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(10000),
  category: z.string().max(40).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const templates = await prisma.messageTemplate.findMany({
    orderBy: [{ usageCount: "desc" }, { title: "asc" }],
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  try {
    const tpl = await prisma.messageTemplate.create({
      data: {
        shortcut: parsed.data.shortcut.toLowerCase(),
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category,
      },
    });
    await logAudit({
      adminId: session.user.adminId,
      action: "create",
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
