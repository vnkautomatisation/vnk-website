// PDF generation — wrapper TypeScript autour de l'ancien pdf-templates.js
// L'ancien fichier PDFKit (1246 lignes) a été préservé dans src/lib/services/
// pdf-templates.js. Il génère les PDFs devis/factures/contrats avec le layout
// identique à l'ancien site (logo hexagonal VNK, couleurs, footer légal).
import "server-only";

// Le require est dynamique car pdfkit est CommonJS
// @ts-expect-error — pas de types pour le fichier JS
import * as PdfTemplates from "./pdf-templates.js";

type Client = {
  fullName: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

type QuotePdfData = {
  quoteNumber: string;
  title: string;
  description?: string;
  client: Client;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  expiryDate?: Date;
  paymentConditions?: string;
  paymentPlan?: string;
  paymentPct1?: number;
  paymentPct2?: number;
};

type InvoicePdfData = {
  invoiceNumber: string;
  title: string;
  description?: string;
  client: Client;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  dueDate?: Date;
  paidAt?: Date | null;
  status?: string;
  invoicePhase?: string | null;
  phaseNumber?: number | null;
};

type ContractPdfData = {
  contractNumber: string;
  title: string;
  content?: string;
  client: Client;
  amountTtc?: number;
  clientSignatureData?: string | null;
  adminSignatureData?: string | null;
  signedAt?: Date | null;
};

// Wrapper qui convertit Buffer PDFKit → Uint8Array compatible Response
function toBuffer(fn: () => unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const result = fn();
      // L'ancien pdf-templates.js retourne soit un Buffer soit un stream
      if (result instanceof Buffer) {
        resolve(result);
      } else if (result && typeof (result as { on?: unknown }).on === "function") {
        // Stream
        const chunks: Buffer[] = [];
        const stream = result as NodeJS.ReadableStream;
        stream.on("data", (c) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      } else {
        reject(new Error("PDF function returned unexpected type"));
      }
    } catch (e) {
      reject(e);
    }
  });
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return toBuffer(() => PdfTemplates.generateQuotePDF(data));
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return toBuffer(() => PdfTemplates.generateInvoicePDF(data));
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  return toBuffer(() => PdfTemplates.generateContractPDF(data));
}
