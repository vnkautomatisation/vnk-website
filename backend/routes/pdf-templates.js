/* ============================================
   VNK Automatisation Inc. — Templates PDF v2
   Devis · Facture · Contrat de service

   Chaque document a une identité visuelle distincte :
   - DEVIS    : header bleu primaire  #1B4F8A
   - FACTURE  : header marine foncé   #0F2D52  + accent vert statut
   - CONTRAT  : header bicolore split prestataire / client

   INSTALLATION: npm install pdfkit
   USAGE: const { generateQuotePDF, generateInvoicePDF, generateContractPDF, autoGenerateContract } = require('./pdf-templates');
============================================ */

'use strict';
const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────
// CONSTANTES VNK
// ─────────────────────────────────────────────
const C = {
    // Couleurs
    blue: '#1B4F8A',   // primaire
    blueMid: '#2E86AB',   // secondaire
    navy: '#0F2D52',   // foncé
    navyDeep: '#0A1F3A',   // footer facture
    green: '#27AE60',   // payée / succès
    greenLight: '#EBF7F0',   // fond badge payée
    amber: '#D97706',   // en attente
    amberLight: '#FEF3C7',   // fond badge attente
    gray: '#64748B',   // texte secondaire
    grayLight: '#F8FAFC',   // fond alterné
    border: '#E2E8F0',   // bordures
    text: '#1E293B',   // texte principal
    white: '#FFFFFF',

    // Coordonnées de page LETTER
    marginL: 40,
    marginR: 40,

    // Infos société
    name: 'VNK Automatisation Inc.',
    neq: '1181943359',
    email: 'vnkautomatisation@gmail.com',
    phone: '(819) 290-8686',
    address: 'Québec, QC, Canada',
    tps: 'À compléter (Revenu Canada)',
    tvq: 'À compléter (Revenu Québec)',
    site: 'vnk-website-production.up.railway.app',
    founder: 'Yan Verone Kengne',
    title: 'Président'
};

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

function fmt(v) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v) || 0);
}

function dateCA(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-CA');
}

function pageWidth(doc) { return doc.page.width; }
function contentWidth(doc) { return doc.page.width - C.marginL - C.marginR; }

// Dessine le logo hexagonal VNK à la position (cx, cy) avec rayon r
function drawHexLogo(doc, cx, cy, r, fillColor, strokeColor) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    // Remplissage semi-transparent
    doc.save()
        .moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().fillOpacity(0.18).fillColor(fillColor).fill().restore();
    // Contour
    doc.save()
        .moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().lineWidth(1.5).strokeOpacity(0.9).strokeColor(strokeColor).stroke().restore();
    // Texte VNK centré
    doc.fillColor(strokeColor).fontSize(8).font('Helvetica-Bold')
        .text('VNK', cx - r, cy - 5, { width: r * 2, align: 'center' });
}

// Barre de section avec accent latéral bleu
function sectionBar(doc, label, accentColor) {
    accentColor = accentColor || C.blue;
    const w = contentWidth(doc);
    const y = doc.y;
    doc.rect(C.marginL, y, w, 22).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, y, 3, 22).fillColor(accentColor).fill();
    doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
        .text(label.toUpperCase(), C.marginL + 10, y + 7, { width: w - 20, characterSpacing: 0.4 });
    doc.y = y + 30;
}

// Ligne label / valeur dans un bloc info
function infoLine(doc, label, value, xLabel, xValue, y, valueWidth) {
    valueWidth = valueWidth || 200;
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(label, xLabel, y, { width: 90 });
    doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
        .text(value || '—', xValue, y, { width: valueWidth });
    return y + 15;
}

// Bloc info encadré (titre + lignes label/valeur)
function infoBox(doc, x, y, w, h, accentColor, title, rows) {
    accentColor = accentColor || C.blue;
    doc.rect(x, y, w, h).fillColor(C.grayLight).fill();
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    doc.rect(x, y, 3, h).fillColor(accentColor).fill();
    // Titre du bloc
    doc.fillColor(accentColor).fontSize(7.5).font('Helvetica-Bold')
        .text(title, x + 10, y + 8, { width: w - 16, characterSpacing: 0.5 });
    // Séparateur titre
    doc.moveTo(x + 8, y + 20).lineTo(x + w - 8, y + 20)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    // Lignes de données
    let ry = y + 26;
    rows.forEach(([lbl, val]) => {
        ry = infoLine(doc, lbl, val, x + 10, x + 90, ry, w - 100);
    });
}

// Tableau de services
function serviceTable(doc, lines) {
    const w = contentWidth(doc);
    const colDesc = C.marginL;
    const colQty = C.marginL + w * 0.55;
    const colUnit = C.marginL + w * 0.65;
    const colHT = C.marginL + w * 0.78;
    const startY = doc.y;

    // En-tête
    doc.rect(C.marginL, startY, w, 20).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
        .text('Description', colDesc + 4, startY + 6, { width: w * 0.52 })
        .text('Qté', colQty, startY + 6, { width: w * 0.09, align: 'center' })
        .text('Unité', colUnit, startY + 6, { width: w * 0.12, align: 'center' })
        .text('Montant HT', colHT, startY + 6, { width: w * 0.22, align: 'right' });

    doc.y = startY + 24;
    let totalHT = 0;

    lines.forEach((line, i) => {
        const rowY = doc.y;
        const bg = i % 2 === 0 ? C.white : C.grayLight;

        // Calculer la hauteur nécessaire pour la description
        const descHeight = Math.max(22,
            doc.heightOfString(line.description || '', { width: w * 0.52 - 8 }) + 10
        );

        doc.rect(C.marginL, rowY, w, descHeight).fillColor(bg).fill();
        doc.rect(C.marginL, rowY, w, descHeight)
            .lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();

        doc.fillColor(C.text).fontSize(8).font('Helvetica')
            .text(line.description || '', colDesc + 4, rowY + 6, { width: w * 0.52 - 8 })
            .text(String(line.qty || 1), colQty, rowY + 6, { width: w * 0.09, align: 'center' })
            .text(line.unit || 'h', colUnit, rowY + 6, { width: w * 0.12, align: 'center' })
            .text(fmt(line.amount_ht), colHT, rowY + 6, { width: w * 0.22, align: 'right' });

        totalHT += parseFloat(line.amount_ht || 0);
        doc.y = rowY + descHeight + 2;
    });

    return totalHT;
}

// Bloc totaux (droite aligné)
function taxBlock(doc, ht, tps, tvq, ttc, totalLabel) {
    const w = contentWidth(doc);
    const boxW = 210;
    const boxX = C.marginL + w - boxW;
    let y = doc.y + 12;

    // Fond du bloc
    doc.rect(boxX - 4, y - 6, boxW + 4, 72).fillColor(C.grayLight).fill();
    doc.rect(boxX - 4, y - 6, boxW + 4, 72)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();

    const rows = [
        ['Sous-total HT', fmt(ht)],
        ['TPS (5 %)', fmt(tps)],
        ['TVQ (9,975 %)', fmt(tvq)],
    ];
    rows.forEach(([l, v]) => {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(l, boxX, y, { width: 100 });
        doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
            .text(v, boxX + 100, y, { width: boxW - 104, align: 'right' });
        y += 16;
    });

    // Ligne séparatrice
    doc.moveTo(boxX, y - 4).lineTo(boxX + boxW, y - 4)
        .lineWidth(0.5).strokeColor(C.border).stroke();

    // Total final
    y += 2;
    doc.rect(boxX - 4, y - 4, boxW + 4, 26).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
        .text(totalLabel || 'TOTAL TTC', boxX, y + 4, { width: 100 });
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
        .text(fmt(ttc), boxX + 100, y + 2, { width: boxW - 104, align: 'right' });

    doc.y = y + 40;
}

// Footer commun
function drawFooter(doc, docNumber, bgColor) {
    bgColor = bgColor || C.navy;
    const w = pageWidth(doc);
    const y = doc.page.height - 44;
    doc.rect(0, y, w, 44).fillColor(bgColor).fill();
    // Ligne déco
    doc.rect(0, y, w, 2).fillColor(C.blueMid).fillOpacity(0.5).fill().fillOpacity(1);
    doc.fillColor('#AABBCC').fontSize(7).font('Helvetica')
        .text(`${C.name}  ·  ${C.site}  ·  ${C.email}  ·  ${C.phone}`,
            C.marginL, y + 10, { width: w - 80, align: 'center' })
        .text(`${docNumber}  ·  Généré le ${dateCA(new Date())}  ·  Document confidentiel`,
            C.marginL, y + 24, { width: w - 80, align: 'center' });
}

// Badge statut coloré (EN ATTENTE / PAYÉE / etc.)
function statusBadge(doc, x, y, label, bgColor, textColor) {
    const badgeW = 90, badgeH = 14;
    doc.rect(x, y, badgeW, badgeH).fillColor(bgColor).fill();
    doc.fillColor(textColor).fontSize(7).font('Helvetica-Bold')
        .text(label, x, y + 3.5, { width: badgeW, align: 'center', characterSpacing: 0.3 });
}


// ─────────────────────────────────────────────
// TEMPLATE 1 — DEVIS
// Header bleu primaire · accent secondaire sur infos client
// ─────────────────────────────────────────────
async function generateQuotePDF(res, quote, client, lines) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quote_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);

    // ── HEADER ──────────────────────────────
    doc.rect(0, 0, w, 100).fillColor(C.blue).fill();
    // Bande déco basse
    doc.rect(0, 97, w, 3).fillColor(C.blueMid).fillOpacity(0.6).fill().fillOpacity(1);

    // Logo hexagonal
    drawHexLogo(doc, 58, 50, 28, C.white, C.white);

    // Nom + slogan + contact
    doc.fillColor(C.white).fontSize(15).font('Helvetica-Bold')
        .text(C.name, 96, 26);
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 97, 44, { characterSpacing: 1.2 });
    doc.fillColor('#B8CDD8').fontSize(7).font('Helvetica')
        .text(`NEQ : ${C.neq}  ·  ${C.email}  ·  ${C.phone}`, 97, 57);

    // Badge document (droite)
    const bx = w - 148, by = 18, bw = 120, bh = 64;
    doc.rect(bx, by, bw, bh).fillColor('#2A6BA8').fill();
    doc.rect(bx, by, bw, bh).lineWidth(0.5).strokeColor('#5A8FBF').stroke();
    doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
        .text('DEVIS', bx, by + 10, { width: bw, align: 'center', characterSpacing: 2 });
    doc.fillColor(C.white).fontSize(9).font('Helvetica')
        .text(quote.quote_number, bx, by + 27, { width: bw, align: 'center' });
    doc.fillColor('#B8CDD8').fontSize(7.5)
        .text(dateCA(quote.created_at), bx, by + 44, { width: bw, align: 'center' });

    doc.y = 116;

    // ── BLOCS INFO ───────────────────────────
    const cw = contentWidth(doc);
    const halfW = (cw - 12) / 2;
    const infoH = 108;
    const infoY = doc.y;  // capturer Y avant les deux blocs

    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, 'CLIENT', [
        ['Nom', client.full_name],
        ['Entreprise', client.company_name],
        ['Courriel', client.email],
        ['Téléphone', client.phone],
        ['Ville', `${client.city || ''} ${client.province || ''}`.trim()],
    ]);

    const rx = C.marginL + halfW + 12;
    infoBox(doc, rx, infoY, halfW, infoH, C.blue, 'DÉTAILS DU DEVIS', [
        ['Numéro', quote.quote_number],
        ['Date', dateCA(quote.created_at)],
        ['Valide jusqu\'au', quote.expiry_date ? dateCA(quote.expiry_date) : '30 jours'],
        ['Statut', 'En attente d\'approbation'],
    ]);

    doc.y = infoY + infoH + 18;

    // ── DESCRIPTION ──────────────────────────
    sectionBar(doc, 'Description des services');
    doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold')
        .text(quote.title, C.marginL, doc.y, { width: cw });
    doc.y += 14;
    if (quote.description) {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(quote.description, C.marginL, doc.y, { width: cw, lineGap: 3 });
        doc.y += 10;
    }
    doc.y += 8;

    // ── TABLEAU ──────────────────────────────
    sectionBar(doc, 'Lignes de service');
    const tableLines = (lines && lines.length) ? lines : [{
        description: quote.title,
        qty: 1, unit: 'forfait', amount_ht: quote.amount_ht
    }];
    serviceTable(doc, tableLines);

    taxBlock(doc, quote.amount_ht, quote.tps_amount, quote.tvq_amount, quote.amount_ttc, 'TOTAL DU DEVIS');

    // ── CONDITIONS ───────────────────────────
    sectionBar(doc, 'Conditions de paiement');
    const conditions = [
        'Acompte de 50 % à la signature du contrat.',
        'Solde dû à la livraison des travaux.',
        `Devis valide 30 jours à compter du ${dateCA(quote.created_at)}.`,
        'Ce devis ne constitue pas un contrat — un contrat de service sera émis après acceptation.',
        'Les prix sont en dollars canadiens (CAD) et excluent les taxes applicables.',
    ];
    conditions.forEach(c => {
        doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
            .text(`•  ${c}`, C.marginL + 6, doc.y, { width: cw - 6, lineGap: 2 });
        doc.y += 13;
    });
    doc.y += 6;

    // ── ACCEPTATION / SIGNATURE ───────────────
    sectionBar(doc, 'Acceptation');
    doc.fillColor(C.gray).fontSize(8).font('Helvetica')
        .text('En signant ci-dessous, le client accepte les termes et conditions de ce devis et autorise VNK Automatisation Inc. à procéder aux travaux décrits.',
            C.marginL, doc.y, { width: cw, lineGap: 3 });
    doc.y += 20;

    const sigY = doc.y;
    const sigW = (cw - 20) / 2;

    // Signature client
    doc.rect(C.marginL, sigY, sigW, 52).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, sigY, sigW, 52).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
        .text('SIGNATURE DU CLIENT', C.marginL + 8, sigY + 8);
    doc.moveTo(C.marginL + 8, sigY + 38).lineTo(C.marginL + sigW - 8, sigY + 38)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    doc.fillColor(C.gray).fontSize(7).font('Helvetica')
        .text(client.full_name || '', C.marginL + 8, sigY + 41);

    // Ligne date
    const dx = C.marginL + sigW + 20;
    doc.rect(dx, sigY, sigW, 52).fillColor(C.grayLight).fill();
    doc.rect(dx, sigY, sigW, 52).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
        .text('DATE', dx + 8, sigY + 8);
    doc.moveTo(dx + 8, sigY + 38).lineTo(dx + sigW - 8, sigY + 38)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();

    doc.y = sigY + 52;

    drawFooter(doc, quote.quote_number, C.navy);
    doc.end();
}


// ─────────────────────────────────────────────
// TEMPLATE 2 — FACTURE
// Header marine foncé · accent vert si payée · badge statut coloré
// ─────────────────────────────────────────────
async function generateInvoicePDF(res, invoice, client) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const isPaid = invoice.status === 'paid';
    const accentColor = isPaid ? C.green : C.blueMid;

    // ── HEADER marine ────────────────────────
    doc.rect(0, 0, w, 100).fillColor(C.navy).fill();
    doc.rect(0, 97, w, 3).fillColor(accentColor).fillOpacity(0.8).fill().fillOpacity(1);

    drawHexLogo(doc, 58, 50, 28, C.white, C.white);

    doc.fillColor(C.white).fontSize(15).font('Helvetica-Bold')
        .text(C.name, 96, 26);
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 97, 44, { characterSpacing: 1.2 });
    doc.fillColor('#B8CDD8').fontSize(7)
        .text(`NEQ : ${C.neq}  ·  ${C.email}  ·  ${C.phone}`, 97, 57);

    // Badge FACTURE
    const bx = w - 148, by = 18, bw = 120, bh = 64;
    doc.rect(bx, by, bw, bh).fillColor('#1A4570').fill();
    doc.rect(bx, by, bw, bh).lineWidth(0.5).strokeColor('#3A6590').stroke();
    doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
        .text('FACTURE', bx, by + 10, { width: bw, align: 'center', characterSpacing: 2 });
    doc.fillColor(C.white).fontSize(9).font('Helvetica')
        .text(invoice.invoice_number, bx, by + 27, { width: bw, align: 'center' });
    doc.fillColor('#B8CDD8').fontSize(7.5)
        .text(dateCA(invoice.created_at), bx, by + 44, { width: bw, align: 'center' });

    doc.y = 116;

    // ── BLOCS INFO ───────────────────────────
    const cw = contentWidth(doc);
    const halfW = (cw - 12) / 2;
    const infoH = 122;
    const infoY = doc.y;  // capturer Y avant les deux blocs

    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, 'FACTURÉ À', [
        ['Nom', client.full_name],
        ['Entreprise', client.company_name],
        ['Courriel', client.email],
        ['Téléphone', client.phone],
        ['Adresse', client.address],
        ['Ville', `${client.city || ''}, ${client.province || ''} ${client.postal_code || ''}`.trim()],
    ]);

    // Bloc détails avec badge statut
    const rx = C.marginL + halfW + 12;
    infoBox(doc, rx, infoY, halfW, infoH, C.navy, 'DÉTAILS', [
        ['Numéro', invoice.invoice_number],
        ['Date émission', dateCA(invoice.created_at)],
        ['Date échéance', invoice.due_date ? dateCA(invoice.due_date) : '—'],
    ]);
    // Badge statut positionné dans le bloc droite
    const badgeBg = isPaid ? C.greenLight : C.amberLight;
    const badgeTxt = isPaid ? C.green : C.amber;
    const badgeLabel = isPaid ? 'PAYÉE' : 'EN ATTENTE';
    statusBadge(doc, rx + halfW - 100, infoY + 72, badgeLabel, badgeBg, badgeTxt);

    doc.y = infoY + infoH + 18;

    // ── TABLEAU ──────────────────────────────
    sectionBar(doc, 'Description', isPaid ? C.green : C.blue);
    serviceTable(doc, [{
        description: invoice.title + (invoice.description ? '\n' + invoice.description : ''),
        qty: 1, unit: 'forfait', amount_ht: invoice.amount_ht
    }]);

    taxBlock(doc, invoice.amount_ht, invoice.tps_amount, invoice.tvq_amount, invoice.amount_ttc, 'TOTAL FACTURE');

    // ── PAIEMENT ─────────────────────────────
    sectionBar(doc, 'Informations de paiement', isPaid ? C.green : C.blue);
    const payY = doc.y;
    doc.rect(C.marginL, payY, cw, 54).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, payY, 3, 54).fillColor(isPaid ? C.green : C.blueMid).fill();
    doc.rect(C.marginL, payY, cw, 54).lineWidth(0.5).strokeColor(C.border).stroke();

    doc.fillColor(C.text).fontSize(8.5).font('Helvetica-Bold')
        .text(`Virement bancaire  ·  Interac : ${C.email}`, C.marginL + 12, payY + 10);
    doc.fillColor(C.gray).fontSize(8).font('Helvetica')
        .text(`Référence de paiement obligatoire : ${invoice.invoice_number}`,
            C.marginL + 12, payY + 24);
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
        .text(`TPS (5 %) : ${C.tps}   ·   TVQ (9,975 %) : ${C.tvq}`,
            C.marginL + 12, payY + 38);
    doc.y = payY + 62;

    // ── TAMPON PAYÉE ─────────────────────────
    if (isPaid) {
        doc.save()
            .rotate(-28, { origin: [w / 2, doc.page.height / 2] })
            .fontSize(80).fillColor(C.green).fillOpacity(0.06).font('Helvetica-Bold')
            .text('PAYÉE', 60, doc.page.height / 2 - 50, { width: w - 120, align: 'center' })
            .restore();
    }

    drawFooter(doc, invoice.invoice_number, C.navyDeep);
    doc.end();
}


// ─────────────────────────────────────────────
// HELPERS CONTRAT — mise en page multi-pages
// ─────────────────────────────────────────────

// Vérifie l'espace dispo et saute de page si nécessaire
function ensureSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - 54) {
        doc.addPage();
        doc.y = 36;
    }
}

// Écrit un titre de section avec saut de page auto
function contractSection(doc, title, cw) {
    ensureSpace(doc, 40);
    const y = doc.y;
    doc.rect(C.marginL, y, cw, 20).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
        .text(title.toUpperCase(), C.marginL + 8, y + 6, { width: cw - 16, characterSpacing: 0.5 });
    doc.y = y + 26;
}

// Écrit un sous-titre
function contractSubtitle(doc, text, cw) {
    ensureSpace(doc, 24);
    doc.fillColor(C.blue).fontSize(8.5).font('Helvetica-Bold')
        .text(text, C.marginL, doc.y, { width: cw });
    doc.y += 13;
}

// Écrit un paragraphe avec saut de page auto
function contractPara(doc, text, cw, opts) {
    opts = opts || {};
    const indent = opts.indent || 0;
    const h = doc.heightOfString(text, { width: cw - indent, lineGap: 2 }) + 6;
    ensureSpace(doc, h);
    doc.fillColor(opts.color || C.text).fontSize(opts.size || 7.5).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(text, C.marginL + indent, doc.y, { width: cw - indent, lineGap: 2 });
    doc.y += h;
}

// Ligne de tableau
function tableRow(doc, cols, widths, isHeader, cw, y) {
    const rowH = 18;
    const bg = isHeader ? C.blue : C.grayLight;
    let x = C.marginL;
    doc.rect(C.marginL, y, cw, rowH).fillColor(bg).fill();
    doc.rect(C.marginL, y, cw, rowH).lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();
    cols.forEach((col, i) => {
        doc.fillColor(isHeader ? C.white : C.text).fontSize(7.5)
            .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .text(col, x + 4, y + 5, { width: widths[i] - 8 });
        x += widths[i];
    });
    return y + rowH;
}

// Tableau complet avec header
function contractTable(doc, headers, rows, widths, cw) {
    ensureSpace(doc, (rows.length + 1) * 18 + 8);
    let y = doc.y;
    y = tableRow(doc, headers, widths, true, cw, y);
    rows.forEach((row, i) => {
        if (i % 2 === 1) {
            doc.rect(C.marginL, y, cw, 18).fillColor('#EEF4FB').fill();
            doc.rect(C.marginL, y, cw, 18).lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();
            let x2 = C.marginL;
            row.forEach((col, j) => {
                doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
                    .text(col, x2 + 4, y + 5, { width: widths[j] - 8 });
                x2 += widths[j];
            });
            y += 18;
        } else {
            y = tableRow(doc, row, widths, false, cw, y);
        }
    });
    doc.y = y + 8;
}

// Puce item
function bulletItem(doc, text, cw) {
    const h = doc.heightOfString(text, { width: cw - 14, lineGap: 2 }) + 5;
    ensureSpace(doc, h);
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
        .text('•', C.marginL, doc.y, { width: 10 });
    doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
        .text(text, C.marginL + 12, doc.y - (doc.currentLineHeight() + 2), { width: cw - 14, lineGap: 2 });
    doc.y += h;
}

// Header de page répété (compact, pour pages suivantes)
function miniHeader(doc, contractNumber, pageNum) {
    const w = pageWidth(doc);
    doc.rect(0, 0, w, 28).fillColor(C.navy).fill();
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
        .text(C.name, C.marginL, 10, { width: w / 2 });
    doc.fillColor('#B8CDD8').fontSize(7).font('Helvetica')
        .text(`${contractNumber}  ·  Page ${pageNum}`, w / 2, 10, { width: w / 2 - C.marginR, align: 'right' });
    doc.y = 36;
}


// ─────────────────────────────────────────────
// TEMPLATE 3 — CONTRAT DE SERVICE COMPLET
// Contrat principal + Annexes A–D avec tarifs du site
// ─────────────────────────────────────────────
async function generateContractPDF(res, contract, client, quote) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.contract_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const cw = contentWidth(doc);

    // ════════════════════════════════════════════
    // PAGE 1 — EN-TÊTE + PARTIES + OBJET
    // ════════════════════════════════════════════
    doc.rect(0, 0, w / 2, 88).fillColor(C.blue).fill();
    doc.rect(w / 2, 0, w / 2, 88).fillColor(C.navy).fill();
    doc.rect(0, 85, w, 3).fillColor(C.blueMid).fillOpacity(0.8).fill().fillOpacity(1);
    drawHexLogo(doc, w / 2, 44, 24, C.white, C.white);

    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold').text(C.name, 16, 18, { width: w / 2 - 36 });
    doc.fillColor('#B8CDD8').fontSize(7).font('Helvetica').text('VALUE · NETWORK · KNOWLEDGE', 16, 32, { characterSpacing: 0.8 });
    doc.fillColor('#B8CDD8').fontSize(6.5).text(`NEQ : ${C.neq}  ·  ${C.email}  ·  ${C.phone}`, 16, 43);
    doc.fillColor('#B8CDD8').fontSize(6.5).text(C.address, 16, 53);

    doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text('CONTRAT DE SERVICES', w / 2 + 28, 16, { width: w / 2 - 46 });
    doc.fillColor(C.white).fontSize(8.5).font('Helvetica').text('EN AUTOMATISATION INDUSTRIELLE', w / 2 + 28, 28, { width: w / 2 - 46 });
    doc.fillColor('#B8CDD8').fontSize(8).text(contract.contract_number, w / 2 + 28, 42, { width: w / 2 - 46 });
    doc.fillColor('#B8CDD8').fontSize(7.5).text(`Daté du ${dateCA(contract.created_at)}`, w / 2 + 28, 54, { width: w / 2 - 46 });

    doc.y = 100;

    // Blocs parties
    const halfW = (cw - 12) / 2;
    const infoH = 118;
    const infoY = doc.y;

    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blue, 'PRESTATAIRE', [
        ['Société', C.name],
        ['NEQ', C.neq],
        ['Représenté', `${C.founder}, ${C.title}`],
        ['Adresse', C.address],
        ['Courriel', C.email],
        ['Téléphone', C.phone],
    ]);
    infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.navy, 'CLIENT', [
        ['Nom', client.full_name],
        ['Entreprise', client.company_name || '—'],
        ['Adresse', client.address || '—'],
        ['Ville', `${client.city || ''}, ${client.province || 'QC'} ${client.postal_code || ''}`.trim()],
        ['Courriel', client.email],
        ['Téléphone', client.phone || '—'],
    ]);
    doc.y = infoY + infoH + 12;

    // Objet
    contractSection(doc, '1.  Objet du contrat', cw);
    contractPara(doc, 'Le présent contrat définit les modalités selon lesquelles VNK Automatisation Inc. (le « Prestataire ») fournit au Client des services professionnels en automatisation industrielle, incluant notamment :', cw);
    bulletItem(doc, 'Support PLC à distance ou sur site (diagnostic, dépannage, optimisation)', cw);
    bulletItem(doc, 'Audit technique, documentation et modernisation de systèmes automatisés', cw);
    bulletItem(doc, 'Mise à disposition de ressources techniques spécialisées', cw);
    contractPara(doc, 'Les modalités spécifiques de chaque mandat sont précisées dans un devis ou une annexe signée par les Parties.', cw);
    doc.y += 4;

    if (contract.title) {
        contractSection(doc, '2.  Mandat visé par ce contrat', cw);
        contractPara(doc, contract.title, cw, { bold: true });
        if (quote) contractPara(doc, `Référence devis : ${quote.quote_number}  —  Montant total : ${fmt(quote.amount_ttc)} (TTC)`, cw, { color: C.gray });
        const serviceText = contract.content || (quote ? `${quote.description || ''}` : 'Services d\'automatisation industrielle selon entente préalable.');
        if (serviceText) contractPara(doc, serviceText, cw);
        doc.y += 4;
    }

    // ════════════════════════════════════════════
    // CONDITIONS GÉNÉRALES (clauses 3 à 17)
    // ════════════════════════════════════════════
    const clauses = [
        ['3.  Documents contractuels',
            `Le présent contrat comprend, par ordre de priorité : (a) le présent contrat et ses annexes ; (b) le devis accepté par le Client ; (c) les bons de commande émis par le Client ; (d) toute entente écrite signée entre les Parties.`],

        ['4.  Rémunération et conditions de paiement',
            `Le Client s'engage à payer les montants prévus au devis. Un acompte de 50 % est exigible à la signature. Le solde est payable dans les 30 jours suivant l'émission de la facture finale. Tout retard entraîne des intérêts de 2 % par mois (24 % par an). Le Prestataire peut suspendre les services en cas de non-paiement. Les montants sont exclusifs de TPS et TVQ. Le Prestataire se réserve le droit de réviser ses tarifs annuellement moyennant un préavis écrit de 30 jours.`],

        ['5.  Frais et remboursements',
            `Le Client rembourse les frais raisonnables : déplacements (0,70 $/km), hébergement, repas lors d'interventions sur site, matériel ou licences nécessaires. Les acomptes ne sont pas remboursables sauf annulation imputable exclusivement au Prestataire. Toute annulation par le Client après début des travaux est facturée au prorata. Annulation tardive (moins de 5 jours ouvrables) : 50 % du montant prévu peut être facturé.`],

        ['6.  Obligations du client',
            `Le Client s'engage à : (a) fournir un accès sécurisé et fonctionnel aux systèmes et tous les documents techniques nécessaires ; (b) désigner un interlocuteur technique qualifié et disponible ; (c) informer le Prestataire de toute contrainte de sécurité et des fenêtres de maintenance ; (d) s'assurer que les systèmes sont accessibles et en état permettant l'intervention ; (e) respecter les normes de sécurité et les procédures internes. Tout retard imputable au Client entraîne des frais supplémentaires et un ajustement des délais.`],

        ['7.  Délais d\'exécution',
            `Le Prestataire s'engage à respecter les délais du devis, sauf : (a) imprévus techniques non prévisibles à la signature ; (b) retards imputables au Client ; (c) cas de force majeure. En cas de dépassement du fait exclusif du Prestataire, le Client notifie par écrit et les parties s'entendent sur un nouveau calendrier avant tout recours.`],

        ['8.  Sécurité des interventions',
            `Les interventions sur systèmes PLC/SCADA/HMI présentent des risques inhérents. En conséquence : (a) Le Client est seul responsable de l'activation des systèmes de sécurité physiques (LOTO, arrêts d'urgence) avant et pendant toute intervention ; (b) les modifications de programme seront testées hors ligne puis en mode manuel avant mise en production ; (c) le Client doit avoir du personnel qualifié sur site lors d'interventions à distance sur des systèmes en production ; (d) pour les interventions sur site, le technicien se conformera aux règles internes du Client, à recevoir par écrit avant l'intervention ; (e) le Prestataire ne modifiera jamais les fonctions de sécurité homologuées (safety PLC, relais, arrêts d'urgence) sans autorisation écrite et documentation préalable.`],

        ['9.  Cybersécurité et accès distant',
            `L'accès aux systèmes s'effectue exclusivement via des canaux sécurisés (VPN, connexion chiffrée). Le Prestataire s'engage à : (a) n'utiliser les accès que pour les besoins stricts du mandat ; (b) protéger les identifiants ; (c) signaler immédiatement tout incident de sécurité détecté ; (d) notifier le Client de révoquer les accès dès la fin du mandat. Le Client est responsable de la segmentation réseau isolant ses systèmes industriels, conformément à IEC 62443.`],

        ['10.  Sauvegarde et intégrité des données',
            `Avant toute modification, le Prestataire procède à la sauvegarde complète des programmes PLC, HMI et SCADA. Une copie est remise au Client. En cas d'incident lors de l'intervention, le Prestataire s'engage à restaurer depuis cette sauvegarde. Le Client demeure responsable de maintenir ses propres sauvegardes indépendamment. Le Prestataire ne peut être tenu responsable des données préexistantes non sauvegardées par le Client.`],

        ['11.  Assurance',
            `Le Prestataire déclare maintenir une assurance responsabilité professionnelle adéquate couvrant ses activités. Une preuve d'assurance peut être fournie sur demande.`],

        ['12.  Sous-traitance',
            `Le Prestataire peut recourir à des sous-traitants qualifiés. Il demeure responsable de la qualité des services et du respect des obligations contractuelles.`],

        ['13.  Propriété intellectuelle et livrables',
            `Les programmes PLC, HMI, SCADA et toute documentation développés spécifiquement deviennent la propriété exclusive du Client après paiement intégral. Les méthodes, outils et savoir-faire génériques du Prestataire demeurent sa propriété exclusive. Le Prestataire peut référencer l'existence du mandat à des fins commerciales, sans divulguer d'informations confidentielles.`],

        ['14.  Confidentialité',
            `Les Parties traitent comme strictement confidentiels tous les renseignements échangés (programmes PLC, schémas, procédés industriels, informations financières). Cette obligation survit à la fin du contrat pour cinq (5) ans. Un NDA distinct peut être signé sur demande pour les mandats à information sensible.`],

        ['15.  Garantie et rectification',
            `Le Prestataire garantit la conformité des livrables pour 90 jours suivant la réception. Durant cette période, il corrige sans frais tout dysfonctionnement directement imputable à l'intervention. La garantie exclut : (a) modifications par le Client ou un tiers ; (b) usure matérielle ; (c) problèmes préexistants non signalés.`],

        ['16.  Rapport d\'intervention',
            `À chaque fin de mandat, le Prestataire remet un rapport écrit détaillant : (a) les travaux réalisés et modifications effectuées ; (b) les tests et leurs résultats ; (c) l'état avant/après ; (d) les recommandations de maintenance ; (e) la liste des sauvegardes. Faute d'objection écrite du Client dans les 10 jours ouvrables, les travaux sont réputés acceptés.`],

        ['17.  Limitation de responsabilité',
            `La responsabilité totale du Prestataire est limitée au montant total facturé pour le mandat. Le Prestataire ne peut être tenu responsable : (a) des pertes d'exploitation, arrêts de production, manque à gagner ; (b) des dommages indirects ou consécutifs ; (c) des dommages résultant de modifications non autorisées après livraison ; (d) des défaillances matérielles préexistantes ; (e) des conséquences d'une utilisation non conforme. Cette limitation s'applique dans toute la mesure permise par le droit québécois.`],

        ['18.  Exclusion — systèmes de sécurité',
            `Le Prestataire ne peut être tenu responsable de dommages corporels, matériels ou environnementaux résultant de : (a) défaillance de systèmes de sécurité hors périmètre du mandat ; (b) activation/désactivation par le Client hors procédures convenues ; (c) utilisation dans des conditions différentes de celles du devis ; (d) manquement du Client aux règles de sécurité applicables (LSST, RSST, NFPA 70E, IEC 61508, ISO 13849). Le Client reconnaît que tout système PLC/SCADA/HMI contrôlant des équipements dangereux nécessite une validation complète avant remise en service.`],

        ['19.  Non-sollicitation',
            `Le Client s'engage à ne pas embaucher directement ou indirectement toute ressource fournie par le Prestataire pendant la durée du contrat et pour 12 mois suivant sa fin. En cas de non-respect, une indemnité équivalente à 12 mois de rémunération de la ressource concernée sera due.`],

        ['20.  Non-exclusivité',
            `Le présent contrat n'accorde aucune exclusivité au Client. Le Prestataire demeure libre de fournir des services similaires à d'autres clients.`],

        ['21.  Résiliation',
            `Chaque Partie peut résilier avec un préavis écrit de 30 jours. Les travaux réalisés et frais engagés sont facturés au prorata. En cas de manquement grave non corrigé dans les 15 jours suivant une mise en demeure, la résiliation peut être immédiate. Le Prestataire ne quittera jamais un système en état instable ou dangereux ; une phase de stabilisation minimale sera complétée avant la fin des travaux.`],

        ['22.  Force majeure',
            `Aucune Partie ne sera tenue responsable en cas de force majeure : catastrophes naturelles, cyberattaques de tiers, pannes d'infrastructure Internet, épidémies, grèves générales ou décisions gouvernementales. La partie affectée notifie l'autre dans les 48 heures.`],

        ['23.  Droit applicable et règlement des différends',
            `Le présent contrat est régi par les lois de la province de Québec et les lois fédérales du Canada. En cas de différend, les parties tentent de régler à l'amiable dans les 30 jours. À défaut, le différend est soumis aux tribunaux compétents du Québec. Le présent contrat constitue l'intégralité de l'entente entre les Parties et remplace tout accord antérieur. Toute modification doit être faite par écrit et signée par les deux Parties.`],
    ];

    clauses.forEach(([title, text]) => {
        const titleH = 14;
        const textH = doc.heightOfString(text, { width: cw - 12, lineGap: 2 }) + 8;
        ensureSpace(doc, titleH + textH);
        doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
            .text(title, C.marginL, doc.y, { width: cw });
        doc.y += 12;
        doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
            .text(text, C.marginL + 8, doc.y, { width: cw - 8, lineGap: 2 });
        doc.y += textH;
    });

    // ════════════════════════════════════════════
    // SIGNATURES — toujours sur nouvelle page
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, '24.  Signatures', cw);
    contractPara(doc, `Fait en deux exemplaires originaux. Les soussignés déclarent avoir lu, compris et accepté les termes du présent contrat daté du ${dateCA(contract.created_at)}.`, cw);
    doc.y += 12;

    const sigY = doc.y;
    const sigW = (cw - 16) / 2;
    const sigBoxH = 110; // plus haut pour accueillir l'image de signature

    // ── Bloc VNK (gauche) ──
    doc.rect(C.marginL, sigY, sigW, sigBoxH).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, sigY, 3, sigBoxH).fillColor(C.blue).fill();
    doc.rect(C.marginL, sigY, sigW, sigBoxH).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold').text('VNK AUTOMATISATION INC.', C.marginL + 10, sigY + 8);
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(C.founder, C.marginL + 10, sigY + 20)
        .text(C.title, C.marginL + 10, sigY + 30);

    // Image de signature admin si disponible
    if (contract.admin_signature_data && contract.admin_signature_data.startsWith('data:image/')) {
        try {
            const base64 = contract.admin_signature_data.replace(/^data:image\/\w+;base64,/, '');
            const imgBuf = Buffer.from(base64, 'base64');
            doc.image(imgBuf, C.marginL + 10, sigY + 40, { width: sigW - 20, height: 40, fit: [sigW - 20, 40] });
        } catch (e) { /* image corrompue — on laisse la ligne vide */ }
    }
    // Ligne de signature
    doc.moveTo(C.marginL + 10, sigY + 84).lineTo(C.marginL + sigW - 10, sigY + 84)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).text('Signature', C.marginL + 10, sigY + 87);

    // Date
    const adminSignedDate = contract.admin_signed_at ? dateCA(contract.admin_signed_at) : '_______________';
    doc.moveTo(C.marginL + 10, sigY + 100).lineTo(C.marginL + sigW - 10, sigY + 100)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7)
        .text('Date : ' + adminSignedDate, C.marginL + 10, sigY + 103);

    // ── Bloc Client (droite) ──
    const cx2 = C.marginL + sigW + 16;
    doc.rect(cx2, sigY, sigW, sigBoxH).fillColor(C.grayLight).fill();
    doc.rect(cx2, sigY, 3, sigBoxH).fillColor(C.navy).fill();
    doc.rect(cx2, sigY, sigW, sigBoxH).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.navy).fontSize(8).font('Helvetica-Bold')
        .text((client.company_name || client.full_name || '').toUpperCase(), cx2 + 10, sigY + 8, { width: sigW - 20 });
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(client.full_name || '', cx2 + 10, sigY + 20);

    // Image de signature client si disponible
    if (contract.client_signature_data && contract.client_signature_data.startsWith('data:image/')) {
        try {
            const base64 = contract.client_signature_data.replace(/^data:image\/\w+;base64,/, '');
            const imgBuf = Buffer.from(base64, 'base64');
            doc.image(imgBuf, cx2 + 10, sigY + 40, { width: sigW - 20, height: 40, fit: [sigW - 20, 40] });
        } catch (e) { /* image corrompue */ }
    }
    // Ligne de signature
    doc.moveTo(cx2 + 10, sigY + 84).lineTo(cx2 + sigW - 10, sigY + 84)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).text('Signature', cx2 + 10, sigY + 87);

    // Date + IP
    const clientSignedDate = contract.signed_at ? dateCA(contract.signed_at) : '_______________';
    const ipStr = contract.client_signature_ip ? '  ·  IP : ' + contract.client_signature_ip : '';
    doc.moveTo(cx2 + 10, sigY + 100).lineTo(cx2 + sigW - 10, sigY + 100)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7)
        .text('Date : ' + clientSignedDate + ipStr, cx2 + 10, sigY + 103, { width: sigW - 20 });

    doc.y = sigY + sigBoxH + 16;

    // Table annexes
    contractPara(doc, 'Le présent contrat inclut les annexes suivantes, intégrées et faisant partie intégrante de l\'entente :', cw, { color: C.gray });
    doc.y += 4;
    const annexes = [
        ['Annexe A', 'Accord de niveau de service (SLA)'],
        ['Annexe B', 'Contrat de support mensuel récurrent'],
        ['Annexe C', 'Grille tarifaire officielle VNK'],
        ['Annexe D', 'Mise à disposition de ressources techniques'],
    ];
    contractTable(doc, ['Annexe', 'Description'], annexes, [cw * 0.2, cw * 0.8], cw);

    drawFooter(doc, contract.contract_number, C.navy);

    // ════════════════════════════════════════════
    // ANNEXE A — SLA
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, 'Annexe A — Accord de niveau de service (SLA)', cw);
    contractPara(doc, 'La présente annexe définit les niveaux de service applicables aux prestations de support technique fournies par VNK Automatisation Inc. dans le cadre des services d\'automatisation industrielle.', cw);
    doc.y += 6;

    contractSubtitle(doc, 'Périmètre des services couverts', cw);
    ['Support PLC, HMI et SCADA', 'Diagnostic et dépannage à distance ou sur site', 'Assistance technique lors de mises en service', 'Support réseau industriel et cybersécurité de base'].forEach(t => bulletItem(doc, t, cw));
    doc.y += 6;

    contractSubtitle(doc, 'Niveaux de service et délais de réponse', cw);
    contractTable(doc,
        ['Niveau', 'Disponibilité', 'Délai de réponse', 'Délai prise en charge'],
        [
            ['Standard', 'Lun–Ven, 8h–17h', '24 h ouvrables', '48 h'],
            ['Prioritaire', 'Lun–Ven, 8h–20h', '8 h ouvrables', '24 h'],
            ['Urgence', '24/7', '2 heures', 'Immédiat selon dispo'],
        ],
        [cw * 0.18, cw * 0.26, cw * 0.28, cw * 0.28], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Classification des incidents', cw);
    contractTable(doc,
        ['Niveau', 'Description', 'Exemple'],
        [
            ['Critique', 'Arrêt complet de production', 'PLC hors service'],
            ['Majeur', 'Fonctionnement dégradé', 'Défaut réseau ou communication'],
            ['Mineur', 'Problème non bloquant', 'Ajustement paramétrique'],
        ],
        [cw * 0.18, cw * 0.44, cw * 0.38], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Exclusions du SLA', cw);
    ['Pannes matérielles non liées aux services fournis', 'Modifications non autorisées par le Client ou un tiers', 'Événements de force majeure', 'Systèmes non couverts par le mandat en cours'].forEach(t => bulletItem(doc, t, cw));

    drawFooter(doc, contract.contract_number + ' — Annexe A', C.navy);

    // ════════════════════════════════════════════
    // ANNEXE B — SUPPORT MENSUEL
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, 'Annexe B — Contrat de support mensuel récurrent', cw);
    contractPara(doc, 'La présente annexe définit les modalités de support technique récurrent en automatisation industrielle. Le Client choisit l\'un des forfaits ci-dessous selon ses besoins.', cw);
    doc.y += 6;

    contractSubtitle(doc, 'Forfaits mensuels disponibles', cw);
    contractTable(doc,
        ['Forfait', 'Heures incluses', 'Délai de réponse', 'Tarif mensuel'],
        [
            ['Essentiel', '5 heures', '24 h ouvrables', '1 000 CAD'],
            ['Professionnel', '10 heures', '8 h ouvrables', '1 800 CAD'],
            ['Premium', '20 heures', '4 h ouvrables', '3 200 CAD'],
        ],
        [cw * 0.22, cw * 0.22, cw * 0.26, cw * 0.30], cw
    );
    contractPara(doc, 'Les heures supplémentaires au-delà du forfait sont facturées selon la grille tarifaire officielle (Annexe C). Les heures non utilisées dans le mois ne sont pas reportées.', cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, 'Durée et renouvellement', cw);
    contractPara(doc, 'Durée initiale de 12 mois. Renouvellement automatique sauf avis écrit de résiliation 30 jours avant l\'échéance. Facturation mensuelle payable dans un délai de 30 jours.', cw);
    doc.y += 6;

    contractSubtitle(doc, 'Conditions particulières', cw);
    ['Le forfait est activé dès réception de l\'acompte du premier mois.',
        'Le niveau de service (délai de réponse) est garanti dans les limites du forfait choisi.',
        'Les interventions d\'urgence hors forfait sont majorées de 25 % (voir Annexe C).',
        'Le Client peut changer de forfait avec un préavis écrit de 30 jours.'].forEach(t => bulletItem(doc, t, cw));

    drawFooter(doc, contract.contract_number + ' — Annexe B', C.navy);

    // ════════════════════════════════════════════
    // ANNEXE C — GRILLE TARIFAIRE
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, 'Annexe C — Grille tarifaire officielle VNK Automatisation Inc.', cw);
    contractPara(doc, `Tarifs en vigueur au ${dateCA(new Date())}. Tous les prix sont en dollars canadiens (CAD), taxes en sus (TPS 5 % + TVQ 9,975 %).`, cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, 'Services techniques', cw);
    contractTable(doc,
        ['Service', 'Tarif'],
        [
            ['Support PLC à distance', '120 – 150 CAD / heure'],
            ['Intervention sur site', '140 – 180 CAD / heure'],
            ['Banque d\'heures prépayée (10 h)', '1 100 CAD (économie de 400 CAD)'],
            ['Forfait mensuel standard', '1 200 CAD / mois'],
            ['Forfait mensuel prioritaire', '2 500 CAD / mois (réponse garantie)'],
        ],
        [cw * 0.62, cw * 0.38], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Audit technique', cw);
    contractTable(doc,
        ['Type d\'audit', 'Tarif', 'Description'],
        [
            ['Audit standard', '1 500 – 2 500 CAD', 'Système simple — 1 à 2 automates'],
            ['Audit complet', '2 500 – 4 000 CAD', 'Système complexe — multiples automates'],
        ],
        [cw * 0.28, cw * 0.28, cw * 0.44], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Documentation industrielle', cw);
    contractTable(doc,
        ['Type', 'Tarif', 'Description'],
        [
            ['Documentation de base', '800 – 2 000 CAD', 'Procédures opérateur et maintenance'],
            ['Documentation complète', '2 000 – 5 000 CAD', 'Tout inclus — code, procédures, schémas'],
        ],
        [cw * 0.28, cw * 0.28, cw * 0.44], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Refactorisation PLC', cw);
    contractTable(doc,
        ['Type', 'Tarif', 'Description'],
        [
            ['Refactorisation partielle', '3 000 – 10 000 CAD', 'Modules ou sections ciblées'],
            ['Refactorisation complète', '10 000 – 25 000 CAD', 'Programme complet restructuré'],
            ['Nouvelle implémentation', '5 000 – 50 000 CAD', 'Réécriture complète ou nouveau projet'],
        ],
        [cw * 0.30, cw * 0.30, cw * 0.40], cw
    );
    doc.y += 4;

    contractSubtitle(doc, 'Frais supplémentaires', cw);
    contractTable(doc,
        ['Type de frais', 'Tarif'],
        [
            ['Déplacement', '0,70 CAD / km'],
            ['Temps de déplacement', '50 % du tarif horaire'],
            ['Intervention d\'urgence', 'Majoration de 25 %'],
            ['Intervention hors heures ouvrables', 'Majoration de 50 %'],
        ],
        [cw * 0.55, cw * 0.45], cw
    );

    drawFooter(doc, contract.contract_number + ' — Annexe C', C.navy);

    // ════════════════════════════════════════════
    // ANNEXE D — RESSOURCES TECHNIQUES
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, 'Annexe D — Mise à disposition de ressources techniques', cw);
    contractPara(doc, 'La présente annexe encadre la fourniture de ressources techniques spécialisées par VNK Automatisation Inc. auprès du Client pour des mandats temporaires ou récurrents en automatisation industrielle.', cw);
    doc.y += 6;

    contractSubtitle(doc, 'Types de ressources disponibles', cw);
    ['Programmeurs PLC (Siemens, Rockwell, B&R, Schneider)',
        'Techniciens en automatisation industrielle',
        'Spécialistes HMI / SCADA (WinCC, FactoryTalk, Wonderware)',
        'Experts en réseaux industriels (Profinet, EtherNet/IP, Modbus)'].forEach(t => bulletItem(doc, t, cw));
    doc.y += 6;

    contractSubtitle(doc, 'Tarification indicative', cw);
    contractTable(doc,
        ['Profil', 'Tarif journalier (8 h)'],
        [
            ['Technicien en automatisation', '700 – 900 CAD / jour'],
            ['Programmeur PLC', '900 – 1 200 CAD / jour'],
            ['Expert senior', '1 200 – 1 600 CAD / jour'],
        ],
        [cw * 0.55, cw * 0.45], cw
    );
    contractPara(doc, 'Les frais de déplacement, d\'hébergement et autres dépenses autorisées sont facturés en sus selon la grille tarifaire (Annexe C).', cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, 'Modalités d\'intervention', cw);
    ['Les ressources demeurent sous la responsabilité contractuelle et administrative du Prestataire.',
        'Le Client assure la supervision opérationnelle quotidienne des ressources mises à disposition.',
        'Le Client s\'engage à fournir un environnement de travail conforme aux normes de santé et sécurité applicables.',
        'Facturation mensuelle ou selon les modalités du devis, payable dans les 30 jours.'].forEach(t => bulletItem(doc, t, cw));
    doc.y += 6;

    contractSubtitle(doc, 'Non-sollicitation', cw);
    contractPara(doc, 'Le Client s\'engage à ne pas embaucher directement ou indirectement toute ressource fournie par le Prestataire pendant la durée du contrat et pour une période de douze (12) mois suivant sa fin. En cas de non-respect, une indemnité équivalente à douze (12) mois de rémunération de la ressource concernée sera due.', cw);
    doc.y += 6;

    contractSubtitle(doc, 'Résiliation', cw);
    contractPara(doc, 'Préavis minimal de 15 jours ouvrables par écrit. Les services rendus jusqu\'à la date effective de résiliation sont facturés au prorata.', cw);

    drawFooter(doc, contract.contract_number + ' — Annexe D', C.navy);

    // Numéros de page sur toutes les pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fillColor('#94A3B8').fontSize(6.5).font('Helvetica')
            .text(`Page ${i + 1} / ${range.count}`, C.marginL, doc.page.height - 10, { width: cw, align: 'right' });
    }

    doc.end();
}

// ─────────────────────────────────────────────
// FLUX AUTO : Devis accepté → Contrat en DB
// ─────────────────────────────────────────────
async function autoGenerateContract(pool, quoteId) {
    const quoteRes = await pool.query(
        `SELECT q.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province
         FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = $1`,
        [quoteId]
    );
    if (!quoteRes.rows.length) throw new Error('Devis non trouvé');
    const quote = quoteRes.rows[0];

    const year = new Date().getFullYear();
    const count = await pool.query(
        'SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1', [year]
    );
    const num = `CT-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

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