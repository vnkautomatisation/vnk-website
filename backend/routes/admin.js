/* ============================================
   VNK Automatisation Inc. - Admin Routes
   Version Phase 1 — Remboursements, Litiges,
   Déclarations fiscales, Dépenses, Contrats
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// ---------- Middleware admin auth ----------
function authenticateAdmin(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access denied.' });
    }
    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.isAdmin) return res.status(403).json({ success: false, message: 'Access denied.' });
        req.admin = decoded;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
}

// ============================================
// POST /api/admin/login
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Courriel et mot de passe requis.' });
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@vnk.ca';
        const adminPassword = process.env.ADMIN_PASSWORD || 'VNKAdmin2026!';
        if (email.toLowerCase().trim() !== adminEmail.toLowerCase()) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
        }
        if (password !== adminPassword) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
        }
        const token = jwt.sign({ email: adminEmail, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token, admin: { email: adminEmail, name: 'Yan Verone' } });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/admin/dashboard
// ============================================
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const [clients, mandates, invoicesUnpaid, monthRevenue, pendingQuotes, unreadMsgs, openDisputes, activity] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM clients WHERE is_active = true"),
            pool.query("SELECT COUNT(*) FROM mandates WHERE status IN ('active','in_progress')"),
            pool.query("SELECT COUNT(*), COALESCE(SUM(amount_ttc),0) as total FROM invoices WHERE status = 'unpaid'"),
            pool.query(`SELECT COALESCE(SUM(amount_ttc),0) as total FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM NOW())`),
            pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'pending'"),
            pool.query("SELECT COUNT(*) FROM messages WHERE sender='client' AND is_read=false"),
            pool.query("SELECT COUNT(*) FROM disputes WHERE status IN ('open','in_progress') LIMIT 1").catch(() => ({ rows: [{ count: 0 }] })),
            pool.query(`
                SELECT 'invoice' as type, CONCAT('Facture ', i.invoice_number, ' — ', i.title) as description, i.amount_ttc as amount, i.status, i.created_at as date, c.full_name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id
                UNION ALL
                SELECT 'quote' as type, CONCAT('Devis ', q.quote_number, ' — ', q.title) as description, q.amount_ttc as amount, q.status, q.created_at as date, c.full_name as client_name FROM quotes q JOIN clients c ON q.client_id = c.id
                UNION ALL
                SELECT 'mandate' as type, CONCAT('Mandat : ', m.title) as description, NULL as amount, m.status, m.updated_at as date, c.full_name as client_name FROM mandates m JOIN clients c ON m.client_id = c.id
                ORDER BY date DESC LIMIT 15`)
        ]);

        res.json({
            success: true,
            stats: {
                clients: parseInt(clients.rows[0].count),
                activeMandates: parseInt(mandates.rows[0].count),
                unpaidInvoices: parseInt(invoicesUnpaid.rows[0].count),
                unpaidAmount: parseFloat(invoicesUnpaid.rows[0].total),
                monthRevenue: parseFloat(monthRevenue.rows[0].total),
                pendingQuotes: parseInt(pendingQuotes.rows[0].count),
                unreadMessages: parseInt(unreadMsgs.rows[0].count),
                openDisputes: parseInt(openDisputes.rows[0].count)
            },
            activity: activity.rows
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/admin/unread-count — polling rapide
// ============================================
router.get('/unread-count', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT COUNT(*) FROM messages WHERE sender='client' AND is_read=false"
        );
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// CLIENTS
// ============================================
router.get('/clients', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, company_name, phone,
                    address, city, province, postal_code,
                    sector, technologies, internal_notes,
                    is_active, last_login, created_at
             FROM clients ORDER BY created_at DESC`
        );
        res.json({ success: true, clients: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/clients', authenticateAdmin, async (req, res) => {
    try {
        const { full_name, email, password, company_name, phone, address, city, province, postal_code, sector, technologies, internal_notes } = req.body;
        if (!full_name || !email || !password) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const existing = await pool.query('SELECT id FROM clients WHERE email = $1', [email.toLowerCase().trim()]);
        if (existing.rows.length) return res.status(409).json({ success: false, message: 'Ce courriel existe déjà.' });
        const hash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO clients (full_name, email, password_hash, company_name, phone, address, city, province, postal_code, sector, technologies, internal_notes, is_active, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,NOW()) RETURNING id, full_name, email, company_name`,
            [full_name, email.toLowerCase().trim(), hash, company_name || null, phone || null, address || null, city || null, province || 'QC', postal_code || null, sector || null, technologies || null, internal_notes || null]
        );
        res.status(201).json({ success: true, client: result.rows[0] });
    } catch (err) {
        console.error('Admin create client error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// MANDATES
// ============================================
router.get('/mandates', authenticateAdmin, async (req, res) => {
    try {
        const clientFilter = req.query.client_id ? 'WHERE m.client_id = $1' : '';
        const params = req.query.client_id ? [req.query.client_id] : [];
        const result = await pool.query(
            `SELECT m.*, c.full_name as client_name, c.company_name FROM mandates m JOIN clients c ON m.client_id = c.id ${clientFilter} ORDER BY m.created_at DESC`, params
        );
        res.json({ success: true, mandates: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/mandates', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, title, description, service_type, status, progress, start_date, end_date, notes } = req.body;
        if (!client_id || !title) return res.status(400).json({ success: false, message: 'Client et titre requis.' });
        const result = await pool.query(
            `INSERT INTO mandates (client_id, title, description, service_type, status, progress, start_date, end_date, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
            [client_id, title, description || null, service_type || 'plc-support', status || 'active', progress || 0, start_date || null, end_date || null, notes || null]
        );
        res.status(201).json({ success: true, mandate: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/mandates/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, progress, notes } = req.body;
        const result = await pool.query(
            `UPDATE mandates SET status=$1, progress=$2, notes=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
            [status, progress, notes || null, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Mandat non trouvé.' });
        res.json({ success: true, mandate: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// QUOTES
// ============================================
router.get('/quotes', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT q.*, c.full_name as client_name, c.company_name FROM quotes q JOIN clients c ON q.client_id = c.id ORDER BY q.created_at DESC`);
        res.json({ success: true, quotes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/quotes', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, title, description, amount_ht, service_type, expiry_days = 30 } = req.body;
        if (!client_id || !title || !amount_ht) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `D-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const expiry = new Date(); expiry.setDate(expiry.getDate() + parseInt(expiry_days));
        const result = await pool.query(
            `INSERT INTO quotes (client_id,quote_number,title,description,service_type,amount_ht,tps_amount,tvq_amount,amount_ttc,status,expiry_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,NOW()) RETURNING *`,
            [client_id, num, title, description || null, service_type || null, amount_ht, tps, tvq, ttc, expiry]
        );
        res.status(201).json({ success: true, quote: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/quotes/:id/expire', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(`UPDATE quotes SET status='expired', updated_at=NOW() WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// INVOICES
// ============================================
router.get('/invoices', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT i.*, c.full_name as client_name, c.company_name FROM invoices i JOIN clients c ON i.client_id = c.id ORDER BY i.created_at DESC`);
        res.json({ success: true, invoices: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/invoices', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, title, description, amount_ht, due_days = 30 } = req.body;
        if (!client_id || !title || !amount_ht) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `F-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const due = new Date(); due.setDate(due.getDate() + parseInt(due_days));
        const result = await pool.query(
            `INSERT INTO invoices (client_id,invoice_number,title,description,amount_ht,tps_amount,tvq_amount,amount_ttc,status,due_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'unpaid',$9,NOW()) RETURNING *`,
            [client_id, num, title, description || null, amount_ht, tps, tvq, ttc, due]
        );
        res.status(201).json({ success: true, invoice: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/invoices/:id/mark-paid', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Facture non trouvée.' });
        await pool.query(`INSERT INTO payments (invoice_id, amount, status, paid_at) VALUES ($1,$2,'completed',NOW())`, [req.params.id, result.rows[0].amount_ttc]);
        res.json({ success: true, invoice: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// REFUNDS — Remboursements
// ============================================
router.get('/refunds', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*, c.full_name as client_name, i.invoice_number
             FROM refunds r
             JOIN clients c ON r.client_id = c.id
             LEFT JOIN invoices i ON r.invoice_id = i.id
             ORDER BY r.created_at DESC`
        );
        res.json({ success: true, refunds: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/refunds', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, invoice_id, reason, amount, notes } = req.body;
        if (!client_id || !reason || !amount) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const tps = parseFloat((amount * 0.05).toFixed(2));
        const tvq = parseFloat((amount * 0.09975).toFixed(2));
        const total = parseFloat((parseFloat(amount) + tps + tvq).toFixed(2));
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM refunds WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `RMB-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const result = await pool.query(
            `INSERT INTO refunds (client_id, invoice_id, refund_number, reason, amount, tps_amount, tvq_amount, total_amount, status, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW()) RETURNING *`,
            [client_id, invoice_id || null, num, reason, amount, tps, tvq, total, notes || null]
        );
        res.status(201).json({ success: true, refund: result.rows[0] });
    } catch (err) {
        console.error('Create refund error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/refunds/:id/process', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE refunds SET status='processed', processed_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Remboursement non trouvé.' });
        res.json({ success: true, refund: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// DISPUTES — Litiges
// ============================================
router.get('/disputes', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.*, c.full_name as client_name, c.company_name,
                    i.invoice_number, m.title as mandate_title
             FROM disputes d
             JOIN clients c ON d.client_id = c.id
             LEFT JOIN invoices i ON d.invoice_id = i.id
             LEFT JOIN mandates m ON d.mandate_id = m.id
             ORDER BY d.opened_at DESC`
        );
        res.json({ success: true, disputes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/disputes', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, invoice_id, mandate_id, title, description, priority } = req.body;
        if (!client_id || !title || !description) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const result = await pool.query(
            `INSERT INTO disputes (client_id, invoice_id, mandate_id, title, description, status, priority, opened_at, created_at)
             VALUES ($1,$2,$3,$4,$5,'open',$6,NOW(),NOW()) RETURNING *`,
            [client_id, invoice_id || null, mandate_id || null, title, description, priority || 'medium']
        );
        res.status(201).json({ success: true, dispute: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/disputes/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, resolution } = req.body;
        const resolved_at = status === 'resolved' ? 'NOW()' : 'NULL';
        const result = await pool.query(
            `UPDATE disputes SET status=$1, resolution=$2, resolved_at=${status === 'resolved' ? 'NOW()' : 'resolved_at'} WHERE id=$3 RETURNING *`,
            [status, resolution || null, req.params.id]
        );
        res.json({ success: true, dispute: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// CONTRACTS — Contrats
// ============================================
router.get('/contracts', authenticateAdmin, async (req, res) => {
    try {
        const clientFilter = req.query.client_id ? 'WHERE ct.client_id = $1' : '';
        const params = req.query.client_id ? [req.query.client_id] : [];
        const result = await pool.query(
            `SELECT ct.*, c.full_name as client_name, c.company_name,
                    m.title as mandate_title, q.quote_number
             FROM contracts ct
             JOIN clients c ON ct.client_id = c.id
             LEFT JOIN mandates m ON ct.mandate_id = m.id
             LEFT JOIN quotes q ON ct.quote_id = q.id
             ${clientFilter}
             ORDER BY ct.created_at DESC`,
            params
        );
        res.json({ success: true, contracts: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/contracts', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, mandate_id, quote_id, title, content, file_url } = req.body;
        if (!client_id || !title) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `CT-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const result = await pool.query(
            `INSERT INTO contracts (client_id, mandate_id, quote_id, contract_number, title, content, file_url, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',NOW(),NOW()) RETURNING *`,
            [client_id, mandate_id || null, quote_id || null, num, title, content || null, file_url || null]
        );
        res.status(201).json({ success: true, contract: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/contracts/:id/sign', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE contracts SET status='signed', signed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        res.json({ success: true, contract: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// EXPENSES — Dépenses professionnelles
// ============================================
router.get('/expenses', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM expenses ORDER BY expense_date DESC`
        );
        const totals = await pool.query(
            `SELECT 
                COALESCE(SUM(amount),0) as total_ht,
                COALESCE(SUM(tps_paid),0) as total_tps,
                COALESCE(SUM(tvq_paid),0) as total_tvq
             FROM expenses`
        );
        res.json({ success: true, expenses: result.rows, totals: totals.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/expenses', authenticateAdmin, async (req, res) => {
    try {
        const { title, category, amount, tps_paid, tvq_paid, vendor, receipt_url, expense_date, notes } = req.body;
        if (!title || !amount || !expense_date) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const result = await pool.query(
            `INSERT INTO expenses (title, category, amount, tps_paid, tvq_paid, vendor, receipt_url, expense_date, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
            [title, category || null, amount, tps_paid || 0, tvq_paid || 0, vendor || null, receipt_url || null, expense_date, notes || null]
        );
        res.status(201).json({ success: true, expense: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.delete('/expenses/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// TAX DECLARATIONS — Déclarations fiscales
// ============================================
router.get('/tax-declarations', authenticateAdmin, async (req, res) => {
    try {
        const decls = await pool.query(`SELECT * FROM tax_declarations ORDER BY period_start DESC`);
        // Données pour générer automatiquement les périodes
        const summary = await pool.query(`
            SELECT 
                EXTRACT(QUARTER FROM created_at) as quarter,
                EXTRACT(YEAR FROM created_at) as year,
                COALESCE(SUM(amount_ht),0) as revenue_ht,
                COALESCE(SUM(tps_amount),0) as tps,
                COALESCE(SUM(tvq_amount),0) as tvq,
                COALESCE(SUM(amount_ttc),0) as ttc
            FROM invoices
            WHERE status = 'paid'
            GROUP BY quarter, year
            ORDER BY year DESC, quarter DESC
        `);
        res.json({ success: true, declarations: decls.rows, quarterSummary: summary.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/tax-declarations', authenticateAdmin, async (req, res) => {
    try {
        const { period_type, period_label, period_start, period_end, notes } = req.body;
        // Calculer les montants automatiquement depuis la base
        const revenue = await pool.query(
            `SELECT COALESCE(SUM(amount_ht),0) as ht, COALESCE(SUM(tps_amount),0) as tps, COALESCE(SUM(tvq_amount),0) as tvq
             FROM invoices WHERE status='paid' AND created_at >= $1 AND created_at <= $2`,
            [period_start, period_end]
        );
        const r = revenue.rows[0];
        const result = await pool.query(
            `INSERT INTO tax_declarations (period_type, period_label, period_start, period_end, total_revenue_ht, total_tps, total_tvq, total_taxes, status, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,NOW()) RETURNING *`,
            [period_type, period_label, period_start, period_end, r.ht, r.tps, r.tvq, parseFloat(r.tps) + parseFloat(r.tvq), notes || null]
        );
        res.status(201).json({ success: true, declaration: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/tax-declarations/:id/submit', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE tax_declarations SET status='submitted', submitted_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        res.json({ success: true, declaration: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// DOCUMENTS
// ============================================
router.get('/documents', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.*, c.full_name as client_name, m.title as mandate_title FROM documents d JOIN clients c ON d.client_id = c.id LEFT JOIN mandates m ON d.mandate_id = m.id ORDER BY d.created_at DESC`
        );
        res.json({ success: true, documents: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/documents', authenticateAdmin, async (req, res) => {
    try {
        const { client_id, mandate_id, title, description, file_type, file_name, file_url, file_size } = req.body;
        if (!client_id || !title || !file_name) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const result = await pool.query(
            `INSERT INTO documents (client_id,mandate_id,title,description,file_type,file_name,file_url,file_size,uploaded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'vnk',NOW()) RETURNING *`,
            [client_id, mandate_id || null, title, description || null, file_type || 'pdf', file_name, file_url || null, file_size || null]
        );
        res.status(201).json({ success: true, document: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.delete('/documents/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM documents WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// MESSAGES + polling
// ============================================
router.get('/messages', authenticateAdmin, async (req, res) => {
    try {
        const allClients = await pool.query(
            `SELECT DISTINCT c.id, c.full_name, c.company_name FROM clients c JOIN messages m ON m.client_id = c.id ORDER BY c.full_name`
        );
        const threads = await Promise.all(allClients.rows.map(async (c) => {
            const msgs = await pool.query(`SELECT * FROM messages WHERE client_id=$1 ORDER BY created_at ASC`, [c.id]);
            const unread = await pool.query(`SELECT COUNT(*) FROM messages WHERE client_id=$1 AND sender='client' AND is_read=false`, [c.id]);
            return { client_id: c.id, client_name: c.full_name, company_name: c.company_name, messages: msgs.rows, unread_count: parseInt(unread.rows[0].count) };
        }));
        res.json({ success: true, threads });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/messages/:clientId', authenticateAdmin, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ success: false, message: 'Message vide.' });
        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW()) RETURNING *`,
            [req.params.clientId, content.trim()]
        );
        await pool.query(`UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`, [req.params.clientId]);
        res.status(201).json({ success: true, message: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PAYMENTS
// ============================================
router.get('/payments', authenticateAdmin, async (req, res) => {
    try {
        const [invoices, totals] = await Promise.all([
            pool.query(`SELECT i.*, c.full_name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id ORDER BY i.created_at DESC`),
            pool.query(`SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount_ttc END),0) as total_paid, COALESCE(SUM(CASE WHEN status='unpaid' THEN amount_ttc END),0) as total_unpaid, COALESCE(SUM(amount_ttc),0) as total_invoiced FROM invoices`)
        ]);
        res.json({ success: true, invoices: invoices.rows, totalPaid: parseFloat(totals.rows[0].total_paid), totalUnpaid: parseFloat(totals.rows[0].total_unpaid), totalInvoiced: parseFloat(totals.rows[0].total_invoiced) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;