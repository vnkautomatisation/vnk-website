// POST /api/message-templates/[id]/duplicate — clone un template avec un shortcut auto
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const src = await prisma.messageTemplate.findUnique({ where: { id: Number(id) } });
  if (!src) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Genere un shortcut unique en suffixant _copy, _copy2, etc.
  let suffix = 1;
  let shortcut = `${src.shortcut}_copy`;
  while (await prisma.messageTemplate.findUnique({ where: { shortcut } })) {
    suffix++;
    shortcut = `${src.shortcut}_copy${suffix}`;
  }

  const dup = await prisma.messageTemplate.create({
    data: {
      shortcut,
      title: `${src.title} (copie)`,
      body: src.body,
      category: src.category,
    },
  });
  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "message_templates",
    entityId: dup.id,
    changes: { duplicatedFrom: src.id },
  });
  return NextResponse.json({ success: true, template: dup });
}
