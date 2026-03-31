/* ============================================
   VNK Automatisation Inc. — PDF client portail
   Devis · Facture  (version portail client)
   Même design que pdf-templates.js (admin)
   ============================================ */
'use strict';
const PDFDocument = require('pdfkit');

// ─── Constantes partagées (identiques à pdf-templates.js) ────────────────────
const C = {
    blue: '#1B4F8A',
    blueMid: '#2E86AB',
    navy: '#0F2D52',
    navyDeep: '#0A1F3A',
    green: '#27AE60',
    greenLight: '#EBF7F0',
    amber: '#D97706',
    amberLight: '#FEF3C7',
    gray: '#64748B',
    grayLight: '#F8FAFC',
    border: '#E2E8F0',
    text: '#1E293B',
    white: '#FFFFFF',

    marginL: 40,
    marginR: 40,

    name: 'VNK Automatisation Inc.',
    neq: '1181943359',
    email: 'vnkautomatisation@gmail.com',
    phone: '(819) 290-8686',
    address: 'Québec, QC, Canada',
    site: 'vnk-website-production.up.railway.app',
    founder: 'Yan Verone Kengne',
    title: 'Président',
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
function fmt(v) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v) || 0);
}
function dateCA(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-CA');
}
function pageWidth(doc) { return doc.page.width; }
function contentWidth(doc) { return doc.page.width - C.marginL - C.marginR; }

// ─── Logo hexagonal VNK (identique à pdf-templates.js) ────────────────────
function drawHexLogo(doc, cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().fillOpacity(0.12).fillColor('#FFFFFF').fill().restore();

    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().lineWidth(1.5).strokeOpacity(0.7).strokeColor('#FFFFFF').stroke().restore();

    const fontSize = Math.max(7, r * 0.38);
    doc.fillColor('#FFFFFF').fillOpacity(1).fontSize(fontSize).font('Helvetica-Bold')
        .text('VNK', cx - r, cy - fontSize * 0.55, { width: r * 2, align: 'center', characterSpacing: 1.5 });
}

// ─── En-tête (bleu primaire) ──────────────────────────────────────────────
function drawHeader(doc, docType, docNumber, headerColor) {
    headerColor = headerColor || C.blue;
    const w = pageWidth(doc);
    const hdrH = 108;

    doc.rect(0, 0, w, hdrH).fillColor(headerColor).fill();
    doc.rect(0, hdrH - 4, w, 4).fillColor(C.blueMid).fillOpacity(0.7).fill().fillOpacity(1);
    doc.rect(0, hdrH, w, 2).fillColor(C.blueMid).fillOpacity(0.3).fill().fillOpacity(1);

    drawHexLogo(doc, 62, 54, 34);

    doc.fillColor(C.white).fontSize(16).font('Helvetica-Bold').text(C.name, 108, 24);
    doc.fillColor('rgba(255,255,255,0.85)').fontSize(7.5).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 109, 44, { characterSpacing: 1.5 });
    doc.fillColor('#A8C4D8').fontSize(7).text('NEQ : ' + C.neq, 109, 56);
    doc.fillColor('#A8C4D8').fontSize(7)
        .text(C.email + '  ·  ' + C.phone + '  ·  ' + C.site, 109, 67);

    // Badge document
    const bx = w - 152, by = 16, bw = 124, bh = 76;
    const badgeBg = headerColor === C.navy ? '#0C2344' : '#1E5A9C';
    doc.rect(bx, by, bw, bh).fillColor(badgeBg).fill();
    doc.rect(bx, by, bw, bh).lineWidth(0.5).strokeColor('#4A7FBF').stroke();
    doc.rect(bx, by, 3, bh).fillColor(C.blueMid).fill();
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
        .text(docType, bx + 4, by + 12, { width: bw - 8, align: 'center', characterSpacing: 2.5 });
    doc.moveTo(bx + 10, by + 30).lineTo(bx + bw - 10, by + 30).lineWidth(0.3).strokeColor('#4A7FBF').stroke();
    doc.fillColor(C.white).fontSize(9.5).font('Helvetica')
        .text(docNumber, bx + 4, by + 36, { width: bw - 8, align: 'center' });
    doc.fillColor('#A8C4D8').fontSize(7.5)
        .text(dateCA(new Date()), bx + 4, by + 53, { width: bw - 8, align: 'center' });

    return hdrH;
}

// ─── Footer ───────────────────────────────────────────────────────────────
function drawFooter(doc, docNumber) {
    const w = pageWidth(doc);
    const y = doc.page.height - 44;
    doc.rect(0, y, w, 44).fillColor(C.navy).fill();
    doc.rect(0, y, w, 2).fillColor(C.blueMid).fillOpacity(0.5).fill().fillOpacity(1);
    doc.fillColor('#AABBCC').fontSize(7).font('Helvetica')
        .text(C.name + '  ·  ' + C.site + '  ·  ' + C.email + '  ·  ' + C.phone,
            C.marginL, y + 10, { width: w - C.marginL - C.marginR, align: 'center' })
        .text(docNumber + '  ·  Généré le ' + dateCA(new Date()) + '  ·  Document confidentiel',
            C.marginL, y + 24, { width: w - C.marginL - C.marginR, align: 'center' });
}

// ─── Bloc info encadré ────────────────────────────────────────────────────
function infoBox(doc, x, y, w, h, accentColor, title, rows) {
    doc.rect(x, y, w, h).fillColor(C.grayLight).fill();
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    doc.rect(x, y, 3, h).fillColor(accentColor).fill();
    doc.fillColor(accentColor).fontSize(7.5).font('Helvetica-Bold')
        .text(title, x + 10, y + 8, { width: w - 16, characterSpacing: 0.5 });
    doc.moveTo(x + 8, y + 20).lineTo(x + w - 8, y + 20)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    let ry = y + 26;
    rows.forEach(([lbl, val]) => {
        doc.fillColor(C.gray).fontSize(7.5).font('Helvetica').text(lbl, x + 10, ry, { width: 90 });
        doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold').text(val || '—', x + 100, ry, { width: w - 110 });
        ry += 15;
    });
}

// ─── Barre de section ─────────────────────────────────────────────────────
function sectionBar(doc, label, accentColor) {
    accentColor = accentColor || C.blue;
    const cw = contentWidth(doc);
    const y = doc.y;
    doc.rect(C.marginL, y, cw, 22).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, y, 3, 22).fillColor(accentColor).fill();
    doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
        .text(label.toUpperCase(), C.marginL + 10, y + 7, { width: cw - 20, characterSpacing: 0.4 });
    doc.y = y + 30;
}

// ─── Tableau de services ──────────────────────────────────────────────────
function serviceTable(doc, lines) {
    const cw = contentWidth(doc);
    const colDesc = C.marginL;
    const colQty = C.marginL + cw * 0.55;
    const colUnit = C.marginL + cw * 0.65;
    const colHT = C.marginL + cw * 0.78;
    const startY = doc.y;

    doc.rect(C.marginL, startY, cw, 20).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
        .text('Description', colDesc + 4, startY + 6, { width: cw * 0.52 })
        .text('Qté', colQty, startY + 6, { width: cw * 0.09, align: 'center' })
        .text('Unité', colUnit, startY + 6, { width: cw * 0.12, align: 'center' })
        .text('Montant HT', colHT, startY + 6, { width: cw * 0.22, align: 'right' });

    doc.y = startY + 24;
    let totalHT = 0;

    lines.forEach((line, i) => {
        const rowY = doc.y;
        const descH = Math.max(22, doc.heightOfString(line.description || '', { width: cw * 0.52 - 8 }) + 10);
        const bg = i % 2 === 0 ? C.white : C.grayLight;
        doc.rect(C.marginL, rowY, cw, descH).fillColor(bg).fill();
        doc.rect(C.marginL, rowY, cw, descH).lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();
        doc.fillColor(C.text).fontSize(8).font('Helvetica')
            .text(line.description || '', colDesc + 4, rowY + 6, { width: cw * 0.52 - 8 })
            .text(String(line.qty || 1), colQty, rowY + 6, { width: cw * 0.09, align: 'center' })
            .text(line.unit || 'h', colUnit, rowY + 6, { width: cw * 0.12, align: 'center' })
            .text(fmt(line.amount_ht), colHT, rowY + 6, { width: cw * 0.22, align: 'right' });
        totalHT += parseFloat(line.amount_ht || 0);
        doc.y = rowY + descH + 2;
    });
    return totalHT;
}

// ─── Bloc totaux ──────────────────────────────────────────────────────────
function taxBlock(doc, ht, tps, tvq, ttc, totalLabel) {
    const cw = contentWidth(doc);
    const boxW = 210;
    const boxX = C.marginL + cw - boxW;
    let y = doc.y + 12;

    doc.rect(boxX - 4, y - 6, boxW + 4, 72).fillColor(C.grayLight).fill();
    doc.rect(boxX - 4, y - 6, boxW + 4, 72).lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();

    [['Sous-total HT', fmt(ht)], ['TPS (5 %)', fmt(tps)], ['TVQ (9,975 %)', fmt(tvq)]].forEach(([l, v]) => {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica').text(l, boxX, y, { width: 100 });
        doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold').text(v, boxX + 100, y, { width: boxW - 104, align: 'right' });
        y += 16;
    });

    doc.moveTo(boxX, y - 4).lineTo(boxX + boxW, y - 4).lineWidth(0.5).strokeColor(C.border).stroke();
    y += 2;
    doc.rect(boxX - 4, y - 4, boxW + 4, 26).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold').text(totalLabel || 'TOTAL TTC', boxX, y + 4, { width: 100 });
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold').text(fmt(ttc), boxX + 100, y + 2, { width: boxW - 104, align: 'right' });
    doc.y = y + 40;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 1 — Devis (portail client)
// ═══════════════════════════════════════════════════════════════════════════
async function generateQuotePDF(quoteData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const w = pageWidth(doc);
            const cw = contentWidth(doc);
            const pH = doc.page.height;
            const hdrH = drawHeader(doc, 'DEVIS', quoteData.quote_number || '');

            // Blocs infos
            const halfW = (cw - 12) / 2;
            const infoH = 108, infoY = hdrH + 20;
            infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, 'CLIENT', [
                ['Nom', quoteData.full_name || quoteData.client_name || '—'],
                ['Entreprise', quoteData.company_name || '—'],
                ['Courriel', quoteData.email || '—'],
                ['Téléphone', quoteData.phone || '—'],
            ]);
            infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.blue, 'DÉTAILS DU DEVIS', [
                ['Numéro', quoteData.quote_number || '—'],
                ['Date', dateCA(quoteData.created_at)],
                ['Valide jusqu\'au', quoteData.expiry_date ? dateCA(quoteData.expiry_date) : '30 jours'],
                ['Statut', quoteData.status === 'accepted' ? 'Approuvé' : 'En attente d\'approbation'],
            ]);

            doc.y = infoY + infoH + 16;
            sectionBar(doc, 'Description des services');
            doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold')
                .text(quoteData.title || '', C.marginL, doc.y, { width: cw });
            doc.y += 16;
            if (quoteData.description) {
                doc.fillColor(C.gray).fontSize(8.5).font('Helvetica')
                    .text(quoteData.description, C.marginL, doc.y, { width: cw, lineGap: 4 });
                doc.y += doc.heightOfString(quoteData.description, { width: cw }) + 10;
            }

            // Tableau ancré en bas
            const nbLines = 1;
            const tableEst = 30 + 24 + nbLines * 30 + 90 + 20;
            const ftrY = pH - 44;
            const tableTopY = ftrY - tableEst;
            if (doc.y < tableTopY) doc.y = tableTopY;

            sectionBar(doc, 'Lignes de service');
            serviceTable(doc, [{
                description: quoteData.title || 'Services d\'automatisation',
                qty: 1, unit: 'forfait', amount_ht: quoteData.amount_ht
            }]);
            taxBlock(doc, quoteData.amount_ht, quoteData.tps_amount, quoteData.tvq_amount,
                quoteData.amount_ttc, 'TOTAL DU DEVIS');

            // Note bas de page
            doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
                .text('Ce devis est valide 30 jours à compter de sa date d\'émission. '
                    + 'Un contrat de service sera émis après acceptation.',
                    C.marginL, doc.y, { width: cw, lineGap: 3 });

            drawFooter(doc, quoteData.quote_number || '');
            doc.end();
        } catch (e) { reject(e); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 2 — Facture (portail client)
// ═══════════════════════════════════════════════════════════════════════════
async function generateInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const isPaid = invoiceData.status === 'paid';
            const w = pageWidth(doc);
            const cw = contentWidth(doc);
            const hdrH = drawHeader(doc, 'FACTURE', invoiceData.invoice_number || '', C.navy);

            // Blocs infos
            const halfW = (cw - 12) / 2;
            const infoH = 108, infoY = hdrH + 20;
            infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, 'FACTURÉ À', [
                ['Nom', invoiceData.full_name || invoiceData.client_name || '—'],
                ['Entreprise', invoiceData.company_name || '—'],
                ['Courriel', invoiceData.email || '—'],
                ['Téléphone', invoiceData.phone || '—'],
            ]);
            infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.navy, 'DÉTAILS', [
                ['Numéro', invoiceData.invoice_number || '—'],
                ['Date émission', dateCA(invoiceData.created_at)],
                ['Date échéance', invoiceData.due_date ? dateCA(invoiceData.due_date) : '—'],
                ['Statut', isPaid ? 'Payée' : 'En attente'],
            ]);

            doc.y = infoY + infoH + 18;
            sectionBar(doc, 'Description', isPaid ? C.green : C.blue);
            serviceTable(doc, [{
                description: invoiceData.title + (invoiceData.description ? '\n' + invoiceData.description : ''),
                qty: 1, unit: 'forfait', amount_ht: invoiceData.amount_ht
            }]);
            taxBlock(doc, invoiceData.amount_ht, invoiceData.tps_amount, invoiceData.tvq_amount,
                invoiceData.amount_ttc, 'TOTAL FACTURE');

            // Paiement
            sectionBar(doc, 'Informations de paiement', isPaid ? C.green : C.blue);
            const payY = doc.y;
            if (isPaid) {
                const paidDate = invoiceData.paid_at ? dateCA(invoiceData.paid_at) : dateCA(new Date());
                const payH = 52;
                doc.rect(C.marginL, payY, cw, payH).fillColor('#F0FDF4').fill();
                doc.rect(C.marginL, payY, 3, payH).fillColor(C.green).fill();
                doc.rect(C.marginL, payY, cw, payH).lineWidth(0.5).strokeColor('#A7F3D0').stroke();
                doc.fillColor(C.green).fontSize(9).font('Helvetica-Bold')
                    .text('PAIEMENT REÇU', C.marginL + 12, payY + 10);
                doc.fillColor(C.gray).fontSize(8).font('Helvetica')
                    .text('Date : ' + paidDate, C.marginL + 12, payY + 24)
                    .text('Mode : ' + (invoiceData.stripe_payment_intent_id
                        ? 'Carte de crédit (Stripe)'
                        : invoiceData.payment_method === 'comptant' ? 'Paiement comptant' : 'Virement / Interac'),
                        C.marginL + 12, payY + 36);
                doc.y = payY + payH + 8;
            } else {
                const payH = 72;
                doc.rect(C.marginL, payY, cw, payH).fillColor(C.grayLight).fill();
                doc.rect(C.marginL, payY, 3, payH).fillColor(C.blueMid).fill();
                doc.rect(C.marginL, payY, cw, payH).lineWidth(0.5).strokeColor(C.border).stroke();
                const colW = (cw - 16) / 2;
                const col1X = C.marginL + 8;
                doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
                    .text('OPTION 1 — PAIEMENT EN LIGNE', col1X, payY + 10, { width: colW - 8 });
                doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
                    .text('Payez par carte via votre portail client :', col1X, payY + 23, { width: colW - 8 });
                doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
                    .text(C.site, col1X, payY + 35, { width: colW - 8 });
                const sepX = C.marginL + 8 + colW;
                doc.moveTo(sepX, payY + 8).lineTo(sepX, payY + 64).lineWidth(0.5).strokeColor(C.border).stroke();
                const col2X = sepX + 8;
                doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
                    .text('OPTION 2 — VIREMENT / INTERAC', col2X, payY + 10, { width: colW - 8 });
                doc.fillColor(C.text).fontSize(7.5).font('Helvetica-Bold')
                    .text(C.email, col2X, payY + 23, { width: colW - 8 });
                doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
                    .text('Référence : ' + (invoiceData.invoice_number || ''), col2X, payY + 35, { width: colW - 8 });
                doc.y = payY + payH + 8;
            }

            // Tampon PAYÉE en filigrane
            if (isPaid) {
                doc.save()
                    .rotate(-28, { origin: [w / 2, doc.page.height / 2] })
                    .fontSize(80).fillColor(C.green).fillOpacity(0.06).font('Helvetica-Bold')
                    .text('PAYÉE', 60, doc.page.height / 2 - 50, { width: w - 120, align: 'center' })
                    .restore();
            }

            drawFooter(doc, invoiceData.invoice_number || '');
            doc.end();
        } catch (e) { reject(e); }
    });
}

module.exports = { generateQuotePDF, generateInvoicePDF };