/* ============================================
   VNK Automatisation Inc. — Messages Routes
   Chat client ↔ VNK (portail + admin)
   v3.0 — WebSocket temps réel
============================================ */
'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
let _email = null;
try { _email = require('../email'); } catch (e) { }
const { authenticateToken } = require('../middleware/auth');

// ── WebSocket broadcast ──
let _wsBroadcast = null;
try { _wsBroadcast = require('../ws-server').broadcast; } catch (e) { }
const wsBroadcast = (opts) => { if (_wsBroadcast) { try { _wsBroadcast(opts); } catch (e) { } } };

// ── Middleware admin ──
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Non autorisé.' });
    const token = authHeader.split(' ')[1];
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vnk_secret_2024');
        if (!decoded.isAdmin) return res.status(403).json({ success: false, message: 'Accès refusé.' });
        req.admin = decoded;
        next();
    } catch (e) {
        res.status(401).json({ success: false, message: 'Token invalide.' });
    }
}

// ════════════════════════════════════════
// ROUTES CLIENT (portail)
// ════════════════════════════════════════

// GET / — liste des messages du client connecté
// ?markRead=true → marque les messages VNK comme lus (chat ouvert)
// Sans paramètre → retourne les messages SANS changer is_read (pour le badge)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, sender, content, attachment_data, is_read, created_at
             FROM messages
             WHERE client_id = $1
             ORDER BY created_at ASC`,
            [req.user.id]
        );

        // Marquer lu SEULEMENT si le client a explicitement ouvert le chat
        if (req.query.markRead === 'true') {
            await pool.query(
                `UPDATE messages SET is_read = true
                 WHERE client_id = $1 AND sender = 'vnk' AND is_read = false`,
                [req.user.id]
            );
            // Retourner avec is_read=true mis à jour
            result.rows.forEach(m => { if (m.sender === 'vnk') m.is_read = true; });
        }

        res.json({ success: true, messages: result.rows });
    } catch (e) {
        console.error('GET /api/messages error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST / — envoyer un message (client → VNK)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: 'Message vide.' });
        }

        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read)
             VALUES ($1, 'client', $2, false)
             RETURNING id, sender, content, is_read, created_at`,
            [req.user.id, String(content).trim()]
        );

        const msg = result.rows[0];

        // Notifier l'admin en temps réel
        wsBroadcast({
            event: 'new_message_client',
            data: { message: msg, clientId: req.user.id },
            adminOnly: true
        });

        res.json({ success: true, message: msg });
        // Notifier admin par email
        if (_email) {
            pool.query('SELECT * FROM clients WHERE id=$1', [req.user.id]).then(r => {
                if (r.rows[0]) _email.notifyAdmin(_email.tplAdminNewMessage(r.rows[0], msg)).catch(() => { });
            }).catch(() => { });
        }
    } catch (e) {
        console.error('POST /api/messages error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ════════════════════════════════════════
// ROUTES ADMIN
// ════════════════════════════════════════

// GET /admin/unread-count — nombre de messages non lus (badge sidebar)
router.get('/admin/unread-count', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) FROM messages WHERE sender = 'client' AND is_read = false`
        );
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /admin/:clientId — tous les messages d'un client (vue admin)
router.get('/admin/:clientId', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, sender, content, attachment_data, is_read, created_at
             FROM messages
             WHERE client_id = $1
             ORDER BY created_at ASC`,
            [req.params.clientId]
        );
        res.json({ success: true, messages: result.rows });
    } catch (e) {
        console.error('GET /api/messages/admin/:id error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /admin/:clientId — VNK répond au client
router.post('/admin/:clientId', authenticateAdmin, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: 'Message vide.' });
        }

        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read)
             VALUES ($1, 'vnk', $2, false)
             RETURNING id, sender, content, is_read, created_at`,
            [req.params.clientId, String(content).trim()]
        );

        const msg = result.rows[0];

        // Notifier le client en temps réel
        wsBroadcast({
            event: 'new_message_vnk',
            data: { message: msg },
            clientId: String(req.params.clientId),
            notifyAdmin: false
        });

        res.json({ success: true, message: msg });
    } catch (e) {
        console.error('POST /api/messages/admin/:id error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /admin/:clientId/mark-read — marquer messages du client comme lus
router.put('/admin/:clientId/mark-read', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(
            `UPDATE messages SET is_read = true
             WHERE client_id = $1 AND sender = 'client' AND is_read = false`,
            [req.params.clientId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /admin/mark-all-read — tout marquer lu
router.put('/admin/mark-all-read', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(
            `UPDATE messages SET is_read = true WHERE sender = 'client' AND is_read = false`
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;