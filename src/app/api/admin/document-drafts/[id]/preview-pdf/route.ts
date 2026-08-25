// GET /api/admin/document-drafts/[id]/preview-pdf
// Genere un PDF d'apercu du brouillon avec les customFieldValues actuels
// (fill_0, fill_1, ...) substitues dans le template. Utilise par l'iframe
// PDF live de DocumentDraftEditor.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplateHtmlToPdf } from "@/lib/services/pdf-html-renderer";
import { buildContextFromEmployee } from "@/lib/document-templates/employee-context";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
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
          id: true, title: true, version: true, bodyMarkdown: true,
          signatureScope: true, acknowledgmentMode: true,
        },
      },
      target: { select: { id: true, fullName: true } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Brouillon introuvable" }, { status: 404 });
  }
  if (draft.authorId !== me) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  // Build context base + injection des fill_X dans le context pour que le
  // pipeline PDF auto-detecte les valeurs saisies.
  const context = await buildContextFromEmployee(draft.targetAdminId).catch(
    () => ({} as Record<string, string>),
  );
  const customValues = (draft.customFieldValues as Record<string, string> | null) ?? {};
  for (const [k, v] of Object.entries(customValues)) {
    if (typeof v === "string") {
      (context as Record<string, string>)[k] = v;
    }
  }

  const tplScope = (draft.template as { signatureScope?: string }).signatureScope as
    | "employee_only" | "employer_only" | "both" | "none" | undefined;
  const ackMode = (draft.template as { acknowledgmentMode?: string }).acknowledgmentMode;
  const isReadingOnly = ackMode === "reading_only";
  const effectiveScope = isReadingOnly ? "none" : (tplScope ?? "both");

  try {
    const buffer = await renderTemplateHtmlToPdf({
      bodyMarkdown: draft.template.bodyMarkdown,
      context,
      title: draft.template.title,
      documentType: "legal",
      metadata: {
        version: draft.template.version,
        employeeName: draft.target.fullName ?? undefined,
      },
      signatureScope: effectiveScope,
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="brouillon-${draft.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Erreur generation PDF : ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
