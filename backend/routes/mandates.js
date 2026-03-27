/* ============================================
   VNK Automatisation Inc. - Mandates Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/mandates — get client mandates
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, description, service_type,
              status, start_date, end_date, notes, created_at
       FROM mandates
       WHERE client_id = $1
       ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            count: result.rows.length,
            mandates: result.rows
        });

    } catch (error) {
        console.error('Get mandates error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/mandates/:id — get single mandate
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.*, 
              json_agg(
                json_build_object(
                  'id', ml.id,
                  'date', ml.log_date,
                  'description', ml.description,
                  'hours', ml.hours_spent
                ) ORDER BY ml.log_date DESC
              ) as logs
       FROM mandates m
       LEFT JOIN mandate_logs ml ON m.id = ml.mandate_id
       WHERE m.id = $1 AND m.client_id = $2
       GROUP BY m.id`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mandate not found.'
            });
        }

        res.json({
            success: true,
            mandate: result.rows[0]
        });

    } catch (error) {
        console.error('Get mandate error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;