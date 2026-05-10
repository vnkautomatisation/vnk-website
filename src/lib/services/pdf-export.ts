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
  shortName: "Automatisation Inc.",
  fullName: "VNK Automatisation Inc.",
  tagline: "VALUE · NETWORK · KNOWLEDGE",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
  site: "vnk-website-production.up.railway.app",
};

const HEADER_H = 72;          // hauteur de l'entete (compactee)
const FOOTER_RESERVED = 30;   // espace reserve en bas pour pied de page

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

// Header VNK : carre VNK + nom + tagline (matche le logo officiel)
function drawHeader(doc: CapturedDoc, title: string, subtitle: string, intro?: string) {
  const w = doc.page.width;
  doc.save();
  // Bande navy
  doc.rect(0, 0, w, HEADER_H).fill(C.navy);
  // Accent bleu fin
  doc.rect(0, HEADER_H - 2, w, 2).fill(C.blue);

  // Carre "VNK" : fond navy plus fonce + bordure blanche
  const logoX = 35, logoY = 16, logoSize = 40;
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 4)
    .fillAndStroke(C.navyDeep, C.white);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(15)
    .text("VNK", logoX, logoY + 11, { width: logoSize, align: "center", lineBreak: false });

  // Bloc nom + tagline a droite du logo
  const textX = logoX + logoSize + 12;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(14)
    .text(COMPANY.shortName, textX, 19, { lineBreak: false });
  doc.fillColor(C.blueLight).font("Helvetica-Bold").fontSize(7.5)
    .text(COMPANY.tagline, textX, 39, { lineBreak: false, characterSpacing: 0.5 });

  // Bloc titre PDF (centre-droite)
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11)
    .text(title, 0, 22, { width: w - 35, align: "right", lineBreak: false });
  doc.fillColor(C.blueLight).font("Helvetica").fontSize(8)
    .text(subtitle, 0, 38, { width: w - 35, align: "right", lineBreak: false });
  doc.fillColor(C.blueLight).fontSize(7.5)
    .text(new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }),
      0, 51, { width: w - 35, align: "right", lineBreak: false });

  doc.restore();
  doc.fillColor(C.text).font("Helvetica");
  doc.y = HEADER_H + 12;

  // Bandeau intro explicatif compact
  if (intro) {
    const padX = 10, padY = 7;
    const introHeight = doc.heightOfString(intro, { width: w - 100 - padX * 2 }) + padY * 2;
    doc.roundedRect(50, doc.y, w - 100, introHeight, 4)
      .fillAndStroke(C.blueLighter, C.blueLight);
    doc.fillColor(C.grayDark).font("Helvetica").fontSize(8.5)
      .text(intro, 50 + padX, doc.y + padY, { width: w - 100 - padX * 2 });
    doc.y += introHeight + 10;
    doc.fillColor(C.text);
  }
}

// Bloc identite client compact — utilise pour litiges, fiche-client
function drawClientBlock(doc: CapturedDoc, client: {
  fullName: string; email: string; phone?: string | null;
  companyName?: string | null; address?: string | null; city?: string | null;
  province?: string | null; postalCode?: string | null;
}) {
  const w = doc.page.width - 100;
  const x = 50;
  const y = doc.y;
  const h = 52;
  doc.roundedRect(x, y, w, h, 4).fillAndStroke(C.grayLight, C.border);

  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
    .text("CLIENT", x + 12, y + 7, { lineBreak: false, characterSpacing: 0.6 });
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11)
    .text(sanitize(client.fullName), x + 12, y + 17, { width: w / 2 - 16, lineBreak: false, ellipsis: true });
  doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
    .text(sanitize(client.companyName) || "—", x + 12, y + 32, { width: w / 2 - 16, lineBreak: false, ellipsis: true });

  // Colonne droite : contacts
  const cx = x + w / 2;
  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
    .text("CONTACT", cx + 12, y + 7, { lineBreak: false, characterSpacing: 0.6 });
  doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
    .text(sanitize(client.email), cx + 12, y + 17, { width: w / 2 - 24, lineBreak: false, ellipsis: true });
  doc.text(sanitize(client.phone) || "—", cx + 12, y + 28, { width: w / 2 - 24, lineBreak: false });
  const addr = [client.address, client.city, client.province, client.postalCode].filter(Boolean).map(sanitize).join(", ");
  if (addr) {
    doc.fillColor(C.gray).fontSize(7.5).text(addr, cx + 12, y + 39, { width: w / 2 - 24, lineBreak: false, ellipsis: true });
  }
  doc.y = y + h + 10;
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
      .text(`${COMPANY.fullName}  ·  ${COMPANY.email}  ·  ${COMPANY.phone}`,
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

    const maxBubbleW = 360;
    const padX = 9;
    const padY = 5;

    let lastDate = "";
    for (const m of params.messages) {
      if (m.deletedAt) continue;

      const dateStr = m.createdAt.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 22);
        doc.moveDown(0.25);
        doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
          .text(dateStr.toUpperCase(), 50, doc.y, { align: "center", width: doc.page.width - 100, characterSpacing: 0.4 });
        doc.moveDown(0.15);
        lastDate = dateStr;
      }

      const isVnk = m.sender === "vnk";
      const bubbleColor = m.isInternalNote ? C.internal : isVnk ? C.bubbleVnk : C.bubbleClient;
      const textColor = m.isInternalNote ? C.text : isVnk ? C.white : C.text;
      const labelColor = m.isInternalNote ? C.amber : C.gray;

      const senderLabel = m.isInternalNote
        ? "Note interne"
        : isVnk ? "VNK" : sanitize(params.client.fullName);
      const timeStr = m.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false });

      const channelLabel = m.channel === "email" ? "email" : "chat";
      const labelText = `${senderLabel} · ${timeStr}${m.editedAt ? " · mod." : ""} · ${channelLabel}`;

      const contentText = sanitize(m.content);
      doc.font("Helvetica").fontSize(8.5);
      const textHeight = contentText
        ? doc.heightOfString(contentText, { width: maxBubbleW - padX * 2 })
        : 0;

      const imageAtts = m.attachments.filter((a) => a.kind === "image" && /^image\/(png|jpeg|jpg)$/i.test(a.mimeType));
      const otherAtts = m.attachments.filter((a) => !imageAtts.includes(a));

      const imgThumbW = 130;
      const imgThumbH = 90;
      const imgGap = 4;
      const imgsHeight = imageAtts.length > 0 ? Math.ceil(imageAtts.length / 2) * (imgThumbH + imgGap) + 4 : 0;
      const otherAttsHeight = otherAtts.length * 11 + (otherAtts.length > 0 ? 4 : 0);

      const bubbleH = padY * 2 + (contentText ? textHeight + (imgsHeight || otherAttsHeight ? 4 : 0) : 0) + imgsHeight + otherAttsHeight;
      const totalH = 11 + bubbleH + 4;

      ensureSpace(doc, totalH);

      const xLeft = 50;
      const xRight = doc.page.width - 50;
      const bubbleW = Math.min(maxBubbleW, xRight - xLeft - 50);
      const bubbleX = isVnk && !m.isInternalNote ? xRight - bubbleW : xLeft;

      doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(7)
        .text(labelText, bubbleX, doc.y, {
          width: bubbleW, align: isVnk && !m.isInternalNote ? "right" : "left", lineBreak: false,
        });

      const bubbleY = doc.y + 1;
      doc.roundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 6).fill(bubbleColor);

      let cursorY = bubbleY + padY;
      if (contentText) {
        doc.fillColor(textColor).font("Helvetica").fontSize(8.5);
        doc.text(contentText, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
        cursorY = doc.y + 3;
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
        doc.fillColor(textColor).font("Helvetica-Oblique").fontSize(7.5);
        for (const att of otherAtts) {
          const sizeKb = Math.round(att.size / 1024);
          const tag = att.kind === "audio" ? "[audio]" : att.kind === "pdf" ? "[PDF]" : "[fichier]";
          const dur = att.durationSec ? ` ${Math.floor(att.durationSec / 60)}:${String(att.durationSec % 60).padStart(2, "0")}` : "";
          doc.text(`${tag} ${sanitize(att.name)} (${sizeKb} Ko)${dur}`, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
          cursorY += 11;
        }
      }

      doc.y = bubbleY + bubbleH + 4;
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
      const hasNotes = !!a.notesAdmin;
      const cardH = hasNotes ? 56 : 42;
      ensureSpace(doc, cardH + 6);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;

      doc.roundedRect(x, y, w, cardH, 4).fillAndStroke(C.grayLight, C.border);
      const statusColor = a.status === "completed" ? C.green : a.status === "cancelled" ? C.red : a.status === "scheduled" ? C.blue : C.amber;
      doc.rect(x, y, 3, cardH).fill(statusColor);

      const dateStr = new Date(a.appointmentDate).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
      const time = a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ""}` : "";

      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10)
        .text(sanitize(a.subject) || "(sans sujet)", x + 10, y + 7, { width: w - 20, lineBreak: false, ellipsis: true });
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(
          `${dateStr}${time ? `  ${time}` : ""}  ·  ${sanitize(a.meetingType) || "—"}  ·  ${a.status}`,
          x + 10, y + 22, { width: w - 20, lineBreak: false, ellipsis: true },
        );
      if (a.notesAdmin) {
        doc.fillColor(C.text).fontSize(7.5)
          .text(sanitize(a.notesAdmin), x + 10, y + 37, { width: w - 20, height: 14, ellipsis: true, lineBreak: false });
      }
      doc.y = y + cardH + 4;
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
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  contractId?: number | null;
  contractNumber?: string | null;
  paymentId?: number | null;
};

export async function generateDisputesPdf(params: {
  client: {
    fullName: string; email: string; phone?: string | null;
    companyName?: string | null; address?: string | null; city?: string | null;
    province?: string | null; postalCode?: string | null;
  };
  disputes: DisputeRow[];
}): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Litiges et différends",
      sanitize(params.client.fullName),
      `Dossier juridique complet des ${params.disputes.length} litiges avec ${sanitize(params.client.fullName)}. Chargebacks Stripe, plaintes, escalades (cabinet, dossier, tribunal). Références croisées vers facture/contrat. Notes internes confidentielles en jaune. Document à conserver pour traçabilité légale.`,
    );

    drawClientBlock(doc, params.client);

    if (params.disputes.length === 0) {
      doc.fillColor(C.gray).fontSize(10).text("Aucun litige enregistré.", 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    for (const d of params.disputes) {
      ensureSpace(doc, 140);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;
      const priorityColor = d.priority === "high" || d.priority === "urgent" ? C.red : d.priority === "medium" ? C.amber : C.gray;

      // Titre + meta
      doc.rect(x, y, 3, 26).fill(priorityColor);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11)
        .text(sanitize(d.title), x + 10, y, { width: w - 20, lineBreak: false, ellipsis: true });
      doc.fillColor(C.grayDark).font("Helvetica").fontSize(8)
        .text(
          `Ouvert ${d.openedAt.toLocaleDateString("fr-CA")} · Statut ${d.status} · Priorité ${d.priority ?? "—"}` +
          (d.invoiceNumber ? ` · Facture ${d.invoiceNumber}` : "") +
          (d.contractNumber ? ` · Contrat ${d.contractNumber}` : ""),
          x + 10, doc.y, { width: w - 20, lineBreak: false },
        );
      doc.moveDown(0.3);

      // 2 colonnes de champs
      const fields: [string, string | null | undefined][] = [
        ["Type", d.type],
        ["Catégorie", d.category],
        ["Montant contesté", d.amountDisputed != null ? `${d.amountDisputed.toFixed(2)} ${d.currency ?? "CAD"}` : null],
        ["Stripe Dispute ID", d.stripeDisputeId],
        ["Raison Stripe", d.stripeReason],
        ["Résultat", d.outcome],
        ["Échéance preuve", d.evidenceDueBy ? d.evidenceDueBy.toLocaleDateString("fr-CA") : null],
        ["Assigné à", d.assignedTo],
        ["Cabinet juridique", d.lawFirmInvolved],
        ["N° de dossier", d.caseNumber],
        ["Tribunal", d.tribunal],
        ["Résolution", d.resolution],
        ["Résolu le", d.resolvedAt ? d.resolvedAt.toLocaleDateString("fr-CA") : null],
      ].filter(([, v]) => !!v) as [string, string][];

      const colW = (w - 20) / 2;
      const colH = Math.ceil(fields.length / 2) * 12;
      ensureSpace(doc, colH + 8);
      const fieldsY = doc.y;
      doc.font("Helvetica").fontSize(8);
      fields.forEach((f, i) => {
        const fx = x + 10 + (i % 2) * colW;
        const fy = fieldsY + Math.floor(i / 2) * 12;
        doc.fillColor(C.gray).text(`${f[0]} :`, fx, fy, { continued: true, lineBreak: false });
        doc.fillColor(C.text).text(`  ${sanitize(f[1])}`, { width: colW - doc.widthOfString(`${f[0]} :  `) - 8, lineBreak: false, ellipsis: true });
      });
      doc.y = fieldsY + colH + 4;

      if (d.description) {
        const desc = sanitize(d.description);
        const descH = doc.heightOfString(desc, { width: w - 20 });
        ensureSpace(doc, descH + 18);
        doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
          .text("DESCRIPTION", x + 10, doc.y, { characterSpacing: 0.5 });
        doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
          .text(desc, x + 10, doc.y + 1, { width: w - 20 });
        doc.moveDown(0.3);
      }

      if (d.internalNotes) {
        const notesText = sanitize(d.internalNotes);
        const notesH = doc.heightOfString(notesText, { width: w - 32 });
        ensureSpace(doc, notesH + 22);
        const noteY = doc.y;
        doc.roundedRect(x + 10, noteY, w - 20, notesH + 18, 3).fillAndStroke(C.amberLight, C.amber);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(7)
          .text("NOTES INTERNES (CONFIDENTIEL)", x + 16, noteY + 4, { characterSpacing: 0.5 });
        doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
          .text(notesText, x + 16, noteY + 14, { width: w - 32 });
        doc.y = noteY + notesH + 22;
      }

      doc.moveDown(0.4);
      doc.strokeColor(C.border).lineWidth(0.4)
        .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
      doc.moveDown(0.4);
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
      const dateStr = e.createdAt.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 18);
        doc.moveDown(0.2);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(8.5)
          .text(dateStr.toUpperCase(), 50, doc.y, { characterSpacing: 0.5 });
        doc.strokeColor(C.border).lineWidth(0.4)
          .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.15);
        lastDate = dateStr;
      }

      const hasMeta = !!(e.ipAddress || e.userAgent);
      ensureSpace(doc, hasMeta ? 24 : 18);
      const x = 50;
      const y = doc.y;
      const w = doc.page.width - 100;
      const dotColor = sourceColor[e.source] ?? C.gray;

      doc.circle(x + 5, y + 5, 3).fill(dotColor);
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(8.5)
        .text(sanitize(e.label), x + 16, y, { width: w - 16, lineBreak: false, ellipsis: true });
      doc.fillColor(C.gray).font("Helvetica").fontSize(7)
        .text(
          `${e.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${e.source}/${e.type}` +
          (hasMeta ? ` · ${[e.ipAddress, e.userAgent ? sanitize(e.userAgent).slice(0, 80) : null].filter(Boolean).join(" · ")}` : ""),
          x + 16, y + 10, { width: w - 16, lineBreak: false, ellipsis: true },
        );
      doc.y = y + (hasMeta ? 22 : 16);
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

    // Sommaire — 3 cartes compactes
    const sx = 50;
    const sw = (doc.page.width - 100) / 3 - 5;
    const sy = doc.y;
    [
      { l: "Total encaissé", v: totalIn, c: C.green, bg: C.greenLight },
      { l: "Total remboursé", v: totalOut, c: C.red, bg: C.redLight },
      { l: "Net", v: net, c: C.navy, bg: C.blueLighter },
    ].forEach((s, i) => {
      const x = sx + i * (sw + 7);
      doc.roundedRect(x, sy, sw, 42, 4).fillAndStroke(s.bg, C.border);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
        .text(s.l.toUpperCase(), x + 10, sy + 6, { width: sw - 20, lineBreak: false, characterSpacing: 0.4 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(14)
        .text(`${s.v.toFixed(2)} CAD`, x + 10, sy + 19, { width: sw - 20, lineBreak: false });
    });
    doc.y = sy + 52;

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
      doc.rect(tx, hy, tw, 18).fill(C.navy);
      let cx = tx + 6;
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(7.5);
      cols.forEach((c) => {
        doc.text(c.label.toUpperCase(), cx, hy + 6, { width: c.w - 6, lineBreak: false, characterSpacing: 0.4 });
        cx += c.w;
      });
      doc.y = hy + 18;
    };
    ensureSpace(doc, 26);
    drawHead();

    let alt = false;
    for (const r of params.rows) {
      ensureSpace(doc, 16);
      if (doc.y < HEADER_H) drawHead();
      const rowY = doc.y;
      if (alt) doc.rect(tx, rowY, tw, 14).fill(C.grayLight);
      alt = !alt;

      const cells = [
        r.type,
        r.date.toLocaleDateString("fr-CA"),
        `${r.amount.toFixed(2)} ${r.currency}`,
        r.method ?? "—",
        r.status,
        sanitize(r.description),
      ];
      let cx = tx + 6;
      doc.fillColor(C.text).font("Helvetica").fontSize(7.5);
      cells.forEach((v, i) => {
        const col = cols[i];
        doc.text(String(v), cx, rowY + 3, { width: col.w - 6, lineBreak: false, ellipsis: true });
        cx += col.w;
      });
      doc.y = rowY + 14;
    }
  });
}

// ─────────────────────────────────────────────────────────
// 6. FICHE CLIENT — synthese executive du dossier complet
// ─────────────────────────────────────────────────────────
type FicheClientData = {
  client: {
    fullName: string; email: string; phone?: string | null;
    companyName?: string | null; address?: string | null; city?: string | null;
    province?: string | null; postalCode?: string | null;
    sector?: string | null; technologies?: string | null;
    createdAt: Date; lastLogin?: Date | null;
    internalNotes?: string | null;
  };
  totals: {
    mandates: number; quotes: number; contracts: number; invoices: number;
    documents: number; messages: number; appointments: number; disputes: number;
    totalSpentTtc: number; openBalanceTtc: number;
  };
  recentInvoices: { invoiceNumber: string; title: string; amountTtc: number; status: string; createdAt: Date }[];
  recentContracts: { contractNumber: string; title: string; status: string; signedAt: Date | null }[];
  activeDisputes: { title: string; status: string; openedAt: Date; amountDisputed: number | null }[];
};

export async function generateFicheClientPdf(data: FicheClientData): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(
      doc,
      "Fiche client (synthèse)",
      sanitize(data.client.fullName),
      `Vue d'ensemble exécutive du dossier de ${sanitize(data.client.fullName)} : identité, totaux financiers, derniers documents émis et litiges en cours. Document de tête du dossier ZIP — sert d'index visuel pour comprendre la relation client en un coup d'œil.`,
    );

    drawClientBlock(doc, data.client);

    // ─── Bandeau totaux ────────────────────────────────────
    const w = doc.page.width - 100;
    const sx = 50;
    const sy = doc.y;
    const cardW = (w - 12) / 4;
    [
      { l: "Mandats", v: String(data.totals.mandates), c: C.blue },
      { l: "Devis", v: String(data.totals.quotes), c: C.amber },
      { l: "Contrats", v: String(data.totals.contracts), c: C.navy },
      { l: "Factures", v: String(data.totals.invoices), c: C.green },
    ].forEach((s, i) => {
      const x = sx + i * (cardW + 4);
      doc.roundedRect(x, sy, cardW, 36, 4).fillAndStroke(C.grayLight, C.border);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
        .text(s.l.toUpperCase(), x + 8, sy + 5, { width: cardW - 16, lineBreak: false, characterSpacing: 0.4 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(16)
        .text(s.v, x + 8, sy + 16, { width: cardW - 16, lineBreak: false });
    });
    doc.y = sy + 44;

    // ─── Finance ──────────────────────────────────────────
    const fy = doc.y;
    const fcardW = (w - 8) / 2;
    [
      { l: "Total dépensé", v: `${data.totals.totalSpentTtc.toFixed(2)} CAD`, c: C.green, bg: C.greenLight },
      { l: "Solde ouvert", v: `${data.totals.openBalanceTtc.toFixed(2)} CAD`, c: data.totals.openBalanceTtc > 0 ? C.amber : C.gray, bg: data.totals.openBalanceTtc > 0 ? C.amberLight : C.grayLight },
    ].forEach((s, i) => {
      const x = sx + i * (fcardW + 8);
      doc.roundedRect(x, fy, fcardW, 42, 4).fillAndStroke(s.bg, C.border);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
        .text(s.l.toUpperCase(), x + 10, fy + 6, { width: fcardW - 20, lineBreak: false, characterSpacing: 0.4 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(15)
        .text(s.v, x + 10, fy + 19, { width: fcardW - 20, lineBreak: false });
    });
    doc.y = fy + 52;

    // ─── Profil business ──────────────────────────────────
    if (data.client.sector || data.client.technologies) {
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
        .text("PROFIL BUSINESS", 50, doc.y, { characterSpacing: 0.5 });
      doc.moveDown(0.2);
      if (data.client.sector) {
        doc.fillColor(C.gray).font("Helvetica").fontSize(8.5).text("Secteur : ", { continued: true });
        doc.fillColor(C.text).text(sanitize(data.client.sector));
      }
      if (data.client.technologies) {
        doc.fillColor(C.gray).font("Helvetica").fontSize(8.5).text("Technologies : ", { continued: true });
        doc.fillColor(C.text).text(sanitize(data.client.technologies), { width: w });
      }
      doc.moveDown(0.4);
    }

    // ─── Dernieres factures ───────────────────────────────
    if (data.recentInvoices.length > 0) {
      ensureSpace(doc, 60);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
        .text("DERNIÈRES FACTURES", 50, doc.y, { characterSpacing: 0.5 });
      doc.moveDown(0.2);
      data.recentInvoices.slice(0, 5).forEach((i) => {
        ensureSpace(doc, 16);
        const ry = doc.y;
        doc.fillColor(C.text).font("Helvetica-Bold").fontSize(8.5)
          .text(i.invoiceNumber, 50, ry, { continued: true });
        doc.font("Helvetica").fillColor(C.grayDark)
          .text(`  ·  ${sanitize(i.title)}`, { width: w - 130, lineBreak: false, ellipsis: true });
        doc.fillColor(C.text).font("Helvetica-Bold")
          .text(`${i.amountTtc.toFixed(2)} CAD`, doc.page.width - 130, ry, { width: 80, align: "right", lineBreak: false });
        doc.fillColor(i.status === "paid" ? C.green : i.status === "overdue" ? C.red : C.amber)
          .fontSize(7).text(i.status.toUpperCase(), doc.page.width - 130, ry + 9, { width: 80, align: "right", lineBreak: false, characterSpacing: 0.4 });
        doc.y = ry + 18;
      });
    }

    // ─── Derniers contrats ────────────────────────────────
    if (data.recentContracts.length > 0) {
      doc.moveDown(0.4);
      ensureSpace(doc, 60);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
        .text("DERNIERS CONTRATS", 50, doc.y, { characterSpacing: 0.5 });
      doc.moveDown(0.2);
      data.recentContracts.slice(0, 5).forEach((c) => {
        ensureSpace(doc, 14);
        const ry = doc.y;
        doc.fillColor(C.text).font("Helvetica-Bold").fontSize(8.5)
          .text(c.contractNumber, 50, ry, { continued: true });
        doc.font("Helvetica").fillColor(C.grayDark)
          .text(`  ·  ${sanitize(c.title)}`, { width: w - 100, lineBreak: false, ellipsis: true });
        doc.fillColor(c.signedAt ? C.green : C.gray).font("Helvetica-Bold").fontSize(7)
          .text(c.signedAt ? `SIGNÉ ${c.signedAt.toLocaleDateString("fr-CA")}` : c.status.toUpperCase(),
            doc.page.width - 130, ry + 1, { width: 80, align: "right", lineBreak: false, characterSpacing: 0.4 });
        doc.y = ry + 14;
      });
    }

    // ─── Litiges actifs ───────────────────────────────────
    if (data.activeDisputes.length > 0) {
      doc.moveDown(0.4);
      ensureSpace(doc, 60);
      doc.fillColor(C.red).font("Helvetica-Bold").fontSize(9)
        .text("LITIGES EN COURS", 50, doc.y, { characterSpacing: 0.5 });
      doc.moveDown(0.2);
      data.activeDisputes.forEach((d) => {
        ensureSpace(doc, 16);
        const ry = doc.y;
        doc.rect(50, ry, 3, 14).fill(C.red);
        doc.fillColor(C.text).font("Helvetica-Bold").fontSize(8.5)
          .text(sanitize(d.title), 58, ry, { width: w - 110, lineBreak: false, ellipsis: true });
        doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
          .text(`Ouvert ${d.openedAt.toLocaleDateString("fr-CA")} · ${d.status}`, 58, ry + 9, { width: w - 110, lineBreak: false });
        if (d.amountDisputed != null) {
          doc.fillColor(C.red).font("Helvetica-Bold").fontSize(8.5)
            .text(`${d.amountDisputed.toFixed(2)} CAD`, doc.page.width - 130, ry + 1, { width: 80, align: "right", lineBreak: false });
        }
        doc.y = ry + 18;
      });
    }

    // ─── Notes internes (si presentes) ────────────────────
    if (data.client.internalNotes) {
      doc.moveDown(0.5);
      ensureSpace(doc, 50);
      const notesText = sanitize(data.client.internalNotes);
      const notesH = doc.heightOfString(notesText, { width: w - 24 });
      const ny = doc.y;
      doc.roundedRect(50, ny, w, notesH + 22, 4).fillAndStroke(C.amberLight, C.amber);
      doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(7)
        .text("NOTES INTERNES", 60, ny + 6, { characterSpacing: 0.5 });
      doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
        .text(notesText, 60, ny + 16, { width: w - 24 });
      doc.y = ny + notesH + 26;
    }
  });
}
