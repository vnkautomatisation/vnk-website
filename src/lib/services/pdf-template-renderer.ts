// Rendu PDF VNK-style pour les templates de documents (contrat, politique,
// document legal, lettre, onboarding).
//
// Pipeline :
//   1. Substitue les variables {{...}} dans le markdown via renderTemplate().
//   2. Parse le markdown rendu en blocs structures (titres, paragraphes,
//      listes, gras inline, blocs signature).
//   3. Emet un PDF stylé VNK (header navy, footer, palette).
//
// Inspire de pdf-hr.ts (memes constantes de couleurs et patterns).
import "server-only";
import { PassThrough } from "stream";
import {
  renderTemplate,
  findVariable,
  type TemplateContext,
} from "@/lib/document-templates";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ─────────────────────────────────────────────────────────
// Palette + constantes (alignees avec pdf-hr.ts)
// ─────────────────────────────────────────────────────────
const C = {
  brand: "#1B4F8A",
  navy: "#0F2D52",
  navyDeep: "#0A1F3A",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  gray: "#64748B",
  grayDark: "#334155",
  grayMid: "#1f2937",
  grayLight: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  white: "#FFFFFF",
  // Bandeau d'avertissement (variables non resolues)
  warnBg: "#fed7aa",
  warnText: "#9a3412",
  warnBorder: "#fb923c",
  // Surlignage placeholder "a completer" (variable connue, non resolue)
  placeholderBg: "#fef3c7",
  placeholderText: "#92400e",
  placeholderBorder: "#fbbf24",
  // Surlignage placeholder "variable inconnue"
  unknownBg: "#fee2e2",
  unknownText: "#991b1b",
  unknownBorder: "#f87171",
};

const COMPANY = {
  shortName: "Automatisation Inc.",
  fullName: "VNK Automatisation Inc.",
  tagline: "VALUE · NETWORK · KNOWLEDGE",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
};

const HEADER_H = 78;
const FOOTER_RESERVED = 40;
const PAGE_MARGIN = 60;

// Typographie pro (en points)
const TYPO = {
  h1Size: 22,
  h2Size: 15,
  h3Size: 12,
  pSize: 10.5,
  bulletSize: 10.5,
  pLineGap: 3,
  pParagraphGap: 4,
} as const;

// Types PDFKit
type CapturedDoc = InstanceType<typeof PDFDocument>;

export type TemplateDocumentType =
  | "legal"
  | "contract"
  | "policy"
  | "letter"
  | "onboarding";

export interface PdfRenderOptions {
  /** Markdown brut (peut contenir {{variables}}). */
  bodyMarkdown: string;
  /** Contexte des variables (deja construit via buildContextFromEmployee). */
  context: TemplateContext;
  /** Titre principal affiche dans le header. */
  title: string;
  /** Type de document — influence le footer et badges. */
  documentType: TemplateDocumentType;
  /** Metadonnees optionnelles (version, employe, numero…). */
  metadata?: {
    version?: string;
    employeeName?: string;
    companyName?: string;
    documentNumber?: string;
  };
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

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
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/[\uD800-\uDFFF]/g, "");
}

// Pour les contextes qui n'utilisent pas writeInline (titres h1/h2/h3),
// on convertit les sentinelles de placeholder en texte litteral entre crochets
// (sans surlignage). Garantit qu'aucune sentinelle interne ne fuit dans le PDF.
function stripPlaceholderSentinels(s: string): string {
  if (!s) return s;
  return s
    .replace(new RegExp(`${PH_OPEN_KNOWN}([\\s\\S]*?)${PH_CLOSE}`, "g"), "[$1]")
    .replace(new RegExp(`${PH_OPEN_UNKNOWN}([\\s\\S]*?)${PH_CLOSE}`, "g"), "[$1]");
}

// ─────────────────────────────────────────────────────────
// Variables non resolues : detection + substitution
// ─────────────────────────────────────────────────────────
// Sentinelles textuelles inserees dans le markdown avant parsing pour preserver
// la position des variables non resolues. Le parser inline les transforme en
// segments surlignes (jaune = connue mais vide, rouge = inconnue).
const PH_OPEN_KNOWN = "PH_KNOWN";
const PH_OPEN_UNKNOWN = "PH_UNKNOWN";
const PH_CLOSE = "/PH";

const UNRESOLVED_VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.\-]*)\s*\}\}/g;
const RESERVED_VAR_KEYWORDS = new Set([
  "else",
  "#if",
  "/if",
  "#unless",
  "/unless",
]);

export interface UnresolvedVariable {
  key: string;
  label: string;
  known: boolean;
}

function findUnresolvedVariables(text: string): UnresolvedVariable[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: UnresolvedVariable[] = [];
  const re = new RegExp(UNRESOLVED_VAR_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    if (RESERVED_VAR_KEYWORDS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const def = findVariable(key);
    out.push({
      key,
      label: def?.label ?? key,
      known: !!def,
    });
  }
  return out;
}

// Remplace toutes les occurrences {{key}} restantes dans le markdown rendu par
// des sentinelles textuelles + un libelle lisible. Les sentinelles sont reperees
// au moment du rendu inline pour appliquer un surlignage couleur (cf. parseInline).
function substituteUnresolvedPlaceholders(text: string): string {
  if (!text) return text;
  return text.replace(UNRESOLVED_VAR_REGEX, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (RESERVED_VAR_KEYWORDS.has(key)) return match;
    const def = findVariable(key);
    if (def) {
      return `${PH_OPEN_KNOWN}A COMPLETER : ${def.label}${PH_CLOSE}`;
    }
    return `${PH_OPEN_UNKNOWN}VARIABLE INCONNUE : ${key}${PH_CLOSE}`;
  });
}

function ensureSpace(doc: CapturedDoc, needed: number) {
  if (doc.y + needed > doc.page.height - FOOTER_RESERVED) {
    doc.addPage();
    doc.y = HEADER_H + 22;
  }
}

function drawHexagonLogo(doc: CapturedDoc, cx: number, cy: number, size: number) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const radius = size * 0.175;
  doc.save();
  doc.lineWidth(1.5);
  doc.fillOpacity(0.1);
  doc.roundedRect(x, y, size, size, radius);
  doc.fillColor(C.white).fill();
  doc.fillOpacity(1).strokeOpacity(0.3);
  doc.roundedRect(x, y, size, size, radius);
  doc.strokeColor(C.white).stroke();
  doc.strokeOpacity(1).fillOpacity(1);
  const fontSize = size * 0.32;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(fontSize)
    .text("VNK", x, cy - fontSize * 0.5,
      { width: size, align: "center", lineBreak: false, characterSpacing: 0.8 });
  doc.restore();
}

const DOC_TYPE_BADGE: Record<TemplateDocumentType, string> = {
  legal: "Document legal",
  contract: "Contrat",
  policy: "Politique",
  letter: "Lettre",
  onboarding: "Accueil",
};

function drawHeader(
  doc: CapturedDoc,
  title: string,
  documentType: TemplateDocumentType,
  documentNumber?: string,
) {
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

  // Cote droit : type de document + numero (optionnel) + titre court
  const rightW = w - 35;
  const badge = DOC_TYPE_BADGE[documentType] ?? "Document";
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11)
    .text(sanitize(title), 0, 18, { width: rightW, align: "right", lineBreak: false, ellipsis: true });
  doc.save();
  doc.fillOpacity(0.78);
  doc.fillColor(C.white).font("Helvetica").fontSize(8.5)
    .text(badge + (documentNumber ? ` · ${documentNumber}` : ""),
      0, 37, { width: rightW, align: "right", lineBreak: false });
  doc.restore();
  doc.save();
  doc.fillOpacity(0.55);
  doc.fillColor(C.white).fontSize(7.5)
    .text(new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }),
      0, 51, { width: rightW, align: "right", lineBreak: false });
  doc.restore();

  doc.restore();
  doc.fillColor(C.text).font("Helvetica");
  doc.y = HEADER_H + 18;
}

function finalizeFooter(doc: CapturedDoc, todayFr: string, title?: string) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    const margin = PAGE_MARGIN;
    // Filet sous lequel le footer s'inscrit
    doc.strokeColor(C.border).lineWidth(0.5)
      .moveTo(margin, h - 30).lineTo(w - margin, h - 30).stroke();
    const colW = (w - margin * 2) / 3;
    // Gauche : titre / entreprise
    const leftTxt = sanitize(title || COMPANY.fullName);
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text(leftTxt, margin, h - 22, {
        width: colW, align: "left", lineBreak: false, ellipsis: true,
      });
    // Centre : pagination
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text(`Page ${i - range.start + 1} / ${totalPages}`,
        margin + colW, h - 22, { width: colW, align: "center", lineBreak: false });
    // Droite : date
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text(todayFr, margin + colW * 2, h - 22, {
        width: colW, align: "right", lineBreak: false,
      });
  }
}

// ─────────────────────────────────────────────────────────
// Parser markdown -> blocs
// ─────────────────────────────────────────────────────────
type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "checkbox"; checked: boolean; text: string }
  | { kind: "numbered"; index: number; text: string }
  | { kind: "blank" }
  | { kind: "signatureSection" }
  | { kind: "signatureLine"; role: string }
  | { kind: "pagebreak" }
  | { kind: "table"; headers: string[]; rows: string[][] };

const SIGN_HEADING_RE = /^#+\s*signatures?\s*$/i;
const SIG_EMP_RE = /\[signature\s+employ[ée]\]/i;
const SIG_EMR_RE = /\[signature\s+employeur\]/i;

// Detection table markdown : `| a | b |` + ligne separateur `|---|---|`
const TABLE_ROW_RE = /^\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|\s*$/;
function splitTableCells(line: string): string[] {
  // Retire pipes en bord et split sur pipe
  const inner = line.replace(/^\|/, "").replace(/\|\s*$/, "");
  return inner.split("|").map((c) => c.trim());
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let inSignatureSection = false;

  let i = 0;
  while (i < lines.length) {
    let raw = lines[i] ?? "";
    raw = raw.replace(/\s+$/g, ""); // trim right
    const line = raw.trim();

    if (line.length === 0) {
      blocks.push({ kind: "blank" });
      i++;
      continue;
    }

    // Pagebreak HTML comment
    if (/^<!--\s*pagebreak\s*-->$/i.test(line)) {
      blocks.push({ kind: "pagebreak" });
      i++;
      continue;
    }

    // Table markdown : 2+ lignes consecutives commencant par `|`,
    // 2e ligne = separateur
    if (TABLE_ROW_RE.test(line)) {
      const nextRaw = (lines[i + 1] ?? "").trim();
      if (TABLE_SEP_RE.test(nextRaw)) {
        const headers = splitTableCells(line);
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length) {
          const r = (lines[j] ?? "").trim();
          if (!TABLE_ROW_RE.test(r)) break;
          rows.push(splitTableCells(r));
          j++;
        }
        blocks.push({ kind: "table", headers, rows });
        i = j;
        continue;
      }
    }

    // Section signatures (declenchee par un titre)
    if (SIGN_HEADING_RE.test(line)) {
      blocks.push({ kind: "signatureSection" });
      inSignatureSection = true;
      i++;
      continue;
    }

    if (inSignatureSection) {
      // Lignes de placeholders connus dans la section signatures
      if (SIG_EMP_RE.test(line)) {
        blocks.push({ kind: "signatureLine", role: "Employé" });
        i++;
        continue;
      }
      if (SIG_EMR_RE.test(line)) {
        blocks.push({ kind: "signatureLine", role: "Employeur" });
        i++;
        continue;
      }
      // Un nouveau titre ferme la section
      if (/^#{1,3}\s/.test(line)) {
        inSignatureSection = false;
        // fall through to heading handling
      }
    }

    // Titres
    if (/^###\s+/.test(line)) {
      blocks.push({ kind: "h3", text: line.replace(/^###\s+/, "") });
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push({ kind: "h2", text: line.replace(/^##\s+/, "") });
      i++;
      continue;
    }
    if (/^#\s+/.test(line)) {
      blocks.push({ kind: "h1", text: line.replace(/^#\s+/, "") });
      i++;
      continue;
    }

    // Case a cocher style markdown : "- [ ] Texte" ou "- [x] Texte"
    const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      blocks.push({
        kind: "checkbox",
        checked: checkMatch[1].toLowerCase() === "x",
        text: checkMatch[2],
      });
      i++;
      continue;
    }

    // Puces
    if (/^[-*]\s+/.test(line)) {
      blocks.push({ kind: "bullet", text: line.replace(/^[-*]\s+/, "") });
      i++;
      continue;
    }

    // Listes numerotees
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push({
        kind: "numbered",
        index: Number(numMatch[1]),
        text: numMatch[2],
      });
      i++;
      continue;
    }

    // Detection inline d'un placeholder signature dans un paragraphe
    if (SIG_EMP_RE.test(line)) {
      blocks.push({ kind: "signatureLine", role: "Employé" });
      i++;
      continue;
    }
    if (SIG_EMR_RE.test(line)) {
      blocks.push({ kind: "signatureLine", role: "Employeur" });
      i++;
      continue;
    }

    blocks.push({ kind: "paragraph", text: line });
    i++;
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────
// Rendu inline : **gras**, `code`, [À COMPLÉTER] / [VARIABLE INCONNUE]
// ─────────────────────────────────────────────────────────
type InlineSegment = {
  text: string;
  bold?: boolean;
  mono?: boolean;
  placeholder?: "known" | "unknown";
};

// On capture egalement les sentinelles PH_KNOWN...PH_CLOSE / PH_UNKNOWN...PH_CLOSE
// inserees par substituteUnresolvedPlaceholders().
const PH_KNOWN_RE_SRC = `${PH_OPEN_KNOWN}([\\s\\S]*?)${PH_CLOSE}`;
const PH_UNKNOWN_RE_SRC = `${PH_OPEN_UNKNOWN}([\\s\\S]*?)${PH_CLOSE}`;
const INLINE_RE = new RegExp(
  `(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|${PH_KNOWN_RE_SRC}|${PH_UNKNOWN_RE_SRC})`,
  "g",
);

function parseInline(text: string): InlineSegment[] {
  const segs: InlineSegment[] = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segs.push({ text: text.slice(last, m.index) });
    }
    const token = m[0];
    if (token.startsWith("**")) {
      segs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("`")) {
      segs.push({ text: token.slice(1, -1), mono: true });
    } else if (token.startsWith(PH_OPEN_KNOWN)) {
      const inner = token.slice(PH_OPEN_KNOWN.length, token.length - PH_CLOSE.length);
      segs.push({ text: `[${inner}]`, placeholder: "known" });
    } else if (token.startsWith(PH_OPEN_UNKNOWN)) {
      const inner = token.slice(PH_OPEN_UNKNOWN.length, token.length - PH_CLOSE.length);
      segs.push({ text: `[${inner}]`, placeholder: "unknown" });
    }
    last = m.index + token.length;
  }
  if (last < text.length) {
    segs.push({ text: text.slice(last) });
  }
  return segs;
}

function writeInline(
  doc: CapturedDoc,
  text: string,
  opts: {
    x: number;
    width: number;
    size: number;
    color: string;
    align?: "left" | "right" | "center" | "justify";
    lineGap?: number;
    paragraphGap?: number;
  },
) {
  const segments = parseInline(sanitize(text));
  if (segments.length === 0) {
    doc.text("", opts.x, doc.y, { width: opts.width });
    return;
  }
  doc.fillColor(opts.color).fontSize(opts.size);
  const lastIdx = segments.length - 1;
  segments.forEach((seg, i) => {
    const isLast = i === lastIdx;
    if (seg.placeholder) {
      // Surlignage : on dessine un fond colore derriere le texte du placeholder.
      // PDFKit n'offre pas de "background-color" sur du texte continued, donc on
      // emule en mesurant la largeur + dessinant un rectangle juste avant le texte.
      const bg = seg.placeholder === "known" ? C.placeholderBg : C.unknownBg;
      const fg = seg.placeholder === "known" ? C.placeholderText : C.unknownText;
      const border = seg.placeholder === "known" ? C.placeholderBorder : C.unknownBorder;
      doc.font("Helvetica-Bold");
      const tw = doc.widthOfString(seg.text);
      const th = doc.currentLineHeight();
      const cx = doc.x;
      const cy = doc.y;
      // Si le placeholder deborde, on laisse PDFKit gerer le wrap mais on dessine
      // au moins une "pastille" derriere la 1re ligne pour signaler le surlignage.
      const rectW = Math.min(tw + 6, opts.width);
      doc.save();
      doc.roundedRect(cx - 1, cy - 1, rectW, th + 2, 3)
        .fillAndStroke(bg, border);
      doc.restore();
      doc.fillColor(fg);
      doc.text(seg.text, {
        width: opts.width,
        continued: !isLast,
        align: isLast ? (opts.align ?? "left") : undefined,
        lineGap: opts.lineGap,
        paragraphGap: opts.paragraphGap,
      });
      // Restaure couleur normale apres le placeholder
      doc.fillColor(opts.color);
      doc.font("Helvetica");
      return;
    }
    if (seg.bold) doc.font("Helvetica-Bold");
    else if (seg.mono) {
      // VNK : pas de monospace dans les templates de docs.
      // On rend en Helvetica bold semi-italique pour signaler une valeur
      // tout en restant lisible (pas Courier qui casse le rendu).
      doc.font("Helvetica-Bold");
    }
    else doc.font("Helvetica");
    doc.text(seg.text, {
      width: opts.width,
      continued: !isLast,
      align: isLast ? (opts.align ?? "left") : undefined,
      lineGap: opts.lineGap,
      paragraphGap: opts.paragraphGap,
    });
  });
  // Restaure police par defaut
  doc.font("Helvetica");
}

// ─────────────────────────────────────────────────────────
// Rendu des blocs
// ─────────────────────────────────────────────────────────

function renderBlocks(doc: CapturedDoc, blocks: Block[]) {
  const x = PAGE_MARGIN;
  const w = doc.page.width - PAGE_MARGIN * 2;

  let lastWasBlank = false;
  let inSignatureGrid = false;
  let pendingSignatures: { role: string }[] = [];

  const flushSignatures = () => {
    if (pendingSignatures.length === 0) return;
    drawSignatureGrid(doc, pendingSignatures);
    pendingSignatures = [];
  };

  for (const block of blocks) {
    if (block.kind === "blank") {
      // En signature section, on garde les sigs en attente : pas de flush sur ligne vide.
      if (!inSignatureGrid) flushSignatures();
      if (!lastWasBlank) {
        doc.moveDown(0.4);
        lastWasBlank = true;
      }
      continue;
    }
    lastWasBlank = false;

    if (block.kind === "pagebreak") {
      flushSignatures();
      doc.addPage();
      doc.y = HEADER_H + 18;
      inSignatureGrid = false;
      continue;
    }

    if (block.kind === "signatureSection") {
      flushSignatures();
      // Force un espace genereux AVANT la section signatures
      ensureSpace(doc, 40);
      doc.moveDown(1.2);
      const y = doc.y;
      doc.rect(x, y + 1, 3, 13).fill(C.navy);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11)
        .text("SIGNATURES", x + 10, y, { lineBreak: false, characterSpacing: 1 });
      doc.strokeColor(C.border).lineWidth(0.5)
        .moveTo(x, y + 19).lineTo(x + w, y + 19).stroke();
      doc.y = y + 28;
      doc.fillColor(C.text);
      inSignatureGrid = true;
      continue;
    }

    if (block.kind === "signatureLine") {
      pendingSignatures.push({ role: block.role });
      continue;
    }

    // À l'intérieur de la section signatures, on ignore les paragraphes/bullets
    // redondants (genre "**Employé** : ...", "Date : ..."). L'information clé
    // (nom + date) sera capturée par les SignatureLine et rendue dans la boite.
    // → permet d'afficher les 2 signatures CÔTE À CÔTE au lieu d'empilées.
    if (inSignatureGrid && (
      block.kind === "paragraph"
      || block.kind === "bullet"
      || block.kind === "numbered"
      || block.kind === "checkbox"
    )) {
      continue;
    }

    // En sortie de section signatures (heading, etc.), on flush avant rendu.
    if (pendingSignatures.length > 0) {
      flushSignatures();
    }

    if (block.kind === "h1") {
      ensureSpace(doc, 38);
      doc.moveDown(0.3);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(TYPO.h1Size)
        .text(stripPlaceholderSentinels(sanitize(block.text)), x, doc.y, {
          width: w,
          characterSpacing: 0.2,
        });
      // Filet doré sous le H1 (signature visuelle pro)
      doc.moveDown(0.15);
      doc.strokeColor(C.brand).lineWidth(1.2)
        .moveTo(x, doc.y).lineTo(x + 60, doc.y).stroke();
      doc.y += 8;
      doc.fillColor(C.text).font("Helvetica");
      inSignatureGrid = false;
      continue;
    }

    if (block.kind === "h2") {
      ensureSpace(doc, 32);
      // Espace genereux avant H2
      doc.moveDown(0.8);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(TYPO.h2Size)
        .text(stripPlaceholderSentinels(sanitize(block.text)), x, doc.y, {
          width: w,
          characterSpacing: 0.2,
        });
      doc.moveDown(0.3);
      doc.fillColor(C.text).font("Helvetica");
      inSignatureGrid = false;
      continue;
    }

    if (block.kind === "h3") {
      ensureSpace(doc, 24);
      doc.moveDown(0.5);
      doc.fillColor(C.grayDark).font("Helvetica-Bold").fontSize(TYPO.h3Size)
        .text(stripPlaceholderSentinels(sanitize(block.text)), x, doc.y, { width: w });
      doc.moveDown(0.3);
      doc.fillColor(C.text).font("Helvetica");
      continue;
    }

    if (block.kind === "bullet") {
      const bulletX = x + 6;
      const textX = x + 18;
      const textW = w - 18;
      const sanitized = sanitize(block.text);
      doc.font("Helvetica").fontSize(TYPO.bulletSize);
      const h = doc.heightOfString(sanitized, { width: textW, lineGap: TYPO.pLineGap });
      ensureSpace(doc, h + 4);
      const startY = doc.y;
      // Puce alignee avec la premiere ligne (centre vertical ~ 5pt)
      doc.save();
      doc.circle(bulletX + 2, startY + 5.5, 1.7).fill(C.navy);
      doc.restore();
      doc.y = startY;
      doc.fillColor(C.grayMid).font("Helvetica").fontSize(TYPO.bulletSize);
      writeInline(doc, block.text, {
        x: textX, width: textW, size: TYPO.bulletSize, color: C.grayMid,
        lineGap: TYPO.pLineGap,
      });
      doc.moveDown(0.25);
      continue;
    }

    if (block.kind === "numbered") {
      const numW = 24;
      const textX = x + numW;
      const textW = w - numW;
      const sanitized = sanitize(block.text);
      doc.font("Helvetica-Bold").fontSize(TYPO.bulletSize);
      const h = doc.heightOfString(sanitized, { width: textW, lineGap: TYPO.pLineGap });
      ensureSpace(doc, h + 4);
      const startY = doc.y;
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(TYPO.bulletSize)
        .text(`${block.index}.`, x, startY, { width: numW - 4, lineBreak: false });
      doc.y = startY;
      writeInline(doc, block.text, {
        x: textX, width: textW, size: TYPO.bulletSize, color: C.grayMid,
        lineGap: TYPO.pLineGap,
      });
      doc.moveDown(0.2);
      continue;
    }

    if (block.kind === "checkbox") {
      const boxSize = 10;
      const boxX = x + 6;
      const textX = x + 6 + boxSize + 10;
      const textW = w - 6 - boxSize - 10;
      const sanitized = sanitize(block.text);
      doc.font("Helvetica").fontSize(TYPO.bulletSize);
      const h = doc.heightOfString(sanitized, { width: textW, lineGap: TYPO.pLineGap });
      ensureSpace(doc, h + 4);
      const startY = doc.y;
      // Boite carree
      doc.save();
      doc.strokeColor(C.navy).lineWidth(1)
        .rect(boxX, startY + 2, boxSize, boxSize)
        .stroke();
      if (block.checked) {
        // Coche : 2 traits formant un V
        doc.strokeColor(C.navy).lineWidth(1.5)
          .moveTo(boxX + 2, startY + 6).lineTo(boxX + 4.5, startY + 9)
          .moveTo(boxX + 4.5, startY + 9).lineTo(boxX + 8, startY + 4)
          .stroke();
      }
      doc.restore();
      doc.y = startY;
      doc.fillColor(C.grayMid).font("Helvetica").fontSize(TYPO.bulletSize);
      writeInline(doc, block.text, {
        x: textX, width: textW, size: TYPO.bulletSize, color: C.grayMid,
        lineGap: TYPO.pLineGap,
      });
      doc.moveDown(0.25);
      continue;
    }

    if (block.kind === "table") {
      drawTable(doc, block.headers, block.rows);
      doc.moveDown(0.4);
      continue;
    }

    if (block.kind === "paragraph") {
      const sanitized = sanitize(block.text);
      doc.font("Helvetica").fontSize(TYPO.pSize);
      const h = doc.heightOfString(sanitized, { width: w, lineGap: TYPO.pLineGap });
      ensureSpace(doc, h + 4);
      writeInline(doc, block.text, {
        x, width: w, size: TYPO.pSize, color: C.grayMid,
        align: "justify",
        lineGap: TYPO.pLineGap,
        paragraphGap: TYPO.pParagraphGap,
      });
      doc.moveDown(0.35);
      continue;
    }
  }
  flushSignatures();
  // Silence ESLint sur la variable de tracking
  void inSignatureGrid;
}

function drawSignatureGrid(
  doc: CapturedDoc,
  signatures: { role: string }[],
) {
  const x = PAGE_MARGIN;
  const w = doc.page.width - PAGE_MARGIN * 2;
  const cols = signatures.length >= 2 ? 2 : 1;
  const gap = 16;
  const colW = (w - gap * (cols - 1)) / cols;
  const blockH = 110;
  const badgeH = 20;
  const rows = Math.ceil(signatures.length / cols);
  const totalH = rows * blockH + (rows - 1) * gap;
  ensureSpace(doc, totalH + 12);
  const baseY = doc.y;

  signatures.forEach((sig, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const bx = x + col * (colW + gap);
    const by = baseY + row * (blockH + gap);

    // Cadre arrondi
    doc.save();
    doc.roundedRect(bx, by, colW, blockH, 6)
      .fillAndStroke(C.grayLight, C.border);
    doc.restore();

    // Badge role (en haut, occupe toute la largeur)
    doc.save();
    // On clip pour respecter l'arrondi du haut
    doc.roundedRect(bx, by, colW, badgeH + 2, 6).clip();
    doc.rect(bx, by, colW, badgeH).fill(C.navy);
    doc.restore();
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5)
      .text(sig.role.toUpperCase(), bx + 12, by + 6,
        { lineBreak: false, characterSpacing: 1, width: colW - 24 });

    // Ligne signature (vers 55% de la box)
    const lineY = by + 62;
    doc.strokeColor(C.grayDark).lineWidth(0.7)
      .moveTo(bx + 14, lineY).lineTo(bx + colW - 14, lineY).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text("Signature", bx + 14, lineY + 4, { lineBreak: false });

    // Bloc Nom + Date alignes en bas
    const nameY = by + blockH - 38;
    const nameW = colW * 0.55;
    doc.strokeColor(C.grayDark).lineWidth(0.7)
      .moveTo(bx + 14, nameY).lineTo(bx + 14 + nameW, nameY).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text("Nom en lettres moulees", bx + 14, nameY + 4, { lineBreak: false });

    const dateX = bx + colW - 14 - 90;
    doc.strokeColor(C.grayDark).lineWidth(0.7)
      .moveTo(dateX, nameY).lineTo(bx + colW - 14, nameY).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
      .text("Date (AAAA-MM-JJ)", dateX, nameY + 4, { lineBreak: false });
  });

  doc.y = baseY + totalH + 12;
  doc.fillColor(C.text);
}

// ─────────────────────────────────────────────────────────
// Tables markdown
// ─────────────────────────────────────────────────────────
function drawTable(
  doc: CapturedDoc,
  headers: string[],
  rows: string[][],
) {
  const x = PAGE_MARGIN;
  const w = doc.page.width - PAGE_MARGIN * 2;
  const cols = headers.length;
  if (cols === 0) return;
  const colW = w / cols;
  const padX = 8;
  const padY = 6;
  const headerH = 22;

  ensureSpace(doc, headerH + 30);

  // Header navy
  doc.save();
  doc.rect(x, doc.y, w, headerH).fill(C.navy);
  doc.restore();
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(9.5);
  headers.forEach((h, i) => {
    doc.text(sanitize(h), x + i * colW + padX, doc.y + (headerH - 10) / 2, {
      width: colW - padX * 2,
      lineBreak: false,
      ellipsis: true,
      characterSpacing: 0.4,
    });
  });
  doc.y += headerH;
  doc.fillColor(C.text);

  // Rows
  rows.forEach((row, rowIdx) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(C.grayMid);
    // Hauteur max de la ligne (basee sur la cellule la plus haute)
    const rowH = Math.max(
      18,
      ...row.map((cell) =>
        doc.heightOfString(sanitize(cell ?? ""), {
          width: colW - padX * 2,
          lineGap: 1.5,
        }) + padY * 2,
      ),
    );
    ensureSpace(doc, rowH + 4);
    const rowY = doc.y;
    // Fond alterne
    if (rowIdx % 2 === 1) {
      doc.save();
      doc.rect(x, rowY, w, rowH).fill(C.grayLight);
      doc.restore();
    }
    // Bordures verticales fines
    doc.save();
    doc.strokeColor(C.border).lineWidth(0.4);
    for (let i = 1; i < cols; i++) {
      doc.moveTo(x + i * colW, rowY).lineTo(x + i * colW, rowY + rowH).stroke();
    }
    doc.restore();
    // Contenu
    doc.fillColor(C.grayMid).font("Helvetica").fontSize(9.5);
    row.forEach((cell, i) => {
      // Support gras inline minimal dans les cellules : **texte**
      const raw = sanitize(cell ?? "");
      const hasBold = /\*\*[^*]+\*\*/.test(raw);
      if (hasBold) {
        // Render brut sans markdown : on retire les ** mais on met tout en gras si la cellule
        // commence par ** (titre de ligne)
        const stripped = raw.replace(/\*\*/g, "");
        const allBold = /^\*\*/.test(raw);
        doc.font(allBold ? "Helvetica-Bold" : "Helvetica");
        doc.text(stripped, x + i * colW + padX, rowY + padY, {
          width: colW - padX * 2,
          lineGap: 1.5,
        });
      } else {
        doc.text(raw, x + i * colW + padX, rowY + padY, {
          width: colW - padX * 2,
          lineGap: 1.5,
        });
      }
    });
    doc.y = rowY + rowH;
    // Ligne horizontale sous
    doc.save();
    doc.strokeColor(C.border).lineWidth(0.4)
      .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
    doc.restore();
  });
  doc.fillColor(C.text);
}

// Bandeau d'avertissement sous le header (page 1) : variables non resolues
// ou erreur de rendu.
function drawWarningBanner(
  doc: CapturedDoc,
  message: string,
  variant: "warning" | "error" = "warning",
) {
  const x = PAGE_MARGIN;
  const w = doc.page.width - PAGE_MARGIN * 2;
  const padX = 12;
  const padY = 8;
  const bg = variant === "error" ? C.unknownBg : C.warnBg;
  const border = variant === "error" ? C.unknownBorder : C.warnBorder;
  const fg = variant === "error" ? C.unknownText : C.warnText;

  const startY = doc.y;
  doc.fillColor(fg).font("Helvetica-Bold").fontSize(9);
  const textW = w - padX * 2;
  const textH = doc.heightOfString(sanitize(message), { width: textW });
  const boxH = textH + padY * 2;
  ensureSpace(doc, boxH + 10);

  doc.save();
  doc.roundedRect(x, startY, w, boxH, 4).fillAndStroke(bg, border);
  doc.restore();
  doc.fillColor(fg).font("Helvetica-Bold").fontSize(9)
    .text(sanitize(message), x + padX, startY + padY, { width: textW });
  doc.y = startY + boxH + 10;
  doc.fillColor(C.text).font("Helvetica");
}

// Construit un PDF minimal d'erreur (status 200, blob valide) pour eviter
// l'icone "fichier casse" cote iframe quand quelque chose tourne mal.
function renderErrorPdf(title: string, message: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 0, left: PAGE_MARGIN },
      bufferPages: true,
    });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);
    try {
      drawHeader(doc, title || "Erreur de rendu", "letter");
      drawWarningBanner(doc, message, "error");
      const x = PAGE_MARGIN;
      const w = doc.page.width - PAGE_MARGIN * 2;
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(9)
        .text(
          "Cet apercu n'a pas pu etre genere normalement. Verifiez le markdown et les variables utilisees, puis reessayez.",
          x, doc.y + 6, { width: w, align: "left" },
        );
      finalizeFooter(
        doc,
        new Date().toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" }),
        title || "Erreur",
      );
      doc.end();
    } catch (e) {
      try { doc.end(); } catch { /* noop */ }
      reject(e);
    }
  });
}

// ─────────────────────────────────────────────────────────
// Entree principale
// ─────────────────────────────────────────────────────────
export async function renderTemplateToPdf(opts: PdfRenderOptions): Promise<Buffer> {
  const safeContext = opts.context ?? {};
  const rawBody = opts.bodyMarkdown ?? "";

  // 1. Rendu Mustache (tolerant : si exception, on tombe sur le body brut)
  let rendered: string;
  let renderError: string | null = null;
  try {
    rendered = renderTemplate(rawBody, safeContext);
  } catch (e) {
    renderError = (e as Error)?.message ?? "Erreur de rendu inconnue";
    rendered = rawBody;
  }

  // 2. Pre-traitement : on enleve TOUS les backticks (inline code markdown).
  // Les templates VNK n'utilisent jamais d'inline code, et les seed historiques
  // wrappent par erreur les variables et certains noms propres dans des
  // backticks, ce qui les rend en Courier mono dans le PDF (visuellement
  // inadequat pour un document juridique). On strip globalement.
  rendered = rendered.replace(/`/g, "");

  // 3. Detection des variables {{...}} non resolues
  const unresolved = findUnresolvedVariables(rendered);
  const renderedWithPlaceholders = substituteUnresolvedPlaceholders(rendered);

  const isEmpty = renderedWithPlaceholders.trim().length === 0;
  const blocks = parseBlocks(renderedWithPlaceholders);
  const todayFr = safeContext["date.todayFr"]
    || new Date().toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" });
  const docNumber = opts.metadata?.documentNumber
    || (opts.metadata?.version ? `v${opts.metadata.version}` : undefined);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 0, left: PAGE_MARGIN },
      bufferPages: true,
    });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);

    // Auto-header sur chaque nouvelle page (sauf la 1re qui est dessinee
    // manuellement avec les metas / bandeaux). On utilise un flag pour
    // sauter le 1er appel.
    let firstPageRendered = false;
    doc.on("pageAdded", () => {
      if (!firstPageRendered) return;
      drawHeader(doc, opts.title, opts.documentType, docNumber);
    });

    try {
      drawHeader(doc, opts.title, opts.documentType, docNumber);
      firstPageRendered = true;

      // En-tete metadata leger sous le header (employe / version)
      if (opts.metadata?.employeeName || opts.metadata?.version || opts.metadata?.companyName) {
        const lines: string[] = [];
        if (opts.metadata.employeeName) lines.push(`Destinataire : ${opts.metadata.employeeName}`);
        if (opts.metadata.companyName) lines.push(opts.metadata.companyName);
        if (opts.metadata.version) lines.push(`Version : ${opts.metadata.version}`);
        const x = PAGE_MARGIN;
        const w = doc.page.width - PAGE_MARGIN * 2;
        const y = doc.y;
        doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
          .text(lines.join("  ·  "), x, y, { width: w, lineBreak: false, ellipsis: true });
        doc.y = y + 14;
        doc.strokeColor(C.border).lineWidth(0.3)
          .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
        doc.y += 10;
        doc.fillColor(C.text).font("Helvetica");
      }

      // Bandeau d'avertissement (page 1 uniquement)
      if (renderError) {
        drawWarningBanner(
          doc,
          `Erreur lors du rendu des variables : ${renderError}. Le contenu brut est affiche ci-dessous.`,
          "error",
        );
      } else if (unresolved.length > 0) {
        drawWarningBanner(
          doc,
          `Apercu avec valeurs par defaut - ${unresolved.length} variable(s) non resolue(s) surlignee(s) dans le document.`,
          "warning",
        );
      }

      if (isEmpty) {
        const x = PAGE_MARGIN;
        const w = doc.page.width - PAGE_MARGIN * 2;
        ensureSpace(doc, 40);
        doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(16)
          .text("Aucun contenu", x, doc.y, { width: w, align: "center" });
        doc.moveDown(0.4);
        doc.fillColor(C.gray).font("Helvetica").fontSize(10)
          .text(
            "Ce template ne contient aucun corps de markdown a afficher. Ajoutez du contenu dans l'editeur puis regenerez l'apercu.",
            x, doc.y, { width: w, align: "center" },
          );
      } else {
        renderBlocks(doc, blocks);
      }

      // Note de bas-de-document (confidentialite legere selon type)
      doc.moveDown(0.6);
      const noteByType: Record<TemplateDocumentType, string> = {
        legal: "Document confidentiel. Lecture et signature reservees aux parties concernees.",
        contract: "Document confidentiel - reserve aux parties signataires. Regi par les lois du Quebec et du Canada.",
        policy: "Politique interne. Consultez votre representant RH pour toute clarification.",
        letter: "Pour toute verification, contactez-nous a vnkautomatisation@gmail.com.",
        onboarding: "Document d'accueil. Conservez une copie pour vos dossiers.",
      };
      const note = noteByType[opts.documentType];
      ensureSpace(doc, 24);
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7.5)
        .text(note, PAGE_MARGIN, doc.y, {
          width: doc.page.width - PAGE_MARGIN * 2,
          align: "center",
        });

      finalizeFooter(doc, todayFr, opts.title);
      doc.end();
    } catch (e) {
      try { doc.end(); } catch { /* noop */ }
      // Plutot que de rejeter (et de renvoyer un 500 cote API), on tente un
      // fallback PDF "erreur" lisible. Si meme ca rate, on rejette.
      const msg = (e as Error)?.message ?? "Erreur inconnue";
      renderErrorPdf(opts.title || "Apercu document", `Erreur PDFKit : ${msg}`)
        .then(resolve)
        .catch(reject);
    }
  });
}
