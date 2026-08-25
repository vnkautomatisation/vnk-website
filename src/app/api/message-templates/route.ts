// GET /api/message-templates — liste des templates (admin)
// POST /api/message-templates — creer un template
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

const createSchema = z.object({
  shortcut: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i, "Lettres, chiffres, _ et - uniquement"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(20000),
  category: z.string().max(40).optional(),
  categoryCustom: z.string().max(80).optional(),
  defaultChannel: z.enum(["chat", "email", "both"]).optional(),
  emailSubject: z.string().max(200).optional(),
  appendSignature: z.boolean().optional(),
  defaultAttachmentsData: z.array(attachmentSchema).max(10).optional(),
  tags: z.array(z.string().max(40)).max(15).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("message_templates", "read")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const templates = await prisma.messageTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { usageCount: "desc" }, { title: "asc" }],
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("message_templates", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
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
        categoryCustom: parsed.data.categoryCustom,
        defaultChannel: parsed.data.defaultChannel,
        emailSubject: parsed.data.emailSubject,
        appendSignature: parsed.data.appendSignature ?? false,
        defaultAttachmentsData: parsed.data.defaultAttachmentsData ?? undefined,
        tags: parsed.data.tags ?? undefined,
        locale: parsed.data.locale,
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
