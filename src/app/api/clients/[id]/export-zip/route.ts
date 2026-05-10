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
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateInvoicePdf, generateQuotePdf, generateContractPdf } from "@/lib/services/pdf";
import {
  generateConversationPdf,
  generateAppointmentsPdf,
  generateDisputesPdf,
  generateAuditPdf,
  generatePaymentsPdf,
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const clientId = Number(id);
  if (!clientId) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

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
  const readme = [
    `Dossier client complet — VNK Automatisation`,
    ``,
    `Client : ${client.fullName}`,
    `Entreprise : ${client.companyName ?? "—"}`,
    `Courriel : ${client.email}`,
    `Téléphone : ${client.phone ?? "—"}`,
    `Adresse : ${[client.address, client.city, client.province, client.postalCode].filter(Boolean).join(", ") || "—"}`,
    `Secteur : ${client.sector ?? "—"}`,
    `Compte créé : ${client.createdAt.toISOString().slice(0, 10)}`,
    `Dernière connexion : ${client.lastLogin?.toISOString().slice(0, 10) ?? "—"}`,
    ``,
    `─── CONTENU DU DOSSIER ─────────────────────────────`,
    `01-identite-fiche-client.json     Profil complet (toutes données du client)`,
    `02-devis/                         ${client.quotes.length} devis (PDF)`,
    `03-contrats/                      ${client.contracts.length} contrats (PDF)`,
    `04-factures/                      ${client.invoices.length} factures (PDF)`,
    `05-paiements.pdf + .csv           ${client.payments.length} paiements + ${client.refunds.length} remboursements`,
    `06-documents/                     ${client.documents.length} documents partagés`,
    `07-conversation.pdf + .csv        ${client.messages.length} messages (chat + email, PDF avec bulles + images)`,
    `08-rendez-vous.pdf + .csv         ${client.appointments.length} rendez-vous`,
    `09-litiges.pdf + .csv             ${client.disputes.length} litiges (avec notes internes + détails juridiques)`,
    `10-audit-events.pdf + .csv        Timeline complète unifiée (login, paiement, signature, consentement, email, audit, workflow)`,
    `11-pieces-jointes-messages/       Fichiers échangés via le chat`,
    ``,
    `Exporté le : ${new Date().toISOString()}`,
    `Exporté par : ${session.user.email ?? "admin"}`,
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
      });
      zip.file(`${folderBase}/04-factures/${safeFileName(i.invoiceNumber)}.pdf`, new Uint8Array(pdf));
    } catch (e) { console.error("PDF facture err:", e); }
  }

  // ─── 05 Paiements + remboursements ─────────────────────
  const paiementsRows: (string | number | Date | null | undefined)[][] = [
    ["Type", "Date", "Montant", "Devise", "Méthode", "Statut", "Référence Stripe", "Description"],
    ...client.payments.map((p) => [
      "Paiement", p.paidAt ?? p.createdAt, Number(p.amount), p.currency, p.paymentMethod ?? "—",
      p.status, p.stripePaymentIntentId ?? "—", `Facture ID ${p.invoiceId ?? "—"}`,
    ]),
    ...client.refunds.map((r) => [
      "Remboursement", r.processedAt ?? r.createdAt, -Number(r.amount), "CAD", "Stripe",
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
  const convRows: (string | number | Date | null | undefined)[][] = [
    ["Date", "Heure", "Auteur", "Canal", "Note interne", "Contenu", "Pièces jointes"],
    ...client.messages.filter((m) => !m.deletedAt).map((m) => {
      const atts = (m.attachmentsData as AttachmentJson[] | null) ?? (m.attachmentData ? [m.attachmentData as AttachmentJson] : []);
      const attNames = atts.map((a) => a?.name ?? "?").join(" | ");
      return [
        m.createdAt.toISOString().slice(0, 10),
        m.createdAt.toISOString().slice(11, 16),
        m.sender === "vnk" ? "VNK (admin)" : "Client",
        m.channel,
        m.isInternalNote ? "Oui" : "Non",
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
    });
    zip.file(`${folderBase}/07-conversation.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF conversation err:", e); }

  // ─── 08 Rendez-vous ────────────────────────────────────
  const rdvRows: (string | number | Date | null | undefined)[][] = [
    ["Date", "Début", "Fin", "Sujet", "Statut", "Type rencontre", "Notes admin"],
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
    });
    zip.file(`${folderBase}/08-rendez-vous.pdf`, new Uint8Array(pdfBuf));
  } catch (e) { console.error("PDF rdv err:", e); }

  // ─── 09 Litiges ────────────────────────────────────────
  const disputesRows: (string | number | Date | null | undefined)[][] = [
    ["Ouvert", "Type", "Titre", "Statut", "Priorité", "Montant", "Stripe ID", "Raison Stripe", "Outcome", "Assigné", "Résolu", "Résolution"],
    ...client.disputes.map((d) => [
      d.openedAt, d.type, d.title, d.status, d.priority,
      d.amountDisputed != null ? Number(d.amountDisputed) : "",
      d.stripeDisputeId ?? "", d.stripeReason ?? "", d.outcome ?? "",
      d.assignedTo ?? "", d.resolvedAt ?? "", d.resolution ?? "",
    ]),
  ];
  zip.file(`${folderBase}/09-litiges.csv`, csvFromRows(disputesRows));

  try {
    const pdfBuf = await generateDisputesPdf({
      client: { fullName: client.fullName, email: client.email },
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
      })),
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
  const unified: UnifiedEvt[] = [
    ...client.workflowEvents.map((w) => ({
      createdAt: w.createdAt, source: "workflow", type: w.eventType,
      label: w.eventLabel ?? w.eventType, ipAddress: null, userAgent: null,
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
    ["Date", "Source", "Type", "Label", "IP", "User-Agent"],
    ...unified.map((u) => [u.createdAt, u.source, u.type, u.label, u.ipAddress ?? "", u.userAgent ?? ""]),
  ];
  zip.file(`${folderBase}/10-audit-events.csv`, csvFromRows(auditRows));

  try {
    const pdfBuf = await generateAuditPdf({
      client: { fullName: client.fullName, email: client.email },
      events: unified,
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

