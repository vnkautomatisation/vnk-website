/* ============================================
   VNK Automatisation Inc. - PDF Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateQuotePDF, generateInvoicePDF } = require('../services/pdf');

// GET /api/quotes/:id/pdf
const downloadQuotePDF = [authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, c.full_name, c.company_name, c.email
       FROM quotes q
       JOIN clients c ON q.client_id = c.id
       WHERE q.id = $1 AND q.client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Quote not found.' });
        }

        const pdfBuffer = await generateQuotePDF(result.rows[0]);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="VNK-${result.rows[0].quote_number}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF quote error:', error);
        res.status(500).json({ success: false, message: 'PDF generation error.' });
    }
}];

// GET /api/invoices/:id/pdf
const downloadInvoicePDF = [authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*, c.full_name, c.company_name, c.email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1 AND i.client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        const pdfBuffer = await generateInvoicePDF(result.rows[0]);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="VNK-${result.rows[0].invoice_number}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF invoice error:', error);
        res.status(500).json({ success: false, message: 'PDF generation error.' });
    }
}];

module.exports = { downloadQuotePDF, downloadInvoicePDF };