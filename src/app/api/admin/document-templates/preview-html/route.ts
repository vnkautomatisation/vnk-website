// GET/POST /api/admin/document-templates/preview-html
// Retourne le HTML rendu d'un template (apres substitution des variables)
// pour la zone "Apercu" de l'editeur de templates.
//
// Mode :
//   - POST { bodyMarkdown, title, documentType, employeeId?, contractId?,
//            metadata?, extraContext? }
//
// Retour : text/html (le meme HTML que celui qui sera converti en PDF).
//
// Auth : admin uniquement.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import {
  buildContextFromEmployee,
  formatDateFr,
  formatDateIso,
  formatPhone,
  type TemplateContext,
} from "@/lib/document-templates";
import {
  renderTemplateAsHtml,
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
    const shortName =
      fullLegal
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
    /* settings indisponibles */
  }
  const now = new Date();
  ctx["date.today"] = formatDateIso(now);
  ctx["date.todayFr"] = formatDateFr(now);
  ctx["signature.employee"] = "[Signature employé]";
  ctx["signature.employer"] = "[Signature employeur]";
  return ctx;
}

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
  const title = (payload.title ?? "Apercu document").trim();
  const rawType = (payload.documentType ?? "legal") as TemplateDocumentType;
  const documentType: TemplateDocumentType = ALLOWED_TYPES.includes(rawType)
    ? rawType
    : "legal";

  let context: TemplateContext;
  if (Number.isFinite(payload.employeeId)) {
    try {
      context = await buildContextFromEmployee(payload.employeeId!, {
        contractId: Number.isFinite(payload.contractId) ? payload.contractId! : undefined,
      });
    } catch {
      context = await buildMinimalContext();
    }
  } else {
    context = await buildMinimalContext();
  }
  if (payload.extraContext) {
    context = { ...context, ...payload.extraContext };
  }
  if (!context["date.todayFr"]) {
    context["date.todayFr"] = new Date().toLocaleDateString("fr-CA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  try {
    const html = renderTemplateAsHtml({
      bodyMarkdown,
      context,
      title,
      documentType,
      metadata: payload.metadata,
    });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        // CSP : autorise les fonts Google (besoin pour l'iframe preview)
        "Content-Security-Policy":
          "default-src 'self' 'unsafe-inline' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com",
      },
    });
  } catch (err) {
    console.error("[preview-html POST] renderTemplateAsHtml failed:", {
      title,
      documentType,
      bodyLength: bodyMarkdown.length,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    const message = (err as Error)?.message ?? "Erreur inconnue";
    return NextResponse.json(
      { error: `Generation HTML impossible : ${message}` },
      { status: 500 },
    );
  }
}
