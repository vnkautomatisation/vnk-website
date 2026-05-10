// PDF generators pour l'export ZIP : conversation chat-style, RDV, litiges, audit, paiements
// Utilise PDFKit directement avec capture via PassThrough
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const C = {
  navy: "#0F2D52",
  navyDeep: "#0A1F3A",
  blue: "#1B4F8A",
  blueLight: "#DBEAFE",
  blueLighter: "#EFF6FF",
  green: "#16A34A",
  greenLight: "#DCFCE7",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
  gray: "#64748B",
  grayDark: "#334155",
  grayLight: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  white: "#FFFFFF",
  bubbleClient: "#F1F5F9",
  bubbleVnk: "#0F2D52",
  internal: "#FEF3C7",
};

const COMPANY = {
  name: "VNK Automatisation Inc.",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
  site: "vnk-website-production.up.railway.app",
};

const HEADER_H = 90;          // hauteur de l'entete
const FOOTER_RESERVED = 35;   // espace reserve en bas pour pied de page

type CapturedDoc = InstanceType<typeof PDFDocument>;

function capture(fn: (doc: CapturedDoc) => void | Promise<void>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // CRITIQUE : marges custom — bottom: 0 pour permettre l'ecriture du footer
    // sans declencher l'auto-pagination de PDFKit.
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, right: 50, bottom: 0, left: 50 },
      bufferPages: true,
    });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);
    Promise.resolve(fn(doc))
      .then(() => {
        finalizeFooter(doc);
        doc.end();
      })
      .catch((e) => {
        try { doc.end(); } catch { /* noop */ }
        reject(e);
      });
  });
}

// Filtre les caracteres non supportes par Helvetica (emojis, symboles Unicode etendus)
// Helvetica supporte WinAnsi/Latin-1. On supprime ce qui sortirait du texte propre.
function sanitize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    // Supprime les emojis et pictogrammes Unicode
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{2300}-\u{23FF}]/gu, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    // Substitutions utiles
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "—")
    .replace(/…/g, "...")
    // Supprime tout caractere de controle / surrogate orphelin
    .replace(/[\uD800-\uDFFF]/g, "");
}

// Header gradient + logo monogramme + titre + sous-titre + date
function drawHeader(doc: CapturedDoc, title: string, subtitle: string, intro?: string) {
  const w = doc.page.width;
  doc.save();
  // Bande navy
  doc.rect(0, 0, w, HEADER_H).fill(C.navy);
  // Accent bleu plus clair en bas (epaisseur 3px)
  doc.rect(0, HEADER_H - 3, w, 3).fill(C.blue);

  // Monogramme VNK dans un carré arrondi blanc
  const logoX = 40, logoY = 22, logoSize = 46;
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 8).fill(C.white);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(20)
    .text("VNK", logoX, logoY + 13, { width: logoSize, align: "center" });

  // Bloc texte a droite du logo
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(15)
    .text(COMPANY.name, logoX + logoSize + 14, 26, { lineBreak: false });
  doc.fillColor(C.blueLight).font("Helvetica").fontSize(10)
    .text(title, logoX + logoSize + 14, 47, { lineBreak: false });

  // Bloc droit : sous-titre + date
  const rightX = w - 280;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(10)
    .text(subtitle, rightX, 26, { width: 240, align: "right", lineBreak: false });
  doc.fillColor(C.blueLight).font("Helvetica").fontSize(8)
    .text(new Date().toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" }),
      rightX, 44, { width: 240, align: "right", lineBreak: false });
  doc.fillColor(C.blueLight).fontSize(8)
    .text(`${COMPANY.phone}  ${COMPANY.email}`,
      rightX, 58, { width: 240, align: "right", lineBreak: false });

  doc.restore();
  doc.fillColor(C.text).font("Helvetica");
  doc.y = HEADER_H + 18;

  // Bandeau intro explicatif
  if (intro) {
    const padX = 50, padY = 10;
    const introHeight = doc.heightOfString(intro, { width: w - 100 - padX * 0 }) + padY * 2;
    doc.roundedRect(50, doc.y, w - 100, introHeight, 6).fillAndStroke(C.blueLighter, C.blueLight);
    doc.fillColor(C.grayDark).font("Helvetica").fontSize(9)
      .text(intro, 50 + padX / 2 + 6, doc.y + padY, { width: w - 100 - padX });
    doc.y += introHeight + 14;
    doc.fillColor(C.text);
  }
}

// Footer applique a chaque page bufferisee, ecrit dans la zone "marge bottom: 0"
function finalizeFooter(doc: CapturedDoc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    // Trait separateur
    doc.strokeColor(C.border).lineWidth(0.5)
      .moveTo(50, h - 30).lineTo(w - 50, h - 30).stroke();
    // Texte gauche
    doc.fillColor(C.gray).font("Helvetica").fontSize(8)
      .text(`${COMPANY.name}  ·  ${COMPANY.email}  ·  ${COMPANY.phone}`,
        50, h - 22, { width: w - 200, align: "left", lineBreak: false });
    // Pagination droite
    doc.text(`Page ${i - range.start + 1} / ${range.count}`,
      w - 130, h - 22, { width: 80, align: "right", lineBreak: false });
  }
}

// Verifie qu'on a la place pour `needed` px avant la zone footer reservee
function ensureSpace(doc: CapturedDoc, needed: number) {
  if (doc.y + needed > doc.page.height - FOOTER_RESERVED) {
    doc.addPage();
    doc.y = 50;
  }
}

// ─────────────────────────────────────────────────────────
// 1. CONVERSATION (chat-style avec bulles + images embarquees)
// ─────────────────────────────────────────────────────────
type ConvAttachment = {
  kind: "image" | "audio" | "pdf" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  durationSec?: number;
};
type ConvMessage = {
  id: number;
  createdAt: Date;
  sender: string;
  channel: string;
  content: string | null;
  isInternalNote: boolean;
  deletedAt: Date | null;
  editedAt?: Date | null;
  attachments: ConvAttachment[];
};

function dataUrlToBuf(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], "base64") };
}

export async function generateConversationPdf(params: {
  client: { fullName: string; email: string; companyName?: string | null };
  messages: ConvMessage[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Conversation complète",
      sanitize(params.client.fullName),
      `Trace officielle de tous les échanges (chat + email) avec ${sanitize(params.client.fullName)}` +
        ` (${sanitize(params.client.email)}). Bulles à gauche : messages du client. Bulles à droite (navy) : réponses de VNK. Bandeau ambré : notes internes admin (non visibles par le client). Pièces jointes images embarquées; autres fichiers listés par nom.`,
    );

    if (params.messages.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun message échangé.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    const maxBubbleW = 380;
    const padX = 12;
    const padY = 8;

    let lastDate = "";
    for (const m of params.messages) {
      if (m.deletedAt) continue;

      const dateStr = m.createdAt.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 30);
        doc.moveDown(0.5);
        doc.fillColor(C.gray).fontSize(9).font("Helvetica-Bold")
          .text(dateStr.toUpperCase(), 50, doc.y, { align: "center", width: doc.page.width - 100 });
        doc.moveDown(0.3);
        lastDate = dateStr;
      }

      const isVnk = m.sender === "vnk";
      const bubbleColor = m.isInternalNote ? C.internal : isVnk ? C.bubbleVnk : C.bubbleClient;
      const textColor = m.isInternalNote ? C.text : isVnk ? C.white : C.text;
      const labelColor = m.isInternalNote ? C.amber : C.gray;

      const senderLabel = m.isInternalNote
        ? "Note interne (admin)"
        : isVnk ? "VNK Automatisation" : sanitize(params.client.fullName);
      const timeStr = m.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false });

      const channelLabel = m.channel === "email" ? "email" : "chat";
      const labelText = `${senderLabel}  ·  ${timeStr}${m.editedAt ? "  ·  modifié" : ""}  ·  ${channelLabel}`;

      // Pre-calc bubble height
      const contentText = sanitize(m.content);
      doc.font("Helvetica").fontSize(10);
      const textHeight = contentText
        ? doc.heightOfString(contentText, { width: maxBubbleW - padX * 2 })
        : 0;

      const imageAtts = m.attachments.filter((a) => a.kind === "image" && /^image\/(png|jpeg|jpg)$/i.test(a.mimeType));
      const otherAtts = m.attachments.filter((a) => !imageAtts.includes(a));

      const imgThumbW = 180;
      const imgThumbH = 120;
      const imgGap = 6;
      const imgsHeight = imageAtts.length > 0 ? Math.ceil(imageAtts.length / 2) * (imgThumbH + imgGap) + 6 : 0;
      const otherAttsHeight = otherAtts.length * 14 + (otherAtts.length > 0 ? 6 : 0);

      const bubbleH = padY * 2 + (contentText ? textHeight + (imgsHeight || otherAttsHeight ? 6 : 0) : 0) + imgsHeight + otherAttsHeight;
      const totalH = 16 + bubbleH + 10;

      ensureSpace(doc, totalH);

      const xLeft = 50;
      const xRight = doc.page.width - 50;
      const bubbleW = Math.min(maxBubbleW, xRight - xLeft - 60);
      const bubbleX = isVnk && !m.isInternalNote ? xRight - bubbleW : xLeft;

      // Label au-dessus de la bulle
      doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8)
        .text(labelText, bubbleX, doc.y, {
          width: bubbleW, align: isVnk && !m.isInternalNote ? "right" : "left", lineBreak: false,
        });
      doc.moveDown(0.15);

      const bubbleY = doc.y;
      doc.roundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 8).fill(bubbleColor);

      let cursorY = bubbleY + padY;
      if (contentText) {
        doc.fillColor(textColor).font("Helvetica").fontSize(10);
        doc.text(contentText, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
        cursorY = doc.y + 4;
      }

      if (imageAtts.length > 0) {
        let col = 0;
        let rowY = cursorY;
        for (const att of imageAtts) {
          const decoded = dataUrlToBuf(att.dataUrl);
          if (!decoded) continue;
          const x = bubbleX + padX + col * (imgThumbW + imgGap);
          try {
            doc.image(decoded.buf, x, rowY, { fit: [imgThumbW, imgThumbH], align: "center", valign: "center" });
          } catch { /* unsupported format */ }
          col++;
          if (col >= 2) { col = 0; rowY += imgThumbH + imgGap; }
        }
        cursorY = rowY + (col > 0 ? imgThumbH + imgGap : 0);
      }

      if (otherAtts.length > 0) {
        doc.fillColor(textColor).font("Helvetica-Oblique").fontSize(9);
        for (const att of otherAtts) {
          const sizeKb = Math.round(att.size / 1024);
          const tag = att.kind === "audio" ? "[audio]" : att.kind === "pdf" ? "[PDF]" : "[fichier]";
          const dur = att.durationSec ? `  ${Math.floor(att.durationSec / 60)}:${String(att.durationSec % 60).padStart(2, "0")}` : "";
          doc.text(`${tag} ${sanitize(att.name)} (${sizeKb} Ko)${dur}`, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
          cursorY += 14;
        }
      }

      doc.y = bubbleY + bubbleH + 10;
    }
  });
}

// ─────────────────────────────────────────────────────────
// 2. RENDEZ-VOUS
// ─────────────────────────────────────────────────────────
type AppointmentRow = {
  appointmentDate: Date;
  startTime: string | null;
  endTime: string | null;
  subject: string | null;
  status: string;
  meetingType: string | null;
  notesAdmin: string | null;
};

export async function generateAppointmentsPdf(params: {
  client: { fullName: string; email: string };
  appointments: AppointmentRow[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Rendez-vous",
      sanitize(params.client.fullName),
      `Liste complète des ${params.appointments.length} rendez-vous planifiés ou tenus avec ${sanitize(params.client.fullName)} : date, durée, sujet, type de rencontre, statut et notes internes admin.`,
    );

    if (params.appointments.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun rendez-vous.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    for (const a of params.appointments) {
      ensureSpace(doc, 90);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;

      doc.roundedRect(x, y, w, 80, 6).fillAndStroke(C.grayLight, C.border);
      // Bande gauche selon statut
      const statusColor = a.status === "completed" ? C.green : a.status === "cancelled" ? C.red : a.status === "scheduled" ? C.blue : C.amber;
      doc.rect(x, y, 4, 80).fill(statusColor);

      const dateStr = new Date(a.appointmentDate).toLocaleDateString("fr-CA",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const time = a.startTime ? `${a.startTime}${a.endTime ? ` — ${a.endTime}` : ""}` : "";

      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(12)
        .text(sanitize(a.subject) || "(sans sujet)", x + 14, y + 12, { width: w - 28, lineBreak: false, ellipsis: true });
      doc.fillColor(C.grayDark).font("Helvetica").fontSize(10)
        .text(`${dateStr}${time ? `   |   ${time}` : ""}`, x + 14, y + 30, { width: w - 28, lineBreak: false });
      doc.fillColor(C.gray).fontSize(9)
        .text(`Type : ${sanitize(a.meetingType) || "—"}     Statut : ${a.status}`, x + 14, y + 46, { width: w - 28, lineBreak: false });
      if (a.notesAdmin) {
        doc.fillColor(C.text).fontSize(8)
          .text(sanitize(a.notesAdmin), x + 14, y + 60, { width: w - 28, height: 16, ellipsis: true, lineBreak: false });
      }
      doc.y = y + 90;
    }
  });
}

// ─────────────────────────────────────────────────────────
// 3. LITIGES
// ─────────────────────────────────────────────────────────
type DisputeRow = {
  openedAt: Date;
  type: string | null;
  category: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  amountDisputed: number | null;
  currency: string | null;
  stripeDisputeId: string | null;
  stripeReason: string | null;
  outcome: string | null;
  evidenceDueBy: Date | null;
  assignedTo: string | null;
  internalNotes: string | null;
  resolution: string | null;
  resolvedAt: Date | null;
  lawFirmInvolved: string | null;
  caseNumber: string | null;
  tribunal: string | null;
};

export async function generateDisputesPdf(params: {
  client: { fullName: string; email: string };
  disputes: DisputeRow[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Litiges et différends",
      sanitize(params.client.fullName),
      `Dossier complet des ${params.disputes.length} litiges avec ${sanitize(params.client.fullName)}. Inclus : chargebacks Stripe, plaintes, escalades juridiques (cabinet, n° de dossier, tribunal). Notes internes en jaune. Document à conserver pour traçabilité légale.`,
    );

    if (params.disputes.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun litige enregistré.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    for (const d of params.disputes) {
      ensureSpace(doc, 200);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;

      const priorityColor = d.priority === "high" || d.priority === "urgent" ? C.red : d.priority === "medium" ? C.amber : C.gray;
      doc.rect(x, y, 4, 30).fill(priorityColor);

      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(13)
        .text(sanitize(d.title), x + 14, y, { width: w - 28 });
      doc.fillColor(C.grayDark).font("Helvetica").fontSize(9)
        .text(
          `Ouvert le ${d.openedAt.toLocaleDateString("fr-CA")}     Statut : ${d.status}     Priorité : ${d.priority ?? "—"}`,
          x + 14,
        );
      doc.moveDown(0.4);

      const fields: [string, string | null | undefined][] = [
        ["Type", d.type],
        ["Catégorie", d.category],
        ["Montant contesté", d.amountDisputed != null ? `${d.amountDisputed.toFixed(2)} ${d.currency ?? "CAD"}` : null],
        ["Stripe Dispute ID", d.stripeDisputeId],
        ["Raison Stripe", d.stripeReason],
        ["Résultat (outcome)", d.outcome],
        ["Échéance preuve", d.evidenceDueBy ? d.evidenceDueBy.toLocaleDateString("fr-CA") : null],
        ["Assigné à", d.assignedTo],
        ["Cabinet juridique", d.lawFirmInvolved],
        ["Numéro de dossier", d.caseNumber],
        ["Tribunal", d.tribunal],
        ["Résolution", d.resolution],
        ["Résolu le", d.resolvedAt ? d.resolvedAt.toLocaleDateString("fr-CA") : null],
      ];

      doc.font("Helvetica").fontSize(9.5);
      for (const [label, value] of fields) {
        if (!value) continue;
        ensureSpace(doc, 14);
        doc.fillColor(C.gray).text(`${label} :`, x + 14, doc.y, { continued: true, width: 140 });
        doc.fillColor(C.text).text(`  ${sanitize(value)}`, { width: w - 154 });
      }

      if (d.description) {
        ensureSpace(doc, 30);
        doc.moveDown(0.4);
        doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(8).text("DESCRIPTION", x + 14);
        doc.fillColor(C.text).font("Helvetica").fontSize(9.5).text(sanitize(d.description), x + 14, doc.y, { width: w - 28 });
      }

      if (d.internalNotes) {
        ensureSpace(doc, 50);
        doc.moveDown(0.4);
        const notesText = sanitize(d.internalNotes);
        const notesH = doc.heightOfString(notesText, { width: w - 40 });
        const noteY = doc.y;
        doc.roundedRect(x + 14, noteY, w - 28, notesH + 22, 4).fillAndStroke(C.amberLight, C.amber);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(8)
          .text("NOTES INTERNES (NON VISIBLE CLIENT)", x + 20, noteY + 6);
        doc.fillColor(C.text).font("Helvetica").fontSize(9.5)
          .text(notesText, x + 20, noteY + 18, { width: w - 40 });
        doc.y = noteY + notesH + 28;
      }

      doc.moveDown(0.6);
      doc.strokeColor(C.border).lineWidth(0.4)
        .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
      doc.moveDown(0.6);
    }
  });
}

// ─────────────────────────────────────────────────────────
// 4. AUDIT / TIMELINE
// ─────────────────────────────────────────────────────────
type AuditRow = {
  createdAt: Date;
  source: string;
  type: string;
  label: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: unknown;
};

export async function generateAuditPdf(params: {
  client: { fullName: string; email: string };
  events: AuditRow[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Timeline d'événements (audit complet)",
      sanitize(params.client.fullName),
      `Trace immuable des ${params.events.length} actions impliquant ${sanitize(params.client.fullName)} : connexions, paiements, signatures, consentements, emails, actions admin et événements workflow. Utilisé pour audit légal, conformité GDPR, et investigation forensique. Chaque ligne inclut IP et User-Agent quand disponibles.`,
    );

    if (params.events.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun événement enregistré.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    const sourceColor: Record<string, string> = {
      login: C.blue, order: C.green, signature: C.navy, consent: C.amber,
      email: C.gray, audit: C.red, workflow: C.blue,
    };

    let lastDate = "";
    for (const e of params.events) {
      const dateStr = e.createdAt.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 28);
        doc.moveDown(0.4);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10)
          .text(dateStr.toUpperCase(), 50, doc.y);
        doc.strokeColor(C.border).lineWidth(0.5)
          .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.3);
        lastDate = dateStr;
      }

      ensureSpace(doc, 38);
      const x = 50;
      const y = doc.y;
      const w = doc.page.width - 100;
      const dotColor = sourceColor[e.source] ?? C.gray;

      // Pastille colorée
      doc.circle(x + 6, y + 7, 4).fill(dotColor);
      // Label principal
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9.5)
        .text(sanitize(e.label), x + 22, y, { width: w - 22 });
      // Méta
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(
          `${e.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false })}` +
          `  ·  ${e.source}/${e.type}`,
          x + 22, doc.y,
        );
      if (e.ipAddress || e.userAgent) {
        doc.fontSize(7.5).text(
          [e.ipAddress, e.userAgent ? sanitize(e.userAgent).slice(0, 90) : null].filter(Boolean).join("  ·  "),
          x + 22, doc.y, { width: w - 22 },
        );
      }
      doc.moveDown(0.4);
    }
  });
}

// ─────────────────────────────────────────────────────────
// 5. PAIEMENTS
// ─────────────────────────────────────────────────────────
type PaymentRow = {
  type: "Paiement" | "Remboursement";
  date: Date;
  amount: number;
  currency: string;
  method: string | null;
  status: string;
  stripeId: string | null;
  description: string;
};

export async function generatePaymentsPdf(params: {
  client: { fullName: string; email: string };
  rows: PaymentRow[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Relevé de paiements",
      sanitize(params.client.fullName),
      `Totaux financiers et détail chronologique des ${params.rows.length} transactions (paiements encaissés et remboursements émis) avec ${sanitize(params.client.fullName)}. Source : Stripe. Document à conserver pour réconciliation comptable.`,
    );

    const totalIn = params.rows.filter((r) => r.type === "Paiement" && r.status === "succeeded").reduce((s, r) => s + r.amount, 0);
    const totalOut = params.rows.filter((r) => r.type === "Remboursement").reduce((s, r) => s + r.amount, 0);
    const net = totalIn - totalOut;

    // Sommaire — 3 cartes
    const sx = 50;
    const sw = (doc.page.width - 100) / 3 - 6;
    const sy = doc.y;
    [
      { l: "Total encaissé", v: totalIn, c: C.green, bg: C.greenLight },
      { l: "Total remboursé", v: totalOut, c: C.red, bg: C.redLight },
      { l: "Net", v: net, c: C.navy, bg: C.blueLighter },
    ].forEach((s, i) => {
      const x = sx + i * (sw + 9);
      doc.roundedRect(x, sy, sw, 56, 6).fillAndStroke(s.bg, C.border);
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(s.l.toUpperCase(), x + 12, sy + 8, { width: sw - 24, lineBreak: false });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(17)
        .text(`${s.v.toFixed(2)} CAD`, x + 12, sy + 24, { width: sw - 24, lineBreak: false });
    });
    doc.y = sy + 70;

    if (params.rows.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucune transaction.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    // Tableau
    const tx = 50;
    const tw = doc.page.width - 100;
    const cols = [
      { label: "Type", w: 75 },
      { label: "Date", w: 80 },
      { label: "Montant", w: 80 },
      { label: "Méthode", w: 70 },
      { label: "Statut", w: 65 },
      { label: "Description", w: tw - 370 },
    ];

    const drawHead = () => {
      const hy = doc.y;
      doc.rect(tx, hy, tw, 22).fill(C.navy);
      let cx = tx + 8;
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5);
      cols.forEach((c) => {
        doc.text(c.label.toUpperCase(), cx, hy + 7, { width: c.w - 8, lineBreak: false });
        cx += c.w;
      });
      doc.y = hy + 22;
    };
    ensureSpace(doc, 30);
    drawHead();

    let alt = false;
    for (const r of params.rows) {
      ensureSpace(doc, 22);
      if (doc.y < HEADER_H) drawHead();
      const rowY = doc.y;
      if (alt) doc.rect(tx, rowY, tw, 18).fill(C.grayLight);
      alt = !alt;

      const cells = [
        r.type,
        r.date.toLocaleDateString("fr-CA"),
        `${r.amount.toFixed(2)} ${r.currency}`,
        r.method ?? "—",
        r.status,
        sanitize(r.description),
      ];
      let cx = tx + 8;
      doc.fillColor(C.text).font("Helvetica").fontSize(8.5);
      cells.forEach((v, i) => {
        const col = cols[i];
        doc.text(String(v), cx, rowY + 5, { width: col.w - 8, lineBreak: false, ellipsis: true });
        cx += col.w;
      });
      doc.y = rowY + 18;
    }
  });
}
