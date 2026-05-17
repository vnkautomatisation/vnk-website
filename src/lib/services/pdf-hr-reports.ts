// PDF generator · Rapport RH (people analytics).
// Pattern aligne avec pdf-hr.ts : PDFKit + PassThrough capture, header VNK navy.
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const C = {
  brand: "#1B4F8A",
  navy: "#0F2D52",
  navyDeep: "#0A1F3A",
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
};

const COMPANY = {
  shortName: "Automatisation Inc.",
  fullName: "VNK Automatisation Inc.",
  tagline: "VALUE  NETWORK  KNOWLEDGE",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
};

const HEADER_H = 72;
const FOOTER_RESERVED = 36;

type CapturedDoc = InstanceType<typeof PDFDocument>;

function sanitize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{2300}-\u{23FF}]/gu, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/[\uD800-\uDFFF]/g, "");
}

function ensureSpace(doc: CapturedDoc, needed: number) {
  if (doc.y + needed > doc.page.height - FOOTER_RESERVED) {
    doc.addPage();
    doc.y = 50;
  }
}

function drawHexagonLogo(doc: CapturedDoc, cx: number, cy: number, size: number) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const radius = size * 0.175;
  doc.save();
  doc.lineWidth(1.5);
  doc.fillOpacity(0.10);
  doc.roundedRect(x, y, size, size, radius);
  doc.fillColor(C.white).fill();
  doc.fillOpacity(1).strokeOpacity(0.30);
  doc.roundedRect(x, y, size, size, radius);
  doc.strokeColor(C.white).stroke();
  doc.strokeOpacity(1).fillOpacity(1);
  const fontSize = size * 0.32;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(fontSize)
    .text("VNK", x, cy - fontSize * 0.50,
      { width: size, align: "center", lineBreak: false, characterSpacing: 0.8 });
  doc.restore();
}

function drawHeader(doc: CapturedDoc, title: string, subtitle: string) {
  const w = doc.page.width;
  doc.save();
  doc.rect(0, 0, w, HEADER_H).fill(C.navy);
  doc.rect(0, HEADER_H - 2, w, 2).fill(C.brand);

  const hexCx = 52, hexCy = HEADER_H / 2, hexSize = 46;
  drawHexagonLogo(doc, hexCx, hexCy, hexSize);

  const textX = hexCx + hexSize / 2 + 14;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(15)
    .text(COMPANY.shortName, textX, hexCy - 12, { lineBreak: false });

  doc.save();
  doc.fillOpacity(0.65);
  doc.fillColor(C.white).font("Helvetica").fontSize(7.5)
    .text(COMPANY.tagline, textX, hexCy + 8, { lineBreak: false, characterSpacing: 2.2 });
  doc.restore();

  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(12)
    .text(title, 0, 18, { width: w - 35, align: "right", lineBreak: false });
  doc.save();
  doc.fillOpacity(0.78);
  doc.fillColor(C.white).font("Helvetica").fontSize(8.5)
    .text(subtitle, 0, 37, { width: w - 35, align: "right", lineBreak: false });
  doc.restore();
  doc.save();
  doc.fillOpacity(0.55);
  doc.fillColor(C.white).fontSize(7.5)
    .text(new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }),
      0, 51, { width: w - 35, align: "right", lineBreak: false });
  doc.restore();

  doc.restore();
  doc.fillColor(C.text).font("Helvetica");
  doc.y = HEADER_H + 18;
}

function sectionTitle(doc: CapturedDoc, label: string, color = C.brand) {
  ensureSpace(doc, 30);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(50, y + 1, 3, 11).fill(color);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(9.5)
    .text(label.toUpperCase(), 60, y, { lineBreak: false, characterSpacing: 0.8 });
  doc.strokeColor(C.border).lineWidth(0.5)
    .moveTo(50, y + 16).lineTo(doc.page.width - 50, y + 16).stroke();
  doc.y = y + 22;
  doc.fillColor(C.text);
}

function finalizeFooter(doc: CapturedDoc) {
  const range = doc.bufferedPageRange();
  const footerText = `Confidentiel — Document interne ${COMPANY.fullName}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    doc.strokeColor(C.border).lineWidth(0.5)
      .moveTo(50, h - 30).lineTo(w - 50, h - 30).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text(footerText, 50, h - 22, { width: w - 200, align: "left", lineBreak: false });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`,
      w - 130, h - 22, { width: 80, align: "right", lineBreak: false });
  }
}

function capture(fn: (doc: CapturedDoc) => void | Promise<void>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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

// ─────────────────────────────────────────────────────────
// Helpers visuels specifiques au rapport RH
// ─────────────────────────────────────────────────────────

// Carte KPI : valeur grande + libelle petit.
function drawKpiRow(
  doc: CapturedDoc,
  cards: Array<{ label: string; value: string; tone?: "navy" | "green" | "red" | "neutral" }>,
) {
  const x = 50;
  const w = doc.page.width - 100;
  const gap = 10;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;
  const cardH = 58;
  ensureSpace(doc, cardH + 8);
  const y = doc.y;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cx = x + i * (cardW + gap);
    let accent = C.navy;
    let valueColor = C.text;
    if (c.tone === "green") { accent = C.green; valueColor = C.green; }
    else if (c.tone === "red") { accent = C.red; valueColor = C.red; }
    else if (c.tone === "neutral") { accent = C.gray; }
    doc.roundedRect(cx, y, cardW, cardH, 5).fillAndStroke(C.grayLight, C.border);
    doc.rect(cx, y, 3, cardH).fill(accent);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text(sanitize(c.label).toUpperCase(), cx + 12, y + 10,
        { width: cardW - 20, lineBreak: false, ellipsis: true, characterSpacing: 0.5 });
    doc.fillColor(valueColor).font("Helvetica-Bold").fontSize(22)
      .text(sanitize(c.value), cx + 12, y + 24,
        { width: cardW - 20, lineBreak: false, ellipsis: true });
  }
  doc.y = y + cardH + 10;
  doc.fillColor(C.text);
}

// Table breakdown avec barre de progression horizontale.
function drawBreakdownTable(
  doc: CapturedDoc,
  title: string,
  rows: Array<{ name: string; count: number; pct: number }>,
) {
  sectionTitle(doc, title);
  if (rows.length === 0) {
    ensureSpace(doc, 16);
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(9)
      .text("Aucune donnee disponible.", 50, doc.y, {
        width: doc.page.width - 100, lineBreak: false,
      });
    doc.y += 16;
    doc.fillColor(C.text);
    return;
  }

  const x = 50;
  const w = doc.page.width - 100;
  const rowH = 22;

  // Header colonnes
  ensureSpace(doc, rowH);
  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
    .text("LIBELLE", x + 6, doc.y, { lineBreak: false, characterSpacing: 0.5 });
  doc.text("EFFECTIF", x + w - 180, doc.y, {
    width: 50, align: "right", lineBreak: false, characterSpacing: 0.5,
  });
  doc.text("PART", x + w - 30, doc.y, {
    width: 30, align: "right", lineBreak: false, characterSpacing: 0.5,
  });
  doc.y += 12;
  doc.strokeColor(C.border).lineWidth(0.5)
    .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
  doc.y += 4;

  rows.forEach((r, i) => {
    ensureSpace(doc, rowH + 2);
    const ry = doc.y;
    if (i % 2 === 1) {
      doc.rect(x, ry - 2, w, rowH).fill(C.grayLight);
    }
    // Libelle
    doc.fillColor(C.text).font("Helvetica").fontSize(9)
      .text(sanitize(r.name), x + 6, ry + 2, {
        width: w - 250, lineBreak: false, ellipsis: true,
      });
    // Mini-bar (situe juste sous le libelle, alignee a droite de la zone libelle)
    const barX = x + 6;
    const barY = ry + 14;
    const barW = w - 260;
    const barH = 4;
    doc.roundedRect(barX, barY, barW, barH, 2).fill(C.border);
    const filled = Math.max(2, (barW * Math.min(100, r.pct)) / 100);
    doc.roundedRect(barX, barY, filled, barH, 2).fill(C.navy);
    // Effectif + pct
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
      .text(String(r.count), x + w - 180, ry + 4, {
        width: 50, align: "right", lineBreak: false,
      });
    doc.fillColor(C.gray).font("Helvetica").fontSize(9)
      .text(`${r.pct}%`, x + w - 30, ry + 4, {
        width: 30, align: "right", lineBreak: false,
      });
    doc.y = ry + rowH;
  });

  doc.y += 4;
  doc.fillColor(C.text);
}

function drawIndicatorGrid(
  doc: CapturedDoc,
  items: Array<{ label: string; value: string; tone?: "amber" | "red" | "neutral" }>,
) {
  const x = 50;
  const w = doc.page.width - 100;
  const cols = 2;
  const gap = 10;
  const cardW = (w - gap * (cols - 1)) / cols;
  const cardH = 38;
  let y = doc.y;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % cols;
    if (col === 0 && i > 0) y += cardH + gap;
    if (col === 0) ensureSpace(doc, cardH + gap);
    if (col === 0) y = doc.y;
    const cx = x + col * (cardW + gap);
    let bg = C.grayLight;
    let accent = C.navy;
    if (item.tone === "amber") { bg = C.amberLight; accent = C.amber; }
    else if (item.tone === "red") { bg = C.redLight; accent = C.red; }
    doc.roundedRect(cx, y, cardW, cardH, 5).fillAndStroke(bg, C.border);
    doc.rect(cx, y, 3, cardH).fill(accent);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text(sanitize(item.label).toUpperCase(), cx + 12, y + 8,
        { width: cardW - 20, lineBreak: false, ellipsis: true, characterSpacing: 0.5 });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(14)
      .text(sanitize(item.value), cx + 12, y + 19,
        { width: cardW - 20, lineBreak: false, ellipsis: true });
  }
  doc.y = y + cardH + 10;
  doc.fillColor(C.text);
}

// ─────────────────────────────────────────────────────────
// Export public
// ─────────────────────────────────────────────────────────

export type HrReportData = {
  generatedAt: Date;
  periodLabel: string;
  headcountActive: number;
  headcountInactive: number;
  hiresLast12Months: number;
  departuresLast12Months: number;
  turnoverPct: number;
  avgTenureYears: number;
  positionsBreakdown: { name: string; count: number; pct: number }[];
  teamsBreakdown: { name: string; count: number; pct: number }[];
  pendingLeaves: number;
  approvedLeavesThisMonth: number;
  openCnesstCases: number;
  upcomingAnniversaries: number;
};

export async function generateHrReportPdf(data: HrReportData): Promise<Buffer> {
  return capture((doc) => {
    drawHeader(doc, "Rapport RH", `Periode : ${sanitize(data.periodLabel)}`);

    // Effectif
    sectionTitle(doc, "Effectif");
    drawKpiRow(doc, [
      { label: "Actifs", value: String(data.headcountActive), tone: "navy" },
      { label: "Inactifs", value: String(data.headcountInactive), tone: "neutral" },
      { label: "Anciennete moyenne", value: `${data.avgTenureYears.toFixed(1)} ans`, tone: "navy" },
    ]);

    // Mouvements 12 mois
    sectionTitle(doc, "Mouvements 12 mois");
    drawKpiRow(doc, [
      { label: "Embauches", value: `+${data.hiresLast12Months}`, tone: "green" },
      { label: "Departs", value: `-${data.departuresLast12Months}`, tone: "red" },
      { label: "Taux turnover", value: `${data.turnoverPct.toFixed(1)} %`, tone: "navy" },
    ]);

    // Repartitions
    drawBreakdownTable(doc, "Repartition par poste (top 10)", data.positionsBreakdown);
    drawBreakdownTable(doc, "Repartition par equipe (top 10)", data.teamsBreakdown);

    // Indicateurs operationnels
    sectionTitle(doc, "Indicateurs operationnels");
    drawIndicatorGrid(doc, [
      {
        label: "Conges en attente",
        value: String(data.pendingLeaves),
        tone: data.pendingLeaves > 0 ? "amber" : "neutral",
      },
      {
        label: "Conges approuves ce mois",
        value: String(data.approvedLeavesThisMonth),
        tone: "neutral",
      },
      {
        label: "Cas CNESST ouverts",
        value: String(data.openCnesstCases),
        tone: data.openCnesstCases > 0 ? "red" : "neutral",
      },
      {
        label: "Anniversaires (30 j)",
        value: String(data.upcomingAnniversaries),
        tone: "neutral",
      },
    ]);

    // Note de pied
    doc.moveDown(0.6);
    ensureSpace(doc, 30);
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7.5)
      .text(
        "Donnees calculees a la date de generation a partir du portail VNK. " +
        "Le turnover est calcule selon la formule : departs / effectif moyen de la periode.",
        50, doc.y, { width: doc.page.width - 100, align: "justify" },
      );
  });
}
