// API · Prévisualisation d'un template email avec variables interpolées.
// POST { bodyHtml, subject, variables? } → HTML rendu prêt pour iframe sandboxé.
// Si variables non fournies, des valeurs factices sont utilisées (Jean Tremblay,
// Acme Inc., etc.) pour donner une idée réaliste du rendu final.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";

const SAMPLE_VARS: Record<string, string> = {
  client_name: "Jean Tremblay",
  client_company: "Acme Manufacturing Inc.",
  client_email: "jean.tremblay@acme.ca",
  invoice_number: "FAC-2026-0042",
  invoice_amount: "1 234,56 $",
  invoice_due_date: "30 mai 2026",
  quote_number: "DEV-2026-0017",
  quote_amount: "8 750,00 $",
  payment_url: "https://vnkautomatisation.ca/pay/example",
  signature_url: "https://vnkautomatisation.ca/sign/example",
  appointment_date: "23 mai 2026",
  appointment_time: "14h00",
  company_name: "VNK Automatisation Inc.",
  company_phone: "+1 514 555-0100",
  company_email: "contact@vnkautomatisation.ca",
  current_year: new Date().getFullYear().toString(),
  document_title: "Facture",
  document_number: "FAC-2026-0042",
  item_description: "Audit B&R Automation Studio",
  item_amount: "1 100,00 $",
  accent: "#0F2D52",
  company_logo: "https://vnkautomatisation.ca/logo.png",
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value !== undefined) return value;
    return `<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px">{{${key}}}</span>`;
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbiddenAll([["settings", "write"], ["email_templates", "write"]])) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  try {
    const { bodyHtml, subject, variables } = await request.json();
    if (typeof bodyHtml !== "string") {
      return NextResponse.json({ error: "Champ bodyHtml requis" }, { status: 400 });
    }

    const vars = { ...SAMPLE_VARS, ...(variables || {}) };
    const interpolatedSubject = interpolate(subject ?? "", vars);
    const interpolatedBody = interpolate(bodyHtml, vars);

    // Wrapping email-like : header sujet + corps dans une largeur réaliste
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; padding: 16px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
  .preview-shell { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .preview-meta { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 12px 20px; }
  .preview-meta .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; }
  .preview-meta .subject { font-size: 16px; font-weight: 600; margin-top: 2px; color: #111827; }
  .preview-body { padding: 24px; font-size: 14px; line-height: 1.6; }
  .preview-body img { max-width: 100%; height: auto; }
  .preview-body a { color: #0F2D52; }
  .preview-body table { border-collapse: collapse; }
</style>
</head>
<body>
  <div class="preview-shell">
    <div class="preview-meta">
      <p class="label">Objet</p>
      <p class="subject">${interpolatedSubject || "(sans objet)"}</p>
    </div>
    <div class="preview-body">
      ${interpolatedBody}
    </div>
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
    console.error("[email-preview]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
