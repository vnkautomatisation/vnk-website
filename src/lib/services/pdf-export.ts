// PDF generators pour l'export ZIP : conversation chat-style, RDV, litiges, audit, paiements
// Utilise PDFKit directement avec capture via PassThrough
import "server-only";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// Couleurs alignees avec le logo officiel VNK (vnk-logo-horizontal-light.svg)
const C = {
  brand: "#1B4F8A",       // bleu primaire VNK (text + stroke logo)
  brandBg: "#EBF2FA",      // fond hexagone version light
  navy: "#0F2D52",         // navy header (matche pdf-templates contrats/factures)
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
  bubbleClient: "#F1F5F9",
  bubbleVnk: "#1B4F8A",
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

// ─────────────────────────────────────────────────────────
// I18N — traductions des textes structurels
// ─────────────────────────────────────────────────────────
export type ExportLang = "fr" | "en";

type Dict = {
  // Conversation PDF
  convTitle: string;
  convIntro: (clientName: string, email: string) => string;
  convEmpty: string;
  convInternalNote: string;
  // Appointments PDF
  apptTitle: string;
  apptIntro: (clientName: string, n: number) => string;
  apptEmpty: string;
  // Disputes PDF
  dispTitle: string;
  dispIntro: (clientName: string, n: number) => string;
  dispEmpty: string;
  dispDescription: string;
  dispInternalNotes: string;
  dispFields: Record<string, string>;
  dispMetaOpened: (date: string) => string;
  dispMetaInvoice: (n: string) => string;
  dispMetaAssigned: (a: string) => string;
  // Audit PDF
  auditTitle: string;
  auditIntro: (clientName: string, n: number) => string;
  auditEmpty: string;
  // Payments PDF
  payTitle: string;
  payIntro: (clientName: string, n: number) => string;
  payEmpty: string;
  payTotalIn: string;
  payTotalOut: string;
  payNet: string;
  payDetail: string;
  payCols: { type: string; date: string; amount: string; method: string; status: string; description: string };
  // Fiche client PDF
  ficheTitle: string;
  ficheIntro: (clientName: string) => string;
  ficheClient: string;
  ficheContact: string;
  ficheKpi: { mandates: string; quotes: string; contracts: string; invoices: string };
  ficheTotalSpent: string;
  ficheOpenBalance: string;
  ficheBusinessProfile: string;
  ficheSector: string;
  ficheTechnologies: string;
  ficheRecentInvoices: string;
  ficheRecentContracts: string;
  ficheActiveDisputes: string;
  ficheInternalNotes: string;
  ficheSigned: (date: string) => string;
  // CSV / README
  readmeTitle: string;
  readmeContent: string;
  readmeExportedOn: string;
  readmeExportedBy: string;
  csvPayments: string[];
  csvAppointments: string[];
  csvDisputes: string[];
  csvAudit: string[];
  csvConversation: string[];
  // Common
  noSubject: string;
  paid: string;
  unpaid: string;
  overdue: string;
  pending: string;
};

const T: Record<ExportLang, Dict> = {
  fr: {
    convTitle: "Conversation complète",
    convIntro: (n, e) => `Trace officielle de tous les échanges (chat + email) avec ${n} (${e}). Bulles à gauche : messages du client. Bulles à droite (navy) : réponses de VNK. Bandeau ambré : notes internes admin (non visibles par le client). Pièces jointes images embarquées; autres fichiers listés par nom.`,
    convEmpty: "Aucun message échangé.",
    convInternalNote: "Note interne",
    apptTitle: "Rendez-vous",
    apptIntro: (n, c) => `Liste complète des ${c} rendez-vous planifiés ou tenus avec ${n} : date, durée, sujet, type de rencontre, statut et notes internes admin.`,
    apptEmpty: "Aucun rendez-vous.",
    dispTitle: "Litiges et différends",
    dispIntro: (n, c) => `Dossier juridique complet des ${c} litiges avec ${n}. Chargebacks Stripe, plaintes, escalades (cabinet, dossier, tribunal). Références croisées vers facture/contrat. Notes internes confidentielles en jaune. Document à conserver pour traçabilité légale.`,
    dispEmpty: "Aucun litige enregistré.",
    dispDescription: "DESCRIPTION",
    dispInternalNotes: "NOTES INTERNES — CONFIDENTIEL",
    dispFields: {
      type: "Type", category: "Catégorie", amountDisputed: "Montant contesté",
      stripeId: "Stripe ID", stripeReason: "Raison Stripe", outcome: "Résultat",
      evidenceDueBy: "Échéance preuve", lawFirm: "Cabinet juridique",
      caseNumber: "N° de dossier", tribunal: "Tribunal", resolution: "Résolution",
      resolvedAt: "Résolu le",
    },
    dispMetaOpened: (d) => `Ouvert ${d}`,
    dispMetaInvoice: (n) => `Facture ${n}`,
    dispMetaAssigned: (a) => `Assigné à ${a}`,
    auditTitle: "Timeline d'événements (audit complet)",
    auditIntro: (n, c) => `Trace immuable des ${c} actions impliquant ${n} : connexions, paiements, signatures, consentements, emails, actions admin et événements workflow. Utilisé pour audit légal, conformité GDPR, et investigation forensique. Chaque ligne inclut IP et User-Agent quand disponibles.`,
    auditEmpty: "Aucun événement enregistré.",
    payTitle: "Relevé de paiements",
    payIntro: (n, c) => `Totaux financiers et détail chronologique des ${c} transactions (paiements encaissés et remboursements émis) avec ${n}. Source : Stripe. Document à conserver pour réconciliation comptable.`,
    payEmpty: "Aucune transaction.",
    payTotalIn: "Total encaissé",
    payTotalOut: "Total remboursé",
    payNet: "Net",
    payDetail: "Détail des transactions",
    payCols: { type: "Type", date: "Date", amount: "Montant", method: "Méthode", status: "Statut", description: "Description" },
    ficheTitle: "Fiche client (synthèse)",
    ficheIntro: (n) => `Vue d'ensemble exécutive du dossier de ${n} : identité, totaux financiers, derniers documents émis et litiges en cours. Document de tête du dossier ZIP — sert d'index visuel pour comprendre la relation client en un coup d'œil.`,
    ficheClient: "CLIENT",
    ficheContact: "CONTACT",
    ficheKpi: { mandates: "Mandats", quotes: "Devis", contracts: "Contrats", invoices: "Factures" },
    ficheTotalSpent: "Total dépensé",
    ficheOpenBalance: "Solde ouvert",
    ficheBusinessProfile: "Profil business",
    ficheSector: "Secteur",
    ficheTechnologies: "Technologies",
    ficheRecentInvoices: "Dernières factures",
    ficheRecentContracts: "Derniers contrats",
    ficheActiveDisputes: "Litiges en cours",
    ficheInternalNotes: "NOTES INTERNES",
    ficheSigned: (d) => `SIGNÉ ${d}`,
    readmeTitle: "Dossier client complet — VNK Automatisation",
    readmeContent: "CONTENU DU DOSSIER",
    readmeExportedOn: "Exporté le",
    readmeExportedBy: "Exporté par",
    csvPayments: ["Type", "Date", "Montant", "Devise", "Méthode", "Statut", "Référence Stripe", "Description"],
    csvAppointments: ["Date", "Début", "Fin", "Sujet", "Statut", "Type rencontre", "Notes admin"],
    csvDisputes: ["Ouvert", "Type", "Titre", "Statut", "Priorité", "Montant", "Stripe ID", "Raison Stripe", "Outcome", "Assigné", "Résolu", "Résolution"],
    csvAudit: ["Date", "Source", "Type", "Label", "IP", "User-Agent"],
    csvConversation: ["Date", "Heure", "Auteur", "Canal", "Note interne", "Contenu", "Pièces jointes"],
    noSubject: "(sans sujet)",
    paid: "PAYÉ",
    unpaid: "IMPAYÉ",
    overdue: "EN RETARD",
    pending: "EN ATTENTE",
  },
  en: {
    convTitle: "Full conversation",
    convIntro: (n, e) => `Official record of all exchanges (chat + email) with ${n} (${e}). Bubbles on the left: client messages. Bubbles on the right (navy): VNK replies. Amber banner: internal admin notes (not visible to the client). Image attachments embedded; other files listed by name.`,
    convEmpty: "No messages exchanged.",
    convInternalNote: "Internal note",
    apptTitle: "Appointments",
    apptIntro: (n, c) => `Complete list of the ${c} appointments scheduled or held with ${n}: date, duration, subject, meeting type, status and internal admin notes.`,
    apptEmpty: "No appointments.",
    dispTitle: "Disputes and claims",
    dispIntro: (n, c) => `Complete legal file of the ${c} disputes with ${n}. Stripe chargebacks, complaints, legal escalations (law firm, case file, court). Cross-references to invoice/contract. Confidential internal notes in yellow. Document to retain for legal traceability.`,
    dispEmpty: "No disputes recorded.",
    dispDescription: "DESCRIPTION",
    dispInternalNotes: "INTERNAL NOTES — CONFIDENTIAL",
    dispFields: {
      type: "Type", category: "Category", amountDisputed: "Disputed amount",
      stripeId: "Stripe ID", stripeReason: "Stripe reason", outcome: "Outcome",
      evidenceDueBy: "Evidence due", lawFirm: "Law firm",
      caseNumber: "Case number", tribunal: "Court", resolution: "Resolution",
      resolvedAt: "Resolved on",
    },
    dispMetaOpened: (d) => `Opened ${d}`,
    dispMetaInvoice: (n) => `Invoice ${n}`,
    dispMetaAssigned: (a) => `Assigned to ${a}`,
    auditTitle: "Event timeline (full audit)",
    auditIntro: (n, c) => `Immutable record of ${c} actions involving ${n}: logins, payments, signatures, consents, emails, admin actions and workflow events. Used for legal audit, GDPR compliance and forensic investigation. Each line includes IP and User-Agent when available.`,
    auditEmpty: "No events recorded.",
    payTitle: "Payment statement",
    payIntro: (n, c) => `Financial totals and chronological detail of the ${c} transactions (payments received and refunds issued) with ${n}. Source: Stripe. Document to retain for accounting reconciliation.`,
    payEmpty: "No transactions.",
    payTotalIn: "Total received",
    payTotalOut: "Total refunded",
    payNet: "Net",
    payDetail: "Transaction details",
    payCols: { type: "Type", date: "Date", amount: "Amount", method: "Method", status: "Status", description: "Description" },
    ficheTitle: "Client overview",
    ficheIntro: (n) => `Executive overview of the file for ${n}: identity, financial totals, latest documents issued and ongoing disputes. Front document of the ZIP file — visual index to understand the client relationship at a glance.`,
    ficheClient: "CLIENT",
    ficheContact: "CONTACT",
    ficheKpi: { mandates: "Mandates", quotes: "Quotes", contracts: "Contracts", invoices: "Invoices" },
    ficheTotalSpent: "Total spent",
    ficheOpenBalance: "Open balance",
    ficheBusinessProfile: "Business profile",
    ficheSector: "Sector",
    ficheTechnologies: "Technologies",
    ficheRecentInvoices: "Recent invoices",
    ficheRecentContracts: "Recent contracts",
    ficheActiveDisputes: "Ongoing disputes",
    ficheInternalNotes: "INTERNAL NOTES",
    ficheSigned: (d) => `SIGNED ${d}`,
    readmeTitle: "Complete client file — VNK Automatisation",
    readmeContent: "FOLDER CONTENTS",
    readmeExportedOn: "Exported on",
    readmeExportedBy: "Exported by",
    csvPayments: ["Type", "Date", "Amount", "Currency", "Method", "Status", "Stripe reference", "Description"],
    csvAppointments: ["Date", "Start", "End", "Subject", "Status", "Meeting type", "Admin notes"],
    csvDisputes: ["Opened", "Type", "Title", "Status", "Priority", "Amount", "Stripe ID", "Stripe reason", "Outcome", "Assigned", "Resolved", "Resolution"],
    csvAudit: ["Date", "Source", "Type", "Label", "IP", "User-Agent"],
    csvConversation: ["Date", "Time", "Author", "Channel", "Internal note", "Content", "Attachments"],
    noSubject: "(no subject)",
    paid: "PAID",
    unpaid: "UNPAID",
    overdue: "OVERDUE",
    pending: "PENDING",
  },
};

export function getDict(lang: ExportLang | undefined): Dict {
  return T[lang === "en" ? "en" : "fr"];
}

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

// Dessine l'hexagone VNK (matche vnk-logo-horizontal-dark.svg, points 50,6 90,28 90,72 50,94 10,72 10,28)
// Sur fond navy : fill blanc 12% opacite + stroke blanc 80% opacite + texte blanc
function drawHexagonLogo(doc: CapturedDoc, cx: number, cy: number, size: number) {
  const s = size / 88;
  const hw = 40 * s;
  const dy1 = 22 * s;
  const dy2 = 44 * s;
  doc.save();
  doc.lineWidth(2);

  // Fill semi-transparent
  doc.fillOpacity(0.12);
  doc.polygon(
    [cx, cy - dy2],
    [cx + hw, cy - dy1],
    [cx + hw, cy + dy1],
    [cx, cy + dy2],
    [cx - hw, cy + dy1],
    [cx - hw, cy - dy1],
  );
  doc.fillColor(C.white).fill();

  // Stroke semi-transparent (a 0.85 opacite)
  doc.fillOpacity(1).strokeOpacity(0.85);
  doc.polygon(
    [cx, cy - dy2],
    [cx + hw, cy - dy1],
    [cx + hw, cy + dy1],
    [cx, cy + dy2],
    [cx - hw, cy + dy1],
    [cx - hw, cy - dy1],
  );
  doc.strokeColor(C.white).stroke();

  // Texte VNK : centré sur l'hexagone, blanc plein
  doc.strokeOpacity(1).fillOpacity(1);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(size * 0.27)
    .text("VNK", cx - hw, cy - size * 0.10,
      { width: hw * 2, align: "center", lineBreak: false, characterSpacing: 1.2 });
  doc.restore();
}

// Header VNK : hexagone + nom + tagline (matche le logo officiel du site)
function drawHeader(doc: CapturedDoc, title: string, subtitle: string, intro?: string) {
  const w = doc.page.width;
  doc.save();
  // Bande navy
  doc.rect(0, 0, w, HEADER_H).fill(C.navy);
  // Accent bleu fin (filet en bas)
  doc.rect(0, HEADER_H - 2, w, 2).fill(C.brand);

  // Hexagone VNK
  const hexCx = 52, hexCy = HEADER_H / 2, hexSize = 46;
  drawHexagonLogo(doc, hexCx, hexCy, hexSize);

  // Bloc nom + tagline a droite du logo
  const textX = hexCx + (hexSize / 88) * 40 + 14;  // bord droit hexagone + 14
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(15)
    .text(COMPANY.shortName, textX, hexCy - 12, { lineBreak: false });

  // Tagline : fillOpacity 0.6
  doc.save();
  doc.fillOpacity(0.65);
  doc.fillColor(C.white).font("Helvetica").fontSize(7.5)
    .text(COMPANY.tagline, textX, hexCy + 8, { lineBreak: false, characterSpacing: 2.2 });
  doc.restore();

  // Bloc titre PDF (droite)
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(12)
    .text(title, 0, 18, { width: w - 35, align: "right", lineBreak: false });
  doc.save();
  doc.fillOpacity(0.78);
  doc.fillColor(C.white).font("Helvetica").fontSize(8.5)
    .text(subtitle, 0, 37, { width: w - 35, align: "right", lineBreak: false });
  doc.restore();
  doc.save();
  doc.fillOpacity(0.55);
  // Date dans la locale active (titre et sous-titre transmis sont deja localises)
  doc.fillColor(C.white).fontSize(7.5)
    .text(new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }),
      0, 51, { width: w - 35, align: "right", lineBreak: false });
  doc.restore();

  doc.restore();
  doc.fillColor(C.text).font("Helvetica");
  doc.y = HEADER_H + 14;

  // Bandeau intro explicatif (filet a gauche, pas d'encadrement lourd)
  if (intro) {
    const padX = 14, padY = 6;
    const ix = 50;
    const innerW = w - 100 - padX;
    const introHeight = doc.heightOfString(intro, { width: innerW }) + padY * 2;
    // Filet vertical bleu marque a gauche
    doc.rect(ix, doc.y, 3, introHeight).fill(C.brand);
    doc.fillColor(C.grayDark).font("Helvetica").fontSize(8.5)
      .text(intro, ix + padX, doc.y + padY, { width: innerW });
    doc.y += introHeight + 14;
    doc.fillColor(C.text);
  }
}

// Bloc identite client compact — utilise pour litiges, fiche-client
function drawClientBlock(doc: CapturedDoc, client: {
  fullName: string; email: string; phone?: string | null;
  companyName?: string | null; address?: string | null; city?: string | null;
  province?: string | null; postalCode?: string | null;
}, t?: Dict) {
  const dict = t ?? getDict("fr");
  const w = doc.page.width - 100;
  const x = 50;
  const y = doc.y;
  const h = 52;
  doc.roundedRect(x, y, w, h, 4).fillAndStroke(C.grayLight, C.border);

  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
    .text(dict.ficheClient, x + 12, y + 7, { lineBreak: false, characterSpacing: 0.6 });
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11)
    .text(sanitize(client.fullName), x + 12, y + 17, { width: w / 2 - 16, lineBreak: false, ellipsis: true });
  doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
    .text(sanitize(client.companyName) || "—", x + 12, y + 32, { width: w / 2 - 16, lineBreak: false, ellipsis: true });

  // Colonne droite : contacts
  const cx = x + w / 2;
  doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
    .text(dict.ficheContact, cx + 12, y + 7, { lineBreak: false, characterSpacing: 0.6 });
  doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
    .text(sanitize(client.email), cx + 12, y + 17, { width: w / 2 - 24, lineBreak: false, ellipsis: true });
  doc.text(sanitize(client.phone) || "—", cx + 12, y + 28, { width: w / 2 - 24, lineBreak: false });
  const addr = [client.address, client.city, client.province, client.postalCode].filter(Boolean).map(sanitize).join(", ");
  if (addr) {
    doc.fillColor(C.gray).fontSize(7.5).text(addr, cx + 12, y + 39, { width: w / 2 - 24, lineBreak: false, ellipsis: true });
  }
  doc.y = y + h + 14;
}

// Titre de section avec accent brand a gauche + ligne fine sous le titre
function sectionTitle(doc: CapturedDoc, label: string, color = C.brand) {
  ensureSpace(doc, 30);
  doc.moveDown(0.6);
  const y = doc.y;
  // Filet vertical accent a gauche
  doc.rect(50, y + 1, 3, 11).fill(color);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(9.5)
    .text(label.toUpperCase(), 60, y, { lineBreak: false, characterSpacing: 0.8 });
  // Ligne fine sous le titre
  doc.strokeColor(C.border).lineWidth(0.5)
    .moveTo(50, y + 16).lineTo(doc.page.width - 50, y + 16).stroke();
  doc.y = y + 22;
  doc.fillColor(C.text);
}

// Badge de statut : rond rect colore + texte blanc, retourne sa largeur
function drawStatusBadge(doc: CapturedDoc, rightX: number, y: number, label: string, bgColor: string): number {
  const padX = 6;
  const h = 12;
  doc.font("Helvetica-Bold").fontSize(6.5);
  const textW = doc.widthOfString(label, { characterSpacing: 0.6 });
  const w = textW + padX * 2;
  doc.roundedRect(rightX - w, y, w, h, 6).fill(bgColor);
  doc.fillColor(C.white).text(label, rightX - w, y + 3.5,
    { width: w, align: "center", lineBreak: false, characterSpacing: 0.6 });
  return w;
}

// Ligne d'item : numero + titre a gauche, montant + badge a droite
// Hauteur = 28px. Optionnellement separateur en bas.
function drawListItem(doc: CapturedDoc, opts: {
  number: string;
  title?: string | null;
  amount?: string;
  status?: { label: string; color: string };
  zebra?: boolean;
  divider?: boolean;
}) {
  const x = 50;
  const w = doc.page.width - 100;
  const ry = doc.y;
  const rowH = 28;
  ensureSpace(doc, rowH + 2);

  if (opts.zebra) {
    doc.rect(x, ry, w, rowH).fill(C.grayLight);
  }

  const rightW = opts.amount || opts.status ? 120 : 0;
  const leftW = w - rightW - 10;

  // Numero (bold)
  doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9)
    .text(opts.number, x + 6, ry + 5, { width: leftW - 6, lineBreak: false });
  // Titre / description (gris, 2e ligne)
  if (opts.title) {
    doc.fillColor(C.gray).font("Helvetica").fontSize(8)
      .text(sanitize(opts.title), x + 6, ry + 16, { width: leftW - 6, lineBreak: false, ellipsis: true });
  }

  // Montant (bold) + badge a droite
  if (opts.amount) {
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9.5)
      .text(opts.amount, 0, ry + 5,
        { width: doc.page.width - 50, align: "right", lineBreak: false });
  }
  if (opts.status) {
    drawStatusBadge(doc, doc.page.width - 50, ry + 16, opts.status.label, opts.status.color);
  }

  if (opts.divider) {
    doc.strokeColor(C.border).lineWidth(0.3)
      .moveTo(x + 6, ry + rowH).lineTo(x + w - 6, ry + rowH).stroke();
  }

  doc.y = ry + rowH + 2;
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
  lang?: ExportLang;
}): Promise<Buffer> {
  const t = getDict(params.lang);
  return capture((doc) => {
    drawHeader(
      doc,
      t.convTitle,
      sanitize(params.client.fullName),
      t.convIntro(sanitize(params.client.fullName), sanitize(params.client.email)),
    );

    if (params.messages.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text(t.convEmpty, 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    const maxBubbleW = 360;
    const padX = 9;
    const padY = 5;
    const localeTag = params.lang === "en" ? "en-CA" : "fr-CA";

    let lastDate = "";
    for (const m of params.messages) {
      if (m.deletedAt) continue;

      const dateStr = m.createdAt.toLocaleDateString(localeTag, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
        ? t.convInternalNote
        : isVnk ? "VNK" : sanitize(params.client.fullName);
      const timeStr = m.createdAt.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit", hour12: false });

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
  lang?: ExportLang;
}): Promise<Buffer> {
  const t = getDict(params.lang);
  const localeTag = params.lang === "en" ? "en-CA" : "fr-CA";
  return capture((doc) => {
    drawHeader(
      doc,
      t.apptTitle,
      sanitize(params.client.fullName),
      t.apptIntro(sanitize(params.client.fullName), params.appointments.length),
    );

    if (params.appointments.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text(t.apptEmpty, 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    for (const a of params.appointments) {
      const hasNotes = !!a.notesAdmin;
      const cardH = hasNotes ? 64 : 48;
      ensureSpace(doc, cardH + 8);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;

      doc.roundedRect(x, y, w, cardH, 5).fill(C.grayLight);
      const statusColor = a.status === "completed" ? C.green : a.status === "cancelled" ? C.red : a.status === "scheduled" ? C.brand : C.amber;
      doc.rect(x, y, 3, cardH).fill(statusColor);

      const dateStr = new Date(a.appointmentDate).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
      const time = a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ""}` : "";

      // Sujet a gauche + badge statut a droite
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10.5)
        .text(sanitize(a.subject) || t.noSubject, x + 12, y + 9, { width: w - 110, lineBreak: false, ellipsis: true });
      drawStatusBadge(doc, doc.page.width - 50, y + 10, a.status.toUpperCase(), statusColor);

      // Meta sur ligne 2
      doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
        .text(
          `${dateStr}${time ? `  ·  ${time}` : ""}${a.meetingType ? `  ·  ${sanitize(a.meetingType)}` : ""}`,
          x + 12, y + 26, { width: w - 24, lineBreak: false, ellipsis: true },
        );
      if (a.notesAdmin) {
        doc.fillColor(C.grayDark).fontSize(8)
          .text(sanitize(a.notesAdmin), x + 12, y + 42, { width: w - 24, height: 16, ellipsis: true, lineBreak: false });
      }
      doc.y = y + cardH + 6;
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
  lang?: ExportLang;
}): Promise<Buffer> {
  const t = getDict(params.lang);
  const localeTag = params.lang === "en" ? "en-CA" : "fr-CA";
  return capture((doc) => {
    drawHeader(
      doc,
      t.dispTitle,
      sanitize(params.client.fullName),
      t.dispIntro(sanitize(params.client.fullName), params.disputes.length),
    );

    drawClientBlock(doc, params.client, t);

    if (params.disputes.length === 0) {
      doc.fillColor(C.gray).fontSize(10).text(t.dispEmpty, 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    for (const d of params.disputes) {
      ensureSpace(doc, 140);
      const x = 50;
      const w = doc.page.width - 100;
      const y = doc.y;
      const priorityColor = d.priority === "high" || d.priority === "urgent" ? C.red : d.priority === "medium" ? C.amber : C.gray;
      const statusColor = d.resolvedAt ? C.green : d.status === "open" ? C.red : C.amber;

      // Titre + badges (statut + priorite)
      doc.rect(x, y, 3, 16).fill(priorityColor);
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(11)
        .text(sanitize(d.title), x + 12, y, { width: w - 200, lineBreak: false, ellipsis: true });
      // Badges en haut a droite
      let badgeRight = doc.page.width - 50;
      const wBadge = drawStatusBadge(doc, badgeRight, y + 1, d.status.toUpperCase(), statusColor);
      badgeRight -= wBadge + 4;
      if (d.priority) {
        drawStatusBadge(doc, badgeRight, y + 1, d.priority.toUpperCase(), priorityColor);
      }

      // Meta info ligne 2
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(
          t.dispMetaOpened(d.openedAt.toLocaleDateString(localeTag)) +
          (d.invoiceNumber ? `  ·  ${t.dispMetaInvoice(d.invoiceNumber)}` : "") +
          (d.assignedTo ? `  ·  ${t.dispMetaAssigned(sanitize(d.assignedTo))}` : ""),
          x + 12, y + 16, { width: w - 24, lineBreak: false, ellipsis: true },
        );
      doc.y = y + 32;

      // Champs en 2 colonnes (label gris fin / valeur noir, plus aere)
      const fields: [string, string | null | undefined][] = [
        [t.dispFields.type, d.type],
        [t.dispFields.category, d.category],
        [t.dispFields.amountDisputed, d.amountDisputed != null ? `${d.amountDisputed.toFixed(2)} ${d.currency ?? "CAD"}` : null],
        [t.dispFields.stripeId, d.stripeDisputeId],
        [t.dispFields.stripeReason, d.stripeReason],
        [t.dispFields.outcome, d.outcome],
        [t.dispFields.evidenceDueBy, d.evidenceDueBy ? d.evidenceDueBy.toLocaleDateString(localeTag) : null],
        [t.dispFields.lawFirm, d.lawFirmInvolved],
        [t.dispFields.caseNumber, d.caseNumber],
        [t.dispFields.tribunal, d.tribunal],
        [t.dispFields.resolution, d.resolution],
        [t.dispFields.resolvedAt, d.resolvedAt ? d.resolvedAt.toLocaleDateString(localeTag) : null],
      ].filter(([, v]) => !!v) as [string, string][];

      if (fields.length > 0) {
        const colW = (w - 12) / 2;
        const rowH = 14;
        const colH = Math.ceil(fields.length / 2) * rowH;
        ensureSpace(doc, colH + 6);
        const fieldsY = doc.y;
        doc.font("Helvetica").fontSize(8.5);
        fields.forEach((f, i) => {
          const fx = x + 6 + (i % 2) * colW;
          const fy = fieldsY + Math.floor(i / 2) * rowH;
          doc.fillColor(C.gray).text(f[0], fx, fy, { width: 90, lineBreak: false });
          doc.fillColor(C.text).font("Helvetica-Bold")
            .text(sanitize(f[1]), fx + 92, fy, { width: colW - 96, lineBreak: false, ellipsis: true });
          doc.font("Helvetica");
        });
        doc.y = fieldsY + colH + 6;
      }

      if (d.description) {
        const desc = sanitize(d.description);
        const descH = doc.heightOfString(desc, { width: w - 12 });
        ensureSpace(doc, descH + 22);
        doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
          .text(t.dispDescription, x + 6, doc.y, { characterSpacing: 0.6 });
        doc.fillColor(C.text).font("Helvetica").fontSize(9)
          .text(desc, x + 6, doc.y + 2, { width: w - 12 });
        doc.moveDown(0.3);
      }

      if (d.internalNotes) {
        const notesText = sanitize(d.internalNotes);
        const notesH = doc.heightOfString(notesText, { width: w - 28 });
        ensureSpace(doc, notesH + 28);
        const noteY = doc.y;
        doc.roundedRect(x, noteY, w, notesH + 22, 4).fill(C.amberLight);
        doc.rect(x, noteY, 3, notesH + 22).fill(C.amber);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(7)
          .text(t.dispInternalNotes, x + 10, noteY + 6, { characterSpacing: 0.6 });
        doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
          .text(notesText, x + 10, noteY + 16, { width: w - 16 });
        doc.y = noteY + notesH + 26;
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
  lang?: ExportLang;
}): Promise<Buffer> {
  const t = getDict(params.lang);
  const localeTag = params.lang === "en" ? "en-CA" : "fr-CA";
  return capture((doc) => {
    drawHeader(
      doc,
      t.auditTitle,
      sanitize(params.client.fullName),
      t.auditIntro(sanitize(params.client.fullName), params.events.length),
    );

    if (params.events.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text(t.auditEmpty, 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    const sourceColor: Record<string, string> = {
      login: C.brand, order: C.green, signature: C.navy, consent: C.amber,
      email: C.gray, audit: C.red, workflow: C.brand,
    };

    let lastDate = "";
    for (const e of params.events) {
      const dateStr = e.createdAt.toLocaleDateString(localeTag, { day: "numeric", month: "long", year: "numeric" });
      if (dateStr !== lastDate) {
        ensureSpace(doc, 26);
        doc.moveDown(0.5);
        const dy = doc.y;
        doc.rect(50, dy + 1, 3, 11).fill(C.brand);
        doc.fillColor(C.brand).font("Helvetica-Bold").fontSize(9.5)
          .text(dateStr.toUpperCase(), 60, dy, { characterSpacing: 0.8 });
        doc.strokeColor(C.border).lineWidth(0.4)
          .moveTo(50, dy + 16).lineTo(doc.page.width - 50, dy + 16).stroke();
        doc.y = dy + 22;
        lastDate = dateStr;
      }

      const metaParts = [
        e.ipAddress,
        e.userAgent ? sanitize(e.userAgent).slice(0, 80) : null,
      ].filter(Boolean) as string[];
      const hasMeta = metaParts.length > 0;
      const itemH = hasMeta ? 26 : 18;
      ensureSpace(doc, itemH);
      const x = 50;
      const y = doc.y;
      const w = doc.page.width - 100;
      const dotColor = sourceColor[e.source] ?? C.gray;

      doc.circle(x + 6, y + 6, 3.5).fill(dotColor);
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9)
        .text(sanitize(e.label), x + 18, y, { width: w - 100, lineBreak: false, ellipsis: true });
      // Heure a droite
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(e.createdAt.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit", hour12: false }),
          0, y + 1, { width: doc.page.width - 50, align: "right", lineBreak: false });
      // IP/UA seulement si presents (plus de "workflow/xxx" technique)
      if (hasMeta) {
        doc.fillColor(C.gray).font("Helvetica").fontSize(7.5)
          .text(metaParts.join("  ·  "),
            x + 18, y + 12, { width: w - 18, lineBreak: false, ellipsis: true });
      }
      doc.y = y + itemH;
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
  lang?: ExportLang;
}): Promise<Buffer> {
  const t = getDict(params.lang);
  const localeTag = params.lang === "en" ? "en-CA" : "fr-CA";
  return capture((doc) => {
    drawHeader(
      doc,
      t.payTitle,
      sanitize(params.client.fullName),
      t.payIntro(sanitize(params.client.fullName), params.rows.length),
    );

    const totalIn = params.rows.filter((r) => r.type === "Paiement" && r.status === "succeeded").reduce((s, r) => s + r.amount, 0);
    const totalOut = params.rows.filter((r) => r.type === "Remboursement").reduce((s, r) => s + r.amount, 0);
    const net = totalIn - totalOut;

    // Sommaire — 3 cartes (fond colore subtil, sans bordure)
    const sx = 50;
    const sw = (doc.page.width - 100) / 3 - 5;
    const sy = doc.y;
    [
      { l: t.payTotalIn, v: totalIn, c: C.green, bg: C.greenLight },
      { l: t.payTotalOut, v: totalOut, c: C.red, bg: C.redLight },
      { l: t.payNet, v: net, c: C.brand, bg: C.brandBg },
    ].forEach((s, i) => {
      const x = sx + i * (sw + 7);
      doc.roundedRect(x, sy, sw, 46, 6).fill(s.bg);
      // Filet d'accent a gauche
      doc.rect(x, sy, 3, 46).fill(s.c);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7)
        .text(s.l.toUpperCase(), x + 12, sy + 8, { width: sw - 22, lineBreak: false, characterSpacing: 0.5 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(15)
        .text(`${s.v.toFixed(2)} CAD`, x + 12, sy + 22, { width: sw - 22, lineBreak: false });
    });
    doc.y = sy + 56;

    if (params.rows.length === 0) {
      doc.fillColor(C.gray).fontSize(11).text(t.payEmpty, 50, doc.y, { align: "center", width: doc.page.width - 100 });
      return;
    }

    // Tableau
    sectionTitle(doc, t.payDetail);
    const tx = 50;
    const tw = doc.page.width - 100;
    const cols = [
      { label: t.payCols.type, w: 80 },
      { label: t.payCols.date, w: 78 },
      { label: t.payCols.amount, w: 92 },
      { label: t.payCols.method, w: 70 },
      { label: t.payCols.status, w: 70 },
      { label: t.payCols.description, w: tw - 390 },
    ];

    const drawHead = () => {
      const hy = doc.y;
      doc.rect(tx, hy, tw, 22).fill(C.navy);
      let cx = tx + 8;
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8);
      cols.forEach((c) => {
        doc.text(c.label.toUpperCase(), cx, hy + 7, { width: c.w - 8, lineBreak: false, characterSpacing: 0.6 });
        cx += c.w;
      });
      doc.y = hy + 22;
    };
    ensureSpace(doc, 30);
    drawHead();

    let alt = false;
    const rowH = 22;
    for (const r of params.rows) {
      ensureSpace(doc, rowH + 2);
      if (doc.y < HEADER_H) drawHead();
      const rowY = doc.y;
      if (alt) doc.rect(tx, rowY, tw, rowH).fill(C.grayLight);
      alt = !alt;

      const statusColor = r.status === "succeeded" || r.status === "paid" ? C.green
        : r.status === "failed" ? C.red : C.amber;
      const isRefund = r.type === "Remboursement";
      const typeLabel = isRefund
        ? (params.lang === "en" ? "Refund" : "Remboursement")
        : (params.lang === "en" ? "Payment" : "Paiement");

      // Type avec couleur
      doc.fillColor(isRefund ? C.red : C.green).font("Helvetica-Bold").fontSize(8)
        .text(typeLabel, tx + 8, rowY + 7, { width: cols[0].w - 8, lineBreak: false });
      // Date
      doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
        .text(r.date.toLocaleDateString(localeTag), tx + cols[0].w + 8, rowY + 7,
          { width: cols[1].w - 8, lineBreak: false });
      // Montant
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9)
        .text(`${isRefund ? "-" : ""}${r.amount.toFixed(2)} ${r.currency.toUpperCase()}`,
          tx + cols[0].w + cols[1].w + 8, rowY + 7,
          { width: cols[2].w - 8, lineBreak: false });
      // Methode
      doc.fillColor(C.text).font("Helvetica").fontSize(8)
        .text(r.method ?? "—", tx + cols[0].w + cols[1].w + cols[2].w + 8, rowY + 7,
          { width: cols[3].w - 8, lineBreak: false, ellipsis: true });
      // Badge statut
      drawStatusBadge(doc, tx + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 4,
        rowY + 5, r.status.toUpperCase(), statusColor);
      // Description
      doc.fillColor(C.gray).font("Helvetica").fontSize(8)
        .text(sanitize(r.description),
          tx + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + 8, rowY + 7,
          { width: cols[5].w - 16, lineBreak: false, ellipsis: true });

      doc.y = rowY + rowH;
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

export async function generateFicheClientPdf(data: FicheClientData & { lang?: ExportLang }): Promise<Buffer> {
  const t = getDict(data.lang);
  const localeTag = data.lang === "en" ? "en-CA" : "fr-CA";
  return capture((doc) => {
    drawHeader(
      doc,
      t.ficheTitle,
      sanitize(data.client.fullName),
      t.ficheIntro(sanitize(data.client.fullName)),
    );

    drawClientBlock(doc, data.client, t);

    // ─── KPI activite — 4 cartes ─────────────────────────
    const w = doc.page.width - 100;
    const sx = 50;
    const sy = doc.y;
    const cardW = (w - 18) / 4;
    [
      { l: t.ficheKpi.mandates, v: String(data.totals.mandates), c: C.brand },
      { l: t.ficheKpi.quotes, v: String(data.totals.quotes), c: C.amber },
      { l: t.ficheKpi.contracts, v: String(data.totals.contracts), c: C.navy },
      { l: t.ficheKpi.invoices, v: String(data.totals.invoices), c: C.green },
    ].forEach((s, i) => {
      const x = sx + i * (cardW + 6);
      doc.roundedRect(x, sy, cardW, 46, 4).fill(C.grayLight);
      doc.rect(x, sy, 3, 46).fill(s.c);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
        .text(s.l.toUpperCase(), x + 10, sy + 9, { width: cardW - 20, lineBreak: false, characterSpacing: 0.6 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(20)
        .text(s.v, x + 10, sy + 21, { width: cardW - 20, lineBreak: false });
    });
    doc.y = sy + 56;

    // ─── Finance — 2 cartes ──────────────────────────────
    const fy = doc.y;
    const fcardW = (w - 10) / 2;
    [
      { l: t.ficheTotalSpent, v: `${data.totals.totalSpentTtc.toFixed(2)} CAD`, c: C.green, bg: C.greenLight },
      { l: t.ficheOpenBalance, v: `${data.totals.openBalanceTtc.toFixed(2)} CAD`,
        c: data.totals.openBalanceTtc > 0 ? C.amber : C.gray,
        bg: data.totals.openBalanceTtc > 0 ? C.amberLight : C.grayLight },
    ].forEach((s, i) => {
      const x = sx + i * (fcardW + 10);
      doc.roundedRect(x, fy, fcardW, 54, 6).fill(s.bg);
      doc.rect(x, fy, 3, 54).fill(s.c);
      doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(7.5)
        .text(s.l.toUpperCase(), x + 14, fy + 10, { width: fcardW - 24, lineBreak: false, characterSpacing: 0.6 });
      doc.fillColor(s.c).font("Helvetica-Bold").fontSize(18)
        .text(s.v, x + 14, fy + 26, { width: fcardW - 24, lineBreak: false });
    });
    doc.y = fy + 64;

    // ─── Profil business ──────────────────────────────────
    if (data.client.sector || data.client.technologies) {
      sectionTitle(doc, t.ficheBusinessProfile);
      const labelW = 90;
      if (data.client.sector) {
        const ly = doc.y;
        doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
          .text(t.ficheSector, 50, ly, { width: labelW, lineBreak: false });
        doc.fillColor(C.text)
          .text(sanitize(data.client.sector), 50 + labelW, ly, { width: w - labelW, lineBreak: false, ellipsis: true });
        doc.y = ly + 14;
      }
      if (data.client.technologies) {
        const ly = doc.y;
        doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
          .text(t.ficheTechnologies, 50, ly, { width: labelW, lineBreak: false });
        doc.fillColor(C.text)
          .text(sanitize(data.client.technologies), 50 + labelW, ly, { width: w - labelW });
        doc.y = Math.max(doc.y, ly + 14);
      }
    }

    // Helper: traduit un statut en label
    const translateStatus = (status: string): string => {
      const s = status.toLowerCase();
      if (s === "paid") return t.paid;
      if (s === "unpaid") return t.unpaid;
      if (s === "overdue") return t.overdue;
      if (s === "pending") return t.pending;
      return status.toUpperCase();
    };

    // ─── Dernieres factures ───────────────────────────────
    if (data.recentInvoices.length > 0) {
      sectionTitle(doc, t.ficheRecentInvoices);
      const items = data.recentInvoices.slice(0, 5);
      items.forEach((i, idx) => {
        const statusBg = i.status === "paid" ? C.green : i.status === "overdue" ? C.red : C.amber;
        drawListItem(doc, {
          number: i.invoiceNumber,
          title: i.title,
          amount: `${i.amountTtc.toFixed(2)} CAD`,
          status: { label: translateStatus(i.status), color: statusBg },
          divider: idx < items.length - 1,
        });
      });
    }

    // ─── Derniers contrats ────────────────────────────────
    if (data.recentContracts.length > 0) {
      sectionTitle(doc, t.ficheRecentContracts);
      const items = data.recentContracts.slice(0, 5);
      items.forEach((c, idx) => {
        const isSigned = !!c.signedAt;
        const statusLabel = isSigned
          ? t.ficheSigned(c.signedAt!.toLocaleDateString(localeTag))
          : translateStatus(c.status);
        const statusColor = isSigned ? C.green : c.status === "pending" ? C.amber : C.gray;
        drawListItem(doc, {
          number: c.contractNumber,
          title: c.title,
          status: { label: statusLabel, color: statusColor },
          divider: idx < items.length - 1,
        });
      });
    }

    // ─── Litiges actifs ───────────────────────────────────
    if (data.activeDisputes.length > 0) {
      sectionTitle(doc, t.ficheActiveDisputes, C.red);
      data.activeDisputes.forEach((d, idx) => {
        drawListItem(doc, {
          number: sanitize(d.title),
          title: `${t.dispMetaOpened(d.openedAt.toLocaleDateString(localeTag))}  ·  ${d.status}`,
          amount: d.amountDisputed != null ? `${d.amountDisputed.toFixed(2)} CAD` : undefined,
          status: { label: d.status.toUpperCase(), color: C.red },
          divider: idx < data.activeDisputes.length - 1,
        });
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
        .text(t.ficheInternalNotes, 60, ny + 6, { characterSpacing: 0.5 });
      doc.fillColor(C.text).font("Helvetica").fontSize(8.5)
        .text(notesText, 60, ny + 16, { width: w - 24 });
      doc.y = ny + notesH + 26;
    }
  });
}
