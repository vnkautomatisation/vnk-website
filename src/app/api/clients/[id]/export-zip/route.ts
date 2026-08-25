// GET /api/clients/[id]/export-zip — telecharge le dossier complet du client en ZIP
// Structure du ZIP :
//   00-README.txt
//   01-identite-fiche-client.json
//   02-devis/D-XXX.pdf
//   03-contrats/CT-XXX.pdf
//   04-factures/F-XXX.pdf
//   05-paiements.pdf + 05-paiements.csv
//   06-documents/<nom>
//   07-conversation.pdf + 07-conversation.csv
//   08-rendez-vous.pdf + 08-rendez-vous.csv
//   09-litiges.pdf + 09-litiges.csv
//   10-audit-events.pdf + 10-audit-events.csv
//   11-pieces-jointes-messages/<nom>
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateInvoicePdf, generateQuotePdf, generateContractPdf } from "@/lib/services/pdf";
import {
  generateConversationPdf,
  generateAppointmentsPdf,
  generateDisputesPdf,
  generateAuditPdf,
  generatePaymentsPdf,
  generateFicheClientPdf,
  getDict,
  type ExportLang,
} from "@/lib/services/pdf-export";

type AttachmentJson = {
  kind: "image" | "audio" | "pdf" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  durationSec?: number;
};

function safeContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function safeFileName(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 200);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : v instanceof Date ? v.toISOString() : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvFromRows(rows: (string | number | Date | null | undefined)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\n");
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!match) return null;
  return { mime: match[1], buf: Buffer.from(match[2], "base64") };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("clients", "read")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const clientId = Number(id);
  if (!clientId) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  // Locale d'export (?lang=fr|en)
  const url = new URL(req.url);
  const langParam = url.searchParams.get("lang");
  const lang: ExportLang = langParam === "en" ? "en" : "fr";
  const t = getDict(lang);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      mandates: true,
      quotes: true,
      contracts: true,
      invoices: true,
      payments: true,
      refunds: true,
      disputes: true,
      documents: true,
      messages: { orderBy: { createdAt: "asc" } },
      appointments: { orderBy: { startTime: "asc" } },
      workflowEvents: { orderBy: { createdAt: "desc" }, take: 500 },
    },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const zip = new JSZip();
  const today = new Date().toISOString().slice(0, 10);
  const folderBase = `dossier-${safeFileName(client.fullName)}-${today}`;

  // ─── 00 README ─────────────────────────────────────────
  const isEn = lang === "en";
  const labels = isEn
    ? { client: "Client", company: "Company", email: "Email", phone: "Phone",
        address: "Address", sector: "Sector", created: "Account created",
        lastLogin: "Last login",
        ficheLine: "Executive summary of the file (read first)",
        identityLine: "Raw snapshot of all client data",
        quotesLine: (n: number) => `${n} quote(s) (PDF)`,
        contractsLine: (n: number) => `${n} contract(s) (PDF)`,
        invoicesLine: (n: number) => `${n} invoice(s) (PDF)`,
        paymentsLine: (n: number, r: number) => `${n} payments + ${r} refunds`,
        documentsLine: (n: number) => `${n} shared documents`,
        messagesLine: (n: number) => `${n} messages (chat + email, PDF with bubbles + images)`,
        apptsLine: (n: number) => `${n} appointments`,
        disputesLine: (n: number) => `${n} disputes (with internal notes + legal details)`,
        auditLine: "Full unified timeline (login, payment, signature, consent, email, audit, workflow)",
        attachLine: "Files exchanged via chat" }
    : { client: "Client", company: "Entreprise", email: "Courriel", phone: "Téléphone",
        address: "Adresse", sector: "Secteur", created: "Compte créé",
        lastLogin: "Dernière connexion",
        ficheLine: "Synthèse exécutive du dossier (à lire en premier)",
        identityLine: "Snapshot brut de toutes les données du client",
        quotesLine: (n: number) => `${n} devis (PDF)`,
        contractsLine: (n: number) => `${n} contrats (PDF)`,
        invoicesLine: (n: number) => `${n} factures (PDF)`,
        paymentsLine: (n: number, r: number) => `${n} paiements + ${r} remboursements`,
        documentsLine: (n: number) => `${n} documents partagés`,
        messagesLine: (n: number) => `${n} messages (chat + email, PDF avec bulles + images)`,
        apptsLine: (n: number) => `${n} rendez-vous`,
        disputesLine: (n: number) => `${n} litiges (avec notes internes + détails juridiques)`,
        auditLine: "Timeline complète unifiée (login, paiement, signature, consentement, email, audit, workflow)",
        attachLine: "Fichiers échangés via le chat" };

  const readme = [
    t.readmeTitle,
    ``,
    `${labels.client} : ${client.fullName}`,
    `${labels.company} : ${client.companyName ?? "—"}`,
    `${labels.email} : ${client.email}`,
    `${labels.phone} : ${client.phone ?? "—"}`,
    `${labels.address} : ${[client.address, client.city, client.province, client.postalCode].filter(Boolean).join(", ") || "—"}`,
    `${labels.sector} : ${client.sector ?? "—"}`,
    `${labels.created} : ${client.createdAt.toISOString().slice(0, 10)}`,
    `${labels.lastLogin} : ${client.lastLogin?.toISOString().slice(0, 10) ?? "—"}`,
    ``,
    `─── ${t.readmeContent} ─────────────────────────────`,
    `01-fiche-client.pdf               ${labels.ficheLine}`,
    `01-identite-fiche-client.json     ${labels.identityLine}`,
    `02-devis/                         ${labels.quotesLine(client.quotes.length)}`,
    `03-contrats/                      ${labels.contractsLine(client.contracts.length)}`,
    `04-factures/                      ${labels.invoicesLine(client.invoices.length)}`,
    `05-paiements.pdf + .csv           ${labels.paymentsLine(client.payments.length, client.refunds.length)}`,
    `06-documents/                     ${labels.documentsLine(client.documents.length)}`,
    `07-conversation.pdf + .csv        ${labels.messagesLine(client.messages.length)}`,
    `08-rendez-vous.pdf + .csv         ${labels.apptsLine(client.appointments.length)}`,
    `09-litiges.pdf + .csv             ${labels.disputesLine(client.disputes.length)}`,
    `10-audit-events.pdf + .csv        ${labels.auditLine}`,
    `11-pieces-jointes-messages/       ${labels.attachLine}`,
    ``,
    `${t.readmeExportedOn} : ${new Date().toISOString()}`,
    `${t.readmeExportedBy} : ${session.user.email ?? "admin"}`,
  ].join("\n");
  zip.file(`${folderBase}/00-README.txt`, readme);

  // ─── 01 Identité ───────────────────────────────────────
  const identitySnapshot = {
    id: client.id,
    fullName: client.fullName,
    email: client.email,
    phone: client.phone,
    companyName: client.companyName,
    address: client.address,
    city: client.city,
    province: client.province,
    postalCode: client.postalCode,
    country: client.country,
    sector: client.sector,
    technologies: client.technologies,
    avatarUrl: client.avatarUrl,
    isActive: client.isActive,
    archived: client.archived,
    storageQuotaMb: client.storageQuotaMb,
    twoFactorEnabled: client.twoFactorEnabled,
    lastLogin: client.lastLogin,
    lastSeenAt: client.lastSeenAt,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    chatLabels: client.chatLabels,
    chatPinned: client.chatPinned,
    chatArchivedAt: client.chatArchivedAt,
    internalNotes: client.internalNotes,
  };
  zip.file(`${folderBase}/01-identite-fiche-client.json`, JSON.stringify(identitySnapshot, null, 2));

  // PDF synthese executive en tete du dossier
  try {
    const totalSpentTtc = Number(client.totalSpentTtc ?? 0)
      || client.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amountTtc), 0);
    const openBalanceTtc = Number(client.openBalanceTtc ?? 0)
      || client.invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + Number(i.amountTtc), 0);

    const recentInvoices = [...client.invoices]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((i) => ({
        invoiceNumber: i.invoiceNumber, title: i.title,
        amountTtc: Number(i.amountTtc), status: i.status, createdAt: i.createdAt,
      }));
    const recentContracts = [...client.contracts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((c) => ({
        contractNumber: c.contractNumber, title: c.title,
        status: c.status, signedAt: c.signedAt,
      }));
    const activeDisputes = client.disputes
      .filter((d) => d.status !== "resolved" && d.status !== "closed")
      .map((d) => ({
        title: d.title, status: d.status, openedAt: d.openedAt,
        amountDisputed: d.amountDisputed != null ? Number(d.amountDisputed) : null,
      }));

    const pdfBuf = await generateFicheClientPdf({
      client: {
        fullName: client.fullName, email: client.email, phone: client.phone,
        companyName: client.companyName, address: client.address, city: client.city,
        province: client.province, postalCode: client.postalCode,
        sector: client.sector, technologies: client.technologies,
        createdAt: client.createdAt, lastLogin: client.lastLogin,
        internalNotes: client.internalNotes,
      },
      totals: {
        mandates: client.mandates.length, quotes: client.quotes.length,
        contracts: client.contracts.length, invoices: client.invoices.length,
        documents: client.documents.length, messages: client.messages.length,
        appointments: client.appointments.length, disputes: client.disputes.length,
        totalSpentTtc, openBalanceTtc,
      },
      recentInvoices, recentContracts, activeDisputes,
      lang,
    });
    zip.file(`${folderBase}/01-fiche-client.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF fiche-client err:", e); }

  // ─── 02 Devis ──────────────────────────────────────────
  for (const q of client.quotes) {
    try {
      const pdf = await generateQuotePdf({
        quoteNumber: q.quoteNumber,
        title: q.title,
        description: q.description ?? undefined,
        client: {
          fullName: client.fullName,
          companyName: client.companyName ?? undefined,
          email: client.email,
          address: client.address ?? undefined,
        },
        amountHt: Number(q.amountHt),
        tpsAmount: Number(q.tpsAmount),
        tvqAmount: Number(q.tvqAmount),
        amountTtc: Number(q.amountTtc),
        createdAt: q.createdAt,
        expiryDate: q.expiryDate ?? undefined,
        paymentConditions: q.paymentConditions ?? undefined,
        status: q.status,
        serviceType: q.serviceType,
        clientSignatureData: q.clientSignatureData,
        signedAt: q.signedAt,
        acceptedAt: q.acceptedAt,
        lang,
      });
      zip.file(`${folderBase}/02-devis/${safeFileName(q.quoteNumber)}.pdf`, new Uint8Array(pdf));
    } catch (e) { console.error("PDF devis err:", e); }
  }

  // ─── 03 Contrats ───────────────────────────────────────
  for (const c of client.contracts) {
    try {
      const pdf = await generateContractPdf({
        contractNumber: c.contractNumber,
        title: c.title,
        content: c.content ?? undefined,
        client: {
          fullName: client.fullName,
          companyName: client.companyName ?? undefined,
          email: client.email,
          address: client.address ?? undefined,
          city: client.city ?? undefined,
          province: client.province ?? undefined,
          postalCode: client.postalCode ?? undefined,
        },
        amountTtc: c.amountTtc != null ? Number(c.amountTtc) : undefined,
        createdAt: c.createdAt,
        clientSignatureData: c.clientSignatureData,
        clientSignatureIp: c.clientSignatureIp,
        adminSignatureData: c.adminSignatureData,
        adminSignedAt: c.adminSignedAt,
        signedAt: c.signedAt,
        lang,
      });
      zip.file(`${folderBase}/03-contrats/${safeFileName(c.contractNumber)}.pdf`, new Uint8Array(pdf));
    } catch (e) { console.error("PDF contrat err:", e); }
  }

  // ─── 04 Factures ───────────────────────────────────────
  for (const i of client.invoices) {
    try {
      const pdf = await generateInvoicePdf({
        invoiceNumber: i.invoiceNumber,
        title: i.title,
        description: i.description ?? undefined,
        client: {
          fullName: client.fullName,
          companyName: client.companyName ?? undefined,
          email: client.email,
          address: client.address ?? undefined,
          city: client.city ?? undefined,
          province: client.province ?? undefined,
          postalCode: client.postalCode ?? undefined,
        },
        amountHt: Number(i.amountHt),
        tpsAmount: Number(i.tpsAmount),
        tvqAmount: Number(i.tvqAmount),
        amountTtc: Number(i.amountTtc),
        createdAt: i.createdAt,
        dueDate: i.dueDate ?? undefined,
        paidAt: i.paidAt,
        status: i.status,
        serviceType: i.serviceType,
        invoicePhase: i.invoicePhase,
        phaseNumber: i.phaseNumber,
        lang,
      });
      zip.file(`${folderBase}/04-factures/${safeFileName(i.invoiceNumber)}.pdf`, new Uint8Array(pdf));
    } catch (e) { console.error("PDF facture err:", e); }
  }

  // ─── 05 Paiements + remboursements ─────────────────────
  const payTypeLabel = isEn ? "Payment" : "Paiement";
  const refundTypeLabel = isEn ? "Refund" : "Remboursement";
  const invoiceIdLabel = isEn ? "Invoice ID" : "Facture ID";
  const paiementsRows: (string | number | Date | null | undefined)[][] = [
    t.csvPayments,
    ...client.payments.map((p) => [
      payTypeLabel, p.paidAt ?? p.createdAt, Number(p.amount), p.currency, p.paymentMethod ?? "—",
      p.status, p.stripePaymentIntentId ?? "—", `${invoiceIdLabel} ${p.invoiceId ?? "—"}`,
    ]),
    ...client.refunds.map((r) => [
      refundTypeLabel, r.processedAt ?? r.createdAt, -Number(r.amount), "CAD", "Stripe",
      r.status, r.stripeRefundId ?? "—", r.reason ?? "—",
    ]),
  ];
  zip.file(`${folderBase}/05-paiements.csv`, csvFromRows(paiementsRows));

  // PDF paiements (releve avec totaux)
  try {
    const paymentsPdfRows = [
      ...client.payments.map((p) => ({
        type: "Paiement" as const,
        date: p.paidAt ?? p.createdAt,
        amount: Number(p.amount),
        currency: p.currency || "CAD",
        method: p.paymentMethod ?? null,
        status: p.status,
        stripeId: p.stripePaymentIntentId ?? null,
        description: `Facture ID ${p.invoiceId ?? "—"}`,
      })),
      ...client.refunds.map((r) => ({
        type: "Remboursement" as const,
        date: r.processedAt ?? r.createdAt,
        amount: Number(r.amount),
        currency: "CAD",
        method: "Stripe" as const,
        status: r.status,
        stripeId: r.stripeRefundId ?? null,
        description: r.reason ?? "—",
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const pdfBuf = await generatePaymentsPdf({
      client: { fullName: client.fullName, email: client.email },
      rows: paymentsPdfRows,
      lang,
    });
    zip.file(`${folderBase}/05-paiements.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF paiements err:", e); }

  // ─── 06 Documents ──────────────────────────────────────
  for (const doc of client.documents) {
    if (!doc.fileUrl) continue;
    if (doc.fileUrl.startsWith("data:")) {
      const decoded = dataUrlToBuffer(doc.fileUrl);
      if (decoded) {
        const fname = safeFileName(doc.fileName ?? `${doc.title}.${doc.fileType ?? "bin"}`);
        zip.file(`${folderBase}/06-documents/${fname}`, new Uint8Array(decoded.buf));
      }
    } else if (doc.fileUrl.startsWith("/api/")) {
      // doc dynamique deja inclus en 02/03/04 — on saute pour pas dupliquer
    }
  }

  // ─── 07 Conversation ───────────────────────────────────
  const yesLabel = isEn ? "Yes" : "Oui";
  const noLabel = isEn ? "No" : "Non";
  const convRows: (string | number | Date | null | undefined)[][] = [
    t.csvConversation,
    ...client.messages.filter((m) => !m.deletedAt).map((m) => {
      const atts = (m.attachmentsData as AttachmentJson[] | null) ?? (m.attachmentData ? [m.attachmentData as AttachmentJson] : []);
      const attNames = atts.map((a) => a?.name ?? "?").join(" | ");
      return [
        m.createdAt.toISOString().slice(0, 10),
        m.createdAt.toISOString().slice(11, 16),
        m.sender === "vnk" ? "VNK (admin)" : (client.fullName ?? "Client"),
        m.channel,
        m.isInternalNote ? yesLabel : noLabel,
        m.content ?? "",
        attNames,
      ];
    }),
  ];
  zip.file(`${folderBase}/07-conversation.csv`, csvFromRows(convRows));

  // PDF conversation (chat-style avec bulles + images embarquees)
  try {
    const convMessages = client.messages.filter((m) => !m.deletedAt).map((m) => {
      const atts = (m.attachmentsData as AttachmentJson[] | null) ?? (m.attachmentData ? [m.attachmentData as AttachmentJson] : []);
      return {
        id: m.id,
        createdAt: m.createdAt,
        sender: m.sender,
        channel: m.channel,
        content: m.content,
        isInternalNote: m.isInternalNote,
        deletedAt: m.deletedAt,
        editedAt: m.editedAt ?? null,
        attachments: atts.filter(Boolean),
      };
    });
    const pdfBuf = await generateConversationPdf({
      client: { fullName: client.fullName, email: client.email, companyName: client.companyName },
      messages: convMessages,
      lang,
    });
    zip.file(`${folderBase}/07-conversation.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF conversation err:", e); }

  // ─── 08 Rendez-vous ────────────────────────────────────
  const rdvRows: (string | number | Date | null | undefined)[][] = [
    t.csvAppointments,
    ...client.appointments.map((a) => [
      a.appointmentDate, a.startTime, a.endTime, a.subject ?? "", a.status,
      a.meetingType, a.notesAdmin ?? "",
    ]),
  ];
  zip.file(`${folderBase}/08-rendez-vous.csv`, csvFromRows(rdvRows));

  try {
    const pdfBuf = await generateAppointmentsPdf({
      client: { fullName: client.fullName, email: client.email },
      appointments: client.appointments.map((a) => ({
        appointmentDate: a.appointmentDate,
        startTime: a.startTime,
        endTime: a.endTime,
        subject: a.subject,
        status: a.status,
        meetingType: a.meetingType,
        notesAdmin: a.notesAdmin,
      })),
      lang,
    });
    zip.file(`${folderBase}/08-rendez-vous.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF rdv err:", e); }

  // ─── 09 Litiges ────────────────────────────────────────
  const disputesRows: (string | number | Date | null | undefined)[][] = [
    t.csvDisputes,
    ...client.disputes.map((d) => [
      d.openedAt, d.type, d.title, d.status, d.priority,
      d.amountDisputed != null ? Number(d.amountDisputed) : "",
      d.stripeDisputeId ?? "", d.stripeReason ?? "", d.outcome ?? "",
      d.assignedTo ?? "", d.resolvedAt ?? "", d.resolution ?? "",
    ]),
  ];
  zip.file(`${folderBase}/09-litiges.csv`, csvFromRows(disputesRows));

  try {
    // Map invoice id -> number pour reference croisee
    const invoiceMap = new Map(client.invoices.map((i) => [i.id, i.invoiceNumber]));

    const pdfBuf = await generateDisputesPdf({
      client: {
        fullName: client.fullName, email: client.email, phone: client.phone,
        companyName: client.companyName, address: client.address, city: client.city,
        province: client.province, postalCode: client.postalCode,
      },
      disputes: client.disputes.map((d) => ({
        openedAt: d.openedAt,
        type: d.type,
        category: d.category,
        title: d.title,
        description: d.description,
        status: d.status,
        priority: d.priority,
        amountDisputed: d.amountDisputed != null ? Number(d.amountDisputed) : null,
        currency: d.currency,
        stripeDisputeId: d.stripeDisputeId,
        stripeReason: d.stripeReason,
        outcome: d.outcome,
        evidenceDueBy: d.evidenceDueBy,
        assignedTo: d.assignedTo,
        internalNotes: d.internalNotes,
        resolution: d.resolution,
        resolvedAt: d.resolvedAt,
        lawFirmInvolved: d.lawFirmInvolved,
        caseNumber: d.caseNumber,
        tribunal: d.tribunal,
        invoiceId: d.invoiceId,
        invoiceNumber: d.invoiceId ? invoiceMap.get(d.invoiceId) ?? null : null,
      })),
      lang,
    });
    zip.file(`${folderBase}/09-litiges.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF litiges err:", e); }

  // ─── 10 Audit / Timeline unifiee (7 sources) ───────────
  const [logins, orders, sigs, consents, emails] = await Promise.all([
    prisma.loginEvent.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.orderEvent.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.signatureEvent.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.consentLog.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.emailEvent.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  type UnifiedEvt = { createdAt: Date; source: string; type: string; label: string; ipAddress: string | null; userAgent: string | null; metadata?: unknown };
  // Substitue retroactivement "par (le )?client" -> nom client dans les vieux labels
  const humanizeWfLabel = (label: string | null): string => {
    const fallback = label ?? "";
    if (!fallback) return "";
    return fallback
      .replace(/\bpar le client\b/gi, `par ${client.fullName}`)
      .replace(/\bau client\b/gi, `à ${client.fullName}`)
      .replace(/\bdu client\b/gi, `de ${client.fullName}`)
      .replace(/\bpar client\b/gi, `par ${client.fullName}`);
  };
  const unified: UnifiedEvt[] = [
    ...client.workflowEvents.map((w) => ({
      createdAt: w.createdAt, source: "workflow", type: w.eventType,
      label: humanizeWfLabel(w.eventLabel) || w.eventType, ipAddress: null, userAgent: null,
      metadata: w.metadata as unknown,
    })),
    ...logins.map((l) => ({
      createdAt: l.createdAt, source: "login", type: l.type,
      label: `${l.type === "success" ? "Connexion réussie" : l.type === "failed" ? "Échec connexion" : l.type === "logout" ? "Déconnexion" : l.type} — ${l.email}${l.reason ? ` (${l.reason})` : ""}`,
      ipAddress: l.ipAddress, userAgent: l.userAgent,
      metadata: { country: l.country, city: l.city, deviceType: l.deviceType },
    })),
    ...orders.map((o) => ({
      createdAt: o.createdAt, source: "order", type: o.type,
      label: `${o.type}${o.amount ? ` — ${Number(o.amount).toFixed(2)} ${o.currency ?? "CAD"}` : ""}`,
      ipAddress: o.ipAddress, userAgent: o.userAgent,
      metadata: { stripeIntentId: o.stripeIntentId, paymentMethod: o.paymentMethod },
    })),
    ...sigs.map((s) => ({
      createdAt: s.createdAt, source: "signature", type: `${s.entityType}_signed`,
      label: `Signature ${s.entityType} #${s.entityId} par ${s.signedBy}${s.rfc3161Token ? " (RFC 3161)" : ""}`,
      ipAddress: s.ipAddress, userAgent: s.userAgent,
      metadata: { hash: s.signatureHash?.slice(0, 16) },
    })),
    ...consents.map((c) => ({
      createdAt: c.createdAt, source: "consent", type: c.consentType,
      label: `Consentement ${c.consentType} ${c.granted ? "accepté" : "refusé"} v${c.version}`,
      ipAddress: c.ipAddress, userAgent: c.userAgent,
      metadata: { source: c.source },
    })),
    ...emails.map((e) => ({
      createdAt: e.createdAt, source: "email", type: e.type,
      label: `Email ${e.type}${e.subject ? ` : ${e.subject}` : ""} → ${e.email}`,
      ipAddress: e.ipAddress, userAgent: e.userAgent,
      metadata: { messageId: e.messageId, link: e.link },
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const auditRows: (string | number | Date | null | undefined)[][] = [
    t.csvAudit,
    ...unified.map((u) => [u.createdAt, u.source, u.type, u.label, u.ipAddress ?? "", u.userAgent ?? ""]),
  ];
  zip.file(`${folderBase}/10-audit-events.csv`, csvFromRows(auditRows));

  try {
    const pdfBuf = await generateAuditPdf({
      client: { fullName: client.fullName, email: client.email },
      events: unified,
      lang,
    });
    zip.file(`${folderBase}/10-audit-events.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF audit err:", e); }

  // ─── 11 Pièces jointes des messages ────────────────────
  let attCounter = 0;
  for (const m of client.messages) {
    if (m.deletedAt) continue;
    const atts = (m.attachmentsData as AttachmentJson[] | null) ?? (m.attachmentData ? [m.attachmentData as AttachmentJson] : []);
    for (const att of atts) {
      if (!att?.dataUrl) continue;
      const decoded = dataUrlToBuffer(att.dataUrl);
      if (!decoded) continue;
      attCounter++;
      const datePart = m.createdAt.toISOString().slice(0, 10);
      const senderPart = m.sender === "vnk" ? "VNK" : "client";
      const fname = safeFileName(`${datePart}-${senderPart}-${att.name || `attachment-${attCounter}`}`);
      zip.file(`${folderBase}/11-pieces-jointes-messages/${fname}`, new Uint8Array(decoded.buf));
    }
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "export",
    entityType: "clients",
    entityId: clientId,
    changes: { type: "zip_full_dossier" },
  });

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const zipName = `${folderBase}.zip`;
  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": safeContentDisposition(zipName),
      "Content-Length": String(zipBuffer.length),
    },
  });
}

