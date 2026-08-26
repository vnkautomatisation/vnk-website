// GET /api/admin/document-drafts/[id]
// Recupere un brouillon complet (avec template.bodyMarkdown pour l'editeur).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const me = (session.user as { adminId?: number }).adminId ?? 0;
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const draft = await prisma.documentDraft.findUnique({
    where: { id },
    include: {
      template: {
        select: {
          id: true, title: true, key: true, category: true, version: true,
          bodyMarkdown: true, signatureScope: true, acknowledgmentMode: true,
        },
      },
      author: { select: { id: true, fullName: true, email: true } },
      target: { select: { id: true, fullName: true, email: true, avatarUrl: true, department: true } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Brouillon introuvable" }, { status: 404 });
  }
  // Seul l'auteur peut acceder pour edition (UI). Les admins RH pourraient
  // lire en read-only mais on garde simple : ownership stricte.
  if (draft.authorId !== me) {
    return unauthorizedJson(403);
  }

  return NextResponse.json({
    id: draft.id,
    template: draft.template,
    author: draft.author,
    target: draft.target,
    status: draft.status,
    customFieldValues: draft.customFieldValues ?? {},
    scheduledFor: draft.scheduledFor,
    notes: draft.notes,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    sentAt: draft.sentAt?.toISOString() ?? null,
  });
}
