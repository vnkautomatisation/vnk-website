/* ============================================
   VNK Automatisation Inc. - Clients Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/clients/dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const clientId = req.user.id;

        // Get counts for dashboard
        const [mandates, quotes, invoices, messages, contracts, unreadDocs] = await Promise.all([
            pool.query(
                "SELECT COUNT(*) FROM mandates WHERE client_id = $1 AND status IN ('active', 'in_progress')",
                [clientId]
            ),
            pool.query(
                "SELECT COUNT(*) FROM quotes WHERE client_id = $1 AND status = 'pending'",
                [clientId]
            ),
            pool.query(
                "SELECT COUNT(*) FROM invoices WHERE client_id = $1 AND status = 'unpaid'",
                [clientId]
            ),
            pool.query(
                "SELECT COUNT(*) FROM messages WHERE client_id = $1 AND is_read = false AND sender = 'vnk'",
                [clientId]
            ),
            pool.query(
                "SELECT COUNT(*) FROM contracts WHERE client_id = $1 AND status IN ('draft','pending','pending_signature')",
                [clientId]
            ),
            pool.query(
                "SELECT COUNT(*) FROM documents WHERE client_id = $1 AND (is_read = false OR is_read IS NULL)",
                [clientId]
            ).catch(() => ({ rows: [{ count: 0 }] }))
        ]);

        // Get recent activity
        const activity = await pool.query(
            `SELECT 
        'invoice' as type,
        CONCAT('Facture ', invoice_number, ' — ', title) as description,
        amount_ttc as amount,
        status,
        created_at as date
    FROM invoices WHERE client_id = $1
    UNION ALL
    SELECT 
        'quote' as type,
        CONCAT('Devis ', quote_number, ' — ', title) as description,
        amount_ttc as amount,
        status,
        created_at as date
    FROM quotes WHERE client_id = $1
    UNION ALL
    SELECT 
        'mandate' as type,
        CONCAT('Mandat : ', title) as description,
        NULL as amount,
        status,
        updated_at as date
    FROM mandates WHERE client_id = $1
    ORDER BY date DESC LIMIT 10`,
            [clientId]
        );

        res.json({
            success: true,
            activeMandates: parseInt(mandates.rows[0].count),
            pendingQuotes: parseInt(quotes.rows[0].count),
            pendingInvoices: parseInt(invoices.rows[0].count),
            unreadMessages: parseInt(messages.rows[0].count),
            pendingContracts: parseInt(contracts.rows[0].count),
            unreadDocuments: parseInt(unreadDocs.rows[0].count),
            recentActivity: activity.rows
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

// POST /api/clients — create new client (admin)
router.post('/', async (req, res) => {
    try {
        const { full_name, email, password, company_name, phone } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required.'
            });
        }

        // Check if email already exists
        const existing = await pool.query(
            'SELECT id FROM clients WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A client with this email already exists.'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO clients (full_name, email, password_hash, company_name, phone, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id, full_name, email, company_name, phone, created_at`,
            [full_name, email.toLowerCase().trim(), passwordHash, company_name, phone]
        );

        res.status(201).json({
            success: true,
            message: 'Client created successfully.',
            client: result.rows[0]
        });

    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

// GET /api/clients — list all clients (admin)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, company_name, phone, is_active, 
              last_login, created_at 
       FROM clients 
       ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            count: result.rows.length,
            clients: result.rows
        });

    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;