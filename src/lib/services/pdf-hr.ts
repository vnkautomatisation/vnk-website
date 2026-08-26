// HR PDF generators: pay stub, employment contract, employment letter.
// Same pattern as pdf-export.ts (PDFKit + PassThrough capture, navy header).
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ─────────────────────────────────────────────────────────
// Colors and constants, aligned with pdf-export.ts
// ─────────────────────────────────────────────────────────
const C = {
  brand: "#1B4F8A",
  brandBg: "#EBF2FA",
  navy: "#0F2D52",
  navyDeep: "#0A1F3A",
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
};

const COMPANY = {
  shortName: "Automatisation Inc.",
  fullName: "VNK Automatisation Inc.",
  tagline: "VALUE · NETWORK · KNOWLEDGE",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
  address: "Mauricie, Quebec, Canada",
};

const HEADER_H = 72;
const FOOTER_RESERVED = 36;

// ─────────────────────────────────────────────────────────
// Helpers, simplified from pdf-export.ts
// ─────────────────────────────────────────────────────────
type CapturedDoc = InstanceType<typeof PDFDocument>;

function capture(fn: (doc: CapturedDoc) => void | Promise<void>, footerText?: string): Promise<Buffer> {
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
        finalizeFooter(doc, footerText);
        doc.end();
      })
      .catch((e) => {
        try { doc.end(); } catch { /* noop */ }
        reject(e);
      });
  });
}

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

function finalizeFooter(doc: CapturedDoc, override?: string) {
  const range = doc.bufferedPageRange();
  const baseFooter = `${COMPANY.fullName}  ·  ${COMPANY.email}  ·  ${COMPANY.phone}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    doc.strokeColor(C.border).lineWidth(0.5)
      .moveTo(50, h - 30).lineTo(w - 50, h - 30).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text(override ?? baseFooter,
        50, h - 22, { width: w - 200, align: "left", lineBreak: false });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`,
      w - 130, h - 22, { width: 80, align: "right", lineBreak: false });
  }
}

// CAD amount, two decimals.
function money(n: number): string {
  return `${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} $`;
}

// Two-column info block: label / value.
function drawInfoBlock(
  doc: CapturedDoc,
  title: string,
  rows: Array<[string, string]>,
  opts?: { bg?: string; accent?: string },
) {
  const x = 50;
  const w = doc.page.width - 100;
  const padX = 14;
  const padY = 10;
  const rowH = 16;
  const titleH = 18;
  const innerH = rows.length * rowH;
  const h = titleH + innerH + padY * 2;
  ensureSpace(doc, h + 8);
  const y = doc.y;

  doc.roundedRect(x, y, w, h, 5).fillAndStroke(opts?.bg ?? C.grayLight, C.border);
  doc.rect(x, y, 3, h).fill(opts?.accent ?? C.brand);

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
    .text(title.toUpperCase(), x + padX, y + padY, { lineBreak: false, characterSpacing: 0.6 });

  rows.forEach(([label, value], i) => {
    const ry = y + padY + titleH + i * rowH;
    doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
      .text(label, x + padX, ry, { width: 140, lineBreak: false });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9)
      .text(sanitize(value) || "—", x + padX + 145, ry, {
        width: w - padX * 2 - 145,
        lineBreak: false,
        ellipsis: true,
      });
  });

  doc.y = y + h + 10;
}

// Three-column table: label, detail, amount.
function drawAmountTable(
  doc: CapturedDoc,
  title: string,
  rows: Array<{ label: string; detail?: string; amount: number; negative?: boolean }>,
  totalRow?: { label: string; amount: number; emphasize?: boolean },
) {
  sectionTitle(doc, title);
  const x = 50;
  const w = doc.page.width - 100;
  const rowH = 18;
  const colDetail = x + 240;
  const colAmount = x + w - 100;

  // Header
  ensureSpace(doc, rowH);
  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
    .text("DESCRIPTION", x + 6, doc.y, { lineBreak: false, characterSpacing: 0.6 });
  doc.text("DETAIL", colDetail, doc.y, { lineBreak: false, characterSpacing: 0.6 });
  doc.text("MONTANT", colAmount, doc.y, {
    width: w - (colAmount - x) - 6, align: "right", lineBreak: false, characterSpacing: 0.6,
  });
  doc.y += 14;
  doc.strokeColor(C.border).lineWidth(0.5).moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
  doc.y += 4;

  // Rows
  rows.forEach((r, i) => {
    ensureSpace(doc, rowH + 2);
    const ry = doc.y;
    if (i % 2 === 1) {
      doc.rect(x, ry - 2, w, rowH).fill(C.grayLight);
    }
    doc.fillColor(C.text).font("Helvetica").fontSize(9)
      .text(sanitize(r.label), x + 6, ry + 3, { width: 230, lineBreak: false, ellipsis: true });
    if (r.detail) {
      doc.fillColor(C.gray).fontSize(8.5)
        .text(sanitize(r.detail), colDetail, ry + 3, {
          width: colAmount - colDetail - 6, lineBreak: false, ellipsis: true,
        });
    }
    const amtStr = (r.negative ? "−" : "") + money(Math.abs(r.amount));
    doc.fillColor(r.negative ? C.red : C.text).font("Helvetica-Bold").fontSize(9)
      .text(amtStr, colAmount, ry + 3, {
        width: w - (colAmount - x) - 6, align: "right", lineBreak: false,
      });
    doc.y = ry + rowH;
  });

  if (totalRow) {
    ensureSpace(doc, rowH + 4);
    const ry = doc.y;
    doc.strokeColor(C.border).lineWidth(0.5).moveTo(x, ry).lineTo(x + w, ry).stroke();
    doc.y += 4;
    const ty = doc.y;
    doc.fillColor(totalRow.emphasize ? C.navy : C.text)
      .font("Helvetica-Bold").fontSize(totalRow.emphasize ? 11 : 9.5)
      .text(sanitize(totalRow.label), x + 6, ty + 1, { lineBreak: false });
    doc.text(money(totalRow.amount), colAmount, ty + 1, {
      width: w - (colAmount - x) - 6, align: "right", lineBreak: false,
    });
    doc.y = ty + (totalRow.emphasize ? 18 : 16);
  }

  doc.fillColor(C.text);
  doc.moveDown(0.4);
}

function formatDate(d: Date | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!d) return "—";
  const locale = lang === "en" ? "en-CA" : "fr-CA";
  return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

/** Date-only columns (@db.Date) carry their calendar day in UTC. */
function formatDayOnly(d: Date | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!d) return "—";
  const locale = lang === "en" ? "en-CA" : "fr-CA";
  return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDayOnlyShort(d: Date | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!d) return "—";
  const locale = lang === "en" ? "en-CA" : "fr-CA";
  return new Date(d).toLocaleDateString(locale, { timeZone: "UTC" });
}

function formatDateShort(d: Date | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!d) return "—";
  const locale = lang === "en" ? "en-CA" : "fr-CA";
  return new Date(d).toLocaleDateString(locale);
}

// ═══════════════════════════════════════════════════════════
// 1. PAY STUB
// ═══════════════════════════════════════════════════════════
export type PayStubData = {
  id: number;
  hoursRegular: number; hoursOvertime: number; hoursVacation: number; hoursSick: number;
  hoursHoliday: number;
  holidayIndemnity: number;
  rate: number; grossPay: number;
  deductionFederal: number; deductionProvincial: number; deductionRrq: number;
  deductionAe: number; deductionRqap: number; deductionOther: number;
  netPay: number;
  releasedAt: Date | null;
};
export type AdminInfo = { fullName: string | null; email: string; position?: string | null };
export type PeriodInfo = { startDate: Date; endDate: Date; payDate: Date; status: string };

export async function generatePayStubPdf(params: {
  stub: PayStubData;
  admin: AdminInfo;
  period: PeriodInfo;
}): Promise<Buffer> {
  const { stub, admin, period } = params;
  return capture((doc) => {
    drawHeader(
      doc,
      "Bulletin de paie",
      `Periode ${formatDayOnlyShort(period.startDate)} → ${formatDayOnlyShort(period.endDate)}`,
    );

    // Employee and period, side by side.
    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
      ["Poste", sanitize(admin.position) || "—"],
    ]);

    const statusLabel = stub.releasedAt
      ? `Publie (${formatDateShort(stub.releasedAt)})`
      : "Brouillon";
    drawInfoBlock(doc, "Periode de paie", [
      ["Debut", formatDayOnly(period.startDate)],
      ["Fin", formatDayOnly(period.endDate)],
      ["Date de paie", formatDayOnly(period.payDate)],
      ["Statut bulletin", statusLabel],
    ], { accent: C.navy });

    // Hours
    const rate = Number(stub.rate);
    const heuresRows: Array<{ label: string; detail?: string; amount: number }> = [];
    const hReg = Number(stub.hoursRegular);
    const otherRows = Number(stub.hoursOvertime) + Number(stub.hoursHoliday)
      + Number(stub.holidayIndemnity) + Number(stub.hoursVacation) + Number(stub.hoursSick);
    if (hReg > 0 || otherRows === 0) {
      heuresRows.push({
        label: "Heures regulieres",
        detail: `${hReg.toFixed(2)} h × ${money(rate)}`,
        amount: hReg * rate,
      });
    }
    const hOt = Number(stub.hoursOvertime);
    if (hOt > 0) {
      heuresRows.push({
        label: "Heures supplementaires",
        detail: `${hOt.toFixed(2)} h × ${money(rate * 1.5)}`,
        amount: hOt * rate * 1.5,
      });
    }
    const hHol = Number(stub.hoursHoliday);
    if (hHol > 0) {
      heuresRows.push({
        label: "Jour ferie travaille",
        detail: `${hHol.toFixed(2)} h × ${money(rate * 2)}`,
        amount: hHol * rate * 2,
      });
    }
    const indemnity = Number(stub.holidayIndemnity);
    if (indemnity > 0) {
      heuresRows.push({
        label: "Indemnite de jour ferie",
        detail: "1/20 des 4 semaines precedentes",
        amount: indemnity,
      });
    }
    const hVac = Number(stub.hoursVacation);
    if (hVac > 0) {
      heuresRows.push({
        label: "Vacances",
        detail: `${hVac.toFixed(2)} h × ${money(rate)}`,
        amount: hVac * rate,
      });
    }
    const hSick = Number(stub.hoursSick);
    if (hSick > 0) {
      heuresRows.push({
        label: "Maladie",
        detail: `${hSick.toFixed(2)} h × ${money(rate)}`,
        amount: hSick * rate,
      });
    }
    drawAmountTable(doc, "Heures et remuneration", heuresRows, {
      label: "Brut total",
      amount: Number(stub.grossPay),
    });

    // Deductions
    const deductionRows = [
      { label: "Impot federal", amount: Number(stub.deductionFederal), negative: true },
      { label: "Impot provincial (Quebec)", amount: Number(stub.deductionProvincial), negative: true },
      { label: "RRQ - Regime de rentes du Quebec", amount: Number(stub.deductionRrq), negative: true },
      { label: "AE - Assurance-emploi", amount: Number(stub.deductionAe), negative: true },
      { label: "RQAP - Assurance parentale", amount: Number(stub.deductionRqap), negative: true },
      { label: "Autres deductions", amount: Number(stub.deductionOther), negative: true },
    ];
    const totalDed = deductionRows.reduce((s, r) => s + r.amount, 0);
    drawAmountTable(doc, "Deductions a la source", deductionRows, {
      label: "Total deductions",
      amount: totalDed,
    });

    // Net pay, in a navy frame.
    ensureSpace(doc, 60);
    const x = 50;
    const w = doc.page.width - 100;
    const y = doc.y + 4;
    const h = 52;
    doc.roundedRect(x, y, w, h, 6).fill(C.navy);
    doc.fillColor(C.white).fillOpacity(0.7).font("Helvetica-Bold").fontSize(9)
      .text("NET A PAYER", x + 16, y + 14, { lineBreak: false, characterSpacing: 0.8 });
    doc.fillOpacity(1);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(22)
      .text(money(Number(stub.netPay)), x, y + 14, {
        width: w - 16, align: "right", lineBreak: false,
      });
    doc.y = y + h + 12;

    // Footer info
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8)
      .text(
        "Pour usage personnel uniquement — conservez ce document pour fins fiscales. " +
        "Les montants des deductions a la source sont provisoires et peuvent etre ajustes lors du calcul officiel de fin d'annee (Releve 1 / T4).",
        50, doc.y, { width: doc.page.width - 100, align: "justify" },
      );
  });
}

// ═══════════════════════════════════════════════════════════
// 2. CONTRAT D'EMPLOI
// ═══════════════════════════════════════════════════════════
export type ContractData = {
  id: number; title: string; contractType: string; bodyMarkdown: string;
  startDate: Date; endDate: Date | null; probationEndDate: Date | null;
  salaryAnnual: number | null; hourlyRate: number | null;
  hoursPerWeek: number | null; vacationPct: number | null;
  employeeSignedAt: Date | null; employerSignedAt: Date | null;
};
export type Person = { fullName: string | null; email: string };

// ASCII labels: the PDF font carries no accents.
// Covers the current QC values and the legacy ones.
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  // Current QC values
  permanent_full_time: "Permanent temps plein",
  permanent_part_time: "Permanent temps partiel",
  temporary: "Temporaire (duree determinee)",
  seasonal: "Saisonnier",
  on_call: "Sur appel",
  student: "Etudiant (temps partiel)",
  internship: "Stage remunere",
  freelance: "Pigiste / Travailleur autonome",
  // Legacy values
  cdi: "Permanent temps plein",
  cdd: "Temporaire (duree determinee)",
  contractuel: "Pigiste / Travailleur autonome",
  stagiaire: "Stage remunere",
  etudiant: "Etudiant (temps partiel)",
  permanent: "Permanent temps plein",
  autre: "Autre",
};

export async function generateContractPdf(params: {
  contract: ContractData;
  admin: Person;
  employer: Person | null;
}): Promise<Buffer> {
  const { contract, admin, employer } = params;
  return capture((doc) => {
    drawHeader(doc, "Contrat d'emploi", sanitize(contract.title));

    // Parties
    drawInfoBlock(doc, "Employeur", [
      ["Nom", COMPANY.fullName],
      ["Adresse", COMPANY.address],
      ["Courriel", COMPANY.email],
      ["Telephone", COMPANY.phone],
    ], { accent: C.navy });

    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
    ]);

    // Terms
    const conditions: Array<[string, string]> = [
      ["Titre du contrat", sanitize(contract.title)],
      ["Type", CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType.toUpperCase()],
      ["Date de debut", formatDayOnly(contract.startDate)],
    ];
    if (contract.endDate) conditions.push(["Date de fin", formatDayOnly(contract.endDate)]);
    if (contract.probationEndDate) conditions.push(["Fin probation", formatDayOnly(contract.probationEndDate)]);
    if (contract.salaryAnnual != null) {
      conditions.push(["Salaire annuel", `${money(Number(contract.salaryAnnual))} CAD`]);
    }
    if (contract.hourlyRate != null) {
      conditions.push(["Taux horaire", `${money(Number(contract.hourlyRate))} CAD`]);
    }
    if (contract.hoursPerWeek != null) {
      conditions.push(["Heures par semaine", `${contract.hoursPerWeek} h`]);
    }
    if (contract.vacationPct != null) {
      conditions.push(["Vacances", `${Number(contract.vacationPct).toFixed(1)} %`]);
    }
    drawInfoBlock(doc, "Conditions", conditions, { accent: C.green });

    // Body of the contract
    sectionTitle(doc, "Termes et conditions");
    const x = 50;
    const w = doc.page.width - 100;
    const paragraphs = (contract.bodyMarkdown || "").split(/\n\s*\n/);
    doc.fillColor(C.text).font("Helvetica").fontSize(9.5);
    for (const p of paragraphs) {
      const text = sanitize(p.trim());
      if (!text) continue;
      const isHeading = /^#+\s/.test(p);
      if (isHeading) {
        const clean = text.replace(/^#+\s*/, "");
        ensureSpace(doc, 18);
        doc.moveDown(0.3);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10.5)
          .text(clean, x, doc.y, { width: w });
        doc.fillColor(C.text).font("Helvetica").fontSize(9.5);
        doc.moveDown(0.2);
      } else {
        const h = doc.heightOfString(text, { width: w });
        ensureSpace(doc, h + 4);
        doc.text(text, x, doc.y, { width: w, align: "justify" });
        doc.moveDown(0.4);
      }
    }

    // Signatures
    sectionTitle(doc, "Signatures");
    const sigW = (w - 12) / 2;
    const sigH = 70;
    ensureSpace(doc, sigH + 12);
    const sy = doc.y;

    // Employee block
    doc.roundedRect(x, sy, sigW, sigH, 4).fillAndStroke(C.grayLight, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text("EMPLOYE", x + 12, sy + 8, { lineBreak: false, characterSpacing: 0.6 });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
      .text(sanitize(admin.fullName) || sanitize(admin.email), x + 12, sy + 22,
        { width: sigW - 24, lineBreak: false, ellipsis: true });
    if (contract.employeeSignedAt) {
      doc.fillColor(C.green).font("Helvetica").fontSize(8.5)
        .text(`Signe le ${formatDateShort(contract.employeeSignedAt)}`,
          x + 12, sy + 40, { width: sigW - 24, lineBreak: false });
    } else {
      doc.fillColor(C.amber).font("Helvetica-Oblique").fontSize(8.5)
        .text("Signature en attente", x + 12, sy + 40, { width: sigW - 24, lineBreak: false });
    }

    // Employer block
    const ex = x + sigW + 12;
    doc.roundedRect(ex, sy, sigW, sigH, 4).fillAndStroke(C.grayLight, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text("EMPLOYEUR", ex + 12, sy + 8, { lineBreak: false, characterSpacing: 0.6 });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
      .text(sanitize(employer?.fullName) || COMPANY.fullName,
        ex + 12, sy + 22, { width: sigW - 24, lineBreak: false, ellipsis: true });
    if (contract.employerSignedAt) {
      doc.fillColor(C.green).font("Helvetica").fontSize(8.5)
        .text(`Signe le ${formatDateShort(contract.employerSignedAt)}`,
          ex + 12, sy + 40, { width: sigW - 24, lineBreak: false });
    } else {
      doc.fillColor(C.amber).font("Helvetica-Oblique").fontSize(8.5)
        .text("Signature en attente", ex + 12, sy + 40, { width: sigW - 24, lineBreak: false });
    }
    doc.y = sy + sigH + 12;

    // Confidentiality note
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7.5)
      .text(
        "Document confidentiel - reserve aux parties signataires. " +
        "Le present contrat est regi par les lois du Quebec et du Canada.",
        50, doc.y, { width: doc.page.width - 100, align: "center" },
      );
  });
}

// ═══════════════════════════════════════════════════════════
// 3. EMPLOYMENT LETTER
// ═══════════════════════════════════════════════════════════
export type LetterPurpose = "mortgage" | "visa" | "landlord" | "other"
  | "bank" | "rental" | "embassy" | "hypothec";

export type LetterParams = {
  admin: { fullName: string | null; email: string; position?: string | null; startDate?: Date | null };
  purpose: LetterPurpose;
  language: "fr" | "en";
  contract?: { salaryAnnual: number | null; hourlyRate: number | null; hoursPerWeek: number | null } | null;
  customBody?: string | null;
  signedBy: { fullName: string | null; email: string };
};

// Maps the extended purposes of the Prisma schema onto the logical categories.
function normalizePurpose(p: LetterPurpose): "mortgage" | "visa" | "landlord" | "other" {
  switch (p) {
    case "hypothec":
    case "bank":
    case "mortgage":
      return "mortgage";
    case "embassy":
    case "visa":
      return "visa";
    case "rental":
    case "landlord":
      return "landlord";
    default:
      return "other";
  }
}

function buildLetterBody(params: LetterParams): { title: string; paragraphs: string[]; salutation: string; closing: string } {
  const { admin, contract, language } = params;
  const fr = language === "fr";
  const purpose = normalizePurpose(params.purpose);
  const empName = sanitize(admin.fullName) || sanitize(admin.email);
  const position = sanitize(admin.position);
  const startDateStr = admin.startDate ? formatDayOnly(admin.startDate, language) : null;

  const salary = contract?.salaryAnnual ? Number(contract.salaryAnnual) : null;
  const rate = contract?.hourlyRate ? Number(contract.hourlyRate) : null;
  const hpw = contract?.hoursPerWeek ? Number(contract.hoursPerWeek) : null;

  const compStr = salary
    ? (fr ? `un salaire annuel de ${money(salary)} CAD` : `an annual salary of CAD ${money(salary)}`)
    : rate
    ? (fr ? `un taux horaire de ${money(rate)} CAD` : `an hourly rate of CAD ${money(rate)}`)
    : null;
  const hpwStr = hpw
    ? (fr ? `${hpw} heures par semaine` : `${hpw} hours per week`)
    : null;

  const salutation = fr ? "A qui de droit," : "To whom it may concern,";
  const closing = fr
    ? `Cordialement,\n\n${sanitize(params.signedBy.fullName) || sanitize(params.signedBy.email)}\nRessources humaines, ${COMPANY.fullName}`
    : `Sincerely,\n\n${sanitize(params.signedBy.fullName) || sanitize(params.signedBy.email)}\nHuman Resources, ${COMPANY.fullName}`;

  if (params.customBody && params.customBody.trim()) {
    return {
      title: fr ? "Lettre d'emploi" : "Employment Letter",
      paragraphs: params.customBody.split(/\n\s*\n/).map((p) => sanitize(p.trim())).filter(Boolean),
      salutation,
      closing,
    };
  }

  const paragraphs: string[] = [];

  if (purpose === "mortgage") {
    paragraphs.push(
      fr
        ? `La presente confirme que ${empName} est un employe en regle de ${COMPANY.fullName}${startDateStr ? `, et ce, depuis le ${startDateStr}` : ""}.${position ? ` Il/Elle occupe presentement le poste de ${position}.` : ""}`
        : `This letter confirms that ${empName} is a current employee in good standing at ${COMPANY.fullName}${startDateStr ? `, since ${startDateStr}` : ""}.${position ? ` Their current position is ${position}.` : ""}`,
    );
    if (compStr) {
      paragraphs.push(
        fr
          ? `Son emploi est de nature permanente et ${fr ? "il/elle beneficie d'" : "they receive "}${compStr}${hpwStr ? `, base sur ${hpwStr}` : ""}.`
          : `Their employment is permanent and they receive ${compStr}${hpwStr ? `, based on ${hpwStr}` : ""}.`,
      );
    }
    paragraphs.push(
      fr
        ? "La presente lettre est emise a la demande de l'employe pour fins de financement hypothecaire ou bancaire."
        : "This letter is issued at the employee's request for the purpose of mortgage or bank financing.",
    );
  } else if (purpose === "visa") {
    paragraphs.push(
      fr
        ? `La presente confirme que ${empName} est un employe de ${COMPANY.fullName}${startDateStr ? `, depuis le ${startDateStr}` : ""}.${position ? ` Il/Elle occupe le poste de ${position}.` : ""}`
        : `This letter confirms that ${empName} is an employee of ${COMPANY.fullName}${startDateStr ? `, since ${startDateStr}` : ""}.${position ? ` Their position is ${position}.` : ""}`,
    );
    if (compStr) {
      paragraphs.push(
        fr
          ? `${empName} beneficie de ${compStr}${hpwStr ? `, a raison de ${hpwStr}` : ""}.`
          : `${empName} earns ${compStr}${hpwStr ? `, working ${hpwStr}` : ""}.`,
      );
    }
    paragraphs.push(
      fr
        ? "Cette lettre est emise aux fins d'une demande d'immigration / visa et atteste de la duree et de la nature de l'emploi."
        : "This letter is issued for the purposes of an immigration / visa application and confirms the duration and nature of employment.",
    );
  } else if (purpose === "landlord") {
    paragraphs.push(
      fr
        ? `La presente confirme que ${empName} est un employe en regle de ${COMPANY.fullName}${startDateStr ? `, depuis le ${startDateStr}` : ""}.${position ? ` Il/Elle occupe le poste de ${position}.` : ""}`
        : `This letter confirms that ${empName} is an employee in good standing at ${COMPANY.fullName}${startDateStr ? `, since ${startDateStr}` : ""}.${position ? ` Their position is ${position}.` : ""}`,
    );
    if (compStr) {
      paragraphs.push(
        fr
          ? `Son revenu courant est de ${compStr}${hpwStr ? ` (${hpwStr})` : ""}.`
          : `Their current income is ${compStr}${hpwStr ? ` (${hpwStr})` : ""}.`,
      );
    }
    paragraphs.push(
      fr
        ? "Cette lettre est emise pour appuyer une demande de location residentielle."
        : "This letter is issued in support of a residential rental application.",
    );
  } else {
    paragraphs.push(
      fr
        ? `La presente confirme que ${empName} est un employe de ${COMPANY.fullName}${startDateStr ? `, depuis le ${startDateStr}` : ""}.${position ? ` Il/Elle occupe le poste de ${position}.` : ""}`
        : `This letter confirms that ${empName} is an employee of ${COMPANY.fullName}${startDateStr ? `, since ${startDateStr}` : ""}.${position ? ` Their position is ${position}.` : ""}`,
    );
  }

  paragraphs.push(
    fr
      ? "Pour toute question ou verification additionnelle, n'hesitez pas a nous contacter par courriel a vnkautomatisation@gmail.com."
      : "For any additional questions or verification, please contact us by email at vnkautomatisation@gmail.com.",
  );

  return {
    title: fr ? "Lettre d'emploi" : "Employment Letter",
    paragraphs,
    salutation,
    closing,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. ANNUAL TAX SUMMARIES (federal T4 / Quebec Releve 1)
//    Internal use only. The real slips must be issued through the
//    government tools.
// ═══════════════════════════════════════════════════════════
export type TaxTotals = {
  grossPay: number;
  netPay: number;
  deductionFederal: number;
  deductionProvincial: number;
  deductionRrq: number;
  deductionAe: number;
  deductionRqap: number;
  deductionOther: number;
};
export type TaxAdminInfo = {
  fullName: string | null;
  email: string;
  address?: string | null;
  sin?: string | null;
};

// Two-column block, box number plus value, in the shape of a tax form.
function drawTaxBoxes(
  doc: CapturedDoc,
  rows: Array<{ code: string; label: string; amount: number; muted?: boolean }>,
) {
  const x = 50;
  const w = doc.page.width - 100;
  const colW = (w - 12) / 2;
  const rowH = 42;

  for (let i = 0; i < rows.length; i += 2) {
    ensureSpace(doc, rowH + 4);
    const y = doc.y;
    for (let c = 0; c < 2; c++) {
      const r = rows[i + c];
      if (!r) continue;
      const bx = x + c * (colW + 12);

      // frame
      doc.roundedRect(bx, y, colW, rowH, 4)
        .fillAndStroke(C.grayLight, C.border);
      // box number, navy badge
      doc.rect(bx, y, 38, rowH).fill(C.navy);
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11)
        .text(r.code, bx, y + rowH / 2 - 6, {
          width: 38, align: "center", lineBreak: false,
        });
      // label
      doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
        .text(sanitize(r.label).toUpperCase(), bx + 46, y + 6, {
          width: colW - 54, lineBreak: false, ellipsis: true, characterSpacing: 0.4,
        });
      // amount
      doc.fillColor(r.muted ? C.gray : C.text)
        .font("Helvetica-Bold").fontSize(13)
        .text(money(r.amount), bx + 46, y + 19, {
          width: colW - 54, lineBreak: false,
        });
    }
    doc.y = y + rowH + 8;
  }
  doc.fillColor(C.text);
}

function drawDisclaimer(doc: CapturedDoc, kind: "t4" | "r1") {
  ensureSpace(doc, 60);
  const x = 50;
  const w = doc.page.width - 100;
  const y = doc.y + 4;
  const h = 58;
  doc.roundedRect(x, y, w, h, 5)
    .fillAndStroke(C.amberLight, C.amber);
  doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(9)
    .text("RESUME NON OFFICIEL — USAGE INTERNE UNIQUEMENT",
      x + 14, y + 10, { width: w - 28, lineBreak: false, characterSpacing: 0.6 });
  const label = kind === "t4"
    ? "Le T4 officiel doit etre delivre par l'employeur via le portail Mon dossier d'entreprise (ARC) ou un logiciel de paie autorise. "
    : "Le Releve 1 officiel doit etre transmis a Revenu Quebec via Clic Sequr Entreprises ou un logiciel de paie autorise. ";
  doc.fillColor(C.grayDark).font("Helvetica").fontSize(8.5)
    .text(
      label +
      "Ce document est genere automatiquement a partir des bulletins de paie publies dans le portail VNK. " +
      "Conservez-le pour reference, mais utilisez les feuillets officiels pour votre declaration de revenus.",
      x + 14, y + 26, { width: w - 28, align: "justify" },
    );
  doc.y = y + h + 10;
  doc.fillColor(C.text);
}

export async function generateT4SummaryPdf(params: {
  admin: TaxAdminInfo;
  year: number;
  totals: TaxTotals;
  stubCount: number;
}): Promise<Buffer> {
  const { admin, year, totals, stubCount } = params;
  // EI insurable earnings = grossPay; the yearly maximum is ignored here.
  const insurableEarnings = totals.grossPay;
  const pensionableEarnings = totals.grossPay;

  return capture((doc) => {
    drawHeader(
      doc,
      `T4 — Sommaire ${year}`,
      "Etat de la remuneration payee (resume non officiel)",
    );

    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
      ["Adresse", sanitize(admin.address) || "—"],
      ["NAS", sanitize(admin.sin) || "—"],
    ], { accent: C.navy });

    drawInfoBlock(doc, "Periode declarative", [
      ["Annee fiscale", String(year)],
      ["Du", `1er janvier ${year}`],
      ["Au", `31 decembre ${year}`],
      ["Bulletins inclus", String(stubCount)],
      ["Employeur", COMPANY.fullName],
    ]);

    sectionTitle(doc, `Cases du feuillet T4 — Annee ${year}`);
    drawTaxBoxes(doc, [
      { code: "14", label: "Revenus d'emploi", amount: totals.grossPay },
      { code: "22", label: "Impot sur le revenu retenu", amount: totals.deductionFederal },
      { code: "16", label: "Cotisations de l'employe au RPC/RRQ", amount: totals.deductionRrq },
      { code: "18", label: "Cotisations de l'employe a l'AE", amount: totals.deductionAe },
      { code: "24", label: "Gains assurables d'AE", amount: insurableEarnings, muted: true },
      { code: "26", label: "Gains ouvrant droit a pension RPC/RRQ", amount: pensionableEarnings, muted: true },
      { code: "55", label: "Cotisations de l'employe au RPAP/RQAP", amount: totals.deductionRqap },
      { code: "56", label: "Gains assurables du RPAP/RQAP", amount: insurableEarnings, muted: true },
    ]);

    sectionTitle(doc, "Recapitulatif");
    drawAmountTable(doc, "Totaux annuels", [
      { label: "Revenus bruts d'emploi", amount: totals.grossPay },
      { label: "Total des deductions a la source", amount: -(
        totals.deductionFederal + totals.deductionProvincial + totals.deductionRrq +
        totals.deductionAe + totals.deductionRqap + totals.deductionOther
      ), negative: true },
    ], {
      label: "Net verse a l'employe",
      amount: totals.netPay,
      emphasize: true,
    });

    drawDisclaimer(doc, "t4");
  }, `T4 ${year} · ${COMPANY.fullName} · Resume non officiel`);
}

export async function generateReleve1Pdf(params: {
  admin: TaxAdminInfo;
  year: number;
  totals: TaxTotals;
  stubCount: number;
}): Promise<Buffer> {
  const { admin, year, totals, stubCount } = params;
  const pensionableEarnings = totals.grossPay;

  return capture((doc) => {
    drawHeader(
      doc,
      `Releve 1 — Sommaire ${year}`,
      "Revenus d'emploi et revenus divers (resume non officiel)",
    );

    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
      ["Adresse", sanitize(admin.address) || "—"],
      ["NAS", sanitize(admin.sin) || "—"],
    ], { accent: C.navy });

    drawInfoBlock(doc, "Periode declarative", [
      ["Annee fiscale", String(year)],
      ["Du", `1er janvier ${year}`],
      ["Au", `31 decembre ${year}`],
      ["Bulletins inclus", String(stubCount)],
      ["Employeur", COMPANY.fullName],
    ]);

    sectionTitle(doc, `Cases du Releve 1 — Annee ${year}`);
    drawTaxBoxes(doc, [
      { code: "A", label: "Revenus d'emploi", amount: totals.grossPay },
      { code: "E", label: "Impot du Quebec retenu", amount: totals.deductionProvincial },
      { code: "B", label: "Cotisation au RRQ", amount: totals.deductionRrq },
      { code: "C", label: "Cotisation a l'assurance-emploi", amount: totals.deductionAe },
      { code: "H", label: "Cotisation au RQAP", amount: totals.deductionRqap },
      { code: "G", label: "Salaire admissible au RRQ", amount: pensionableEarnings, muted: true },
      { code: "I", label: "Salaire admissible au RQAP", amount: pensionableEarnings, muted: true },
      { code: "F", label: "Cotisation syndicale", amount: 0, muted: true },
    ]);

    sectionTitle(doc, "Recapitulatif");
    drawAmountTable(doc, "Totaux annuels", [
      { label: "Revenus bruts d'emploi", amount: totals.grossPay },
      { label: "Total des deductions a la source", amount: -(
        totals.deductionFederal + totals.deductionProvincial + totals.deductionRrq +
        totals.deductionAe + totals.deductionRqap + totals.deductionOther
      ), negative: true },
    ], {
      label: "Net verse a l'employe",
      amount: totals.netPay,
      emphasize: true,
    });

    drawDisclaimer(doc, "r1");
  }, `Releve 1 ${year} · ${COMPANY.fullName} · Resume non officiel`);
}

export async function generateEmploymentLetterPdf(params: LetterParams): Promise<Buffer> {
  const today = new Date();
  const fr = params.language === "fr";
  const body = buildLetterBody(params);
  const todayStr = today.toLocaleDateString(fr ? "fr-CA" : "en-CA", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const footerText = fr
    ? `Document genere automatiquement le ${todayStr} · Pour toute question : ${COMPANY.email}`
    : `Document generated automatically on ${todayStr} · For any question: ${COMPANY.email}`;

  return capture((doc) => {
    drawHeader(doc, body.title, sanitize(params.admin.fullName) || sanitize(params.admin.email));

    const x = 50;
    const w = doc.page.width - 100;

    // Date, right aligned
    doc.fillColor(C.gray).font("Helvetica").fontSize(9.5)
      .text(todayStr, x, doc.y, { width: w, align: "right", lineBreak: false });
    doc.moveDown(1.2);

    // Salutation
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(11)
      .text(body.salutation, x, doc.y, { width: w });
    doc.moveDown(0.8);

    // Body
    doc.font("Helvetica").fontSize(10.5);
    for (const p of body.paragraphs) {
      const h = doc.heightOfString(p, { width: w });
      ensureSpace(doc, h + 8);
      doc.fillColor(C.text).text(p, x, doc.y, { width: w, align: "justify" });
      doc.moveDown(0.7);
    }

    // Signature
    doc.moveDown(1.2);
    ensureSpace(doc, 80);
    doc.fillColor(C.text).font("Helvetica").fontSize(10.5)
      .text(body.closing, x, doc.y, { width: w });
  }, footerText);
}

// ═══════════════════════════════════════════════════════════
// 5. FULL EMPLOYEE FILE
//    Internal PDF gathering identity, contracts, reviews, notes, leaves,
//    equipment, licences and training, CNESST.
// ═══════════════════════════════════════════════════════════

export type DossierAdmin = {
  id: number;
  fullName: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  department: string | null;
  birthdate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  position: { name: string } | null;
  customRole: { name: string } | null;
  team: { name: string } | null;
  manager: { fullName: string | null; email: string } | null;
};

export type DossierNote = {
  id: number;
  category: string;
  severity: string | null;
  title: string;
  body: string;
  isConfidential: boolean;
  acknowledgedAt: Date | null;
  occurredAt: Date | null;
  createdAt: Date;
  author: { fullName: string | null; email: string };
};

export type DossierContract = {
  id: number;
  title: string;
  contractType: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  salaryAnnual: number | null;
  hourlyRate: number | null;
  hoursPerWeek: number | null;
};

export type DossierReview = {
  id: number;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  rating: number | null;
  managerComments: string | null;
  strengths: string | null;
  improvements: string | null;
  reviewer: { fullName: string | null; email: string };
};

export type DossierLeave = {
  id: number;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  reason: string | null;
};

export type DossierEquipment = {
  id: number;
  category: string;
  name: string;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedAt: Date;
};

export type DossierLicense = {
  id: number;
  type: string;
  number: string | null;
  issuer: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
};

export type DossierTraining = {
  id: number;
  title: string;
  category: string;
  provider: string | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  isMandatory: boolean;
};

export type DossierCnesst = {
  id: number;
  incidentDate: Date;
  location: string;
  description: string;
  injuryType: string | null;
  status: string;
  daysAbsent: number | null;
};

const NOTE_CATEGORY_LABEL: Record<string, string> = {
  discipline: "Discipline",
  exit: "Depart",
  medical: "Medical",
  observation: "Observation",
  onboarding: "Onboarding",
  commendation: "Felicitation",
  general: "General",
};

const NOTE_CATEGORY_COLOR: Record<string, string> = {
  discipline: C.red,
  commendation: C.green,
  observation: "#2563EB", // blue
  medical: "#7C3AED", // violet
  onboarding: "#0891B2", // cyan
  exit: C.amber,
  general: C.gray,
};

const NOTE_CATEGORY_ORDER = ["discipline", "exit", "medical", "observation", "onboarding", "commendation", "general"];

function ensureColumnTable(
  doc: CapturedDoc,
  title: string,
  headers: string[],
  widths: number[],
  rows: string[][],
) {
  sectionTitle(doc, title);
  const x = 50;
  const w = doc.page.width - 100;
  const rowH = 16;
  if (rows.length === 0) {
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8.5)
      .text("Aucune entree.", x, doc.y, { width: w });
    doc.y += 12;
    return;
  }
  // Normalize the widths to the total width.
  const totalW = widths.reduce((s, n) => s + n, 0);
  const ratios = widths.map((n) => n / totalW);
  const colX = ratios.reduce<number[]>((acc, r) => {
    const last = acc[acc.length - 1] ?? x;
    acc.push(last + r * w);
    return acc;
  }, [x]).slice(0, -1);
  // Header
  ensureSpace(doc, rowH + 6);
  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5);
  headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), colX[i] + 4, doc.y, {
      width: ratios[i] * w - 8, lineBreak: false, ellipsis: true, characterSpacing: 0.5,
    });
  });
  doc.y += 12;
  doc.strokeColor(C.border).lineWidth(0.5).moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
  doc.y += 3;
  // Rows
  rows.forEach((cells, i) => {
    ensureSpace(doc, rowH + 2);
    const ry = doc.y;
    if (i % 2 === 1) {
      doc.rect(x, ry - 2, w, rowH).fill(C.grayLight);
    }
    doc.fillColor(C.text).font("Helvetica").fontSize(8.5);
    cells.forEach((c, j) => {
      doc.text(sanitize(c) || "—", colX[j] + 4, ry + 2, {
        width: ratios[j] * w - 8, lineBreak: false, ellipsis: true,
      });
    });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.3);
}

export type DossierMonthlyHours = {
  ym: string; // YYYY-MM
  workMin: number;     // time actually worked (work + meeting + training)
  meetingMin: number;
  trainingMin: number;
};

export type DossierData = {
  admin: DossierAdmin;
  notes: DossierNote[];
  contracts: DossierContract[];
  reviews: DossierReview[];
  leaves: DossierLeave[];
  equipment: DossierEquipment[];
  licenses: DossierLicense[];
  trainings: DossierTraining[];
  cnesst: DossierCnesst[];
  payAgg: { count: number; grossPay: number; netPay: number };
  // Optional: hours worked per month, over the last 12 months.
  monthlyHours?: DossierMonthlyHours[];
};

function seniorityFr(start: Date | null): string {
  if (!start) return "—";
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return "Moins d'un mois";
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} an${y > 1 ? "s" : ""}` : `${y} an${y > 1 ? "s" : ""} ${m} mois`;
}

// ═══════════════════════════════════════════════════════════
// PERSONAL TIMESHEET (employee self-export)
// ═══════════════════════════════════════════════════════════
export type PersonalTimesheetEntry = {
  clockIn: Date;
  clockOut: Date | null;
  durationMin: number | null;
  category: string;
  notes: string | null;
  approvedAt: Date | null;
};

const CAT_LABEL_PDF: Record<string, string> = {
  work: "Travail",
  break: "Pause",
  meeting: "Reunion",
  training: "Formation",
  sick: "Maladie",
  vacation: "Vacances",
};

function fmtDurFromMin(mins: number | null): string {
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

// One (employee, day): work = work+meeting+training, absence = vacation/sick/parental/etc.
type DayBucket = {
  date: string; // YYYY-MM-DD
  workMin: number;
  meetingMin: number;
  trainingMin: number;
  breakMin: number;
  absenceMin: number; // paid leave (vacation, sick, parental, bereavement, unpaid, other)
  absenceType: string | null; // main leave type, for the label
  totalEffMin: number; // total paid (work + meeting + training + absence)
  isApproved: boolean;
  isSubmitted: boolean;
};

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  parental: "Parental",
  bereavement: "Décès",
  unpaid: "Sans solde",
  other: "Autre",
};

function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function aggregateByDay(entries: PersonalTimesheetEntry[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const e of entries) {
    if (!e.clockOut) continue;
    const key = dayKeyFromDate(e.clockIn);
    let b = map.get(key);
    if (!b) {
      b = {
        date: key,
        workMin: 0,
        meetingMin: 0,
        trainingMin: 0,
        breakMin: 0,
        absenceMin: 0,
        absenceType: null,
        totalEffMin: 0,
        isApproved: true,
        isSubmitted: true,
      };
      map.set(key, b);
    }
    const dur = e.durationMin ?? 0;
    if (e.category === "work") { b.workMin += dur; b.totalEffMin += dur; }
    else if (e.category === "meeting") { b.meetingMin += dur; b.totalEffMin += dur; }
    else if (e.category === "training") { b.trainingMin += dur; b.totalEffMin += dur; }
    else if (e.category === "break") { b.breakMin += dur; }
    else if (e.category && ABSENCE_TYPE_LABELS[e.category]) {
      // vacation, sick, parental, bereavement, unpaid, other -> paid absence
      b.absenceMin += dur;
      b.totalEffMin += dur;
      if (!b.absenceType) b.absenceType = e.category;
    }
    // Approval state: everything approved?
    if (!e.approvedAt) b.isApproved = false;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function generatePersonalTimesheetPdf(params: {
  admin: { fullName: string | null; email: string; position?: string | null };
  from: Date;
  to: Date;
  entries: PersonalTimesheetEntry[];
}): Promise<Buffer> {
  const { admin, from, to, entries } = params;
  const buckets = aggregateByDay(entries);
  const totalEffMin = buckets.reduce((s, b) => s + b.totalEffMin, 0);
  const totalWorkMin = buckets.reduce((s, b) => s + b.workMin, 0);
  const totalMeetingMin = buckets.reduce((s, b) => s + b.meetingMin, 0);
  const totalTrainingMin = buckets.reduce((s, b) => s + b.trainingMin, 0);
  const totalAbsenceMin = buckets.reduce((s, b) => s + b.absenceMin, 0);
  const totalBreakMin = buckets.reduce((s, b) => s + b.breakMin, 0);
  const approvedMin = buckets.filter((b) => b.isApproved).reduce((s, b) => s + b.totalEffMin, 0);
  const pendingMin = buckets.filter((b) => !b.isApproved).reduce((s, b) => s + b.totalEffMin, 0);

  return capture((doc) => {
    drawHeader(
      doc,
      "Releve d'heures",
      `${formatDateShort(from)} → ${formatDateShort(to)}`,
    );

    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
      ["Poste", sanitize(admin.position) || "—"],
      ["Periode", `${formatDate(from)} au ${formatDate(to)}`],
    ], { accent: C.navy });

    sectionTitle(doc, "Synthese");
    const x = 50;
    const w = doc.page.width - 100;
    const cardW = (w - 24) / 3;
    ensureSpace(doc, 60);
    const y = doc.y;
    const cards: Array<{ label: string; value: string; color: string }> = [
      { label: "TRAVAIL EFFECTIF", value: fmtDurFromMin(totalEffMin), color: C.navy },
      { label: "APPROUVE", value: fmtDurFromMin(approvedMin), color: C.green },
      { label: "EN ATTENTE", value: fmtDurFromMin(pendingMin), color: C.amber },
    ];
    cards.forEach((c, i) => {
      const cx = x + i * (cardW + 12);
      doc.roundedRect(cx, y, cardW, 50, 5).fillAndStroke(C.grayLight, C.border);
      doc.rect(cx, y, 3, 50).fill(c.color);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
        .text(c.label, cx + 12, y + 10, { lineBreak: false, characterSpacing: 0.6 });
      doc.fillColor(c.color).font("Helvetica-Bold").fontSize(16)
        .text(c.value, cx + 12, y + 24, { width: cardW - 20, lineBreak: false });
    });
    doc.y = y + 60;

    // Daily summary: one line per day, no technical detail.
    sectionTitle(doc, "Resume quotidien");
    const xT = 50;
    const wT = doc.page.width - 100;
    const rowH = 16;
    if (buckets.length === 0) {
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8.5)
        .text("Aucune journee travaillee sur la periode.", xT, doc.y, { width: wT });
      doc.y += 12;
    } else {
      // Simplified columns: WORK merges work+meeting+training.
      const headers = ["DATE", "TRAVAIL", "ABSENCE", "TOTAL", "STATUT"];
      const ratios = [1.6, 1.2, 1.4, 1.2, 1.2];
      const totalR = ratios.reduce((s, n) => s + n, 0);
      const colX = ratios.reduce<number[]>((acc, r) => {
        const last = acc[acc.length - 1] ?? xT;
        acc.push(last + (r / totalR) * wT);
        return acc;
      }, [xT]).slice(0, -1);

      ensureSpace(doc, rowH + 4);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5);
      const headerY = doc.y; // fixed y for every header cell
      headers.forEach((h, i) => {
        // STATUS (last column) and DATE (first) are left aligned.
        const align: "left" | "right" = i === 0 || i === 4 ? "left" : "right";
        doc.text(h, colX[i] + 4, headerY, {
          width: (ratios[i] / totalR) * wT - 8, lineBreak: false, characterSpacing: 0.5, align,
        });
      });
      doc.y = headerY + 12;
      doc.strokeColor(C.border).lineWidth(0.5).moveTo(xT, doc.y).lineTo(xT + wT, doc.y).stroke();
      doc.y += 3;

      buckets.forEach((b, i) => {
        ensureSpace(doc, rowH + 2);
        const ry = doc.y;
        if (i % 2 === 1) doc.rect(xT, ry - 2, wT, rowH).fill(C.grayLight);
        const d = new Date(b.date + "T12:00:00");
        const dateLabel = d.toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short" });
        const status = b.isApproved ? "Approuve" : "Soumis";
        // WORK = work + meeting + training merged
        const travailMin = b.workMin + b.meetingMin + b.trainingMin;
        // Absence : duree + libelle court du type (ex: "8h00 Vacances")
        const absenceCell = b.absenceMin > 0
          ? `${fmtDurFromMin(b.absenceMin)}${b.absenceType ? ` ${ABSENCE_TYPE_LABELS[b.absenceType] ?? ""}`.trimEnd() : ""}`
          : "—";
        const cells = [
          dateLabel,
          fmtDurFromMin(travailMin),
          absenceCell,
          fmtDurFromMin(b.totalEffMin),
          status,
        ];
        doc.fillColor(C.text).font("Helvetica").fontSize(8.5);
        cells.forEach((c, j) => {
          const align: "left" | "right" = j === 0 || j === 4 ? "left" : "right";
          doc.text(sanitize(c), colX[j] + 4, ry + 2, {
            width: (ratios[j] / totalR) * wT - 8, lineBreak: false, ellipsis: true, align,
          });
        });
        doc.y = ry + rowH;
      });

      // Ligne TOTAL
      ensureSpace(doc, rowH + 6);
      const ry = doc.y + 2;
      doc.strokeColor(C.border).lineWidth(0.6).moveTo(xT, ry).lineTo(xT + wT, ry).stroke();
      const totalY = ry + 5; // fixed y: PDFKit would otherwise advance the cursor
      const totalTravailMin = totalWorkMin + totalMeetingMin + totalTrainingMin;
      const totals = [
        "TOTAL",
        fmtDurFromMin(totalTravailMin),
        fmtDurFromMin(totalAbsenceMin),
        fmtDurFromMin(totalEffMin),
        "",
      ];
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9);
      totals.forEach((c, j) => {
        const align: "left" | "right" = j === 0 || j === 4 ? "left" : "right";
        doc.text(c, colX[j] + 4, totalY, {
          width: (ratios[j] / totalR) * wT - 8, lineBreak: false, align,
        });
      });
      doc.y = totalY + rowH;
    }

    // Pied : info pauses (conformite uniquement)
    if (totalBreakMin > 0) {
      doc.moveDown(0.6);
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7.5)
        .text(
          `Pauses cumulees sur la periode : ${fmtDurFromMin(totalBreakMin)} (information conformite, non comptabilise).`,
          50, doc.y, { width: doc.page.width - 100 },
        );
    }
  }, `Releve d'heures · ${sanitize(admin.fullName) || sanitize(admin.email)} · Genere le ${formatDate(new Date())} · ${COMPANY.fullName}`);
}

export async function generateEmployeeDossierPdf(data: DossierData): Promise<Buffer> {
  const { admin, notes, contracts, reviews, leaves, equipment, licenses, trainings, cnesst, payAgg, monthlyHours } = data;
  const empName = sanitize(admin.fullName) || sanitize(admin.email);
  const todayStr = new Date().toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" });

  return capture((doc) => {
    drawHeader(doc, "Dossier employe", empName);

    // ── Bandeau identite synthese ───────────────────────
    drawInfoBlock(doc, "Identite et emploi", [
      ["Nom complet", empName],
      ["Courriel", sanitize(admin.email)],
      ["Telephone", sanitize(admin.phone) || "—"],
      ["Poste", sanitize(admin.position?.name) || sanitize(admin.title) || "—"],
      ["Departement", sanitize(admin.department) || "—"],
      ["Equipe", sanitize(admin.team?.name) || "—"],
      ["Role", sanitize(admin.customRole?.name) || "—"],
      ["Manager", admin.manager ? (sanitize(admin.manager.fullName) || sanitize(admin.manager.email)) : "—"],
      ["Date d'embauche", formatDate(admin.startDate)],
      ["Anciennete", seniorityFr(admin.startDate)],
      ["Date de fin", formatDate(admin.endDate)],
      ["Naissance", formatDate(admin.birthdate)],
    ], { accent: C.navy });

    // ── Contrats ────────────────────────────────────────
    ensureColumnTable(
      doc,
      "Contrats",
      ["Titre", "Type", "Debut", "Fin", "Statut", "Remuneration"],
      [3, 1.2, 1.2, 1.2, 1.1, 1.5],
      contracts.map((c) => [
        c.title,
        c.contractType.toUpperCase(),
        formatDateShort(c.startDate),
        c.endDate ? formatDateShort(c.endDate) : "—",
        c.status,
        c.salaryAnnual != null
          ? `${money(Number(c.salaryAnnual))} / an`
          : c.hourlyRate != null
          ? `${money(Number(c.hourlyRate))} / h`
          : "—",
      ]),
    );

    // ── Evaluations ─────────────────────────────────────
    sectionTitle(doc, "Evaluations de performance");
    if (reviews.length === 0) {
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8.5)
        .text("Aucune evaluation.", 50, doc.y, { width: doc.page.width - 100 });
      doc.y += 12;
    } else {
      const x = 50;
      const w = doc.page.width - 100;
      reviews.forEach((r) => {
        ensureSpace(doc, 60);
        const y = doc.y;
        doc.roundedRect(x, y, w, 56, 4).fillAndStroke(C.grayLight, C.border);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9.5)
          .text(`${formatDateShort(r.periodStart)} → ${formatDateShort(r.periodEnd)}`, x + 10, y + 8, { lineBreak: false });
        doc.fillColor(C.gray).font("Helvetica").fontSize(8)
          .text(`Reviewer : ${sanitize(r.reviewer.fullName) || sanitize(r.reviewer.email)}`, x + 10, y + 22, { lineBreak: false });
        if (r.rating != null) {
          doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(13)
            .text(`${r.rating} / 5`, x + w - 90, y + 12, { width: 80, align: "right", lineBreak: false });
        }
        const summary = sanitize(r.managerComments || r.strengths || r.improvements || "").slice(0, 220);
        if (summary) {
          doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
            .text(summary, x + 10, y + 36, { width: w - 20, lineBreak: false, ellipsis: true });
        }
        doc.y = y + 60;
      });
    }

    // ── Notes par categorie ─────────────────────────────
    sectionTitle(doc, "Notes et avis dans le dossier");
    if (notes.length === 0) {
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8.5)
        .text("Aucune note.", 50, doc.y, { width: doc.page.width - 100 });
      doc.y += 12;
    } else {
      const grouped: Record<string, DossierNote[]> = {};
      for (const n of notes) {
        (grouped[n.category] ||= []).push(n);
      }
      for (const cat of NOTE_CATEGORY_ORDER) {
        const list = grouped[cat];
        if (!list || list.length === 0) continue;
        const color = NOTE_CATEGORY_COLOR[cat] || C.gray;
        const label = NOTE_CATEGORY_LABEL[cat] || cat;
        ensureSpace(doc, 22);
        doc.fillColor(color).font("Helvetica-Bold").fontSize(10)
          .text(`${label.toUpperCase()} (${list.length})`, 50, doc.y, { lineBreak: false, characterSpacing: 0.5 });
        doc.y += 14;

        for (const n of list) {
          const bodyText = sanitize(n.body);
          const x = 50;
          const w = doc.page.width - 100;
          const titleH = 14;
          const metaH = 12;
          const bodyH = Math.min(
            doc.heightOfString(bodyText, { width: w - 20 }),
            120,
          );
          const blockH = 14 + titleH + metaH + bodyH + 14;
          ensureSpace(doc, blockH + 6);
          const y = doc.y;
          doc.roundedRect(x, y, w, blockH, 4).fillAndStroke(C.grayLight, C.border);
          doc.rect(x, y, 3, blockH).fill(color);
          // Titre + severity
          doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
            .text(sanitize(n.title), x + 12, y + 8, {
              width: w - 130, lineBreak: false, ellipsis: true,
            });
          if (n.severity && cat === "discipline") {
            const sevLabel = n.severity.toUpperCase();
            const sevColor = n.severity === "critical" ? C.red : n.severity === "warning" ? C.amber : C.gray;
            doc.fillColor(sevColor).font("Helvetica-Bold").fontSize(8)
              .text(sevLabel, x + w - 90, y + 10, { width: 80, align: "right", lineBreak: false });
          }
          // Meta
          const meta = `${formatDateShort(n.occurredAt || n.createdAt)} · ${sanitize(n.author.fullName) || sanitize(n.author.email)}${n.isConfidential ? " · Confidentiel" : ""}${n.acknowledgedAt ? ` · Lu ${formatDateShort(n.acknowledgedAt)}` : ""}`;
          doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
            .text(sanitize(meta), x + 12, y + 8 + titleH, {
              width: w - 24, lineBreak: false, ellipsis: true,
            });
          // Body
          doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
            .text(bodyText, x + 12, y + 8 + titleH + metaH + 2, {
              width: w - 24, height: bodyH, ellipsis: true,
            });
          doc.y = y + blockH + 6;
        }
      }
    }

    // ── Conges ──────────────────────────────────────────
    ensureColumnTable(
      doc,
      "Historique des conges",
      ["Type", "Debut", "Fin", "Jours", "Statut"],
      [1.4, 1, 1, 0.8, 1],
      leaves.map((l) => [
        l.type,
        formatDateShort(l.startDate),
        formatDateShort(l.endDate),
        Number(l.daysCount).toFixed(1),
        l.status,
      ]),
    );

    // ── Equipement ──────────────────────────────────────
    ensureColumnTable(
      doc,
      "Equipement actif",
      ["Nom", "Categorie", "Marque/Modele", "S/N", "Depuis"],
      [2, 1, 1.4, 1.2, 1],
      equipment.map((e) => [
        e.name,
        e.category,
        [e.brand, e.model].filter(Boolean).join(" ") || "—",
        e.serialNumber || "—",
        formatDateShort(e.assignedAt),
      ]),
    );

    // ── Permis ──────────────────────────────────────────
    ensureColumnTable(
      doc,
      "Permis professionnels",
      ["Type", "Numero", "Emetteur", "Emis", "Expire"],
      [2, 1.2, 1.4, 1, 1],
      licenses.map((l) => [
        l.type,
        l.number || "—",
        l.issuer || "—",
        l.issuedAt ? formatDateShort(l.issuedAt) : "—",
        l.expiresAt ? formatDateShort(l.expiresAt) : "—",
      ]),
    );

    // ── Formations ──────────────────────────────────────
    ensureColumnTable(
      doc,
      "Formations",
      ["Titre", "Categorie", "Fournisseur", "Termine", "Obligatoire"],
      [2, 1.1, 1.4, 1, 0.8],
      trainings.map((t) => [
        t.title,
        t.category,
        t.provider || "—",
        t.completedAt ? formatDateShort(t.completedAt) : "—",
        t.isMandatory ? "Oui" : "Non",
      ]),
    );

    // ── Paie (resume) ───────────────────────────────────
    sectionTitle(doc, "Paie — recapitulatif");
    drawInfoBlock(doc, "Bulletins emis", [
      ["Nombre de bulletins", String(payAgg.count)],
      ["Brut cumule", money(payAgg.grossPay)],
      ["Net cumule", money(payAgg.netPay)],
    ], { accent: C.green });

    // ── Heures travaillees (12 derniers mois, agrege) ───
    if (monthlyHours && monthlyHours.length > 0) {
      const totalWork = monthlyHours.reduce((s, m) => s + m.workMin, 0);
      const totalMeeting = monthlyHours.reduce((s, m) => s + m.meetingMin, 0);
      const totalTraining = monthlyHours.reduce((s, m) => s + m.trainingMin, 0);
      ensureColumnTable(
        doc,
        "Heures travaillees — 12 derniers mois",
        ["Mois", "Travail", "Reunion", "Formation", "Total"],
        [1.4, 1, 1, 1.2, 1.1],
        [
          ...monthlyHours.map((m) => {
            const [y, mo] = m.ym.split("-");
            const d = new Date(Number(y), Number(mo) - 1, 1);
            const label = d.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
            const pureWork = Math.max(0, m.workMin - m.meetingMin - m.trainingMin);
            return [
              label,
              fmtDurFromMin(pureWork),
              fmtDurFromMin(m.meetingMin),
              fmtDurFromMin(m.trainingMin),
              fmtDurFromMin(m.workMin),
            ];
          }),
          [
            "TOTAL",
            fmtDurFromMin(Math.max(0, totalWork - totalMeeting - totalTraining)),
            fmtDurFromMin(totalMeeting),
            fmtDurFromMin(totalTraining),
            fmtDurFromMin(totalWork),
          ],
        ],
      );
    }

    // ── CNESST ──────────────────────────────────────────
    if (cnesst.length > 0) {
      sectionTitle(doc, "Incidents CNESST", C.red);
      ensureColumnTable(
        doc,
        "Declarations",
        ["Date", "Lieu", "Type", "Absent (j)", "Statut"],
        [1.1, 2, 1.4, 0.8, 1],
        cnesst.map((c) => [
          formatDateShort(c.incidentDate),
          c.location,
          c.injuryType || "—",
          c.daysAbsent != null ? String(c.daysAbsent) : "—",
          c.status,
        ]),
      );
      // Descriptions detaillees
      cnesst.forEach((c) => {
        ensureSpace(doc, 40);
        const x = 50;
        const w = doc.page.width - 100;
        doc.fillColor(C.red).font("Helvetica-Bold").fontSize(8.5)
          .text(`${formatDateShort(c.incidentDate)} — ${sanitize(c.location)}`,
            x, doc.y, { width: w, lineBreak: false });
        doc.y += 12;
        doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
          .text(sanitize(c.description), x, doc.y, { width: w });
        doc.moveDown(0.4);
      });
    }
  }, `Confidentiel — Document interne ${COMPANY.fullName} · Genere le ${todayStr}`);
}

// ═══════════════════════════════════════════════════════════
// 6. LETTRE DE CONFIRMATION DE CONGE
// ═══════════════════════════════════════════════════════════
export type LeaveLetterData = {
  id: number;
  type: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  halfDay: string | null;
  reviewedAt: Date | null;
  reviewer: { fullName: string | null; email: string } | null;
  admin: { fullName: string | null; email: string; position?: string | null };
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  parental: "Conge parental",
  unpaid: "Sans solde",
  bereavement: "Deces",
  other: "Autre",
};

export async function generateLeaveLetterPdf(data: LeaveLetterData): Promise<Buffer> {
  const todayStr = new Date().toLocaleDateString("fr-CA", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const empName = sanitize(data.admin.fullName) || sanitize(data.admin.email);
  const typeLabel = LEAVE_TYPE_LABEL[data.type] ?? data.type;
  const startStr = formatDate(data.startDate);
  const endStr = formatDate(data.endDate);
  const reviewer = data.reviewer
    ? (sanitize(data.reviewer.fullName) || sanitize(data.reviewer.email))
    : "la direction";
  const reviewDateStr = data.reviewedAt ? formatDate(data.reviewedAt) : todayStr;
  const halfNote = data.halfDay === "AM"
    ? " (demi-journee matin)"
    : data.halfDay === "PM"
    ? " (demi-journee apres-midi)"
    : "";

  return capture((doc) => {
    drawHeader(doc, "Lettre de confirmation de conge", empName);

    const x = 50;
    const w = doc.page.width - 100;

    doc.fillColor(C.gray).font("Helvetica").fontSize(9.5)
      .text(todayStr, x, doc.y, { width: w, align: "right", lineBreak: false });
    doc.moveDown(1.2);

    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(11)
      .text("A qui de droit,", x, doc.y, { width: w });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10.5);

    const p1 = `La presente confirme que ${empName} beneficie d'un conge de type ${typeLabel}${halfNote} du ${startStr} au ${endStr}, pour un total de ${data.daysCount} jour${data.daysCount > 1 ? "s" : ""}.`;
    const p2 = `Cette demande a ete approuvee par ${reviewer} le ${reviewDateStr}.`;
    const p3 = "Pour toute question relative a cette absence, veuillez contacter le service des ressources humaines de l'entreprise.";

    for (const p of [p1, p2, p3]) {
      const h = doc.heightOfString(p, { width: w });
      ensureSpace(doc, h + 8);
      doc.fillColor(C.text).text(p, x, doc.y, { width: w, align: "justify" });
      doc.moveDown(0.7);
    }

    // Signature
    doc.moveDown(1.6);
    ensureSpace(doc, 90);
    const sigW = (w - 12) / 2;
    const sy = doc.y;
    doc.roundedRect(x, sy, sigW, 70, 4).fillAndStroke(C.grayLight, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text("APPROUVE PAR", x + 12, sy + 8, { lineBreak: false, characterSpacing: 0.6 });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
      .text(reviewer, x + 12, sy + 22, { width: sigW - 24, lineBreak: false, ellipsis: true });
    doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
      .text(`Le ${reviewDateStr}`, x + 12, sy + 40, { width: sigW - 24, lineBreak: false });

    const ex = x + sigW + 12;
    doc.roundedRect(ex, sy, sigW, 70, 4).fillAndStroke(C.grayLight, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text("EMPLOYEUR", ex + 12, sy + 8, { lineBreak: false, characterSpacing: 0.6 });
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10)
      .text(COMPANY.fullName, ex + 12, sy + 22, { width: sigW - 24, lineBreak: false, ellipsis: true });
    doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
      .text("Service des ressources humaines", ex + 12, sy + 40, { width: sigW - 24, lineBreak: false });

    doc.y = sy + 90;
  }, `Document genere automatiquement le ${todayStr} - ${COMPANY.fullName} - ${COMPANY.email}`);
}

// ═══════════════════════════════════════════════════════════
// 7. RELEVE ANNUEL DE CONGES
// ═══════════════════════════════════════════════════════════
export type LeaveAnnualReportData = {
  admin: { fullName: string | null; email: string; position?: string | null };
  periodStart: Date;
  periodEnd: Date;
  balance: {
    vacationDaysRemaining: number;
    vacationDaysTaken: number;
    vacationDaysPlanned: number;
    accruedDays?: number;
    carriedOverDays?: number;
    policyName?: string;
  } | null;
  requests: Array<{
    id: number;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
    daysCount: number;
    halfDay: string | null;
  }>;
};

export async function generateLeaveAnnualReportPdf(data: LeaveAnnualReportData): Promise<Buffer> {
  const empName = sanitize(data.admin.fullName) || sanitize(data.admin.email);
  const startStr = formatDateShort(data.periodStart);
  const endStr = formatDateShort(data.periodEnd);
  const todayStr = new Date().toLocaleDateString("fr-CA");

  // Agregation par type (uniquement approved)
  const totalsByType = new Map<string, { count: number; days: number }>();
  for (const r of data.requests) {
    if (r.status !== "approved") continue;
    const cur = totalsByType.get(r.type) ?? { count: 0, days: 0 };
    cur.count++;
    cur.days += Number(r.daysCount);
    totalsByType.set(r.type, cur);
  }

  return capture((doc) => {
    drawHeader(doc, "Releve annuel de conges", `${empName} - ${startStr} -> ${endStr}`);

    // Employee and period block
    drawInfoBlock(doc, "Employe", [
      ["Nom", empName],
      ["Courriel", sanitize(data.admin.email)],
      ["Poste", sanitize(data.admin.position) || "-"],
    ]);
    drawInfoBlock(doc, "Periode de reference", [
      ["Debut", formatDate(data.periodStart)],
      ["Fin", formatDate(data.periodEnd)],
      ["Politique", sanitize(data.balance?.policyName) || "Defaut"],
    ], { accent: C.navy });

    // Solde courant
    if (data.balance) {
      sectionTitle(doc, "Solde de vacances");
      const x = 50;
      const w = doc.page.width - 100;
      ensureSpace(doc, 60);
      const ry = doc.y;
      const cells: Array<[string, string]> = [
        ["Dispo", `${data.balance.vacationDaysRemaining} j`],
        ["Pris", `${data.balance.vacationDaysTaken} j`],
        ["Planifies", `${data.balance.vacationDaysPlanned} j`],
        ["Accumules", `${data.balance.accruedDays ?? 0} j`],
      ];
      const cellW = (w - 12) / 4;
      cells.forEach(([label, value], i) => {
        const cx = x + i * (cellW + 4);
        doc.roundedRect(cx, ry, cellW, 50, 5).fillAndStroke(C.blueLighter, C.border);
        doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
          .text(label.toUpperCase(), cx + 8, ry + 8, { width: cellW - 16, lineBreak: false, characterSpacing: 0.6 });
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(18)
          .text(value, cx + 8, ry + 22, { width: cellW - 16, lineBreak: false });
      });
      doc.y = ry + 60;
    }

    // Requests table
    sectionTitle(doc, "Detail des demandes");
    const x = 50;
    const w = doc.page.width - 100;
    const colType = x + 6;
    const colDates = x + 110;
    const colDays = x + 320;
    const colStatus = x + 400;

    ensureSpace(doc, 20);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
      .text("TYPE", colType, doc.y, { lineBreak: false, characterSpacing: 0.6 });
    doc.text("PERIODE", colDates, doc.y, { lineBreak: false, characterSpacing: 0.6 });
    doc.text("JOURS", colDays, doc.y, { lineBreak: false, characterSpacing: 0.6 });
    doc.text("STATUT", colStatus, doc.y, { lineBreak: false, characterSpacing: 0.6 });
    doc.y += 14;
    doc.strokeColor(C.border).lineWidth(0.5).moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
    doc.y += 4;

    if (data.requests.length === 0) {
      ensureSpace(doc, 20);
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(9)
        .text("Aucune demande enregistree sur la periode.", x + 6, doc.y, { width: w - 12 });
      doc.y += 18;
    } else {
      data.requests.forEach((r, i) => {
        ensureSpace(doc, 20);
        const ry = doc.y;
        if (i % 2 === 1) doc.rect(x, ry - 2, w, 18).fill(C.grayLight);
        const halfStr = r.halfDay ? ` 1/2 ${r.halfDay}` : "";
        doc.fillColor(C.text).font("Helvetica").fontSize(9)
          .text(LEAVE_TYPE_LABEL[r.type] ?? r.type, colType, ry + 3, { width: 100, lineBreak: false, ellipsis: true });
        doc.text(
          `${formatDateShort(r.startDate)} - ${formatDateShort(r.endDate)}${halfStr}`,
          colDates, ry + 3, { width: colDays - colDates - 6, lineBreak: false, ellipsis: true },
        );
        doc.font("Helvetica-Bold")
          .text(`${Number(r.daysCount)}`, colDays, ry + 3, { width: colStatus - colDays - 6, lineBreak: false });
        const statusColor =
          r.status === "approved" ? C.green :
          r.status === "rejected" ? C.red :
          r.status === "pending" ? C.amber :
          C.gray;
        doc.fillColor(statusColor).font("Helvetica-Bold").fontSize(9)
          .text(r.status, colStatus, ry + 3, { width: w - (colStatus - x) - 6, lineBreak: false });
        doc.y = ry + 18;
      });
    }

    // Totaux par type
    if (totalsByType.size > 0) {
      doc.moveDown(0.8);
      sectionTitle(doc, "Totaux par type (approuves)");
      const rows: Array<[string, string]> = Array.from(totalsByType.entries()).map(([t, v]) =>
        [LEAVE_TYPE_LABEL[t] ?? t, `${v.days} j (${v.count} demande${v.count > 1 ? "s" : ""})`],
      );
      drawInfoBlock(doc, "Recapitulatif annuel", rows, { accent: C.green });
    }
  }, `${COMPANY.fullName} - ${COMPANY.email} - Genere le ${todayStr}`);
}

