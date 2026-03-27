/* ============================================
   VNK Automatisation Inc. - PDF Generation
   ============================================ */

const PDFDocument = require('pdfkit');

// ---------- VNK Color Palette ----------
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

// ---------- Generate Quote PDF ----------
async function generateQuotePDF(quoteData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            addHeader(doc, 'DEVIS', quoteData.quote_number);

            // Client info
            addClientInfo(doc, quoteData);

            // Quote details
            doc.moveDown(2);
            doc.fontSize(14).fillColor(COLORS.primary).text('Détails du devis', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor(COLORS.text).text(quoteData.title, { bold: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor(COLORS.textLight).text(quoteData.description || '');

            // Pricing table
            addPricingTable(doc, quoteData);

            // Terms
            doc.moveDown(2);
            doc.fontSize(9).fillColor(COLORS.textLight)
                .text('Ce devis est valide pour 30 jours à partir de la date d\'émission.', { italic: true });
            doc.text('Tout travail commence après signature du contrat de service.', { italic: true });

            // Footer
            addFooter(doc);

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// ---------- Generate Invoice PDF ----------
async function generateInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            addHeader(doc, 'FACTURE', invoiceData.invoice_number);

            // Client info
            addClientInfo(doc, invoiceData);

            // Invoice details
            doc.moveDown(2);
            doc.fontSize(14).fillColor(COLORS.primary).text('Description des services', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor(COLORS.text).text(invoiceData.title, { bold: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor(COLORS.textLight).text(invoiceData.description || '');

            // Due date
            doc.moveDown(1);
            doc.fontSize(10).fillColor(COLORS.text)
                .text(`Date d'échéance : ${new Date(invoiceData.due_date).toLocaleDateString('fr-CA')}`);

            // Pricing table
            addPricingTable(doc, invoiceData);

            // Payment info
            doc.moveDown(2);
            doc.fontSize(10).fillColor(COLORS.primary).text('Informations de paiement', { bold: true });
            doc.fontSize(9).fillColor(COLORS.textLight)
                .text('Paiement accepté en ligne via le portail client : vnk.ca/portail')
                .text('Virement bancaire disponible sur demande.');

            // Footer
            addFooter(doc);

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// ---------- Helper: Add Header ----------
function addHeader(doc, documentType, documentNumber) {
    // Background header rectangle
    doc.rect(0, 0, doc.page.width, 120).fill(COLORS.darkBg);

    // Company name
    doc.fontSize(28).fillColor(COLORS.white).font('Helvetica-Bold')
        .text('VNK', 50, 30, { continued: true })
        .font('Helvetica').fontSize(14).fillColor('#99BBDD')
        .text(' Automatisation Inc.');

    doc.fontSize(9).fillColor('#8899AA')
        .text('Value. Network. Knowledge.', 50, 65);

    doc.fontSize(9).fillColor('#8899AA')
        .text('NEQ : 1181943359', 50, 80)
        .text('vnkautomatisation@gmail.com', 50, 93)
        .text('Québec, QC, Canada', 50, 106);

    // Document type and number
    doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold')
        .text(documentType, doc.page.width - 200, 35, { align: 'right', width: 150 });

    doc.fontSize(11).fillColor('#99BBDD').font('Helvetica')
        .text(documentNumber, doc.page.width - 200, 62, { align: 'right', width: 150 });

    const today = new Date().toLocaleDateString('fr-CA');
    doc.fontSize(9).fillColor('#8899AA')
        .text(`Date : ${today}`, doc.page.width - 200, 80, { align: 'right', width: 150 });

    doc.y = 140;
    doc.font('Helvetica');
}

// ---------- Helper: Add Client Info ----------
function addClientInfo(doc, data) {
    doc.fontSize(11).fillColor(COLORS.primary).text('Facturé à :', 50, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(COLORS.text)
        .text(data.full_name || data.client_name || '', { bold: true });

    if (data.company_name) {
        doc.text(data.company_name);
    }

    if (data.email) {
        doc.fontSize(9).fillColor(COLORS.textLight).text(data.email);
    }
}

// ---------- Helper: Add Pricing Table ----------
function addPricingTable(doc, data) {
    doc.moveDown(2);

    const tableTop = doc.y;
    const tableWidth = doc.page.width - 100;
    const col1 = 50;
    const col2 = tableWidth - 100;

    // Table header
    doc.rect(col1, tableTop, tableWidth, 25).fill(COLORS.primary);
    doc.fontSize(10).fillColor(COLORS.white)
        .text('Description', col1 + 10, tableTop + 7)
        .text('Montant', col2, tableTop + 7, { align: 'right', width: 100 });

    // Subtotal row
    let y = tableTop + 30;
    doc.rect(col1, y, tableWidth, 22).fill('#F8FAFC');
    doc.fontSize(9).fillColor(COLORS.text)
        .text('Sous-total (avant taxes)', col1 + 10, y + 6)
        .text(`${parseFloat(data.amount_ht).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    // TPS row
    y += 22;
    doc.rect(col1, y, tableWidth, 22).fill(COLORS.white);
    doc.fontSize(9).fillColor(COLORS.textLight)
        .text('TPS (5%)', col1 + 10, y + 6)
        .text(`${parseFloat(data.tps_amount).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    // TVQ row
    y += 22;
    doc.rect(col1, y, tableWidth, 22).fill('#F8FAFC');
    doc.fontSize(9).fillColor(COLORS.textLight)
        .text('TVQ (9.975%)', col1 + 10, y + 6)
        .text(`${parseFloat(data.tvq_amount).toFixed(2)} $`, col2, y + 6, { align: 'right', width: 100 });

    // Total row
    y += 22;
    doc.rect(col1, y, tableWidth, 28).fill(COLORS.primary);
    doc.fontSize(12).fillColor(COLORS.white).font('Helvetica-Bold')
        .text('TOTAL', col1 + 10, y + 8)
        .text(`${parseFloat(data.amount_ttc).toFixed(2)} $`, col2, y + 8, { align: 'right', width: 100 });

    doc.y = y + 40;
    doc.font('Helvetica');
}

// ---------- Helper: Add Footer ----------
function addFooter(doc) {
    const pageHeight = doc.page.height;
    doc.rect(0, pageHeight - 50, doc.page.width, 50).fill(COLORS.darkBg);
    doc.fontSize(8).fillColor('#8899AA')
        .text(
            'VNK Automatisation Inc. | NEQ : 1181943359 | vnkautomatisation@gmail.com | Québec, QC, Canada',
            50, pageHeight - 30,
            { align: 'center', width: doc.page.width - 100 }
        );
}

module.exports = {
    generateQuotePDF,
    generateInvoicePDF
};