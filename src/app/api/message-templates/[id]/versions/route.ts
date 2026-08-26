// GET /api/message-templates/[id]/versions — historique des versions d'un template
// POST /api/message-templates/[id]/versions — restaurer une version (body: { versionId })
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("message_templates", "read")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const versions = await prisma.messageTemplateVersion.findMany({
    where: { templateId: Number(id) },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ versions });
}

const restoreSchema = z.object({ versionId: z.number().int().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("message_templates", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "versionId requis" }, { status: 400 });

  const version = await prisma.messageTemplateVersion.findUnique({ where: { id: parsed.data.versionId } });
  if (!version || version.templateId !== Number(id)) {
    return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
  }

  const current = await prisma.messageTemplate.findUnique({ where: { id: Number(id) } });
  if (!current) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

  // Snapshot avant restauration
  await prisma.messageTemplateVersion.create({
    data: {
      templateId: current.id,
      body: current.body,
      emailSubject: current.emailSubject,
      editedBy: session.user.email ?? "admin",
    },
  });

  const restored = await prisma.messageTemplate.update({
    where: { id: Number(id) },
    data: { body: version.body, emailSubject: version.emailSubject },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "message_templates",
    entityId: restored.id,
    changes: { restoredFromVersion: version.id },
  });

  return NextResponse.json({ success: true, template: restored });
}
