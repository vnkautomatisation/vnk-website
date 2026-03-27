/* ============================================
   VNK Automatisation Inc. - Quotes Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/quotes — get client quotes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, quote_number, title, description, amount_ht, 
              tps_amount, tvq_amount, amount_ttc, status, 
              created_at, expiry_date, accepted_at
       FROM quotes 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            count: result.rows.length,
            quotes: result.rows
        });

    } catch (error) {
        console.error('Get quotes error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/quotes/:id — get single quote
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, c.full_name, c.company_name, c.email 
       FROM quotes q
       JOIN clients c ON q.client_id = c.id
       WHERE q.id = $1 AND q.client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found.'
            });
        }

        res.json({
            success: true,
            quote: result.rows[0]
        });

    } catch (error) {
        console.error('Get quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/quotes — create quote (admin)
router.post('/', async (req, res) => {
    try {
        const {
            client_id, title, description,
            amount_ht, service_type, expiry_days = 30
        } = req.body;

        // Calculate taxes
        const tps_rate = 0.05;
        const tvq_rate = 0.09975;
        const tps_amount = parseFloat((amount_ht * tps_rate).toFixed(2));
        const tvq_amount = parseFloat((amount_ht * tvq_rate).toFixed(2));
        const amount_ttc = parseFloat((amount_ht + tps_amount + tvq_amount).toFixed(2));

        // Generate quote number
        const year = new Date().getFullYear();
        const countResult = await pool.query(
            "SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at) = $1",
            [year]
        );
        const quoteNumber = `D-${year}-${String(parseInt(countResult.rows[0].count) + 1).padStart(3, '0')}`;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiry_days);

        const result = await pool.query(
            `INSERT INTO quotes 
       (client_id, quote_number, title, description, service_type,
        amount_ht, tps_amount, tvq_amount, amount_ttc, 
        status, expiry_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW())
       RETURNING *`,
            [client_id, quoteNumber, title, description, service_type,
                amount_ht, tps_amount, tvq_amount, amount_ttc, expiryDate]
        );

        res.status(201).json({
            success: true,
            message: 'Quote created successfully.',
            quote: result.rows[0]
        });

    } catch (error) {
        console.error('Create quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/quotes/:id/accept — client accepts quote
router.put('/:id/accept', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE quotes 
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND client_id = $2 AND status = 'pending'
       RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found or already processed.'
            });
        }

        res.json({
            success: true,
            message: 'Quote accepted successfully.',
            quote: result.rows[0]
        });

    } catch (error) {
        console.error('Accept quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/quotes/:id/decline — client declines quote
router.put('/:id/decline', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE quotes 
       SET status = 'declined', updated_at = NOW()
       WHERE id = $1 AND client_id = $2 AND status = 'pending'
       RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found or already processed.'
            });
        }

        res.json({
            success: true,
            message: 'Quote declined.',
            quote: result.rows[0]
        });

    } catch (error) {
        console.error('Decline quote error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;