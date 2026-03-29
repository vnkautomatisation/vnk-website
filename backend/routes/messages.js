/* ============================================
   VNK Automatisation Inc. - Messages Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/messages — get client messages
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, sender, content, is_read, created_at
       FROM messages
       WHERE client_id = $1
       ORDER BY created_at ASC`,
            [req.user.id]
        );

        // Mark messages from VNK as read
        await pool.query(
            `UPDATE messages 
       SET is_read = true 
       WHERE client_id = $1 AND sender = 'vnk' AND is_read = false`,
            [req.user.id]
        );

        res.json({
            success: true,
            count: result.rows.length,
            messages: result.rows
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/messages — send message
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message content is required.'
            });
        }

        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at)
       VALUES ($1, 'client', $2, false, NOW())
       RETURNING *`,
            [req.user.id, content.trim()]
        );

        res.status(201).json({
            success: true,
            message: result.rows[0]
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/messages/upload — upload file/audio
router.post('/upload', authenticateToken, async (req, res) => {
    try {
        // Multer non configuré — stocker en base64 dans le content du message
        // Pour l'instant, retourner une URL blob (le frontend gère localement)
        res.json({
            success: false,
            message: 'Upload serveur non configuré. Utiliser URL locale.'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;