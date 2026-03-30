/* ============================================
   VNK Automatisation Inc. - Documents Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/documents — get client documents
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.id, d.title, d.description, d.file_type,
                    d.file_name, d.file_url, d.file_size,
                    d.uploaded_by, d.created_at,
                    d.category, d.status, d.is_read,
                    m.title as mandate_title
             FROM documents d
             LEFT JOIN mandates m ON d.mandate_id = m.id
             WHERE d.client_id = $1
             ORDER BY d.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            count: result.rows.length,
            documents: result.rows
        });

    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/documents/:id/read — marquer un document comme lu
router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`).catch(() => { });
        await pool.query(
            'UPDATE documents SET is_read = true WHERE id = $1 AND client_id = $2',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.json({ success: true });
    }
});

// GET /api/documents/:id — download document
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM documents 
             WHERE id = $1 AND client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const doc = result.rows[0];

        if (doc.file_url) {
            return res.redirect(doc.file_url);
        }

        res.status(404).json({ success: false, message: 'File not available.' });

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;