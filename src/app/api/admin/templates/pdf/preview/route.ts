// API · Prévisualisation HTML d'un template PDF (sans génération PDF réelle).
// Rend les sections header/body/footer dans une page A4 simulée à l'écran,
// ce qui suffit pour valider la mise en page avant export.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SAMPLE_VARS: Record<string, string> = {
  client_name: "Jean Tremblay",
  client_company: "Acme Manufacturing Inc.",
  client_email: "jean.tremblay@acme.ca",
  invoice_number: "FAC-2026-0042",
  invoice_amount: "1 234,56 $",
  invoice_due_date: "30 mai 2026",
  quote_number: "DEV-2026-0017",
  quote_amount: "8 750,00 $",
  appointment_date: "23 mai 2026",
  appointment_time: "14h00",
  company_name: "VNK Automatisation Inc.",
  company_phone: "+1 514 555-0100",
  company_email: "contact@vnkautomatisation.ca",
  current_year: new Date().getFullYear().toString(),
  document_title: "Facture",
  document_number: "FAC-2026-0042",
  item_description: "Audit B&R Automation Studio · 10h × 110 $",
  item_amount: "1 100,00 $",
  payment_url: "https://vnkautomatisation.ca/pay/example",
  signature_url: "https://vnkautomatisation.ca/sign/example",
};

// Dimensions A4 / Letter / Legal en pixels @ 96dpi
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  Letter: { width: 816, height: 1056 },
  Legal: { width: 816, height: 1344 },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value !== undefined) return value;
    return `<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px">{{${key}}}</span>`;
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      headerHtml = "",
      bodyHtml = "",
      footerHtml = "",
      pageSize = "A4",
      margins = { top: 40, right: 40, bottom: 40, left: 40 },
      accentColor = "#0F2D52",
      variables = {},
    } = body;

    const vars = { ...SAMPLE_VARS, ...variables, accent: accentColor };
    const dims = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; padding: 30px; background: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
  .pdf-page {
    width: ${dims.width}px;
    min-height: ${dims.height}px;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);
    padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .pdf-header { margin-bottom: 24px; }
  .pdf-body { flex: 1; font-size: 12px; line-height: 1.6; }
  .pdf-footer {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 10px;
    color: #6b7280;
  }
  .pdf-body table { border-collapse: collapse; }
  .pdf-body img { max-width: 100%; height: auto; }
  .pdf-meta {
    max-width: ${dims.width}px;
    margin: 0 auto 16px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 11px;
    color: #6b7280;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pdf-meta strong { color: #111827; font-weight: 600; }
</style>
</head>
<body>
  <div class="pdf-meta">
    <span><strong>Format :</strong> ${pageSize}</span>
    <span><strong>Dimensions :</strong> ${dims.width} × ${dims.height} px (96 dpi)</span>
    <span><strong>Marges :</strong> ${margins.top}/${margins.right}/${margins.bottom}/${margins.left}</span>
    <span><strong>Couleur d'accent :</strong> <code style="background:${accentColor};color:#fff;padding:1px 6px;border-radius:3px">${accentColor}</code></span>
  </div>
  <div class="pdf-page">
    ${headerHtml ? `<div class="pdf-header">${interpolate(headerHtml, vars)}</div>` : ""}
    <div class="pdf-body">${interpolate(bodyHtml, vars)}</div>
    ${footerHtml ? `<div class="pdf-footer">${interpolate(footerHtml, vars)}</div>` : ""}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'self' data: blob: https:; img-src * data: blob:; style-src 'unsafe-inline' 'self'; script-src 'none'; frame-ancestors 'self'",
      },
    });
  } catch (err) {
    console.error("[pdf-preview]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
