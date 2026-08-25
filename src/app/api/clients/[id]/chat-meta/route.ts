// PATCH /api/clients/[id]/chat-meta — meta conversation (pin, archive, snooze, labels)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate";

const schema = z.object({
  chatPinned: z.boolean().optional(),
  chatArchive: z.boolean().optional(),
  chatSnoozedUntil: z.string().datetime().nullable().optional(),
  chatLabels: z.array(z.string().max(40)).max(10).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée" });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("clients", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.chatPinned !== undefined) data.chatPinned = parsed.data.chatPinned;
  if (parsed.data.chatArchive !== undefined) data.chatArchivedAt = parsed.data.chatArchive ? new Date() : null;
  if (parsed.data.chatSnoozedUntil !== undefined) data.chatSnoozedUntil = parsed.data.chatSnoozedUntil ? new Date(parsed.data.chatSnoozedUntil) : null;
  if (parsed.data.chatLabels !== undefined) data.chatLabels = parsed.data.chatLabels ?? undefined;

  await prisma.client.update({ where: { id: Number(id) }, data });
  revalidateAdminViews();
  return NextResponse.json({ success: true });
}
