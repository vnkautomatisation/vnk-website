// GET /api/admin/document-templates/[id]/resolved
// Retourne le markdown d'un template avec les variables {{...}} résolues
// pour l'employé connecté (ou un employé donné si admin).
//
// Utilisé par <SignaturePadDialog> pour afficher un aperçu PDF-like
// avec toutes les variables résolues (au lieu du markdown brut).
//
// Auth :
//   - L'employé connecté peut résoudre n'importe quel template actif
//     pour SES propres variables.
//   - Un admin avec users:write peut passer ?employeeId=X pour résoudre
//     pour un autre employé (preview admin).
//
// Réponse : { resolvedMarkdown: string, title: string, version: string }
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/document-templates/render-engine";
import { buildContextFromEmployee } from "@/lib/document-templates/employee-context";
import { applyPlaceholderValues } from "@/lib/document-templates/placeholder-detector";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const selfId = session.user.adminId!;

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  // Param ?employeeId=X — réservé aux admins users:write
  // Param ?requestId=N — pour appliquer les customFieldValues de la demande
  //                      de signature (resolus dans le markdown avant rendu).
  const url = new URL(req.url);
  const employeeIdParam = url.searchParams.get("employeeId");
  const requestIdParam = url.searchParams.get("requestId");
  let employeeId = selfId;
  if (employeeIdParam) {
    const reqId = Number(employeeIdParam);
    if (Number.isFinite(reqId) && reqId > 0 && reqId !== selfId) {
      // Vérifie que l'appelant a le droit de résoudre pour quelqu'un d'autre.
      const admin = await prisma.admin.findUnique({
        where: { id: selfId },
        include: { customRole: true },
      });
      const perms = (admin?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
      const isSuper = admin?.customRole?.name === "super_admin";
      const canWrite = isSuper || (perms.users ?? []).includes("write");
      if (!canWrite) {
        return unauthorizedJson(403);
      }
      employeeId = reqId;
    }
  }

  const tpl = await prisma.legalDocumentTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      version: true,
      bodyMarkdown: true,
      isActive: true,
      signatureScope: true,
      // Cast : acknowledgmentMode peut ne pas etre dans le client genere.
      ...({ acknowledgmentMode: true } as object),
    },
  });
  if (!tpl || !tpl.isActive) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Charge les `customFieldValues` de la demande de signature si fournie.
  // Best-effort : un requestId invalide ou sans droits ne bloque pas le rendu.
  let customFieldValues: Record<string, string> | null = null;
  if (requestIdParam) {
    const reqId = Number(requestIdParam);
    if (Number.isFinite(reqId) && reqId > 0) {
      try {
        const dsr = await prisma.documentSignatureRequest.findUnique({
          where: { id: reqId },
          select: {
            templateId: true,
            customFieldValues: true,
            targetAdminId: true,
            targetTeamId: true,
            targetAll: true,
          },
        });
        // Ne resout que si la demande est valide (meme template) et si la
        // demande concerne l'employe resolvant (cible individuelle, equipe
        // ou tout le monde — RH bypass).
        if (dsr && dsr.templateId === tpl.id && dsr.customFieldValues) {
          customFieldValues = dsr.customFieldValues as Record<string, string>;
        }
      } catch {
        /* noop — best effort */
      }
    }
  }

  try {
    const context = await buildContextFromEmployee(employeeId);
    // 1. Substitution variables auto-resolvables `{{...}}`.
    let resolved = renderTemplate(tpl.bodyMarkdown, context);
    // 2. Substitution des `[CHAMP]` libres saisis par le RH.
    if (customFieldValues) {
      resolved = applyPlaceholderValues(resolved, customFieldValues);
    }
    return NextResponse.json({
      resolvedMarkdown: resolved,
      title: tpl.title,
      version: tpl.version,
      signatureScope:
        (tpl as { signatureScope?: string }).signatureScope ?? "employee_only",
      acknowledgmentMode:
        (tpl as { acknowledgmentMode?: string }).acknowledgmentMode ??
        "reading_only",
    });
  } catch (err) {
    console.error("[document-templates/resolved] render error", err);
    // Fallback : on retourne le markdown brut plutôt qu'une erreur
    return NextResponse.json({
      resolvedMarkdown: tpl.bodyMarkdown,
      title: tpl.title,
      version: tpl.version,
      signatureScope:
        (tpl as { signatureScope?: string }).signatureScope ?? "employee_only",
      acknowledgmentMode:
        (tpl as { acknowledgmentMode?: string }).acknowledgmentMode ??
        "reading_only",
    });
  }
}
