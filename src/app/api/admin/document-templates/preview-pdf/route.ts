// GET/POST /api/admin/document-templates/preview-pdf
// Genere et retourne en streaming un aperçu PDF VNK d'un template de document.
//
// Modes :
//   - POST { bodyMarkdown, title, documentType, employeeId?, contractId?,
//            metadata?, extraContext? }
//       -> renders directement le markdown fourni
//   - GET ?templateId=X&templateType=legal|contract|policy[&employeeId=Y][&contractId=Z]
//       -> charge le template en DB puis render
//
// Query commune : ?download=1 -> Content-Disposition: attachment
//                 sinon       -> inline
//
// Auth : admin uniquement.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import {
  buildContextFromEmployee,
  formatDateFr,
  formatDateIso,
  formatPhone,
  type TemplateContext,
} from "@/lib/document-templates";
import {
  renderTemplateHtmlToPdf as renderTemplateToPdf,
  type TemplateDocumentType,
} from "@/lib/services/pdf-html-renderer";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: TemplateDocumentType[] = [
  "legal",
  "contract",
  "policy",
  "letter",
  "onboarding",
];

type TemplateTypeDb = "legal" | "contract" | "policy";

interface PostPayload {
  bodyMarkdown?: string;
  title?: string;
  documentType?: string;
  employeeId?: number;
  contractId?: number;
  metadata?: {
    version?: string;
    employeeName?: string;
    companyName?: string;
    documentNumber?: string;
  };
  extraContext?: Record<string, string>;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }
  return session;
}

// Construit un contexte "minimal" sans employe : remplit uniquement
// company.* (depuis Setting) + date.*. Les variables employee.* / contract.*
// restent non resolues et seront affichees en placeholder dans le PDF.
async function buildMinimalContext(): Promise<TemplateContext> {
  const ctx: TemplateContext = {};
  try {
    const [
      companyName,
      companyAddress,
      companyCity,
      companyProvince,
      companyPostalCode,
      companyPhone,
      companyEmail,
      companyNeq,
    ] = await Promise.all([
      getSetting<string>("general", "company_name"),
      getSetting<string>("company", "address"),
      getSetting<string>("company", "city"),
      getSetting<string>("company", "province"),
      getSetting<string>("company", "postal_code"),
      getSetting<string>("company", "phone"),
      getSetting<string>("company", "email"),
      getSetting<string>("company", "neq"),
    ]);

    const fullLegal = (companyName ?? "VNK Automatisation Inc.").trim();
    const shortName = fullLegal
      .replace(/\b(inc\.?|ltée\.?|ltd\.?|ltee\.?|s\.e\.n\.c\.?|enr\.?)\b/gi, "")
      .trim()
      .replace(/\s+/g, " ") || "VNK Automatisation";

    const fullAddress = [companyAddress, companyCity, companyProvince, companyPostalCode]
      .map((s) => (s ?? "").trim())
      .filter((s) => s.length > 0)
      .join(", ");

    ctx["company.name"] = shortName;
    ctx["company.fullName"] = fullLegal;
    ctx["company.address"] = fullAddress;
    ctx["company.phone"] = formatPhone(companyPhone ?? "");
    ctx["company.email"] = companyEmail ?? "";
    ctx["company.neq"] = companyNeq ?? "";
  } catch {
    // Settings DB indisponibles : on laisse company.* en placeholder
  }

  const now = new Date();
  ctx["date.today"] = formatDateIso(now);
  ctx["date.todayFr"] = formatDateFr(now);

  // Ancres de signature (litterales — le PDF les transforme en blocs dessines)
  ctx["signature.employee"] = "[Signature employé]";
  ctx["signature.employer"] = "[Signature employeur]";

  return ctx;
}

function safeFilename(title: string, fallback = "document"): string {
  const cleaned = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${cleaned || fallback}.pdf`;
}

function pdfResponse(buffer: Buffer, filename: string, download: boolean) {
  const disposition = download ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function loadTemplateFromDb(
  templateType: TemplateTypeDb,
  templateId: number,
): Promise<{ bodyMarkdown: string; title: string; version?: string } | null> {
  if (templateType === "legal") {
    const row = await prisma.legalDocumentTemplate.findUnique({
      where: { id: templateId },
      select: { bodyMarkdown: true, title: true, version: true },
    });
    return row ?? null;
  }
  if (templateType === "contract") {
    const row = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      select: { bodyMarkdown: true, name: true },
    });
    return row ? { bodyMarkdown: row.bodyMarkdown, title: row.name } : null;
  }
  if (templateType === "policy") {
    const row = await prisma.hrPolicy.findUnique({
      where: { id: templateId },
      select: { bodyMarkdown: true, title: true, version: true },
    });
    return row ?? null;
  }
  return null;
}

function dbTypeToDocType(t: TemplateTypeDb): TemplateDocumentType {
  if (t === "contract") return "contract";
  if (t === "policy") return "policy";
  return "legal";
}

// ─────────────────────────────────────────────────────────
// POST : markdown inline
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  let payload: PostPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const bodyMarkdown = typeof payload.bodyMarkdown === "string" ? payload.bodyMarkdown : "";
  const title = (payload.title ?? "Aperçu document").trim();
  const rawType = (payload.documentType ?? "legal") as TemplateDocumentType;
  // documentType invalide -> fallback "legal" plutot que 400 : on veut TOUJOURS un PDF.
  const documentType: TemplateDocumentType = ALLOWED_TYPES.includes(rawType)
    ? rawType
    : "legal";

  // Contexte : si employeeId fourni, on construit le contexte complet ;
  // sinon on part d'un contexte minimal (company.* + date.*) pour que les
  // variables employee.* / contract.* apparaissent comme placeholders dans le PDF.
  let context: TemplateContext;
  if (Number.isFinite(payload.employeeId)) {
    try {
      context = await buildContextFromEmployee(payload.employeeId!, {
        contractId: Number.isFinite(payload.contractId) ? payload.contractId! : undefined,
      });
    } catch {
      // Employe introuvable -> contexte minimal
      context = await buildMinimalContext();
    }
  } else {
    context = await buildMinimalContext();
  }
  if (payload.extraContext) {
    context = { ...context, ...payload.extraContext };
  }
  // Filet de securite : date.todayFr toujours present
  if (!context["date.todayFr"]) {
    context["date.todayFr"] = new Date().toLocaleDateString("fr-CA", {
      day: "2-digit", month: "long", year: "numeric",
    });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  try {
    const pdf = await renderTemplateToPdf({
      bodyMarkdown,
      context,
      title,
      documentType,
      metadata: payload.metadata,
    });
    return pdfResponse(pdf, safeFilename(title, "apercu"), download);
  } catch (err) {
    // LOG SERVEUR DETAILLE pour diagnostiquer (visible dans le terminal `npm run dev`)
    console.error("[preview-pdf POST] renderTemplateToPdf failed:", {
      title,
      documentType,
      bodyLength: bodyMarkdown.length,
      hasEmployeeId: Number.isFinite(payload.employeeId),
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    const message = (err as Error)?.message ?? "Erreur inconnue";
    try {
      const fallback = await renderMinimalErrorPdf(title, message);
      return pdfResponse(fallback, safeFilename(title, "apercu-erreur"), download);
    } catch (fallbackErr) {
      console.error("[preview-pdf POST] fallback PDF also failed:", fallbackErr);
      // Vraiment impossible : on renvoie JSON 500 pour que le client puisse afficher
      // un message d'erreur clair (au lieu de servir un faux PDF qui casse l'iframe).
      return NextResponse.json(
        { error: `Generation PDF impossible : ${message}` },
        { status: 500 },
      );
    }
  }
}

// PDF d'erreur ABSOLUMENT MINIMAL — utilise uniquement les primitives PDFKit
// de base pour eviter toute exception (font/fillColor/etc). Si meme ceci
// echoue, c'est que PDFKit est casse au niveau module.
async function renderMinimalErrorPdf(title: string, errorMsg: string): Promise<Buffer> {
  // Import dynamique pour eviter de tirer PDFKit dans le bundle si jamais appele
  const { default: PDFDocument } = await import("pdfkit");
  const { PassThrough } = await import("stream");
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);
    try {
      // ASCII uniquement pour eviter tout probleme de font
      doc.fontSize(18).text("Apercu temporairement indisponible", { align: "center" });
      doc.moveDown(1);
      doc.fontSize(11).text(`Document: ${title.replace(/[^\x20-\x7E]/g, "?")}`);
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("gray")
        .text("Le rendu PDF du modele a echoue. Consultez les logs serveur (terminal npm run dev) pour le detail.");
      doc.moveDown(1);
      doc.fontSize(9).text(`Erreur: ${errorMsg.slice(0, 200).replace(/[^\x20-\x7E]/g, "?")}`);
      doc.end();
    } catch (e) {
      try { doc.end(); } catch { /* noop */ }
      reject(e);
    }
  });
}

// ─────────────────────────────────────────────────────────
// GET : chargement depuis la DB via templateId + type
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const templateIdStr = searchParams.get("templateId");
  const templateType = searchParams.get("templateType") as TemplateTypeDb | null;
  const employeeIdStr = searchParams.get("employeeId");
  const contractIdStr = searchParams.get("contractId");
  const download = searchParams.get("download") === "1";

  const templateId = Number(templateIdStr);
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: "templateId requis" }, { status: 400 });
  }
  if (!templateType || !["legal", "contract", "policy"].includes(templateType)) {
    return NextResponse.json(
      { error: "templateType requis (legal | contract | policy)" },
      { status: 400 },
    );
  }

  const tpl = await loadTemplateFromDb(templateType, templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  let context: TemplateContext;
  const employeeId = Number(employeeIdStr);
  if (Number.isFinite(employeeId)) {
    try {
      const contractId = Number(contractIdStr);
      context = await buildContextFromEmployee(employeeId, {
        contractId: Number.isFinite(contractId) ? contractId : undefined,
      });
    } catch {
      context = await buildMinimalContext();
    }
  } else {
    context = await buildMinimalContext();
  }
  if (!context["date.todayFr"]) {
    context["date.todayFr"] = new Date().toLocaleDateString("fr-CA", {
      day: "2-digit", month: "long", year: "numeric",
    });
  }

  const docType = dbTypeToDocType(templateType);
  try {
    const pdf = await renderTemplateToPdf({
      bodyMarkdown: tpl.bodyMarkdown,
      context,
      title: tpl.title,
      documentType: docType,
      metadata: {
        version: tpl.version,
        employeeName: context["employee.fullName"] || undefined,
      },
    });
    return pdfResponse(pdf, safeFilename(tpl.title, "apercu"), download);
  } catch (err) {
    console.error("[preview-pdf GET] renderTemplateToPdf failed:", {
      templateId, templateType,
      title: tpl.title,
      bodyLength: tpl.bodyMarkdown.length,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    const message = (err as Error)?.message ?? "Erreur inconnue";
    try {
      const fallback = await renderMinimalErrorPdf(tpl.title, message);
      return pdfResponse(fallback, safeFilename(tpl.title, "apercu-erreur"), download);
    } catch (fallbackErr) {
      console.error("[preview-pdf GET] fallback PDF also failed:", fallbackErr);
      return NextResponse.json(
        { error: `Generation PDF impossible : ${message}` },
        { status: 500 },
      );
    }
  }
}
