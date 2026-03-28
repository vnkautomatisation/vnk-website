/* ============================================
   VNK Automatisation Inc. - PDF Routes
   ============================================ */

const pool = require('../db');
const { generateQuotePDF, generateInvoicePDF, generateContractPDF } = require('./pdf-templates');

// GET /api/quotes/:id/pdf — accessible admin (pas de auth client requis)
const downloadQuotePDF = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, c.full_name, c.company_name, c.email, c.phone,
                    c.address, c.city, c.province, c.postal_code
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             WHERE q.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Devis introuvable.' });
        }
        const row = result.rows[0];
        const quote = row;
        const client = {
            full_name: row.full_name, company_name: row.company_name,
            email: row.email, phone: row.phone,
            address: row.address, city: row.city,
            province: row.province, postal_code: row.postal_code
        };
        await generateQuotePDF(res, quote, client, null);
    } catch (error) {
        console.error('PDF devis error:', error);
        res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
};

// GET /api/invoices/:id/pdf
const downloadInvoicePDF = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*, c.full_name, c.company_name, c.email, c.phone,
                    c.address, c.city, c.province, c.postal_code
             FROM invoices i
             JOIN clients c ON i.client_id = c.id
             WHERE i.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Facture introuvable.' });
        }
        const row = result.rows[0];
        const invoice = row;
        const client = {
            full_name: row.full_name, company_name: row.company_name,
            email: row.email, phone: row.phone,
            address: row.address, city: row.city,
            province: row.province, postal_code: row.postal_code
        };
        await generateInvoicePDF(res, invoice, client);
    } catch (error) {
        console.error('PDF facture error:', error);
        res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
};

// GET /api/contracts/:id/pdf
const downloadContractPDF = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ct.*, 
                    c.full_name, c.company_name, c.email, c.phone,
                    q.quote_number, q.amount_ttc, q.description AS quote_description
             FROM contracts ct
             JOIN clients c ON ct.client_id = c.id
             LEFT JOIN quotes q ON ct.quote_id = q.id
             WHERE ct.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });
        }
        const row = result.rows[0];
        const contract = row;
        const client = {
            full_name: row.full_name, company_name: row.company_name,
            email: row.email, phone: row.phone
        };
        const quote = row.quote_number ? {
            quote_number: row.quote_number,
            amount_ttc: row.amount_ttc,
            description: row.quote_description
        } : null;
        await generateContractPDF(res, contract, client, quote);
    } catch (error) {
        console.error('PDF contrat error:', error);
        res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
};

module.exports = { downloadQuotePDF, downloadInvoicePDF, downloadContractPDF };