/* ============================================
   VNK Automatisation Inc. - PDF Generation
   ============================================ */

const PDFDocument = require('pdfkit');

const COLORS = {
    primary: '#1B4F8A',
    secondary: '#2E75B6',
    lightBlue: '#D5E8F0',
    text: '#444444',
    textLight: '#888888',
    success: '#27AE60',
    white: '#FFFFFF',
    darkBg: '#0F2D52'
};

async function generateQuotePDF(quoteData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            addHeader(doc, 'DEVIS', quoteData.quote_number);
            addClientInfo(doc, quoteData);
            doc.moveDown(2);
            doc.fontSize(14).fillColor(COLORS.primary).text('Détails du devis', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor(COLORS.text).text(quoteData.title, { bold: true });
            doc.moveDown(0.5);
            if (quoteData.description) doc.fontSize(10).fillColor(COLORS.textLight).text(quoteData.description);
            addPricingTable(doc, quoteData);
            doc.moveDown(2);
            doc.fontSize(9).fillColor(COLORS.textLight)
                .text("Ce devis est valide pour 30 jours à partir de la date d'émission.", { italic: true })
                .text('Tout travail commence après signature du contrat de service.', { italic: true });
            addFooter(doc);
            doc.end();
        } catch (error) { reject(error); }
    });
}

async function generateInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            addHeader(doc, 'FACTURE', invoiceData.invoice_number);
            addClientInfo(doc, invoiceData);
            doc.moveDown(2);
            doc.fontSize(14).fillColor(COLORS.primary).text('Description des services', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor(COLORS.text).text(invoiceData.title, { bold: true });
            doc.moveDown(0.5);
            if (invoiceData.description) doc.fontSize(10).fillColor(COLORS.textLight).text(invoiceData.description);
            if (invoiceData.due_date) {
                doc.moveDown(1);
                doc.fontSize(10).fillColor(COLORS.text)
                    .text(`Date d'échéance : ${new Date(invoiceData.due_date).toLocaleDateString('fr-CA')}`);
            }
            addPricingTable(doc, invoiceData);
            doc.moveDown(2);
            doc.fontSize(10).fillColor(COLORS.primary).text('Informations de paiement', { bold: true });
            doc.fontSize(9).fillColor(COLORS.textLight)
                .text('Paiement accepté en ligne via le portail client : vnk.ca/portail')
                .text('Virement bancaire disponible sur demande.');
            addFooter(doc);
            doc.end();
        } catch (error) { reject(error); }
    });
}

// ---------- Header avec logo hexagone VNK ----------
function addHeader(doc, documentType, documentNumber) {
    doc.rect(0, 0, doc.page.width, 120).fill(COLORS.darkBg);

    // Hexagone VNK
    const hx = 62, hy = 48, hr = 26;
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        pts.push([hx + hr * Math.cos(a), hy + hr * Math.sin(a)]);
    }
    // Fond semi-transparent
    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().fillOpacity(0.12).fill('#FFFFFF').restore();
    // Contour
    doc.save().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().lineWidth(1.8).strokeOpacity(0.8).stroke('#FFFFFF').restore();
    // Texte VNK
    doc.fontSize(11).fillColor('#FFFFFF').font('Helvetica-Bold').fillOpacity(1)
        .text('VNK', hx - 13, hy - 7, { width: 26, align: 'center' });

    // Nom entreprise
    doc.fontSize(18).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text('Automatisation Inc.', 98, 28);
    doc.fontSize(8).fillColor('#99BBDD').font('Helvetica')
        .text('VALUE  ·  NETWORK  ·  KNOWLEDGE', 98, 50);

    // Infos
    doc.fontSize(8).fillColor('#8899AA')
        .text('NEQ : 1181943359', 98, 68)
        .text('vnkautomatisation@gmail.com', 98, 79)
        .text('Québec, QC, Canada', 98, 90);

    // Type et numéro document
    doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text(documentType, doc.page.width - 200, 28, { align: 'right', width: 150 });
    doc.fontSize(11).fillColor('#99BBDD').font('Helvetica')
        .text(documentNumber, doc.page.width - 200, 55, { align: 'right', width: 150 });
    doc.fontSize(9).fillColor('#8899AA')
        .text(`Date : ${new Date().toLocaleDateString('fr-CA')}`, doc.page.width - 200, 72, { align: 'right', width: 150 });

    doc.fillOpacity(1);
    doc.y = 140;
    doc.font('Helvetica');
}

function addClientInfo(doc, data) {
    doc.fontSize(11).fillColor(COLORS.primary).text('Facturé à :', 50, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold')
        .text(data.full_name || data.client_name || '');
    doc.font('Helvetica');
    if (data.company_name) doc.text(data.company_name);
    if (data.email) doc.fontSize(9).fillColor(COLORS.textLight).text(data.email);
}

function addPricingTable(doc, data) {
    doc.moveDown(2);
    const tableTop = doc.y;
    const tableWidth = doc.page.width - 100;
    const col1 = 50;
    const col2 = tableWidth - 100;

    doc.rect(col1, tableTop, tableWidth, 25).fill(COLORS.primary);
    doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text('Description', col1 + 10, tableTop + 7)
        .text('Montant', col2, tableTop + 7, { align: 'right', width: 100 });

    let y = tableTop + 30;
    doc.rect(col1, y, tableWidth, 22).fill('#F8FAFC');
    doc.fontSize(9).fillColor(COLORS.text).font('Helvetica')
        .text('Sous-total (avant taxes)', col1 + 10, y + 6)
        .text(`${parseFloat(data.amount_ht).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    y += 22;
    doc.rect(col1, y, tableWidth, 22).fill('#FFFFFF');
    doc.fontSize(9).fillColor(COLORS.textLight)
        .text('TPS (5%)', col1 + 10, y + 6)
        .text(`${parseFloat(data.tps_amount).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    y += 22;
    doc.rect(col1, y, tableWidth, 22).fill('#F8FAFC');
    doc.fillColor(COLORS.textLight)
        .text('TVQ (9,975%)', col1 + 10, y + 6)
        .text(`${parseFloat(data.tvq_amount).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    y += 22;
    doc.rect(col1, y, tableWidth, 30).fill(COLORS.primary);
    doc.fontSize(12).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text('TOTAL TTC', col1 + 10, y + 9)
        .text(`${parseFloat(data.amount_ttc).toFixed(2)} $`, col2, y + 9, { align: 'right', width: 100 });

    doc.y = y + 42;
    doc.font('Helvetica').fillOpacity(1);
}

function addFooter(doc) {
    const h = doc.page.height;
    doc.rect(0, h - 50, doc.page.width, 50).fill(COLORS.darkBg);
    doc.fontSize(8).fillColor('#8899AA')
        .text(
            'VNK Automatisation Inc.  |  NEQ : 1181943359  |  vnkautomatisation@gmail.com  |  Québec, QC, Canada',
            50, h - 28,
            { align: 'center', width: doc.page.width - 100 }
        );
}

module.exports = { generateQuotePDF, generateInvoicePDF };