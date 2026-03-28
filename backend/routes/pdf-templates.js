/* ============================================
   VNK Automatisation Inc. — Templates PDF
   Devis, Facture, Contrat
   
   INSTALLATION:
   npm install pdfkit
   
   USAGE dans admin.js:
   const pdfTemplates = require('./pdf-templates');
   
   FLUX AUTOMATIQUE:
   1. Admin accepte devis → génère contrat auto → envoie pour signature Dropbox Sign
   2. Contrat signé → génère facture automatiquement
   ============================================ */

const PDFDocument = require('pdfkit');

// ============================================================
// COULEURS ET CONSTANTES VNK
// ============================================================
const VNK = {
    primary: '#1B4F8A',
    secondary: '#2E86AB',
    dark: '#0F2D52',
    gray: '#64748B',
    lightGray: '#F8FAFC',
    border: '#E2E8F0',
    success: '#27AE60',
    text: '#1E293B',

    name: 'VNK Automatisation Inc.',
    neq: '1181943359',
    email: 'yan.verone@vnk.ca',
    phone: '(819) 290-8686',
    address: 'Québec, QC, Canada',
    tps: 'À compléter (Revenu Canada)',
    tvq: 'À compléter (Revenu Québec)',
    site: 'vnk-website-production.up.railway.app'
};

// ============================================================
// HELPER: Dessiner le header VNK
// ============================================================
function drawHeader(doc, docType, docNumber) {
    const w = doc.page.width;

    // Fond header
    doc.rect(0, 0, w, 110).fill(VNK.primary);

    // Hexagone logo
    const cx = 52, cy = 52, r = 30;
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().fillOpacity(0.2).fill('white').restore();
    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().strokeOpacity(0.8).lineWidth(1.5).stroke('white').restore();
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text('VNK', cx - 13, cy - 5, { width: 26, align: 'center' });

    // Nom compagnie
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
        .text(VNK.name, 90, 28);
    doc.fillColor('rgba(255,255,255,0.75)').fontSize(8).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 90, 48);
    doc.fillColor('rgba(255,255,255,0.65)').fontSize(7.5)
        .text(`NEQ: ${VNK.neq}  ·  ${VNK.email}  ·  ${VNK.phone}`, 90, 62);

    // Badge type de document
    const badgeX = w - 180, badgeY = 20;
    doc.rect(badgeX, badgeY, 155, 70).fillOpacity(0.15).fill('white').fillOpacity(1);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
        .text(docType.toUpperCase(), badgeX + 10, badgeY + 10, { width: 135, align: 'center' });
    doc.fillColor('rgba(255,255,255,0.85)').fontSize(10).font('Helvetica')
        .text(docNumber, badgeX + 10, badgeY + 30, { width: 135, align: 'center' });
    const dateStr = new Date().toLocaleDateString('fr-CA');
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(8)
        .text(dateStr, badgeX + 10, badgeY + 50, { width: 135, align: 'center' });

    doc.y = 130;
}

// ============================================================
// HELPER: Section titre
// ============================================================
function sectionTitle(doc, text) {
    const w = doc.page.width - 80;
    doc.rect(40, doc.y, w, 24).fill(VNK.lightGray);
    doc.rect(40, doc.y, 4, 24).fill(VNK.primary);
    doc.fillColor(VNK.primary).fontSize(9).font('Helvetica-Bold')
        .text(text.toUpperCase(), 52, doc.y + 8, { width: w - 20 });
    doc.y += 34;
}

// ============================================================
// HELPER: Ligne info (label: valeur)
// ============================================================
function infoRow(doc, label, value, y) {
    doc.fillColor(VNK.gray).fontSize(8).font('Helvetica')
        .text(label, 40, y, { width: 130 });
    doc.fillColor(VNK.text).fontSize(8.5).font('Helvetica-Bold')
        .text(value || '—', 175, y, { width: 340 });
    return y + 16;
}

// ============================================================
// HELPER: Footer
// ============================================================
function drawFooter(doc, docNumber) {
    const w = doc.page.width;
    const y = doc.page.height - 50;
    doc.rect(0, y, w, 50).fill(VNK.dark);
    doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica')
        .text(`${VNK.name}  ·  ${VNK.site}  ·  ${VNK.email}`, 40, y + 12, { width: w - 80, align: 'center' })
        .text(`${docNumber}  ·  Généré le ${new Date().toLocaleDateString('fr-CA')}  ·  Ce document est confidentiel`, 40, y + 26, { width: w - 80, align: 'center' });
}

// ============================================================
// HELPER: Tableau de lignes de service
// ============================================================
function drawServiceTable(doc, lines) {
    const w = doc.page.width - 80;
    const startY = doc.y;

    // Header tableau
    doc.rect(40, startY, w, 22).fill(VNK.primary);
    const cols = { desc: 40, qty: 320, unit: 370, ht: 430, ttc: 490 };
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text('Description', cols.desc + 4, startY + 7)
        .text('Qté', cols.qty + 4, startY + 7)
        .text('Unité', cols.unit + 4, startY + 7)
        .text('Montant HT', cols.ht + 4, startY + 7);
    doc.y = startY + 26;

    let totalHT = 0;
    lines.forEach((line, i) => {
        const rowY = doc.y;
        const bg = i % 2 === 0 ? 'white' : VNK.lightGray;
        doc.rect(40, rowY, w, 24).fill(bg);
        doc.rect(40, rowY, w, 24).strokeOpacity(0.3).lineWidth(0.5).stroke(VNK.border);
        doc.fillColor(VNK.text).fontSize(8.5).font('Helvetica')
            .text(line.description, cols.desc + 6, rowY + 8, { width: 265 })
            .text(String(line.qty || 1), cols.qty + 4, rowY + 8, { width: 45 })
            .text(line.unit || 'h', cols.unit + 4, rowY + 8, { width: 55 })
            .text(fmt(line.amount_ht), cols.ht + 4, rowY + 8, { width: 80, align: 'right' });
        totalHT += parseFloat(line.amount_ht || 0);
        doc.y = rowY + 28;
    });

    return totalHT;
}

// ============================================================
// HELPER: Bloc taxes
// ============================================================
function drawTaxSummary(doc, ht, tps, tvq, ttc, label) {
    const w = doc.page.width - 80;
    const boxW = 200, boxX = 40 + w - boxW;
    let y = doc.y + 10;

    const rows = [
        ['Sous-total HT', fmt(ht)],
        ['TPS (5%)', fmt(tps)],
        ['TVQ (9.975%)', fmt(tvq)],
    ];
    rows.forEach(([l, v]) => {
        doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
            .text(l, boxX, y, { width: 90 });
        doc.fillColor(VNK.text).fontSize(8.5).font('Helvetica')
            .text(v, boxX + 90, y, { width: 108, align: 'right' });
        y += 16;
    });

    // Total TTC
    doc.rect(boxX - 4, y, boxW + 4, 28).fill(VNK.primary);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text(label || 'TOTAL TTC', boxX + 2, y + 9, { width: 88 });
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
        .text(fmt(ttc), boxX + 90, y + 7, { width: 108, align: 'right' });
    doc.y = y + 40;
}

function fmt(v) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v || 0);
}

// ============================================================
// TEMPLATE: DEVIS
// ============================================================
async function generateQuotePDF(res, quote, client, lines) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quote_number}.pdf"`);
    doc.pipe(res);

    drawHeader(doc, 'DEVIS', quote.quote_number);

    // Infos client + devis
    const infoY = doc.y;
    // Bloc client (gauche)
    doc.rect(40, infoY, 240, 120).fill(VNK.lightGray);
    doc.rect(40, infoY, 4, 120).fill(VNK.secondary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold')
        .text('CLIENT', 52, infoY + 8);
    let y = infoY + 22;
    y = infoRow(doc, 'Nom', client.full_name, y);
    y = infoRow(doc, 'Entreprise', client.company_name, y);
    y = infoRow(doc, 'Courriel', client.email, y);
    y = infoRow(doc, 'Téléphone', client.phone, y);
    y = infoRow(doc, 'Ville', `${client.city || ''} ${client.province || ''}`.trim(), y);

    // Bloc devis (droite)
    const w = doc.page.width - 80;
    doc.rect(300, infoY, w - 260, 120).fill(VNK.lightGray);
    doc.rect(300, infoY, 4, 120).fill(VNK.primary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold')
        .text('DÉTAILS DU DEVIS', 312, infoY + 8);
    let y2 = infoY + 22;
    y2 = infoRow(doc, 'Numéro', quote.quote_number, y2);
    y2 = infoRow(doc, 'Date', new Date(quote.created_at).toLocaleDateString('fr-CA'), y2);
    y2 = infoRow(doc, 'Valide jusqu\'au', quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString('fr-CA') : '30 jours', y2);
    y2 = infoRow(doc, 'Statut', 'En attente d\'approbation', y2);

    doc.y = infoY + 130;

    // Titre et description
    sectionTitle(doc, 'Description des services');
    doc.fillColor(VNK.text).fontSize(10).font('Helvetica-Bold')
        .text(quote.title, 40, doc.y, { width: w });
    doc.y += 16;
    if (quote.description) {
        doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
            .text(quote.description, 40, doc.y, { width: w, lineGap: 3 });
        doc.y += 12;
    }
    doc.y += 10;

    // Lignes de service
    sectionTitle(doc, 'Lignes de service');
    if (lines && lines.length) {
        drawServiceTable(doc, lines);
    } else {
        // Ligne unique depuis les montants du devis
        drawServiceTable(doc, [{
            description: quote.title,
            qty: 1, unit: 'forfait',
            amount_ht: quote.amount_ht
        }]);
    }

    drawTaxSummary(doc,
        quote.amount_ht,
        quote.tps_amount,
        quote.tvq_amount,
        quote.amount_ttc,
        'TOTAL DU DEVIS'
    );

    // Conditions
    sectionTitle(doc, 'Conditions de paiement');
    doc.fillColor(VNK.gray).fontSize(8).font('Helvetica')
        .text('• Acompte de 50% à la signature du contrat\n• Solde dû à la livraison des travaux\n• Devis valide 30 jours à compter de la date d\'émission\n• Ce devis ne constitue pas un contrat — un contrat de service sera émis après acceptation\n• Les prix sont en dollars canadiens (CAD) et excluent les taxes applicables', 40, doc.y, { width: w, lineGap: 4 });
    doc.y += 20;

    // Signature acceptance
    sectionTitle(doc, 'Acceptation');
    doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
        .text('En signant ci-dessous, le client accepte les termes et conditions de ce devis et autorise VNK Automatisation Inc. à procéder aux travaux décrits.', 40, doc.y, { width: w, lineGap: 3 });
    doc.y += 20;
    const sigY = doc.y;
    doc.moveTo(40, sigY + 30).lineTo(220, sigY + 30).strokeOpacity(1).lineWidth(1).stroke(VNK.border);
    doc.moveTo(300, sigY + 30).lineTo(480, sigY + 30).stroke(VNK.border);
    doc.fillColor(VNK.gray).fontSize(7.5)
        .text('Signature du client', 40, sigY + 34)
        .text('Date', 300, sigY + 34);

    drawFooter(doc, quote.quote_number);
    doc.end();
}

// ============================================================
// TEMPLATE: FACTURE
// ============================================================
async function generateInvoicePDF(res, invoice, client) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    drawHeader(doc, 'FACTURE', invoice.invoice_number);

    const w = doc.page.width - 80;
    const infoY = doc.y;

    // Client
    doc.rect(40, infoY, 240, 130).fill(VNK.lightGray);
    doc.rect(40, infoY, 4, 130).fill(VNK.secondary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text('FACTURÉ À', 52, infoY + 8);
    let y = infoY + 22;
    y = infoRow(doc, 'Nom', client.full_name, y);
    y = infoRow(doc, 'Entreprise', client.company_name, y);
    y = infoRow(doc, 'Courriel', client.email, y);
    y = infoRow(doc, 'Téléphone', client.phone, y);
    y = infoRow(doc, 'Adresse', client.address, y);
    y = infoRow(doc, 'Ville', `${client.city || ''}, ${client.province || ''} ${client.postal_code || ''}`.trim(), y);

    // Détails facture
    doc.rect(300, infoY, w - 260, 130).fill(VNK.lightGray);
    doc.rect(300, infoY, 4, 130).fill(VNK.primary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text('DÉTAILS', 312, infoY + 8);
    let y2 = infoY + 22;
    y2 = infoRow(doc, 'Numéro', invoice.invoice_number, y2);
    y2 = infoRow(doc, 'Date émission', new Date(invoice.created_at).toLocaleDateString('fr-CA'), y2);
    y2 = infoRow(doc, 'Date échéance', invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-CA') : '—', y2);
    y2 = infoRow(doc, 'Statut', invoice.status === 'paid' ? 'PAYÉE' : 'EN ATTENTE', y2);
    if (invoice.status === 'paid' && invoice.paid_at) {
        y2 = infoRow(doc, 'Payée le', new Date(invoice.paid_at).toLocaleDateString('fr-CA'), y2);
    }

    doc.y = infoY + 140;

    // Tableau service
    sectionTitle(doc, 'Description');
    drawServiceTable(doc, [{
        description: invoice.title + (invoice.description ? '\n' + invoice.description : ''),
        qty: 1, unit: 'forfait', amount_ht: invoice.amount_ht
    }]);

    drawTaxSummary(doc, invoice.amount_ht, invoice.tps_amount, invoice.tvq_amount, invoice.amount_ttc, 'TOTAL FACTURE');

    // Infos paiement
    sectionTitle(doc, 'Informations de paiement');
    doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
        .text(`Virement bancaire · Interac: ${VNK.email}\nVeuillez inclure le numéro de facture ${invoice.invoice_number} dans la référence de paiement.\nTPS (5%) : ${VNK.tps}\nTVQ (9.975%) : ${VNK.tvq}`, 40, doc.y, { width: w, lineGap: 4 });

    // Tampon PAYÉE si applicable
    if (invoice.status === 'paid') {
        doc.save().rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] })
            .fontSize(72).fillColor(VNK.success).fillOpacity(0.08).font('Helvetica-Bold')
            .text('PAYÉE', 80, doc.page.height / 2 - 40, { width: doc.page.width - 160, align: 'center' })
            .restore();
    }

    drawFooter(doc, invoice.invoice_number);
    doc.end();
}

// ============================================================
// TEMPLATE: CONTRAT DE SERVICE
// ============================================================
async function generateContractPDF(res, contract, client, quote) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.contract_number}.pdf"`);
    doc.pipe(res);

    drawHeader(doc, 'CONTRAT DE SERVICE', contract.contract_number);

    const w = doc.page.width - 80;
    const infoY = doc.y;

    // Parties
    doc.rect(40, infoY, (w / 2) - 8, 130).fill(VNK.lightGray);
    doc.rect(40, infoY, 4, 130).fill(VNK.primary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text('PRESTATAIRE', 52, infoY + 8);
    let y = infoY + 22;
    y = infoRow(doc, 'Société', VNK.name, y);
    y = infoRow(doc, 'NEQ', VNK.neq, y);
    y = infoRow(doc, 'Courriel', VNK.email, y);
    y = infoRow(doc, 'Téléphone', VNK.phone, y);

    const colR = 40 + (w / 2) + 8;
    const colRW = (w / 2) - 8;
    doc.rect(colR, infoY, colRW, 130).fill(VNK.lightGray);
    doc.rect(colR, infoY, 4, 130).fill(VNK.secondary);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text('CLIENT', colR + 12, infoY + 8);
    let y2 = infoY + 22;
    y2 = infoRow(doc, 'Nom', client.full_name, y2);
    y2 = infoRow(doc, 'Entreprise', client.company_name, y2);
    y2 = infoRow(doc, 'Courriel', client.email, y2);
    y2 = infoRow(doc, 'Téléphone', client.phone, y2);

    doc.y = infoY + 140;

    sectionTitle(doc, 'Objet du contrat');
    doc.fillColor(VNK.text).fontSize(10).font('Helvetica-Bold').text(contract.title, 40, doc.y, { width: w });
    doc.y += 16;
    if (quote) {
        doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
            .text(`Référence devis : ${quote.quote_number} — Montant total : ${fmt(quote.amount_ttc)} (TTC)`, 40, doc.y, { width: w });
        doc.y += 16;
    }

    sectionTitle(doc, 'Description des services');
    const serviceText = contract.content ||
        (quote ? quote.description : 'Services d\'automatisation industrielle selon entente préalable.');
    doc.fillColor(VNK.text).fontSize(8.5).font('Helvetica')
        .text(serviceText, 40, doc.y, { width: w, lineGap: 3 });
    doc.y += 20;

    sectionTitle(doc, 'Conditions générales');
    const clauses = [
        '1. RÉMUNÉRATION — Le Client s\'engage à payer VNK Automatisation Inc. les montants convenus selon le devis annexé. Un acompte de 50% est exigible à la signature du présent contrat.',
        '2. DÉLAIS — VNK Automatisation Inc. s\'engage à fournir les services dans les délais convenus, sous réserve d\'imprévus techniques ou de retards imputables au Client.',
        '3. PROPRIÉTÉ INTELLECTUELLE — Les livrables produits dans le cadre de ce contrat demeurent la propriété du Client après paiement complet. VNK Automatisation Inc. conserve le droit de référencer les travaux à des fins de portfolio.',
        '4. CONFIDENTIALITÉ — Les parties s\'engagent à ne pas divulguer les informations confidentielles échangées dans le cadre de ce contrat.',
        '5. RESPONSABILITÉ — La responsabilité de VNK Automatisation Inc. est limitée au montant du présent contrat. VNK n\'est pas responsable des pertes indirectes ou consécutives.',
        '6. RÉSILIATION — Chaque partie peut résilier ce contrat avec un préavis de 30 jours. Les travaux réalisés seront facturés au prorata.',
        '7. DROIT APPLICABLE — Ce contrat est régi par les lois de la province de Québec, Canada.',
    ];
    clauses.forEach(clause => {
        doc.fillColor(VNK.text).fontSize(8).font('Helvetica')
            .text(clause, 40, doc.y, { width: w, lineGap: 2 });
        doc.y += 14;
    });

    doc.y += 10;
    sectionTitle(doc, 'Signatures');
    doc.fillColor(VNK.gray).fontSize(8.5).font('Helvetica')
        .text(`Les soussignés déclarent avoir lu, compris et accepté les termes du présent contrat daté du ${new Date(contract.created_at).toLocaleDateString('fr-CA')}.`, 40, doc.y, { width: w });
    doc.y += 24;

    const sigY = doc.y;
    // Signature prestataire
    doc.rect(40, sigY, 220, 70).fill(VNK.lightGray);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text('VNK AUTOMATISATION INC.', 52, sigY + 8);
    doc.fillColor(VNK.gray).fontSize(7.5).font('Helvetica')
        .text('Yan Verone Kengne, Président', 52, sigY + 22)
        .text('Signature: ____________________', 52, sigY + 38)
        .text('Date: ____________________', 52, sigY + 52);
    // Signature client
    doc.rect(290, sigY, 220, 70).fill(VNK.lightGray);
    doc.fillColor(VNK.primary).fontSize(8).font('Helvetica-Bold').text(client.company_name || client.full_name, 302, sigY + 8, { width: 200 });
    doc.fillColor(VNK.gray).fontSize(7.5).font('Helvetica')
        .text(client.full_name, 302, sigY + 22)
        .text('Signature: ____________________', 302, sigY + 38)
        .text('Date: ____________________', 302, sigY + 52);

    drawFooter(doc, contract.contract_number);
    doc.end();
}

// ============================================================
// FLUX AUTOMATIQUE: Devis accepté → Contrat généré
// ============================================================
async function autoGenerateContract(pool, quoteId) {
    // 1. Récupérer le devis et le client
    const quoteRes = await pool.query(
        `SELECT q.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province
         FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = $1`,
        [quoteId]
    );
    if (!quoteRes.rows.length) throw new Error('Devis non trouvé');
    const quote = quoteRes.rows[0];

    // 2. Générer numéro de contrat
    const year = new Date().getFullYear();
    const count = await pool.query(
        "SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1", [year]
    );
    const num = `CT-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

    // 3. Créer le contrat en DB
    const contractTitle = `Contrat de service — ${quote.title}`;
    const contractContent = `Services d'automatisation industrielle conformément au devis ${quote.quote_number}.\n\n${quote.description || ''}`;

    const contractRes = await pool.query(
        `INSERT INTO contracts (client_id, quote_id, contract_number, title, content, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW()) RETURNING *`,
        [quote.client_id, quoteId, num, contractTitle, contractContent]
    );

    return { contract: contractRes.rows[0], quote, client: quote };
}

module.exports = {
    generateQuotePDF,
    generateInvoicePDF,
    generateContractPDF,
    autoGenerateContract,
    fmt
};