// PDF generation — wrapper Next.js autour de l'ancien pdf-templates.js (Express)
// Les fonctions dans pdf-templates.js font doc.pipe(res) puis doc.end().
// On passe un PassThrough comme "res" et on attend "finish" pour collecter le buffer.
import "server-only";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfTemplates = require("./pdf-templates.js");

import { PassThrough } from "stream";

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

export type DocLang = "fr" | "en";

// Convertit la locale Prisma (fr-CA, en-CA, en, fr) en DocLang ("fr" | "en")
export function localeToDocLang(locale: string | null | undefined): DocLang {
  if (!locale) return "fr";
  return locale.toLowerCase().startsWith("en") ? "en" : "fr";
}

type QuotePdfData = {
  quoteNumber: string;
  title: string;
  description?: string;
  client: Client;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  createdAt?: Date;
  expiryDate?: Date;
  paymentConditions?: string;
  paymentPlan?: string;
  paymentPct1?: number;
  paymentPct2?: number;
  status?: string;
  serviceType?: string | null;
  clientSignatureData?: string | null;
  signedAt?: Date | null;
  acceptedAt?: Date | null;
  lang?: DocLang;
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
  createdAt?: Date;
  dueDate?: Date;
  paidAt?: Date | null;
  status?: string;
  serviceType?: string | null;
  invoicePhase?: string | null;
  phaseNumber?: number | null;
  lang?: DocLang;
};

type ReceiptPdfData = {
  receiptNumber?: string;
  invoiceNumber?: string;
  invoiceTitle?: string;
  client: Client;
  amount: number;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  lang?: DocLang;
};

type ContractPdfData = {
  contractNumber: string;
  title: string;
  content?: string;
  client: Client;
  amountTtc?: number;
  createdAt?: Date;
  clientSignatureData?: string | null;
  clientSignatureIp?: string | null;
  adminSignatureData?: string | null;
  adminSignedAt?: Date | null;
  signedAt?: Date | null;
  lang?: DocLang;
};

function toSnakeClient(c: Client) {
  return {
    full_name: c.fullName,
    company_name: c.companyName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    province: c.province,
    postal_code: c.postalCode,
  };
}

// Cree un PassThrough stream avec setHeader noop.
// Collecte le PDF et resolve quand le stream est termine (finish event).
function capturePdf(
  fn: (fakeRes: PassThrough & { setHeader: () => void }) => void | Promise<void>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    // Ajoute setHeader noop — les templates appellent res.setHeader()
    const fakeRes = Object.assign(stream, { setHeader: () => {} });

    // Lance la generation — le template fait doc.pipe(fakeRes) puis doc.end()
    // doc.end() flush le stream, ce qui declenche "end" sur notre PassThrough
    try {
      const result = fn(fakeRes);
      // Si la fonction est async, catch les erreurs
      if (result && typeof result.catch === "function") {
        result.catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const quote = {
    quote_number: data.quoteNumber,
    title: data.title,
    description: data.description,
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    created_at: data.createdAt ?? new Date(),
    expiry_date: data.expiryDate,
    payment_conditions: data.paymentConditions,
    payment_plan: data.paymentPlan,
    payment_pct_1: data.paymentPct1,
    payment_pct_2: data.paymentPct2,
    status: data.status,
    service_type: data.serviceType,
    client_signature_data: data.clientSignatureData,
    signed_at: data.signedAt,
    accepted_at: data.acceptedAt,
  };

  return capturePdf((fakeRes) =>
    PdfTemplates.generateQuotePDF(fakeRes, quote, toSnakeClient(data.client), [], { lang: data.lang ?? "fr" })
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const invoice = {
    invoice_number: data.invoiceNumber,
    title: data.title,
    description: data.description,
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    created_at: data.createdAt ?? new Date(),
    due_date: data.dueDate,
    paid_at: data.paidAt,
    status: data.status,
    service_type: data.serviceType,
    invoice_phase: data.invoicePhase,
    phase_number: data.phaseNumber,
  };

  return capturePdf((fakeRes) =>
    PdfTemplates.generateInvoicePDF(fakeRes, invoice, toSnakeClient(data.client), { lang: data.lang ?? "fr" })
  );
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const contract = {
    contract_number: data.contractNumber,
    title: data.title,
    content: data.content,
    amount_ttc: data.amountTtc,
    created_at: data.createdAt ?? new Date(),
    client_signature_data: data.clientSignatureData,
    client_signature_ip: data.clientSignatureIp,
    admin_signature_data: data.adminSignatureData,
    admin_signed_at: data.adminSignedAt,
    signed_at: data.signedAt,
  };

  return capturePdf((fakeRes) =>
    PdfTemplates.generateContractPDF(fakeRes, contract, toSnakeClient(data.client), null, { lang: data.lang ?? "fr" })
  );
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const receipt = {
    receipt_number: data.receiptNumber,
    invoice_number: data.invoiceNumber,
    invoice_title: data.invoiceTitle,
    amount: data.amount,
    payment_method: data.paymentMethod,
    stripe_payment_intent_id: data.stripePaymentIntentId,
    paid_at: data.paidAt ?? new Date(),
  };

  return capturePdf((fakeRes) =>
    PdfTemplates.generateReceiptPDF(fakeRes, receipt, toSnakeClient(data.client), { lang: data.lang ?? "fr" })
  );
}
