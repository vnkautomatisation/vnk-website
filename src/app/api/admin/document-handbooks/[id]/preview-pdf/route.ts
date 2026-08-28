// GET /api/admin/document-handbooks/[id]/preview-pdf?employeeId=Y
// Genere un apercu PDF du cahier complet (cover + TOC + chapitres + page
// signature) pour visualiser le rendu avant publication.
// Mission 3 : apercu PDF cahier depuis la page Cahiers admin.
//
// Auth : admin uniquement.
// Query : ?employeeId=Y (optionnel) -> resout les variables avec un employe
//         ?download=1 -> Content-Disposition: attachment
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import {
  buildContextFromEmployee,
  formatDateFr,
  formatDateIso,
  formatPhone,
  type TemplateContext,
} from "@/lib/document-templates";
import {
  renderHandbookHtmlToPdf,
  type SignatureScope,
} from "@/lib/services/pdf-html-renderer";
import { getLocale } from "next-intl/server";
import { dateLocale } from "@/lib/i18n-format";

export const dynamic = "force-dynamic";

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
    /* settings indispo */
  }
  const now = new Date();
  ctx["date.today"] = formatDateIso(now);
  ctx["date.todayFr"] = formatDateFr(now);
  ctx["signature.employee"] = "[Signature employé]";
  ctx["signature.employer"] = "[Signature employeur]";
  return ctx;
}

function safeFilename(title: string, fallback = "cahier"): string {
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

/**
 * D4 : etats live (initiales, lecture finale, signature) appliques au PDF
 * pour refleter l'avancement de la signature en temps reel dans l'iframe
 * d'apercu. Acceptes via query (court) OU body POST (long, signature).
 */
interface LiveState {
  finalRead?: boolean;
  finalInitials?: string;
  globalAccepted?: boolean;
  signatureDataUrl?: string;
  employeeName?: string;
}

async function buildHandbookPdf(
  handbookId: number,
  employeeIdStr: string | null,
  live: LiveState,
): Promise<{ buffer: Buffer; filename: string } | { error: string; status: number }> {
  const dateTag = dateLocale(await getLocale());
  const handbook = await prisma.documentHandbook.findUnique({
    where: { id: handbookId },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: {
          template: {
            select: {
              id: true,
              key: true,
              title: true,
              bodyMarkdown: true,
              version: true,
              targetPositions: true,
            },
          },
        },
      },
    },
  });
  if (!handbook) {
    return { error: "Cahier introuvable", status: 404 };
  }

  let context: TemplateContext;
  let employeeName: string | undefined;
  let employeePositionName: string | null = null;
  const employeeId = Number(employeeIdStr);
  if (Number.isFinite(employeeId)) {
    try {
      context = await buildContextFromEmployee(employeeId);
      const emp = await prisma.admin.findUnique({
        where: { id: employeeId },
        select: {
          fullName: true,
          email: true,
          position: { select: { name: true } },
        },
      });
      employeeName = emp?.fullName ?? emp?.email ?? undefined;
      employeePositionName = emp?.position?.name ?? null;
    } catch {
      context = await buildMinimalContext();
      employeeName = "Apercu";
    }
  } else {
    context = await buildMinimalContext();
    employeeName = "Apercu";
  }
  if (live.employeeName) employeeName = live.employeeName;
  if (!context["date.todayFr"]) {
    context["date.todayFr"] = new Date().toLocaleDateString(dateTag, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // D6 : filtre les chapitres selon le poste de l'employe.
  const filteredItems = !Number.isFinite(employeeId)
    ? handbook.items
    : handbook.items.filter((it) => {
        const targets = (it.template.targetPositions ?? []) as string[];
        if (!targets || targets.length === 0) return true;
        if (!employeePositionName) return false;
        return targets.includes(employeePositionName);
      });

  const customFieldValues =
    (handbook as unknown as { customFieldValues?: Record<string, string> | null })
      .customFieldValues ?? null;

  const signaturePayload = live.signatureDataUrl
    ? {
        dataUrl: live.signatureDataUrl,
        name: employeeName,
        date: new Date(),
      }
    : undefined;

  const pdf = await renderHandbookHtmlToPdf({
    handbook: {
      title: handbook.title,
      subtitle: handbook.subtitle ?? undefined,
      coverIntro: handbook.coverIntro ?? undefined,
      version: handbook.version,
      signatureScope: (handbook.signatureScope as SignatureScope) ?? "employee_only",
      customFieldValues,
    },
    chapters: filteredItems.map((it) => ({
      title: it.template.title,
      bodyMarkdown: it.template.bodyMarkdown,
      templateId: it.template.id,
      templateKey: it.template.key,
    })),
    context,
    employeeName,
    signature: signaturePayload,
    finalRead: live.finalRead,
    finalInitials: live.finalInitials,
    globalAccepted: live.globalAccepted,
  });
  return { buffer: pdf, filename: safeFilename(handbook.title, "cahier") };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const { id: idStr } = await params;
  const handbookId = Number(idStr);
  if (!Number.isFinite(handbookId)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const employeeIdStr = searchParams.get("employeeId");
  const download = searchParams.get("download") === "1";

  // D4 : etats live legers via query string (initiales courtes, booleens).
  const live: LiveState = {
    finalRead: searchParams.get("finalRead") === "1",
    finalInitials: searchParams.get("finalInitials") ?? undefined,
    globalAccepted: searchParams.get("globalAccepted") === "1",
  };

  try {
    const result = await buildHandbookPdf(handbookId, employeeIdStr, live);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return pdfResponse(result.buffer, result.filename, download);
  } catch (err) {
    console.error("[handbook preview-pdf GET] erreur generation :", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Generation PDF impossible : ${message}` },
      { status: 500 },
    );
  }
}

/**
 * D4 : POST utilise par l'iframe d'apercu pour rafraichir le PDF avec
 * l'etat live (initiales + lecture finale + signature data URL). La
 * signature peut atteindre ~ 50 ko, donc passe par le body et non
 * par la query string.
 *
 * Body JSON :
 *   {
 *     employeeId?: number,
 *     finalRead?: boolean,
 *     finalInitials?: string,
 *     globalAccepted?: boolean,
 *     signatureDataUrl?: string  // data URL base64 PNG
 *   }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { id: idStr } = await params;
  const handbookId = Number(idStr);
  if (!Number.isFinite(handbookId)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  let body: {
    employeeId?: number;
    finalRead?: boolean;
    finalInitials?: string;
    globalAccepted?: boolean;
    signatureDataUrl?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* body vide : tolerance */
  }

  const live: LiveState = {
    finalRead: body.finalRead === true,
    finalInitials: typeof body.finalInitials === "string" ? body.finalInitials : undefined,
    globalAccepted: body.globalAccepted === true,
    signatureDataUrl: typeof body.signatureDataUrl === "string" && body.signatureDataUrl.length > 0
      ? body.signatureDataUrl
      : undefined,
  };
  const employeeIdStr = Number.isFinite(body.employeeId) ? String(body.employeeId) : null;

  try {
    const result = await buildHandbookPdf(handbookId, employeeIdStr, live);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return pdfResponse(result.buffer, result.filename, false);
  } catch (err) {
    console.error("[handbook preview-pdf POST] erreur generation :", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Generation PDF impossible : ${message}` },
      { status: 500 },
    );
  }
}
