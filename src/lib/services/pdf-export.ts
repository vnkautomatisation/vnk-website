// PDF generators pour l'export ZIP : conversation chat-style, RDV, litiges, audit, paiements
// Utilise PDFKit directement avec capture via PassThrough (meme pattern que pdf.tsx)
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const C = {
  navy: "#0F2D52",
  navyDeep: "#0A1F3A",
  blue: "#1B4F8A",
  blueLight: "#E0EDF8",
  green: "#27AE60",
  greenLight: "#EBF7F0",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
  gray: "#64748B",
  grayLight: "#F8FAFC",
  border: "#E2E8F0",
  text: "#1E293B",
  white: "#FFFFFF",
  bubbleClient: "#F1F5F9",
  bubbleVnk: "#0F2D52",
  internal: "#FEF3C7",
};

type CapturedDoc = InstanceType<typeof PDFDocument>;

function capture(fn: (doc: CapturedDoc) => void | Promise<void>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);
    Promise.resolve(fn(doc))
      .then(() => doc.end())
      .catch((e) => {
        try { doc.end(); } catch { /* noop */ }
        reject(e);
      });
  });
}

function header(doc: CapturedDoc, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 70).fill(C.navy);
  doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("VNK Automatisation", 50, 22);
  doc.fontSize(10).font("Helvetica").text(title, 50, 46);
  doc.fontSize(9).fillColor(C.blueLight).text(subtitle, doc.page.width - 250, 30, { width: 200, align: "right" });
  doc.fontSize(8).text(new Date().toLocaleString("fr-CA"), doc.page.width - 250, 46, { width: 200, align: "right" });
  doc.fillColor(C.text).font("Helvetica");
  doc.y = 90;
}

function footerOnAllPages(doc: CapturedDoc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 30;
    doc.fontSize(8).fillColor(C.gray).font("Helvetica");
    doc.text(`VNK Automatisation Inc. · vnkautomatisation@gmail.com · (819) 290-8686`, 50, bottom, {
      width: doc.page.width - 100, align: "left", lineBreak: false,
    });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`, doc.page.width - 100, bottom, {
      width: 50, align: "right", lineBreak: false,
    });
  }
}

function ensureSpace(doc: CapturedDoc, needed: number) {
  if (doc.y + needed > doc.page.height - 50) doc.addPage();
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
    header(doc, "Conversation complete", `${params.client.fullName} · ${params.client.email}`);

    if (params.messages.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun message echange.", { align: "center" });
      footerOnAllPages(doc);
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
        doc.fillColor(C.gray).fontSize(9).font("Helvetica-Bold").text(dateStr.toUpperCase(), { align: "center" });
        doc.moveDown(0.3);
        lastDate = dateStr;
      }

      const isVnk = m.sender === "vnk";
      const bubbleColor = m.isInternalNote ? C.internal : isVnk ? C.bubbleVnk : C.bubbleClient;
      const textColor = m.isInternalNote ? C.text : isVnk ? C.white : C.text;
      const labelColor = m.isInternalNote ? C.amber : C.gray;

      const senderLabel = m.isInternalNote ? "Note interne" : isVnk ? "VNK (admin)" : params.client.fullName;
      const timeStr = m.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

      doc.font("Helvetica-Bold").fontSize(8).fillColor(labelColor);
      const labelText = `${senderLabel} · ${timeStr}${m.editedAt ? " · modifie" : ""} · ${m.channel}`;

      // Pre-calc bubble height
      doc.font("Helvetica").fontSize(10);
      const contentText = m.content ?? "";
      const textHeight = contentText
        ? doc.heightOfString(contentText, { width: maxBubbleW - padX * 2 })
        : 0;

      // Image attachments (embed inline thumbnails — png/jpeg only)
      const imageAtts = m.attachments.filter((a) => a.kind === "image" && /^image\/(png|jpeg|jpg)$/i.test(a.mimeType));
      const otherAtts = m.attachments.filter((a) => !imageAtts.includes(a));

      const imgThumbW = 180;
      const imgThumbH = 120;
      const imgGap = 6;
      const imgsHeight = imageAtts.length > 0 ? Math.ceil(imageAtts.length / 2) * (imgThumbH + imgGap) + 6 : 0;
      const otherAttsHeight = otherAtts.length * 14 + (otherAtts.length > 0 ? 6 : 0);

      const bubbleH = padY * 2 + (contentText ? textHeight + (imgsHeight || otherAttsHeight ? 6 : 0) : 0) + imgsHeight + otherAttsHeight;
      const totalH = 14 + bubbleH + 8;

      ensureSpace(doc, totalH);

      const xLeft = 50;
      const xRight = doc.page.width - 50;
      const bubbleW = Math.min(maxBubbleW, xRight - xLeft - 60);
      const bubbleX = isVnk && !m.isInternalNote ? xRight - bubbleW : xLeft;

      // Label above bubble
      doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8).text(labelText, bubbleX, doc.y, {
        width: bubbleW, align: isVnk && !m.isInternalNote ? "right" : "left",
      });
      doc.moveDown(0.1);

      const bubbleY = doc.y;
      doc.roundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 8).fill(bubbleColor);

      let cursorY = bubbleY + padY;
      if (contentText) {
        doc.fillColor(textColor).font("Helvetica").fontSize(10);
        doc.text(contentText, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
        cursorY = doc.y + 4;
      }

      // Embed images (2 per row)
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

      // Other attachments (filename list)
      if (otherAtts.length > 0) {
        doc.fillColor(textColor).font("Helvetica-Oblique").fontSize(9);
        for (const att of otherAtts) {
          const sizeKb = Math.round(att.size / 1024);
          const icon = att.kind === "audio" ? "[audio]" : att.kind === "pdf" ? "[PDF]" : "[fichier]";
          const dur = att.durationSec ? ` ${Math.floor(att.durationSec / 60)}:${String(att.durationSec % 60).padStart(2, "0")}` : "";
          doc.text(`${icon} ${att.name} (${sizeKb} Ko)${dur}`, bubbleX + padX, cursorY, { width: bubbleW - padX * 2 });
          cursorY += 14;
        }
      }

      doc.y = bubbleY + bubbleH + 8;
    }

    footerOnAllPages(doc);
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
    header(doc, "Rendez-vous", `${params.client.fullName} · ${params.appointments.length} entrees`);

    if (params.appointments.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun rendez-vous.", { align: "center" });
      footerOnAllPages(doc);
      return;
    }

    for (const a of params.appointments) {
      ensureSpace(doc, 80);
      const y = doc.y;
      const x = 50;
      const w = doc.page.width - 100;

      doc.roundedRect(x, y, w, 70, 6).strokeColor(C.border).lineWidth(0.5).stroke();
      const dateStr = new Date(a.appointmentDate).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const time = a.startTime ? `${a.startTime}${a.endTime ? ` - ${a.endTime}` : ""}` : "";

      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text(a.subject ?? "(sans sujet)", x + 12, y + 10, { width: w - 24 });
      doc.fillColor(C.gray).font("Helvetica").fontSize(9).text(`${dateStr}  ${time}`, x + 12, y + 28);
      doc.text(`Type: ${a.meetingType ?? "—"}  ·  Statut: ${a.status}`, x + 12, y + 42);
      if (a.notesAdmin) {
        doc.fillColor(C.text).fontSize(8).text(a.notesAdmin, x + 12, y + 54, { width: w - 24, ellipsis: true, height: 14 });
      }
      doc.y = y + 80;
    }

    footerOnAllPages(doc);
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
    header(doc, "Litiges", `${params.client.fullName} · ${params.disputes.length} dossiers`);

    if (params.disputes.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun litige.", { align: "center" });
      footerOnAllPages(doc);
      return;
    }

    for (const d of params.disputes) {
      ensureSpace(doc, 200);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;

      const priorityColor = d.priority === "high" || d.priority === "urgent" ? C.red : d.priority === "medium" ? C.amber : C.gray;
      doc.rect(x, y, 4, 1).fill(priorityColor);

      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(13).text(d.title, x + 12, y, { width: w - 24 });
      doc.fillColor(C.gray).font("Helvetica").fontSize(9).text(
        `Ouvert le ${d.openedAt.toLocaleDateString("fr-CA")}  ·  Statut: ${d.status}  ·  Priorite: ${d.priority ?? "—"}`,
        x + 12,
      );

      const fields: [string, string | null | undefined][] = [
        ["Type", d.type],
        ["Categorie", d.category],
        ["Montant conteste", d.amountDisputed != null ? `${d.amountDisputed.toFixed(2)} ${d.currency ?? "CAD"}` : null],
        ["Stripe ID", d.stripeDisputeId],
        ["Raison Stripe", d.stripeReason],
        ["Resultat (outcome)", d.outcome],
        ["Echeance preuve", d.evidenceDueBy ? d.evidenceDueBy.toLocaleDateString("fr-CA") : null],
        ["Assigne a", d.assignedTo],
        ["Cabinet juridique", d.lawFirmInvolved],
        ["Numero de dossier", d.caseNumber],
        ["Tribunal", d.tribunal],
        ["Resolution", d.resolution],
        ["Resolu le", d.resolvedAt ? d.resolvedAt.toLocaleDateString("fr-CA") : null],
      ];

      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9);
      for (const [label, value] of fields) {
        if (!value) continue;
        ensureSpace(doc, 14);
        doc.fillColor(C.gray).text(`${label}:`, x + 12, doc.y, { continued: true, width: 130 });
        doc.fillColor(C.text).text(` ${value}`, { width: w - 140 });
      }

      if (d.description) {
        ensureSpace(doc, 30);
        doc.moveDown(0.3);
        doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(8).text("DESCRIPTION", x + 12);
        doc.fillColor(C.text).font("Helvetica").fontSize(9).text(d.description, x + 12, doc.y, { width: w - 24 });
      }

      if (d.internalNotes) {
        ensureSpace(doc, 30);
        doc.moveDown(0.3);
        doc.rect(x + 12, doc.y, w - 24, doc.heightOfString(d.internalNotes, { width: w - 36 }) + 12).fill(C.amberLight);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(8).text("NOTES INTERNES", x + 18, doc.y - doc.heightOfString(d.internalNotes, { width: w - 36 }) - 6);
        doc.fillColor(C.text).font("Helvetica").fontSize(9).text(d.internalNotes, x + 18, doc.y - doc.heightOfString(d.internalNotes, { width: w - 36 }) + 6, { width: w - 36 });
      }

      doc.moveDown(1);
      doc.strokeColor(C.border).lineWidth(0.3).moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
      doc.moveDown(0.5);
    }

    footerOnAllPages(doc);
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
    header(doc, "Timeline d'evenements (audit complet)", `${params.client.fullName} · ${params.events.length} evenements`);

    if (params.events.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucun evenement.", { align: "center" });
      footerOnAllPages(doc);
      return;
    }

    const sourceColor: Record<string, string> = {
      login: C.blue, order: C.green, signature: C.navy, consent: C.amber,
      email: C.gray, audit: C.red, workflow: C.blueLight,
    };

    let lastDate = "";
    for (const e of params.events) {
      const dateStr = e.createdAt.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 25);
        doc.moveDown(0.4);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text(dateStr.toUpperCase());
        doc.strokeColor(C.border).lineWidth(0.5).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.2);
        lastDate = dateStr;
      }

      ensureSpace(doc, 36);
      const x = 50;
      const y = doc.y;
      const w = doc.page.width - 100;
      const dotColor = sourceColor[e.source] ?? C.gray;

      doc.circle(x + 6, y + 6, 4).fill(dotColor);
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9).text(e.label, x + 20, y, { width: w - 80 });
      doc.fillColor(C.gray).font("Helvetica").fontSize(8).text(
        `${e.createdAt.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}  ·  ${e.source}/${e.type}`,
        x + 20, doc.y,
      );
      if (e.ipAddress || e.userAgent) {
        doc.fontSize(7).text(
          [e.ipAddress, e.userAgent ? e.userAgent.slice(0, 80) : null].filter(Boolean).join(" · "),
          x + 20, doc.y, { width: w - 30 },
        );
      }
      doc.moveDown(0.4);
    }

    footerOnAllPages(doc);
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
    header(doc, "Releve de paiements", `${params.client.fullName} · ${params.rows.length} transactions`);

    const totalIn = params.rows.filter((r) => r.type === "Paiement" && r.status === "succeeded").reduce((s, r) => s + r.amount, 0);
    const totalOut = params.rows.filter((r) => r.type === "Remboursement").reduce((s, r) => s + r.amount, 0);
    const net = totalIn - totalOut;

    // Sommaire
    const sx = 50;
    const sw = (doc.page.width - 100) / 3;
    [
      { l: "Total encaisse", v: totalIn, c: C.green },
      { l: "Total rembourse", v: totalOut, c: C.red },
      { l: "Net", v: net, c: C.navy },
    ].forEach((s, i) => {
      const x = sx + i * sw;
      doc.roundedRect(x + 4, doc.y, sw - 8, 50, 6).fill(C.grayLight);
      doc.fillColor(C.gray).font("Helvetica").fontSize(8).text(s.l, x + 12, doc.y - 44);
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(16).text(`${s.v.toFixed(2)} CAD`, x + 12, doc.y - 26);
    });
    doc.y += 14;
    doc.moveDown(1);

    if (params.rows.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text("Aucune transaction.", { align: "center" });
      footerOnAllPages(doc);
      return;
    }

    // Table
    const tx = 50;
    const tw = doc.page.width - 100;
    const cols = [
      { label: "Type", w: 70 },
      { label: "Date", w: 75 },
      { label: "Montant", w: 75 },
      { label: "Methode", w: 70 },
      { label: "Statut", w: 60 },
      { label: "Description", w: tw - 350 },
    ];

    const drawHead = () => {
      doc.rect(tx, doc.y, tw, 22).fill(C.navy);
      let cx = tx + 6;
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8);
      cols.forEach((c) => { doc.text(c.label, cx, doc.y - 16, { width: c.w - 6, lineBreak: false }); cx += c.w; });
      doc.y += 6;
    };
    drawHead();

    let alt = false;
    for (const r of params.rows) {
      ensureSpace(doc, 22);
      if (doc.y < 100) drawHead();
      const rowY = doc.y;
      if (alt) doc.rect(tx, rowY, tw, 18).fill(C.grayLight);
      alt = !alt;

      const cells = [
        r.type,
        r.date.toLocaleDateString("fr-CA"),
        `${r.amount.toFixed(2)} ${r.currency}`,
        r.method ?? "—",
        r.status,
        r.description,
      ];
      let cx = tx + 6;
      doc.fillColor(C.text).font("Helvetica").fontSize(8);
      cells.forEach((v, i) => {
        const col = cols[i];
        doc.text(String(v), cx, rowY + 5, { width: col.w - 6, lineBreak: false, ellipsis: true });
        cx += col.w;
      });
      doc.y = rowY + 18;
    }

    footerOnAllPages(doc);
  });
}
