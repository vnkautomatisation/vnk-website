// PDF generators RH : bulletin de paie, contrat employe, lettre d'emploi.
// Suit le pattern de pdf-export.ts (PDFKit + PassThrough capture, header VNK navy).
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ─────────────────────────────────────────────────────────
// Couleurs et constantes (alignees avec pdf-export.ts)
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
// Utilitaires (cles de pdf-export.ts simplifies)
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

// Formatte un montant CAD avec 2 decimales
function money(n: number): string {
  return `${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} $`;
}

// Bloc info en 2 colonnes (label / valeur)
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

// Tableau simple a 3 colonnes (label, qte/details, montant)
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

function formatDateShort(d: Date | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!d) return "—";
  const locale = lang === "en" ? "en-CA" : "fr-CA";
  return new Date(d).toLocaleDateString(locale);
}

// ═══════════════════════════════════════════════════════════
// 1. BULLETIN DE PAIE
// ═══════════════════════════════════════════════════════════
export type PayStubData = {
  id: number;
  hoursRegular: number; hoursOvertime: number; hoursVacation: number; hoursSick: number;
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
      `Periode ${formatDateShort(period.startDate)} → ${formatDateShort(period.endDate)}`,
    );

    // Employe + Periode (cote a cote via 2 blocs)
    drawInfoBlock(doc, "Employe", [
      ["Nom", sanitize(admin.fullName) || sanitize(admin.email)],
      ["Courriel", sanitize(admin.email)],
      ["Poste", sanitize(admin.position) || "—"],
    ]);

    const statusLabel = stub.releasedAt
      ? `Publie (${formatDateShort(stub.releasedAt)})`
      : "Brouillon";
    drawInfoBlock(doc, "Periode de paie", [
      ["Debut", formatDate(period.startDate)],
      ["Fin", formatDate(period.endDate)],
      ["Date de paie", formatDate(period.payDate)],
      ["Statut bulletin", statusLabel],
    ], { accent: C.navy });

    // Heures
    const rate = Number(stub.rate);
    const heuresRows: Array<{ label: string; detail?: string; amount: number }> = [];
    const hReg = Number(stub.hoursRegular);
    if (hReg > 0 || (Number(stub.hoursOvertime) === 0 && Number(stub.hoursVacation) === 0 && Number(stub.hoursSick) === 0)) {
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

    // Net a payer - encadre navy
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

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  cdi: "Contrat a duree indeterminee (CDI)",
  cdd: "Contrat a duree determinee (CDD)",
  contractuel: "Contractuel",
  stagiaire: "Stagiaire",
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

    // Conditions
    const conditions: Array<[string, string]> = [
      ["Titre du contrat", sanitize(contract.title)],
      ["Type", CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType.toUpperCase()],
      ["Date de debut", formatDate(contract.startDate)],
    ];
    if (contract.endDate) conditions.push(["Date de fin", formatDate(contract.endDate)]);
    if (contract.probationEndDate) conditions.push(["Fin probation", formatDate(contract.probationEndDate)]);
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

    // Corps du contrat
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

    // Bloc employe
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

    // Bloc employeur
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

    // Note confidentialite
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7.5)
      .text(
        "Document confidentiel - reserve aux parties signataires. " +
        "Le present contrat est regi par les lois du Quebec et du Canada.",
        50, doc.y, { width: doc.page.width - 100, align: "center" },
      );
  });
}

// ═══════════════════════════════════════════════════════════
// 3. LETTRE D'EMPLOI
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

// Mappe les purposes etendus (schema Prisma) vers les categories logiques
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
  const startDateStr = admin.startDate ? formatDate(admin.startDate, language) : null;

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
// 4. RESUMES FISCAUX ANNUELS (T4 federal / Releve 1 Quebec)
//    Non officiels — pour usage interne. Les vrais documents
//    doivent etre delivres via les outils gouvernementaux.
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

// Bloc 2 colonnes "case officielle + valeur" — visuel formulaire fiscal
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

      // cadre
      doc.roundedRect(bx, y, colW, rowH, 4)
        .fillAndStroke(C.grayLight, C.border);
      // code de case (badge navy)
      doc.rect(bx, y, 38, rowH).fill(C.navy);
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11)
        .text(r.code, bx, y + rowH / 2 - 6, {
          width: 38, align: "center", lineBreak: false,
        });
      // libelle
      doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
        .text(sanitize(r.label).toUpperCase(), bx + 46, y + 6, {
          width: colW - 54, lineBreak: false, ellipsis: true, characterSpacing: 0.4,
        });
      // montant
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
  // Gains assurables AE = grossPay (plafond 2026 ~ 65 700 $ — ignore ici, valeur indicative)
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

    // Date a droite
    doc.fillColor(C.gray).font("Helvetica").fontSize(9.5)
      .text(todayStr, x, doc.y, { width: w, align: "right", lineBreak: false });
    doc.moveDown(1.2);

    // Salutation
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(11)
      .text(body.salutation, x, doc.y, { width: w });
    doc.moveDown(0.8);

    // Corps
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
