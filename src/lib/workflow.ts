// ═══════════════════════════════════════════════════════════
// VNK Workflow Engine
// Pipeline état : prospect → mandat → devis → contrat → facture → payé
// Chaque transition crée un workflow_event + déclenche notifications + webhooks
// ═══════════════════════════════════════════════════════════
import "server-only";
import { prisma } from "./prisma";

export type WorkflowEventType =
  // Clients
  | "client_created"
  | "client_archived"
  | "client_reactivated"
  // Mandats
  | "mandate_created"
  | "mandate_started"
  | "mandate_progress_update"
  | "mandate_paused"
  | "mandate_completed"
  | "mandate_cancelled"
  // Devis
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | "quote_expired"
  // Contrats
  | "contract_created"
  | "contract_sent_for_signature"
  | "contract_signed_client"
  | "contract_signed_admin"
  | "contract_signed_both"
  | "contract_cancelled"
  // Factures
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "invoice_reminded"
  | "invoice_refunded"
  // Paiements
  | "payment_received"
  | "payment_failed"
  // Projets
  | "project_request_received"
  | "project_request_converted"
  // Messages
  | "message_from_client"
  | "message_from_admin"
  // Rendez-vous
  | "appointment_booked"
  | "appointment_cancelled"
  | "appointment_completed"
  // Litiges
  | "dispute_opened"
  | "dispute_resolved";

export async function createWorkflowEvent(params: {
  clientId: number;
  mandateId?: number;
  quoteId?: number;
  contractId?: number;
  invoiceId?: number;
  eventType: WorkflowEventType;
  eventLabel: string;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}) {
  const event = await prisma.workflowEvent.create({
    data: {
      clientId: params.clientId,
      mandateId: params.mandateId,
      quoteId: params.quoteId,
      contractId: params.contractId,
      invoiceId: params.invoiceId,
      eventType: params.eventType,
      eventLabel: params.eventLabel,
      triggeredBy: params.triggeredBy ?? "system",
      wsBroadcast: true,
      metadata: (params.metadata as object) ?? null,
    },
  });

  // Fire outgoing webhooks (async, ne bloque pas)
  fireOutgoingWebhooks(params.eventType, event).catch((e) =>
    console.error("[workflow] webhook fire failed:", e)
  );

  return event;
}

// ═══════════════════════════════════════════════════════════
// WORKFLOW TRANSITIONS (core business logic)
// ═══════════════════════════════════════════════════════════

// Quand un devis est accepté → crée automatiquement le contrat
export async function acceptQuote(quoteId: number, triggeredBy = "client") {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { client: true },
  });

  // 1. Marquer devis accepté
  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "accepted", acceptedAt: new Date() },
  });

  // 2. Générer numéro de contrat
  const year = new Date().getFullYear();
  const lastContract = await prisma.contract.findFirst({
    where: { contractNumber: { startsWith: `CT-${year}-` } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = lastContract
    ? Number(lastContract.contractNumber.split("-")[2]) + 1
    : 1;
  const contractNumber = `CT-${year}-${String(nextSeq).padStart(3, "0")}`;

  // 3. Créer contrat
  const contract = await prisma.contract.create({
    data: {
      clientId: quote.clientId,
      quoteId: quote.id,
      contractNumber,
      title: `Contrat de service — ${quote.title}`,
      status: "pending",
      amountTtc: quote.amountTtc,
    },
  });

  // 4. Auto-générer le document pour le devis accepté
  await prisma.document.create({
    data: {
      clientId: quote.clientId,
      title: `Devis ${quote.quoteNumber} — ${quote.title}`,
      fileUrl: `/api/quotes/${quote.id}/pdf`,
      fileType: "pdf",
      category: "Devis",
      uploadedBy: "system",
      isRead: false,
    },
  });

  // 5. Workflow events
  const acceptedBy = triggeredBy === "client" ? (quote.client?.fullName ?? "client") : triggeredBy;
  await createWorkflowEvent({
    clientId: quote.clientId,
    quoteId: quote.id,
    eventType: "quote_accepted",
    eventLabel: `Devis ${quote.quoteNumber} accepté par ${acceptedBy}`,
    triggeredBy,
  });
  await createWorkflowEvent({
    clientId: quote.clientId,
    quoteId: quote.id,
    contractId: contract.id,
    eventType: "contract_created",
    eventLabel: `Contrat ${contractNumber} généré automatiquement`,
    triggeredBy: "system",
  });

  return { quote, contract };
}

// Quand un contrat est signé par les deux parties → génère la première facture
export async function onContractFullySigned(
  contractId: number,
  triggeredBy = "system"
) {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { quote: true, client: true },
  });

  if (!contract.quote) return;

  // Calcul selon payment plan
  const plan = contract.quote.paymentPlan ?? "split_50_50";
  const pct1 = contract.quote.paymentPct1 ?? 50;
  const totalTtc = Number(contract.quote.amountTtc);
  const firstAmount = (totalTtc * pct1) / 100;

  // Générer numéro de facture
  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `F-${year}-` } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.invoiceNumber.split("-")[2]) + 1 : 1;
  const invoiceNumber = `F-${year}-${String(nextSeq).padStart(3, "0")}`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const ht = firstAmount / 1.14975; // approximation
  const tps = ht * 0.05;
  const tvq = ht * 0.09975;

  const invoice = await prisma.invoice.create({
    data: {
      clientId: contract.clientId,
      contractId: contract.id,
      quoteId: contract.quoteId,
      invoiceNumber,
      title: `${contract.title} — ${plan === "full" ? "Paiement complet" : `Acompte ${pct1}%`}`,
      amountHt: ht,
      tpsAmount: tps,
      tvqAmount: tvq,
      amountTtc: firstAmount,
      status: "unpaid",
      dueDate,
      invoicePhase: plan === "full" ? "full" : "deposit",
      phaseNumber: 1,
    },
  });

  // Auto-générer le document pour le contrat signé
  await prisma.document.create({
    data: {
      clientId: contract.clientId,
      title: `Contrat ${contract.contractNumber} — ${contract.title}`,
      fileUrl: `/api/contracts/${contract.id}/pdf`,
      fileType: "pdf",
      category: "Contrats",
      uploadedBy: "system",
      isRead: false,
    },
  });

  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    invoiceId: invoice.id,
    eventType: "invoice_created",
    eventLabel: `Facture ${invoiceNumber} générée — ${firstAmount.toFixed(2)} $`,
    triggeredBy,
  });

  return invoice;
}

// Crée la facture de SOLDE (phase 2) d'un contrat dont l'acompte (phase 1) a été facturé.
// Déclenché manuellement par admin via /api/contracts/[id]/create-balance-invoice
// (typiquement à la livraison des travaux).
export async function createBalanceInvoice(contractId: number, triggeredBy = "admin") {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      quote: true,
      invoices: { orderBy: { phaseNumber: "asc" } },
    },
  });

  if (!contract.quote) {
    throw new Error("Contrat sans devis lié — impossible de générer un solde");
  }
  const plan = contract.quote.paymentPlan ?? "split_50_50";
  if (plan === "full") {
    throw new Error("Devis en paiement unique — pas de solde à émettre");
  }

  // Vérifie qu'il n'y a pas déjà une phase 2
  const existingBalance = contract.invoices.find((i) => i.phaseNumber === 2);
  if (existingBalance) {
    throw new Error(`Facture de solde déjà émise (${existingBalance.invoiceNumber})`);
  }

  // Vérifie que l'acompte (phase 1) est bien payé
  const deposit = contract.invoices.find((i) => i.phaseNumber === 1);
  if (!deposit) {
    throw new Error("Aucune facture d'acompte (phase 1) — anomalie");
  }
  if (deposit.status !== "paid") {
    throw new Error("Acompte non payé — solde non émissible pour l'instant");
  }

  const pct2 = contract.quote.paymentPct2 ?? 50;
  const totalTtc = Number(contract.quote.amountTtc);
  const balanceAmount = (totalTtc * pct2) / 100;

  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `F-${year}-` } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.invoiceNumber.split("-")[2]) + 1 : 1;
  const invoiceNumber = `F-${year}-${String(nextSeq).padStart(3, "0")}`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const ht = balanceAmount / 1.14975;
  const tps = ht * 0.05;
  const tvq = ht * 0.09975;

  const invoice = await prisma.invoice.create({
    data: {
      clientId: contract.clientId,
      contractId: contract.id,
      quoteId: contract.quoteId,
      invoiceNumber,
      title: `${contract.title} — Solde ${pct2}%`,
      amountHt: ht,
      tpsAmount: tps,
      tvqAmount: tvq,
      amountTtc: balanceAmount,
      status: "unpaid",
      dueDate,
      invoicePhase: "balance",
      phaseNumber: 2,
    },
  });

  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    invoiceId: invoice.id,
    eventType: "invoice_created",
    eventLabel: `Facture de solde ${invoiceNumber} générée — ${balanceAmount.toFixed(2)} $`,
    triggeredBy,
  });

  return invoice;
}

// Quand une facture est payée → créer l'événement + notifier
export async function markInvoicePaid(
  invoiceId: number,
  paymentMethod: string,
  stripePaymentIntentId?: string
) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paidAt: new Date(),
      paymentMethod,
      stripePaymentIntentId,
    },
  });

  // Capture du taux FX au moment du paiement (pour audit IFRS / ARC)
  const { convertToCAD } = await import("./services/fx");
  const fxResult = await convertToCAD(Number(invoice.amountTtc), invoice.currency, new Date()).catch(() => null);

  // Cast en any le temps que `prisma generate` régénère le client avec les nouveaux champs FX
  const paymentData: Record<string, unknown> = {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    amount: invoice.amountTtc,
    currency: invoice.currency.toLowerCase(),
    status: "succeeded",
    paymentMethod,
    stripePaymentIntentId,
    paidAt: new Date(),
  };
  if (fxResult) {
    paymentData.amountCad = fxResult.amountCad;
    paymentData.fxRate = fxResult.quote.rate;
    paymentData.fxRateSource = fxResult.quote.source;
    paymentData.fxRateDate = new Date(fxResult.quote.date);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = await prisma.payment.create({ data: paymentData as any });

  // Auto-générer le document pour la facture payée
  await prisma.document.create({
    data: {
      clientId: invoice.clientId,
      title: `Facture ${invoice.invoiceNumber} — ${invoice.title}`,
      fileUrl: `/api/invoices/${invoice.id}/pdf`,
      fileType: "pdf",
      category: "Factures",
      uploadedBy: "system",
      isRead: false,
    },
  });

  await createWorkflowEvent({
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    eventType: "invoice_paid",
    eventLabel: `Paiement reçu — ${invoice.invoiceNumber}`,
    triggeredBy: stripePaymentIntentId ? "stripe" : "admin",
  });

  // Génération + envoi auto du reçu de paiement par email au client
  sendPaymentReceipt(payment.id).catch((err) =>
    console.error("[markInvoicePaid] receipt send failed:", err)
  );

  return invoice;
}

// Envoi async du reçu de paiement (PDF + email) — non bloquant
// Exportee pour permettre le renvoi manuel depuis /admin/finance/receipts
export async function sendPaymentReceipt(paymentId: number) {
  const { generateReceiptPdf, localeToDocLang } = await import("./services/pdf");
  const { sendEmail } = await import("./services/email");
  const { logEmailEvent } = await import("./request-context");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      client: true,
      invoice: { select: { invoiceNumber: true, title: true } },
    },
  });
  if (!payment || !payment.client || !payment.client.email) return;
  const client = payment.client; // narrow non-null

  const lang = localeToDocLang(client.locale);
  const isEn = lang === "en";
  const receiptNumber = `R-${new Date(payment.paidAt ?? payment.createdAt).getFullYear()}-${String(payment.id).padStart(5, "0")}`;
  const amount = Number(payment.amount).toFixed(2);

  const pdfBuf = await generateReceiptPdf({
    receiptNumber,
    invoiceNumber: payment.invoice?.invoiceNumber,
    invoiceTitle: payment.invoice?.title,
    client: {
      fullName: client.fullName,
      companyName: client.companyName ?? undefined,
      email: client.email,
    },
    amount: Number(payment.amount),
    paymentMethod: payment.paymentMethod ?? "Stripe",
    stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
    paidAt: payment.paidAt ?? payment.createdAt,
    lang,
  });

  const subject = isEn
    ? `Payment receipt ${receiptNumber} — ${amount} CAD`
    : `Reçu de paiement ${receiptNumber} — ${amount} CAD`;

  const html = isEn
    ? `<p>Hi ${client.fullName},</p>
       <p>Thank you for your payment of <strong>${amount} CAD</strong>${payment.invoice ? ` for invoice <strong>${payment.invoice.invoiceNumber}</strong>` : ""}.</p>
       <p>Please find the receipt attached for your records.</p>
       <p>— VNK Automatisation Inc.</p>`
    : `<p>Bonjour ${client.fullName},</p>
       <p>Merci pour votre paiement de <strong>${amount} CAD</strong>${payment.invoice ? ` pour la facture <strong>${payment.invoice.invoiceNumber}</strong>` : ""}.</p>
       <p>Veuillez trouver le reçu en pièce jointe pour vos archives.</p>
       <p>— VNK Automatisation Inc.</p>`;

  const result = await sendEmail({
    to: client.email,
    subject,
    html,
    attachments: [{
      filename: `${receiptNumber}.pdf`,
      content: pdfBuf,
      contentType: "application/pdf",
    }],
  });

  await logEmailEvent({
    clientId: payment.clientId,
    type: result.ok ? "sent" : "failed",
    email: client.email,
    subject,
    metadata: { type: "payment_receipt", paymentId, receiptNumber, error: result.ok ? undefined : result.error },
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════
// OUTGOING WEBHOOKS (signed HMAC payload)
// ═══════════════════════════════════════════════════════════

async function fireOutgoingWebhooks(
  eventType: WorkflowEventType,
  event: { id: number; createdAt: Date; metadata: unknown }
) {
  const hooks = await prisma.outgoingWebhook.findMany({
    where: {
      isEnabled: true,
      events: { has: eventType },
    },
  });

  for (const hook of hooks) {
    try {
      const payload = JSON.stringify({
        type: eventType,
        timestamp: event.createdAt.toISOString(),
        data: event,
      });
      // TODO: HMAC signing with hook.secret
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VNK-Event": eventType,
        },
        body: payload,
      });
      await prisma.outgoingWebhook.update({
        where: { id: hook.id },
        data: { lastFireAt: new Date(), lastStatus: res.status },
      });
    } catch (e) {
      await prisma.outgoingWebhook.update({
        where: { id: hook.id },
        data: { failCount: { increment: 1 } },
      });
    }
  }
}
