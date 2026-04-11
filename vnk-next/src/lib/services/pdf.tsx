// PDF generation using @react-pdf/renderer
// Génère des PDFs pour devis, factures, contrats directement depuis React
// (remplace PDFKit)
import "server-only";

// Note: this is a stub. Real implementation would use @react-pdf/renderer
// import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

type QuotePdfData = {
  quoteNumber: string;
  title: string;
  description?: string;
  client: { fullName: string; companyName?: string; email: string; address?: string };
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  expiryDate?: Date;
  paymentConditions?: string;
};

type InvoicePdfData = {
  invoiceNumber: string;
  title: string;
  client: { fullName: string; companyName?: string; email: string };
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  dueDate?: Date;
};

type ContractPdfData = {
  contractNumber: string;
  title: string;
  content?: string;
  client: { fullName: string; companyName?: string };
  amountTtc?: number;
};

// TODO: replace with real @react-pdf/renderer implementation
// For now, return a plain HTML→PDF stub
export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${data.quoteNumber}</title>
<style>
  body { font-family: Inter, sans-serif; padding: 40px; color: #0F2D52; }
  .header { border-bottom: 3px solid #0F2D52; padding-bottom: 20px; }
  .logo { font-size: 24px; font-weight: bold; }
  h1 { margin-top: 30px; }
  .meta { display: flex; justify-content: space-between; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 30px; }
  table th { background: #EBF5FB; padding: 10px; text-align: left; }
  table td { padding: 10px; border-bottom: 1px solid #E2EBF5; }
  .totals { text-align: right; margin-top: 20px; }
  .total-row { display: flex; justify-content: space-between; max-width: 300px; margin-left: auto; padding: 5px 0; }
  .grand-total { font-size: 1.2em; font-weight: bold; border-top: 2px solid #0F2D52; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">VNK Automatisation Inc.</div>
    <div>Value · Network · Knowledge</div>
  </div>
  <h1>Devis ${data.quoteNumber}</h1>
  <div class="meta">
    <div>
      <strong>Client :</strong><br>
      ${data.client.fullName}<br>
      ${data.client.companyName ?? ""}<br>
      ${data.client.email}
    </div>
    <div>
      ${data.expiryDate ? `<strong>Valide jusqu'au :</strong> ${data.expiryDate.toLocaleDateString("fr-CA")}` : ""}
    </div>
  </div>
  <h2>${data.title}</h2>
  ${data.description ? `<p>${data.description}</p>` : ""}
  <div class="totals">
    <div class="total-row"><span>Sous-total HT</span><span>${data.amountHt.toFixed(2)} $</span></div>
    <div class="total-row"><span>TPS (5%)</span><span>${data.tpsAmount.toFixed(2)} $</span></div>
    <div class="total-row"><span>TVQ (9,975%)</span><span>${data.tvqAmount.toFixed(2)} $</span></div>
    <div class="total-row grand-total"><span>TOTAL TTC</span><span>${data.amountTtc.toFixed(2)} $</span></div>
  </div>
  ${data.paymentConditions ? `<p><small>${data.paymentConditions}</small></p>` : ""}
</body>
</html>`;

  // TODO: convert HTML to PDF via puppeteer or @react-pdf/renderer
  return Buffer.from(html);
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  // TODO: same as above with invoice layout
  return Buffer.from(`Invoice ${data.invoiceNumber}`);
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  return Buffer.from(`Contract ${data.contractNumber}`);
}
