// PDF generation — wrapper Next.js autour de l'ancien pdf-templates.js (Express)
// Les fonctions dans pdf-templates.js attendent (res, entity, client) format Express.
// On passe un PassThrough stream comme "res" — PDFKit fait doc.pipe(res).
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

// Cree un faux "res" Express : un PassThrough stream avec setHeader noop.
// PDFKit fait doc.pipe(res) et res recoit le PDF binaire.
function createFakeRes(): { fakeRes: PassThrough & { setHeader: () => void }; getBuffer: () => Promise<Buffer> } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Ajoute setHeader noop — les templates Express appellent res.setHeader()
  const fakeRes = Object.assign(stream, {
    setHeader: () => {},
  });

  const getBuffer = () =>
    new Promise<Buffer>((resolve, reject) => {
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });

  return { fakeRes, getBuffer };
}

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

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const { fakeRes, getBuffer } = createFakeRes();

  const quote = {
    quote_number: data.quoteNumber,
    title: data.title,
    description: data.description,
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    expiry_date: data.expiryDate,
    payment_conditions: data.paymentConditions,
    payment_plan: data.paymentPlan,
    payment_pct_1: data.paymentPct1,
    payment_pct_2: data.paymentPct2,
  };

  await PdfTemplates.generateQuotePDF(fakeRes, quote, toSnakeClient(data.client), []);
  return getBuffer();
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const { fakeRes, getBuffer } = createFakeRes();

  const invoice = {
    invoice_number: data.invoiceNumber,
    title: data.title,
    description: data.description,
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    due_date: data.dueDate,
    paid_at: data.paidAt,
    status: data.status,
    invoice_phase: data.invoicePhase,
    phase_number: data.phaseNumber,
  };

  await PdfTemplates.generateInvoicePDF(fakeRes, invoice, toSnakeClient(data.client));
  return getBuffer();
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const { fakeRes, getBuffer } = createFakeRes();

  const contract = {
    contract_number: data.contractNumber,
    title: data.title,
    content: data.content,
    amount_ttc: data.amountTtc,
    client_signature_data: data.clientSignatureData,
    admin_signature_data: data.adminSignatureData,
    signed_at: data.signedAt,
  };

  await PdfTemplates.generateContractPDF(fakeRes, contract, toSnakeClient(data.client), null);
  return getBuffer();
}
