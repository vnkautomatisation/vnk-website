// PDF generation — wrapper Next.js autour de l'ancien pdf-templates.js (Express)
// Les fonctions dans pdf-templates.js attendent (res, entity, client) format Express.
// Ce wrapper cree un faux response object qui capture le stream PDF.
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

// Faux response Express qui capture le PDF dans un buffer
function createFakeResponse(): { res: any; getBuffer: () => Promise<Buffer> } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const res = {
    setHeader: () => {},
    write: (chunk: any) => stream.write(chunk),
    end: (chunk?: any) => {
      if (chunk) stream.write(chunk);
      stream.end();
    },
    // PDFKit doc.pipe(res) needs this to be a writable stream
    on: stream.on.bind(stream),
    once: stream.once.bind(stream),
    emit: stream.emit.bind(stream),
    writable: true,
    _write: stream._write.bind(stream),
  };

  // Make it pipeable — PDFKit calls doc.pipe(res)
  Object.setPrototypeOf(res, stream);

  const getBuffer = () =>
    new Promise<Buffer>((resolve, reject) => {
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });

  return { res: stream, getBuffer };
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const { res, getBuffer } = createFakeResponse();

  // pdf-templates.js attend (res, quote, client, lines)
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

  const client = {
    full_name: data.client.fullName,
    company_name: data.client.companyName,
    email: data.client.email,
    phone: data.client.phone,
    address: data.client.address,
    city: data.client.city,
    province: data.client.province,
    postal_code: data.client.postalCode,
  };

  await PdfTemplates.generateQuotePDF(res, quote, client, []);
  return getBuffer();
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const { res, getBuffer } = createFakeResponse();

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

  const client = {
    full_name: data.client.fullName,
    company_name: data.client.companyName,
    email: data.client.email,
    phone: data.client.phone,
    address: data.client.address,
    city: data.client.city,
    province: data.client.province,
    postal_code: data.client.postalCode,
  };

  await PdfTemplates.generateInvoicePDF(res, invoice, client);
  return getBuffer();
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const { res, getBuffer } = createFakeResponse();

  const contract = {
    contract_number: data.contractNumber,
    title: data.title,
    content: data.content,
    amount_ttc: data.amountTtc,
    client_signature_data: data.clientSignatureData,
    admin_signature_data: data.adminSignatureData,
    signed_at: data.signedAt,
  };

  const client = {
    full_name: data.client.fullName,
    company_name: data.client.companyName,
    email: data.client.email,
    phone: data.client.phone,
    address: data.client.address,
    city: data.client.city,
    province: data.client.province,
    postal_code: data.client.postalCode,
  };

  await PdfTemplates.generateContractPDF(res, contract, client, null);
  return getBuffer();
}
