// PATCH /api/message-templates/[id] — modifier (cree une version)
// DELETE /api/message-templates/[id] — supprimer
// POST /api/message-templates/[id] — incrementer usageCount + lastUsedAt
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const attachmentSchema = z.object({
  kind: z.enum(["image", "audio", "pdf", "file"]),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive(),
  dataUrl: z.string().startsWith("data:"),
  durationSec: z.number().int().nonnegative().optional(),
});

const patchSchema = z.object({
  shortcut: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i).optional(),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(20000).optional(),
  category: z.string().max(40).nullable().optional(),
  categoryCustom: z.string().max(80).nullable().optional(),
  defaultChannel: z.enum(["chat", "email", "both"]).nullable().optional(),
  emailSubject: z.string().max(200).nullable().optional(),
  appendSignature: z.boolean().optional(),
  defaultAttachmentsData: z.array(attachmentSchema).max(10).nullable().optional(),
  tags: z.array(z.string().max(40)).max(15).nullable().optional(),
  locale: z.enum(["fr", "en"]).optional(),
  isActive: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée" });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("message_templates", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const existing = await prisma.messageTemplate.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Snapshot version si body ou subject modifie
  const bodyChanged = parsed.data.body !== undefined && parsed.data.body !== existing.body;
  const subjectChanged = parsed.data.emailSubject !== undefined && parsed.data.emailSubject !== existing.emailSubject;
  if (bodyChanged || subjectChanged) {
    await prisma.messageTemplateVersion.create({
      data: {
        templateId: existing.id,
        body: existing.body,
        emailSubject: existing.emailSubject,
        editedBy: session.user.email ?? "admin",
      },
    });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.shortcut) data.shortcut = String(data.shortcut).toLowerCase();
  if (data.tags === null) data.tags = undefined;
  if (data.defaultAttachmentsData === null) data.defaultAttachmentsData = undefined;

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
  if (await adminApiForbidden("message_templates", "delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
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
  if (await adminApiForbidden("message_templates", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.messageTemplate.update({
    where: { id: Number(id) },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
