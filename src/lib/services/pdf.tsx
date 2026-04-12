// PDF generation — wrapper TypeScript autour de l'ancien pdf-templates.js
// L'ancien fichier utilise le pattern Express (res.setHeader, doc.pipe(res)).
// Ce wrapper cree un faux objet "res" qui collecte les chunks en Buffer.
import "server-only";
import { PassThrough } from "stream";

// @ts-expect-error — pas de types pour le fichier JS legacy
import * as PdfTemplates from "./pdf-templates.js";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// Fake Express response that collects PDF bytes
// ═══════════════════════════════════════════════════════════

function createFakeRes(): { stream: PassThrough; promise: Promise<Buffer>; fakeRes: Record<string, unknown> } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  const promise = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  // The old pdf-templates.js calls res.setHeader() and doc.pipe(res)
  // We fake the Express response object so it pipes into our PassThrough
  const fakeRes = {
    setHeader: () => {},
    write: (chunk: Buffer) => stream.write(chunk),
    end: (chunk?: Buffer) => { if (chunk) stream.write(chunk); stream.end(); },
    on: (event: string, fn: (...args: unknown[]) => void) => stream.on(event, fn),
    once: (event: string, fn: (...args: unknown[]) => void) => stream.once(event, fn),
    emit: (event: string, ...args: unknown[]) => stream.emit(event, ...args),
    // PassThrough is a writable stream — PDFKit calls pipe(res)
    // We need to make fakeRes behave as a writable stream
    writable: true,
    _write: stream._write.bind(stream),
    _final: stream._final?.bind(stream),
  };

  // Make it work with doc.pipe() — pipe expects a writable stream
  // The simplest approach: return the PassThrough directly as the pipe target
  return { stream, promise, fakeRes: fakeRes as Record<string, unknown> };
}

// ═══════════════════════════════════════════════════════════
// Adapters: convert old Express (res, data, client) → Buffer
// ═══════════════════════════════════════════════════════════

function toExpressQuote(data: QuotePdfData) {
  return {
    quote_number: data.quoteNumber,
    title: data.title,
    description: data.description ?? "",
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    payment_conditions: data.paymentConditions ?? "Net 30 jours",
    expiry_date: data.expiryDate,
    created_at: new Date(),
  };
}

function toExpressClient(c: Client) {
  return {
    full_name: c.fullName,
    company_name: c.companyName ?? "",
    email: c.email,
    phone: c.phone ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    province: c.province ?? "QC",
    postal_code: c.postalCode ?? "",
  };
}

function toExpressInvoice(data: InvoicePdfData) {
  return {
    invoice_number: data.invoiceNumber,
    title: data.title,
    description: data.description ?? "",
    amount_ht: data.amountHt,
    tps_amount: data.tpsAmount,
    tvq_amount: data.tvqAmount,
    amount_ttc: data.amountTtc,
    due_date: data.dueDate,
    paid_at: data.paidAt,
    status: data.status ?? "unpaid",
    invoice_phase: data.invoicePhase,
    phase_number: data.phaseNumber,
    created_at: new Date(),
  };
}

function toExpressContract(data: ContractPdfData) {
  return {
    contract_number: data.contractNumber,
    title: data.title,
    content: data.content ?? "",
    amount_ttc: data.amountTtc ?? 0,
    client_signature_data: data.clientSignatureData ?? null,
    admin_signature_data: data.adminSignatureData ?? null,
    signed_at: data.signedAt,
    created_at: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const { stream, promise } = createFakeRes();
  const quote = toExpressQuote(data);
  const client = toExpressClient(data.client);

  // The old function signature: generateQuotePDF(res, quote, client, lines)
  // lines = array of {description, quantity, unit_price, amount}
  // For now we pass a single line based on the quote total
  const lines = [
    {
      description: data.title + (data.description ? "\n" + data.description : ""),
      quantity: 1,
      unit_price: data.amountHt,
      amount: data.amountHt,
    },
  ];

  await PdfTemplates.generateQuotePDF(stream, quote, client, lines);
  return promise;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const { stream, promise } = createFakeRes();
  const invoice = toExpressInvoice(data);
  const client = toExpressClient(data.client);

  await PdfTemplates.generateInvoicePDF(stream, invoice, client);
  return promise;
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const { stream, promise } = createFakeRes();
  const contract = toExpressContract(data);
  const client = toExpressClient(data.client);

  // The old function: generateContractPDF(res, contract, client, quote)
  // quote is optional (used for reference)
  await PdfTemplates.generateContractPDF(stream, contract, client, null);
  return promise;
}
