// POST /api/admin/document-templates/[id]/signature-preview-pdf
// Genere le PDF identique a celui qui sera produit apres signature de
// l'employe connecte. Pipeline strict :
//   1. Charge le template (markdown brut + scope + acknowledgmentMode)
//   2. Recherche la DocumentSignatureRequest active pour cet employe
//      (ciblage individuel / equipe / global) ; recupere customFieldValues
//   3. Applique customFieldValues (placeholders `[FIELD]`) au markdown
//   4. Build context complet depuis l'employe (employee.*, contract.*,
//      company.*, date.*) — identique au pipeline de signature
//   5. Rend le PDF via renderTemplateHtmlToPdf, MEME documentType
//      ("legal"), MEME signatureScope effectif que ce qui sera utilise
//      a la signature → preview = PDF final byte-pour-byte (modulo
//      l'image de signature de l'employe ajoutee a la fin)
//
// Auth : utilisateur authentifie (employee/admin role) seulement.
// Body  : { requestId?: number } — si fourni, on bypass le lookup auto.
// Reponse : application/pdf
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildContextFromEmployee } from "@/lib/document-templates";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import {
  applyPlaceholderValues,
  detectPlaceholdersWithInfo,
  escapeUntrustedInlineValue,
} from "@/lib/document-templates/placeholder-detector";
import { renderTemplateHtmlToPdf } from "@/lib/services/pdf-html-renderer";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const { id: idStr } = await ctx.params;
  const templateId = Number(idStr);
  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  let body: {
    requestId?: number;
    acknowledged?: boolean;
    signatureDataUrl?: string;
    /**
     * Etats des cases `- [ ]` cochees par l'employe dans le wizard.
     * Cle = index (ordre d'apparition dans le markdown), valeur = booleen.
     * Pattern identique au handbook : valider une case dans le panneau
     * actions -> la case devient cochee dans le PDF.
     */
    checkboxStates?: Record<string, boolean>;
    /**
     * Valeurs des `[CHAMP]` que l'employe remplit lui-meme dans le wizard
     * (numero de membre OIQ/CPA, permis…). Merges avec les customFieldValues
     * de la DSR (RH a priorite sauf si vide). Le PDF preview les applique
     * en temps reel.
     */
    employeeFieldValues?: Record<string, string>;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* body optionnel */
  }

  // 1) Charge le template
  const tpl = await prisma.legalDocumentTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      key: true,
      title: true,
      version: true,
      bodyMarkdown: true,
      isActive: true,
      signatureScope: true,
      ...({ acknowledgmentMode: true } as object),
    },
  });
  if (!tpl || !tpl.isActive) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Suivi de consultation : trace l'OUVERTURE initiale du document par
  // l'employe (audit "qui a consulte quoi, quand", exigence conformite).
  // Les refresh live du meme dialog (cases cochees, signature dessinee...)
  // envoient un body non-vide et ne sont PAS re-traces.
  const isInitialView =
    body.acknowledged === undefined
    && body.signatureDataUrl === undefined
    && body.checkboxStates === undefined
    && body.employeeFieldValues === undefined;
  if (isInitialView) {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      adminId,
      action: "view",
      entityType: "legal_doc",
      entityId: tpl.id,
      changes: { key: tpl.key, version: tpl.version, context: "signature_preview" },
    });
  }

  // 2) Lookup customFieldValues (best-effort)
  let customFieldValues: Record<string, string> | null = null;
  try {
    if (body.requestId && Number.isFinite(body.requestId)) {
      const dsr = await prisma.documentSignatureRequest.findUnique({
        where: { id: body.requestId },
        select: {
          templateId: true,
          customFieldValues: true,
          targetAdminId: true,
          targetTeamId: true,
          targetAll: true,
        },
      });
      // Verifie que la demande cible bien l'employe connecte (individuel,
      // son equipe, ou global) — sinon un employe pourrait lire les
      // customFieldValues d'une demande destinee a quelqu'un d'autre.
      let targetsMe = false;
      if (dsr) {
        if (dsr.targetAll) targetsMe = true;
        else if (dsr.targetAdminId === adminId) targetsMe = true;
        else if (dsr.targetTeamId) {
          const me = await prisma.admin.findUnique({
            where: { id: adminId },
            select: { teamId: true },
          });
          targetsMe = me?.teamId === dsr.targetTeamId;
        }
      }
      if (dsr && dsr.templateId === tpl.id && targetsMe && dsr.customFieldValues) {
        customFieldValues = dsr.customFieldValues as Record<string, string>;
      }
    } else {
      // Lookup auto : derniere demande active ciblant cet employe
      const me = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { teamId: true },
      });
      const dsr = await prisma.documentSignatureRequest.findFirst({
        where: {
          templateId: tpl.id,
          OR: [
            { targetAdminId: adminId },
            ...(me?.teamId ? [{ targetTeamId: me.teamId }] : []),
            { targetAll: true },
          ],
        },
        orderBy: { requestedAt: "desc" },
        select: { customFieldValues: true },
      });
      const vals = dsr?.customFieldValues as
        | Record<string, string>
        | null
        | undefined;
      if (vals && Object.keys(vals).length > 0) {
        customFieldValues = vals;
      }
    }
  } catch {
    /* noop : si echec, on rend avec le markdown brut */
  }

  // 3) Merge customFieldValues (RH) avec employeeFieldValues (employe)
  // Employee values prennent priorite (ce sont SES infos perso pro) MAIS
  // uniquement sur les cles detectees fillBy="employee" dans le template,
  // et echappees en texte litteral — meme regle que signLegalDocAction,
  // pour que l'apercu reste identique au PDF final.
  const employeeAllowedKeys = new Set(
    detectPlaceholdersWithInfo(tpl.bodyMarkdown)
      .filter((p) => p.fillBy === "employee")
      .map((p) => p.key),
  );
  const mergedFieldValues: Record<string, string> = {
    ...(customFieldValues ?? {}),
    ...(body.employeeFieldValues && typeof body.employeeFieldValues === "object"
      ? Object.fromEntries(
          Object.entries(body.employeeFieldValues)
            .filter(
              ([k, v]) =>
                employeeAllowedKeys.has(k)
                && typeof v === "string"
                && v.trim().length > 0,
            )
            .map(([k, v]) => [k, escapeUntrustedInlineValue((v as string).trim())]),
        )
      : {}),
  };

  // Separe les fill_X (long form wizard) des placeholders {{...}} classiques.
  // Les fill_X sont injectes dans le context pour que le renderer PDF les
  // substitue aux `___` du markdown. Les {{...}} sont substitues immediatement.
  const fillVals: Record<string, string> = {};
  const placeholderVals: Record<string, string> = {};
  for (const [k, v] of Object.entries(mergedFieldValues)) {
    if (/^fill_\d+$/.test(k)) fillVals[k] = v;
    else placeholderVals[k] = v;
  }

  let bodyForPdf = tpl.bodyMarkdown;
  if (Object.keys(placeholderVals).length > 0) {
    try {
      bodyForPdf = applyPlaceholderValues(bodyForPdf, placeholderVals);
    } catch {
      /* noop : conserve markdown brut */
    }
  }

  // 4) Build context complet (+ fill_X injectes pour auto-detection PDF).
  const context = await buildContextFromEmployee(adminId).catch(
    () => ({} as Record<string, string>),
  );
  if (Object.keys(fillVals).length > 0) {
    Object.assign(context, fillVals);
  }

  // Override poste suggere selon la cle template (CPA -> Comptable, OIQ ->
  // Ingenieur, etc.). Applique UNIQUEMENT pour l'apercu — le PDF reel signe
  // utilise le poste reel de l'employe via la sign action.
  if (tpl.key) {
    const { getSuggestedPositionForTemplate } = await import(
      "@/lib/document-templates/template-suggested-position"
    );
    const suggested = getSuggestedPositionForTemplate(tpl.key);
    if (suggested) {
      (context as Record<string, string>)["employee.position"] = suggested;
    }
  }

  // 5) Detection acknowledgmentMode pour ajuster signatureScope
  const ackMode = (tpl as { acknowledgmentMode?: string }).acknowledgmentMode;
  const isReadingOnly = ackMode === "reading_only";
  const tplScope = (tpl as { signatureScope?: string }).signatureScope as
    | "employee_only"
    | "employer_only"
    | "both"
    | "none"
    | undefined;
  const effectiveScope = isReadingOnly ? "none" : (tplScope ?? "employee_only");

  // 6) Genere PDF avec :
  //  - bloc Accuse de reception final (pattern handbook acceptation page)
  //  - signature embarquee si dessine en live cote dialog
  const employeeName =
    (context as Record<string, string>)["employee.fullName"] || undefined;
  const liveSignatureDataUrl =
    typeof body.signatureDataUrl === "string" && body.signatureDataUrl.startsWith("data:image/")
      ? body.signatureDataUrl
      : undefined;
  try {
    const pdfBuffer = await renderTemplateHtmlToPdf({
      bodyMarkdown: bodyForPdf,
      context,
      title: tpl.title,
      documentType: "legal",
      metadata: {
        version: tpl.version,
        employeeName,
      },
      signatureScope: effectiveScope,
      // Live preview : cases cochees dans le wizard apparaissent cochees dans le PDF
      checkboxStates:
        body.checkboxStates && typeof body.checkboxStates === "object"
          ? body.checkboxStates
          : undefined,
      // Live preview : injecte image signature si dessinee
      signatures: liveSignatureDataUrl
        ? {
            employee: {
              dataUrl: liveSignatureDataUrl,
              name: employeeName,
              date: new Date(),
            },
          }
        : undefined,
      // Bloc Accuse final (pattern handbook). En reading_only on rend toujours
      // ce bloc (c'est le seul moyen d'acquitter). En signature, il complete
      // le bloc Signatures du document.
      acknowledgmentBlock: {
        acknowledged: body.acknowledged === true,
        employeeName,
      },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"apercu-signature.pdf\"",
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[signature-preview-pdf] render failed:", {
      templateId, adminId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return NextResponse.json(
      { error: "Generation PDF impossible" },
      { status: 500 },
    );
  }
}
