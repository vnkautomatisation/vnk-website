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
    email: 'yan.verone@vnk.ca',
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
    const infoH = 96;
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

    doc.y = infoY + infoH + 10;

    // ── DESCRIPTION ──────────────────────────
    sectionBar(doc, 'Description des services');
    doc.fillColor(C.text).fontSize(9).font('Helvetica-Bold')
        .text(quote.title, C.marginL, doc.y, { width: cw });
    doc.y += 11;
    if (quote.description) {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(quote.description, C.marginL, doc.y, { width: cw, lineGap: 2 });
        doc.y += 8;
    }
    doc.y += 4;

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
            .text(`•  ${c}`, C.marginL + 6, doc.y, { width: cw - 6, lineGap: 1 });
        doc.y += 11;
    });
    doc.y += 3;

    // ── ACCEPTATION / SIGNATURE ───────────────
    sectionBar(doc, 'Acceptation');
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text('En signant ci-dessous, le client accepte les termes et conditions de ce devis et autorise VNK Automatisation Inc. à procéder aux travaux décrits.',
            C.marginL, doc.y, { width: cw, lineGap: 2 });
    doc.y += 12;

    const sigY = doc.y;
    const sigW = (cw - 16) / 2;

    // Bloc signature client
    doc.rect(C.marginL, sigY, sigW, 50).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, sigY, 3, 50).fillColor(C.blue).fill();
    doc.rect(C.marginL, sigY, sigW, 50).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
        .text('SIGNATURE DU CLIENT', C.marginL + 10, sigY + 7);
    doc.moveTo(C.marginL + 10, sigY + 36).lineTo(C.marginL + sigW - 10, sigY + 36)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    doc.fillColor(C.gray).fontSize(7).font('Helvetica')
        .text(client.full_name || '', C.marginL + 10, sigY + 39);

    // Bloc date
    const dx = C.marginL + sigW + 16;
    doc.rect(dx, sigY, sigW, 50).fillColor(C.grayLight).fill();
    doc.rect(dx, sigY, 3, 50).fillColor(C.blue).fill();
    doc.rect(dx, sigY, sigW, 50).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
        .text('DATE', dx + 10, sigY + 7);
    doc.moveTo(dx + 10, sigY + 36).lineTo(dx + sigW - 10, sigY + 36)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();

    doc.y = sigY + 50;

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
// TEMPLATE 3 — CONTRAT DE SERVICE
// Header bicolore split · clauses numérotées · double signature propre
// ─────────────────────────────────────────────
async function generateContractPDF(res, contract, client, quote) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.contract_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const cw = contentWidth(doc);

    // ── HEADER bicolore ──────────────────────
    // Moitié gauche bleue (prestataire), moitié droite marine (client)
    doc.rect(0, 0, w / 2, 100).fillColor(C.blue).fill();
    doc.rect(w / 2, 0, w / 2, 100).fillColor(C.navy).fill();
    // Bande déco
    doc.rect(0, 97, w, 3).fillColor(C.blueMid).fillOpacity(0.7).fill().fillOpacity(1);

    // Logo centré sur la coupure
    drawHexLogo(doc, w / 2, 50, 26, C.white, C.white);

    // Côté gauche — prestataire
    doc.fillColor(C.white).fontSize(12).font('Helvetica-Bold')
        .text(C.name, 18, 24, { width: w / 2 - 40 });
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 18, 40, { characterSpacing: 0.8 });
    doc.fillColor('#B8CDD8').fontSize(7)
        .text(`NEQ : ${C.neq}`, 18, 54)
        .text(`${C.email}  ·  ${C.phone}`, 18, 65);

    // Côté droit — type document
    doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
        .text('CONTRAT DE SERVICE', w / 2 + 32, 24, { width: w / 2 - 50 });
    doc.fillColor(C.white).fontSize(9).font('Helvetica')
        .text(contract.contract_number, w / 2 + 32, 42, { width: w / 2 - 50 });
    doc.fillColor('#B8CDD8').fontSize(7.5)
        .text(dateCA(contract.created_at), w / 2 + 32, 57, { width: w / 2 - 50 });

    doc.y = 116;

    // ── PARTIES ──────────────────────────────
    const halfW = (cw - 12) / 2;
    const infoH = 100;
    const infoY = doc.y;  // capturer Y avant les deux blocs

    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blue, 'PRESTATAIRE', [
        ['Société', C.name],
        ['NEQ', C.neq],
        ['Représenté', `${C.founder}, ${C.title}`],
        ['Courriel', C.email],
        ['Téléphone', C.phone],
    ]);

    infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.navy, 'CLIENT', [
        ['Nom', client.full_name],
        ['Entreprise', client.company_name],
        ['Courriel', client.email],
        ['Téléphone', client.phone],
    ]);

    doc.y = infoY + infoH + 18;

    // ── OBJET ────────────────────────────────
    sectionBar(doc, 'Objet du contrat');
    doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold')
        .text(contract.title, C.marginL, doc.y, { width: cw });
    doc.y += 14;
    if (quote) {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(`Référence devis : ${quote.quote_number}  —  Montant total : ${fmt(quote.amount_ttc)} (TTC)`,
                C.marginL, doc.y, { width: cw });
        doc.y += 14;
    }
    doc.y += 6;

    // ── DESCRIPTION SERVICES ─────────────────
    sectionBar(doc, 'Description des services');
    const serviceText = contract.content ||
        (quote ? `Services d'automatisation industrielle conformément au devis ${quote.quote_number}.\n\n${quote.description || ''}` :
            'Services d\'automatisation industrielle selon entente préalable.');
    doc.fillColor(C.text).fontSize(8).font('Helvetica')
        .text(serviceText, C.marginL, doc.y, { width: cw, lineGap: 3 });
    doc.y += 16;

    // ── CONDITIONS GÉNÉRALES ─────────────────
    sectionBar(doc, 'Conditions générales');
    const clauses = [
        ['RÉMUNÉRATION', `Le Client s'engage à payer VNK Automatisation Inc. les montants convenus selon le devis annexé. Un acompte de 50 % est exigible à la signature du présent contrat, le solde est dû à la livraison des travaux.`],
        ['DÉLAIS', `VNK Automatisation Inc. s'engage à fournir les services dans les délais convenus, sous réserve d'imprévus techniques ou de retards imputables au Client.`],
        ['PROPRIÉTÉ INTELLECTUELLE', `Les livrables produits dans le cadre de ce contrat demeurent la propriété du Client après paiement complet. VNK Automatisation Inc. conserve le droit de référencer les travaux à des fins de portfolio, sans divulguer d'informations confidentielles.`],
        ['CONFIDENTIALITÉ', `Les parties s'engagent mutuellement à ne pas divulguer à des tiers les informations confidentielles échangées dans le cadre de ce contrat. Un NDA distinct peut être signé sur demande du Client.`],
        ['RESPONSABILITÉ', `La responsabilité de VNK Automatisation Inc. est limitée au montant du présent contrat. VNK n'est pas responsable des pertes indirectes, consécutives ou d'exploitation résultant de l'utilisation des livrables.`],
        ['RÉSILIATION', `Chaque partie peut résilier ce contrat avec un préavis écrit de 30 jours. Les travaux réalisés jusqu'à la date effective de résiliation seront facturés au prorata du travail accompli.`],
        ['DROIT APPLICABLE', `Ce contrat est régi exclusivement par les lois de la province de Québec et les lois fédérales du Canada qui s'y appliquent. Tout litige sera soumis aux tribunaux compétents du Québec.`],
    ];

    clauses.forEach(([num, text], i) => {
        const clauseY = doc.y;
        doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
            .text(`${i + 1}.  ${num}`, C.marginL, clauseY, { width: cw, continued: false });
        doc.y += 11;
        doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
            .text(text, C.marginL + 12, doc.y, { width: cw - 12, lineGap: 2 });
        doc.y += 12;
    });

    doc.y += 6;

    // ── SIGNATURES ───────────────────────────
    sectionBar(doc, 'Signatures');
    doc.fillColor(C.gray).fontSize(8).font('Helvetica')
        .text(`Les soussignés déclarent avoir lu, compris et accepté les termes du présent contrat daté du ${dateCA(contract.created_at)}.`,
            C.marginL, doc.y, { width: cw, lineGap: 3 });
    doc.y += 18;

    const sigY = doc.y;
    const sigW = (cw - 20) / 2;

    // Bloc VNK (gauche)
    doc.rect(C.marginL, sigY, sigW, 72).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, sigY, 3, 72).fillColor(C.blue).fill();
    doc.rect(C.marginL, sigY, sigW, 72).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
        .text('VNK AUTOMATISATION INC.', C.marginL + 10, sigY + 8);
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(`${C.founder}, ${C.title}`, C.marginL + 10, sigY + 22);
    doc.moveTo(C.marginL + 10, sigY + 50).lineTo(C.marginL + sigW - 10, sigY + 50)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).font('Helvetica')
        .text('Signature  ·  Date', C.marginL + 10, sigY + 54);

    // Bloc Client (droite)
    const cx2 = C.marginL + sigW + 20;
    doc.rect(cx2, sigY, sigW, 72).fillColor(C.grayLight).fill();
    doc.rect(cx2, sigY, 3, 72).fillColor(C.navy).fill();
    doc.rect(cx2, sigY, sigW, 72).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.navy).fontSize(7.5).font('Helvetica-Bold')
        .text((client.company_name || client.full_name || '').toUpperCase(),
            cx2 + 10, sigY + 8, { width: sigW - 20 });
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(client.full_name || '', cx2 + 10, sigY + 22);
    doc.moveTo(cx2 + 10, sigY + 50).lineTo(cx2 + sigW - 10, sigY + 50)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).font('Helvetica')
        .text('Signature  ·  Date', cx2 + 10, sigY + 54);

    doc.y = sigY + 72;

    drawFooter(doc, contract.contract_number, C.navy);
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