/* ============================================
   VNK Automatisation Inc. - Invoices Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/invoices — get client invoices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const clientId = req.query.client_id || req.user.id;
        const result = await pool.query(
            `SELECT id, invoice_number, title, description, amount_ht,
  tps_amount, tvq_amount, amount_ttc,
  status, due_date, paid_at, created_at
FROM invoices
WHERE client_id = $1
ORDER BY created_at DESC`,
            [clientId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            invoices: result.rows
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/invoices/:id — get single invoice
// GET /:id/pdf — générer PDF facture (portail client)
router.get('/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*, cl.full_name, cl.company_name, cl.email, cl.phone,
                    cl.address, cl.city, cl.province, cl.postal_code
             FROM invoices i
             JOIN clients cl ON i.client_id = cl.id
             WHERE i.id = $1 AND i.client_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Facture introuvable.' });
        const row = result.rows[0];
        const invoice = { ...row };
        const client = { full_name: row.full_name, email: row.email, phone: row.phone, company_name: row.company_name, address: row.address, city: row.city, province: row.province, postal_code: row.postal_code };
        const { generateInvoicePDF } = require('./pdf-templates');
        await generateInvoicePDF(res, invoice, client);
    } catch (e) {
        console.error('Invoice PDF client error:', e);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*, c.full_name, c.company_name, c.email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1 AND i.client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found.'
            });
        }

        res.json({
            success: true,
            invoice: result.rows[0]
        });

    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/invoices — create invoice (admin)
router.post('/', async (req, res) => {
    try {
        const { client_id, title, description, amount_ht, due_days = 30 } = req.body;

        // Calculate taxes
        const tps_rate = 0.05;
        const tvq_rate = 0.09975;
        const tps_amount = parseFloat((amount_ht * tps_rate).toFixed(2));
        const tvq_amount = parseFloat((amount_ht * tvq_rate).toFixed(2));
        const amount_ttc = parseFloat((amount_ht + tps_amount + tvq_amount).toFixed(2));

        // Generate invoice number
        const year = new Date().getFullYear();
        const countResult = await pool.query(
            "SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at) = $1",
            [year]
        );
        const invoiceNumber = `F-${year}-${String(parseInt(countResult.rows[0].count) + 1).padStart(3, '0')}`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + due_days);

        const result = await pool.query(
            `INSERT INTO invoices
       (client_id, invoice_number, title, description,
        amount_ht, tps_amount, tvq_amount, amount_ttc,
        status, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', $9, NOW())
       RETURNING *`,
            [client_id, invoiceNumber, title, description,
                amount_ht, tps_amount, tvq_amount, amount_ttc, dueDate]
        );

        res.status(201).json({
            success: true,
            message: 'Invoice created successfully.',
            invoice: result.rows[0]
        });

    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;