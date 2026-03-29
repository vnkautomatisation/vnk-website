/* ============================================
   VNK Automatisation Inc. - Quotes Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/quotes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const clientId = req.user.id;
        const result = await pool.query(
            `SELECT id, quote_number, title, description, service_type,
                    amount_ht, tps_amount, tvq_amount, amount_ttc,
                    status, created_at, expiry_date, accepted_at
             FROM quotes
             WHERE client_id = $1
             ORDER BY created_at DESC`,
            [clientId]
        );
        res.json({ success: true, count: result.rows.length, quotes: result.rows });
    } catch (error) {
        console.error('Get quotes error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/quotes/:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, c.full_name, c.company_name, c.email
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             WHERE q.id = $1 AND q.client_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quote not found.' });
        res.json({ success: true, quote: result.rows[0] });
    } catch (error) {
        console.error('Get quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/quotes (admin)
router.post('/', async (req, res) => {
    try {
        const { client_id, title, description, amount_ht, service_type, expiry_days = 30 } = req.body;
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `D-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + expiry_days);
        const result = await pool.query(
            `INSERT INTO quotes (client_id, quote_number, title, description, service_type, amount_ht, tps_amount, tvq_amount, amount_ttc, status, expiry_date, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,NOW()) RETURNING *`,
            [client_id, num, title, description, service_type, amount_ht, tps, tvq, ttc, expiry]
        );
        res.status(201).json({ success: true, message: 'Quote created successfully.', quote: result.rows[0] });
    } catch (error) {
        console.error('Create quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/quotes/:id/accept
router.put('/:id/accept', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE quotes SET status='accepted', accepted_at=NOW(), updated_at=NOW()
             WHERE id=$1 AND client_id=$2 AND status='pending' RETURNING *`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quote not found or already processed.' });
        res.json({ success: true, message: 'Quote accepted.', quote: result.rows[0] });
    } catch (error) {
        console.error('Accept quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/quotes/:id/decline
router.put('/:id/decline', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE quotes SET status='declined', updated_at=NOW()
             WHERE id=$1 AND client_id=$2 AND status='pending' RETURNING *`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quote not found or already processed.' });
        res.json({ success: true, message: 'Quote declined.', quote: result.rows[0] });
    } catch (error) {
        console.error('Decline quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/quotes/:id (admin update)
router.put('/:id', async (req, res) => {
    try {
        const { title, description, amount_ht, service_type, status, expiry_days } = req.body;
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (expiry_days || 30));
        const result = await pool.query(
            `UPDATE quotes SET title=$1, description=$2, amount_ht=$3, tps_amount=$4, tvq_amount=$5,
             amount_ttc=$6, service_type=$7, status=$8, expiry_date=$9, updated_at=NOW()
             WHERE id=$10 RETURNING *`,
            [title, description, amount_ht, tps, tvq, ttc, service_type, status, expiry, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quote not found.' });
        res.json({ success: true, quote: result.rows[0] });
    } catch (error) {
        console.error('Update quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /api/quotes/:id (admin)
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM quotes WHERE id=$1', [req.params.id]);
        res.json({ success: true, message: 'Quote deleted.' });
    } catch (error) {
        console.error('Delete quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;