/* ============================================
   VNK Automatisation Inc. - Admin Routes
   Version Phase 2 — Toutes fonctionnalités
   + Toggle archive client
   + Mark messages as read (thread + all)
   + Export CSV (via frontend)
   + Contrats, Litiges, Remboursements,
     Dépenses, Déclarations fiscales
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const pdfTemplates = require('./pdf-templates');

// ── WebSocket broadcast (optionnel) ──
let _wsBroadcast = null;
let _email = null;
try { _email = require('../email'); } catch (e) { console.warn('[email] Module non disponible:', e.message); }
try { _wsBroadcast = require('../ws-server').broadcast; } catch (e) { }
const wsBroadcast = (opts) => { if (_wsBroadcast) { try { _wsBroadcast(opts); } catch (e) { } } };

// ── Notification client interne ──

async function _autoCreateInvoice(pool, contract) {
    try {
        await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id INTEGER`).catch(() => { });
        const existing = await pool.query(`SELECT id FROM invoices WHERE contract_id=$1`, [contract.id]).catch(() => ({ rows: [] }));
        if (existing.rows.length) return;
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = parseInt(count.rows[0].count) + 1;
        const invoice_number = `F-${year}-${String(num).padStart(3, '0')}`;
        const due = new Date(); due.setDate(due.getDate() + 30);
        let amount_ht = 0, tps = 0, tvq = 0, amount_ttc = 0;
        if (contract.quote_id) {
            const q = await pool.query('SELECT * FROM quotes WHERE id=$1', [contract.quote_id]).catch(() => ({ rows: [] }));
            if (q.rows[0]) { amount_ht = q.rows[0].amount_ht || 0; tps = q.rows[0].tps_amount || 0; tvq = q.rows[0].tvq_amount || 0; amount_ttc = q.rows[0].amount_ttc || 0; }
        }
        await pool.query(
            `INSERT INTO invoices (client_id,contract_id,invoice_number,title,description,amount_ht,tps_amount,tvq_amount,amount_ttc,status,due_date,created_at,updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid',$10,NOW(),NOW())`,
            [contract.client_id, contract.id, invoice_number,
            `Contrat de service — ${contract.title || contract.contract_number}`,
            `Conformément au contrat ${contract.contract_number}`,
                amount_ht, tps, tvq, amount_ttc, due.toISOString().split('T')[0]]
        );
        console.log(`[workflow] Facture ${invoice_number} créée pour contrat ${contract.contract_number}`);
        if (_email) {
            pool.query('SELECT * FROM invoices WHERE invoice_number=$1', [invoice_number]).then(r => {
                const invRow = r.rows[0];
                pool.query('SELECT * FROM clients WHERE id=$1', [contract.client_id]).then(cr => {
                    const cl = cr.rows[0];
                    if (invRow && cl) {
                        _email.sendEmail(cl.email, _email.tplNewInvoice(cl, invRow)).catch(() => { });
                        pool.query(`INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW())`,
                            [contract.client_id, `Votre facture ${invoice_number} a été générée suite à la signature du contrat ${contract.contract_number}. Réglez-la depuis votre portail.`]).catch(() => { });
                        wsBroadcast({ event: 'new_invoice', clientId: contract.client_id, data: { invoice: invRow } });
                    }
                }).catch(() => { });
            }).catch(() => { });
        }
    } catch (e) { console.warn('[workflow] Facture auto error:', e.message); }
}

async function _notifyFull(pool, clientId, { chatMsg, wsEvent, wsData, emailFn }) {
    // 1. Message chat (portail)
    if (chatMsg) {
        try {
            await pool.query(`INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW())`, [clientId, chatMsg]);
        } catch (e) { console.warn('[notify] chat error:', e.message); }
    }
    // 2. WebSocket (notification temps réel)
    if (wsEvent) {
        try { wsBroadcast({ event: wsEvent, clientId, data: wsData || {} }); } catch (_) { }
    }
    // 3. Email
    if (emailFn && _email) {
        try {
            const cl = await pool.query('SELECT * FROM clients WHERE id=$1', [clientId]);
            if (cl.rows.length) await _email.sendEmail(cl.rows[0].email, emailFn(cl.rows[0]));
        } catch (e) { console.warn('[notify] email error:', e.message); }
    }
}

async function notifyClient(pool, clientId, content) {
    try {
        await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW())`,
            [clientId, content]
        );
    } catch (e) {
        console.warn('[notify] failed:', e.message);
    }
}

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
            pool.query("SELECT COUNT(*) FROM disputes WHERE status IN ('open','in_progress')").catch(() => ({ rows: [{ count: 0 }] })),
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
// PUT /api/admin/clients/:id/toggle-active — Archiver/Réactiver
// ============================================
router.put('/clients/:id/toggle-active', authenticateAdmin, async (req, res) => {
    try {
        const current = await pool.query('SELECT is_active FROM clients WHERE id = $1', [req.params.id]);
        if (!current.rows.length) return res.status(404).json({ success: false, message: 'Client non trouvé.' });
        const newStatus = !current.rows[0].is_active;
        const result = await pool.query(
            'UPDATE clients SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, is_active',
            [newStatus, req.params.id]
        );
        res.json({ success: true, client: result.rows[0], is_active: newStatus });
    } catch (err) {
        console.error('Toggle client active error:', err);
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
        const mNew = result.rows[0];
        res.status(201).json({ success: true, mandate: mNew });
        _notifyFull(pool, mNew.client_id, {
            chatMsg: 'Nouveau mandat créé : ' + mNew.title + '. Suivez son avancement depuis votre portail.',
            wsEvent: 'new_mandate', wsData: { mandate: mNew },
            emailFn: null
        });
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
        const mUpd = result.rows[0];
        res.json({ success: true, mandate: mUpd });
        if (mUpd && _email) {
            _notifyFull(pool, mUpd.client_id, {
                chatMsg: 'Mise à jour du mandat ' + mUpd.title + ' — Progression : ' + (mUpd.progress || 0) + '%' + (mUpd.notes ? ' — ' + mUpd.notes : ''),
                wsEvent: 'mandate_update', wsData: { mandate: mUpd },
                emailFn: (cl) => _email.tplMandateUpdate(cl, mUpd)
            });
        }
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
        const q = result.rows[0];
        res.status(201).json({ success: true, quote: q });
        // Notification chat + email
        _notifyFull(pool, q.client_id, {
            chatMsg: `📋 Nouveau devis *${q.quote_number}* — ${parseFloat(q.amount_ttc).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} — Valide jusqu'au ${q.expiry_date ? new Date(q.expiry_date).toLocaleDateString('fr-CA') : '—'}. Acceptez-le depuis votre portail.`,
            wsEvent: 'new_quote',
            wsData: { quote: q },
            emailFn: (cl) => _email.tplNewQuote(cl, q)
        });
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
        const inv = result.rows[0];
        res.status(201).json({ success: true, invoice: inv });
        _notifyFull(pool, inv.client_id, {
            chatMsg: `🧾 Nouvelle facture *${inv.invoice_number}* — ${parseFloat(inv.amount_ttc).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}. Réglez-la depuis votre portail.`,
            wsEvent: 'new_invoice',
            wsData: { invoice: inv },
            emailFn: (cl) => _email && _email.tplNewInvoice(cl, inv)
        });
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
        const result = await pool.query(
            `UPDATE disputes SET status=$1, resolution=$2,
             resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
             WHERE id=$3 RETURNING *`,
            [status, resolution || null, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Litige non trouvé.' });
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
        const { client_id, mandate_id, quote_id, title, content, file_url, status } = req.body;
        if (!client_id || !title) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const contractStatus = ['draft', 'pending', 'pending_signature'].includes(status) ? status : 'pending';
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `CT-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const result = await pool.query(
            `INSERT INTO contracts (client_id, mandate_id, quote_id, contract_number, title, content, file_url, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
            [client_id, mandate_id || null, quote_id || null, num, title, content || null, file_url || null, contractStatus]
        );
        res.status(201).json({ success: true, contract: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/contracts/:id/sign', authenticateAdmin, async (req, res) => {
    try {
        const current = await pool.query('SELECT * FROM contracts WHERE id=$1', [req.params.id]);
        if (!current.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        const c = current.rows[0];
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`).catch(() => { });
        const bothSigned = !!c.signed_at;
        const result = await pool.query(
            `UPDATE contracts SET admin_signed_at=NOW(), status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [bothSigned ? 'signed' : 'pending', req.params.id]
        );
        res.json({ success: true, contract: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /contracts/:id/admin-sign — signature canvas admin
router.put('/contracts/:id/admin-sign', authenticateAdmin, async (req, res) => {
    try {
        const { signature_data } = req.body;
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signature_data TEXT`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`).catch(() => { });
        // Récupérer l'état actuel
        const current = await pool.query('SELECT * FROM contracts WHERE id=$1', [req.params.id]);
        if (!current.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        const c = current.rows[0];
        // Status = signed seulement si le CLIENT a aussi signé
        const bothSigned = !!c.signed_at;
        let query, params;
        if (signature_data && signature_data.startsWith('data:image/')) {
            query = `UPDATE contracts SET admin_signed_at=NOW(), admin_signature_data=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *`;
            params = [signature_data, bothSigned ? 'signed' : 'pending', req.params.id];
        } else {
            query = `UPDATE contracts SET admin_signed_at=NOW(), status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`;
            params = [bothSigned ? 'signed' : 'pending', req.params.id];
        }
        const result = await pool.query(query, params);
        const contract = result.rows[0];
        // Notifier le client — silencieux si erreur
        try {
            await notifyClient(pool, contract.client_id,
                `Votre contrat ${contract.contract_number} — « ${contract.title} » a été signé par l'administrateur.\n\n${!bothSigned ? 'Il ne reste plus que votre signature pour finaliser le contrat.' : 'Le contrat est maintenant signé des deux parties.'}\n\nÉquipe VNK Automatisation Inc.`
            );
        } catch (notifErr) {
            console.warn('admin-sign notify error:', notifErr.message);
        }
        // Broadcast WS avant res.json pour éviter ERR_HTTP_HEADERS_SENT
        if (bothSigned) {
            _autoCreateInvoice(pool, contract);
            // Notifier contrat signé des deux parties
            _notifyFull(pool, contract.client_id, {
                chatMsg: `✅ Contrat *${contract.contract_number}* signé des deux parties ! Les travaux peuvent démarrer. Votre facture a été générée.`,
                wsEvent: 'contract_signed',
                wsData: { contract },
                emailFn: (cl) => _email.tplContractSigned(cl, contract)
            });
        } else {
            // Notifier que l'admin a signé, en attente client
            _notifyFull(pool, contract.client_id, {
                chatMsg: `✍️ VNK Automatisation a signé le contrat *${contract.contract_number}*. Votre signature est maintenant requise pour démarrer les travaux.`,
                wsEvent: 'contract_signed',
                wsData: { contract }
            });
        }
        return res.json({ success: true, contract, message: bothSigned ? 'Contrat signé des deux parties.' : 'Signature admin enregistrée — en attente du client.' });
    } catch (err) {
        console.error('admin-sign error:', err.message);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ============================================
// EXPENSES — Dépenses professionnelles
// ============================================
router.get('/expenses', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM expenses ORDER BY expense_date DESC`);
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
        const summary = await pool.query(`
            SELECT
                EXTRACT(QUARTER FROM paid_at) as quarter,
                EXTRACT(YEAR FROM paid_at) as year,
                COALESCE(SUM(amount_ht),0) as revenue_ht,
                COALESCE(SUM(tps_amount),0) as tps,
                COALESCE(SUM(tvq_amount),0) as tvq,
                COALESCE(SUM(amount_ttc),0) as ttc
            FROM invoices
            WHERE status = 'paid' AND paid_at IS NOT NULL
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
        if (!period_type || !period_label || !period_start || !period_end) {
            return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        }
        // Calculer automatiquement depuis la base
        const revenue = await pool.query(
            `SELECT COALESCE(SUM(amount_ht),0) as ht, COALESCE(SUM(tps_amount),0) as tps, COALESCE(SUM(tvq_amount),0) as tvq
             FROM invoices WHERE status='paid' AND paid_at >= $1 AND paid_at <= $2`,
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
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Déclaration non trouvée.' });
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
        const { client_id, mandate_id, title, description, file_type, file_name, file_url, file_data, file_size, category, status } = req.body;
        if (!client_id || !title) return res.status(400).json({ success: false, message: 'client_id et title requis.' });
        let finalUrl = file_url || null;
        if (file_data && !finalUrl) {
            const mimes = {
                pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip'
            };
            const ext = (file_type || 'other').toLowerCase();
            finalUrl = 'data:' + (mimes[ext] || 'application/octet-stream') + ';base64,' + file_data;
        }
        // Catégorie : exactement ce que l'admin a choisi
        const finalCategory = (category && category.trim()) ? category.trim() : null;
        // Statut : disponible_lu = déjà lu, sinon non lu (notifie le client)
        const finalStatus = (status === 'disponible_lu') ? 'disponible' : (status || 'disponible');
        const isRead = (status === 'disponible_lu');
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(100)`).catch(() => { });
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'disponible'`).catch(() => { });
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`).catch(() => { });
        const result = await pool.query(
            `INSERT INTO documents (client_id, mandate_id, title, description, file_type, file_name, file_url, file_size, category, status, is_read, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
            [client_id, mandate_id || null, title, description || null, file_type || 'other',
                file_name || title, finalUrl, file_size || null, finalCategory, finalStatus, isRead]
        );
        const doc = result.rows[0];
        res.status(201).json({ success: true, document: doc });
        // Notification chat + email (seulement si non lu = nouveau pour le client)
        if (!isRead) {
            const catLabel = finalCategory || 'document';
            _notifyFull(pool, client_id, {
                chatMsg: `📄 Nouveau document disponible : *${title}*${finalCategory ? ' (' + finalCategory + ')' : ''}. Consultez-le dans votre portail, section Documents.`,
                wsEvent: 'new_document',
                wsData: { document: doc },
                emailFn: (cl) => _email.tplNewDocument(cl, doc)
            });
        }
    } catch (err) {
        console.error('POST document error:', err);
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
// MESSAGES + polling + mark-read
// ============================================
router.get('/messages', authenticateAdmin, async (req, res) => {
    try {
        const allClients = await pool.query(
            `SELECT DISTINCT c.id, c.full_name, c.company_name
             FROM clients c
             JOIN messages m ON m.client_id = c.id
             ORDER BY c.full_name`
        );
        const threads = await Promise.all(allClients.rows.map(async (c) => {
            const msgs = await pool.query(`SELECT id, client_id, sender, content, attachment_data, is_read, channel, created_at FROM messages WHERE client_id=$1 ORDER BY created_at ASC`, [c.id]);
            const unread = await pool.query(`SELECT COUNT(*) FROM messages WHERE client_id=$1 AND sender='client' AND is_read=false`, [c.id]);
            return {
                client_id: c.id,
                client_name: c.full_name,
                company_name: c.company_name,
                messages: msgs.rows,
                unread_count: parseInt(unread.rows[0].count)
            };
        }));
        res.json({ success: true, threads });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/messages/:clientId', authenticateAdmin, async (req, res) => {
    try {
        const { content, channel = 'chat' } = req.body;
        if (!content) return res.status(400).json({ success: false, message: 'Message vide.' });

        // Ajouter colonne channel si pas encore présente
        await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(30) DEFAULT 'chat'`).catch(() => { });

        let msg = null;
        // Insérer dans le chat seulement si canal = chat ou both
        if (channel === 'chat' || channel === 'both') {
            const result = await pool.query(
                `INSERT INTO messages (client_id, sender, content, is_read, channel, created_at) VALUES ($1, 'vnk', $2, false, $3, NOW()) RETURNING *`,
                [req.params.clientId, content.trim(), channel]
            );
            msg = result.rows[0];
        }
        // Marquer les messages du client comme lus
        await pool.query(
            `UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`,
            [req.params.clientId]
        );

        // Récupérer infos client pour email
        const clR = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.clientId]).catch(() => ({ rows: [] }));
        const client = clR.rows[0];

        // Envoyer email si canal = email ou both
        if ((channel === 'email' || channel === 'both') && _email && client) {
            const msgObj = msg || { content: content.trim(), channel, created_at: new Date() };
            await _email.sendEmail(client.email, _email.tplNewMessage(client, msgObj)).catch(e => {
                console.warn('[email] Message send error:', e.message);
            });
            // Si canal email uniquement → insérer quand même en DB avec channel='email' pour garder trace
            if (channel === 'email' && !msg) {
                const result = await pool.query(
                    `INSERT INTO messages (client_id, sender, content, is_read, channel, created_at) VALUES ($1, 'vnk', $2, false, 'email', NOW()) RETURNING *`,
                    [req.params.clientId, content.trim()]
                );
                msg = result.rows[0];
            }
        }

        if (!msg) {
            return res.status(201).json({ success: true, message: { client_id: parseInt(req.params.clientId), content, channel } });
        }

        res.status(201).json({ success: true, message: msg });
        // WS push (seulement si chat ou both)
        if (channel !== 'email') {
            wsBroadcast({ event: 'new_message', clientId: parseInt(req.params.clientId), data: { message: msg } });
        }
    } catch (err) {
        console.error('[messages POST]', err.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/admin/email-inbound — Recevoir un email entrant (webhook)
// Compatible SendGrid Inbound Parse, Mailgun, Postmark
// Mappe l'email à un client via son adresse email
router.post('/email-inbound', async (req, res) => {
    try {
        // Support SendGrid, Mailgun, Postmark formats
        const from = req.body.from || req.body.sender || req.body.From || '';
        const subject = req.body.subject || req.body.Subject || '(Sans objet)';
        const text = req.body.text || req.body['body-plain'] || req.body.TextBody || '';
        const html = req.body.html || req.body['body-html'] || req.body.HtmlBody || '';

        // Extraire l'adresse email de l'expéditeur
        const emailMatch = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (!emailMatch) return res.status(200).json({ success: false, message: 'Email invalide.' });
        const fromEmail = emailMatch[0].toLowerCase();

        // Trouver le client correspondant
        const cl = await pool.query('SELECT * FROM clients WHERE LOWER(email)=$1', [fromEmail]);
        if (!cl.rows.length) {
            console.log('[email-inbound] Email inconnu:', fromEmail, '—', subject);
            return res.status(200).json({ success: false, message: 'Client non trouvé.' });
        }
        const client = cl.rows[0];

        // Nettoyer le contenu texte
        const body = text.trim() || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const content = subject && subject !== '(Sans objet)'
            ? `**${subject}**\n\n${body}`.substring(0, 2000)
            : body.substring(0, 2000);

        // Ajouter colonne channel si pas encore présente
        await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(30) DEFAULT 'chat'`).catch(() => { });

        // Insérer comme message client avec channel='email_received'
        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, channel, created_at) VALUES ($1, 'client', $2, false, 'email_received', NOW()) RETURNING *`,
            [client.id, content]
        );
        const msg = result.rows[0];
        console.log(`[email-inbound] Email reçu de ${fromEmail} (${client.full_name}) — ${subject}`);

        // WS push vers admin
        wsBroadcast({ event: 'new_message_client', clientId: client.id, data: { message: msg, from: fromEmail } });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[email-inbound]', err.message);
        res.status(200).json({ success: false }); // Toujours 200 pour les webhooks
    }
});

// PUT /api/admin/messages/:clientId/mark-read — marquer thread comme lu
router.put('/messages/:clientId/mark-read', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(
            `UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`,
            [req.params.clientId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/admin/messages/mark-all-read — marquer tous les messages comme lus
router.put('/messages/mark-all-read', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE messages SET is_read=true WHERE sender='client' AND is_read=false`
        );
        res.json({ success: true, updated: result.rowCount });
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
            pool.query(`SELECT
                COALESCE(SUM(CASE WHEN status='paid' THEN amount_ttc END),0) as total_paid,
                COALESCE(SUM(CASE WHEN status='unpaid' THEN amount_ttc END),0) as total_unpaid,
                COALESCE(SUM(amount_ttc),0) as total_invoiced
                FROM invoices`)
        ]);
        res.json({
            success: true,
            invoices: invoices.rows,
            totalPaid: parseFloat(totals.rows[0].total_paid),
            totalUnpaid: parseFloat(totals.rows[0].total_unpaid),
            totalInvoiced: parseFloat(totals.rows[0].total_invoiced)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PAYMENTS — Transactions Stripe
// ============================================
router.get('/payments/transactions', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, i.invoice_number, i.client_id, c.full_name as client_name,
                   i.stripe_payment_intent_id as stripe_id
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN clients c ON i.client_id = c.id
            ORDER BY p.paid_at DESC
        `);
        res.json({ success: true, transactions: result.rows });
    } catch (err) {
        res.json({ success: false, message: 'Table payments non disponible.' });
    }
});

// ============================================
// PAYMENTS — Remboursement Stripe
// ============================================
router.post('/payments/refund', authenticateAdmin, async (req, res) => {
    try {
        const { invoice_id, amount, reason } = req.body;
        if (!invoice_id || !amount) {
            return res.status(400).json({ success: false, message: 'invoice_id et amount requis.' });
        }
        const invResult = await pool.query('SELECT * FROM invoices WHERE id=$1', [invoice_id]);
        if (!invResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Facture non trouvée.' });
        }
        const inv = invResult.rows[0];

        // Tentative remboursement Stripe si payment intent disponible
        if (process.env.STRIPE_SECRET_KEY && inv.stripe_payment_intent_id) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: inv.stripe_payment_intent_id,
                    amount: Math.round(parseFloat(amount) * 100),
                    reason: reason || 'requested_by_customer'
                });
                // Enregistrer
                const year = new Date().getFullYear();
                const count = await pool.query("SELECT COUNT(*) FROM refunds WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
                const num = `RMB-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
                await pool.query(
                    `INSERT INTO refunds (client_id, invoice_id, refund_number, reason, amount, tps_amount, tvq_amount, total_amount, status, notes, created_at)
                     VALUES ($1,$2,$3,$4,$5,0,0,$5,'processed',$6,NOW())`,
                    [inv.client_id, invoice_id, num, reason || 'Remboursement client', amount, 'Stripe ID: ' + refund.id]
                );
                return res.json({ success: true, refund_id: refund.id });
            } catch (stripeErr) {
                return res.status(400).json({ success: false, message: 'Erreur Stripe: ' + stripeErr.message });
            }
        }

        // Fallback : note de crédit manuelle
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM refunds WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `RMB-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const tps = parseFloat((amount * 0.05).toFixed(2));
        const tvq = parseFloat((amount * 0.09975).toFixed(2));
        const total = parseFloat(amount) + tps + tvq;
        await pool.query(
            `INSERT INTO refunds (client_id, invoice_id, refund_number, reason, amount, tps_amount, tvq_amount, total_amount, status, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW())`,
            [inv.client_id, invoice_id, num, reason || 'Remboursement client', amount, tps, tvq, total,
                'Remboursement manuel — aucun Stripe payment intent']
        );
        res.json({ success: true, message: 'Remboursement enregistré comme note de crédit.' });
    } catch (err) {
        console.error('Refund error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// MESSAGES — envoi avec pièce jointe
// ============================================
router.post('/messages/:clientId/with-attachment', authenticateAdmin, upload.array('files', 5), async (req, res) => {
    try {
        const textContent = req.body?.content || '';
        const files = req.files || [];

        // Construire les pièces jointes en base64 (stockage direct en DB)
        const attachments = files.map(f => ({
            name: f.originalname,
            type: f.mimetype,
            size: f.size,
            data: f.buffer.toString('base64')
        }));

        const fileNames = files.map(f => f.originalname).join(', ');
        let msgContent = textContent;
        if (fileNames) {
            msgContent = (textContent ? textContent + '\n' : '') + '\uD83D\uDCCE ' + fileNames;
        }
        if (!msgContent) msgContent = '(piece jointe)';

        // Stocker attachments JSON dans la colonne attachment_data
        // (ajouter la colonne si elle n'existe pas)
        await pool.query(`
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_data JSONB DEFAULT NULL
        `).catch(() => { }); // ignore si colonne existe déjà

        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, attachment_data, is_read, created_at)
             VALUES ($1, 'vnk', $2, $3, false, NOW()) RETURNING *`,
            [req.params.clientId, msgContent, attachments.length ? JSON.stringify(attachments) : null]
        );
        await pool.query(
            `UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`,
            [req.params.clientId]
        );
        res.status(201).json({ success: true, message: result.rows[0] });
    } catch (err) {
        console.error('with-attachment error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// CONTRACTS — Envoyer pour signature HelloSign
// ============================================
router.post('/contracts/:id/send-signature', authenticateAdmin, async (req, res) => {
    try {
        const { signer_email, signer_name, message } = req.body;
        if (!signer_email || !signer_name) {
            return res.status(400).json({ success: false, message: 'Courriel et nom du signataire requis.' });
        }
        const ctResult = await pool.query('SELECT * FROM contracts WHERE id=$1', [req.params.id]);
        if (!ctResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        }
        const contract = ctResult.rows[0];

        // Tenter HelloSign si clé API disponible
        if (process.env.DROPBOXSIGN_API_KEY && contract.file_url) {
            try {
                const dropboxSignService = require('../services/hellosign');
                if (dropboxSignService && dropboxSignService.sendForSignature) {
                    const result = await dropboxSignService.sendForSignature({
                        file_url: contract.file_url,
                        title: contract.title,
                        signer_email, signer_name,
                        message: message || 'Veuillez signer ce contrat VNK Automatisation Inc.'
                    });
                    if (result.success) {
                        await pool.query(
                            'UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2',
                            ['pending', req.params.id]
                        );
                        return res.json({ success: true, signature_request_id: result.signature_request_id });
                    }
                }
            } catch (hsErr) {
                console.warn('HelloSign error, fallback:', hsErr.message);
            }
        }

        // Fallback : marquer comme "en attente" + log
        await pool.query(
            'UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2',
            ['pending', req.params.id]
        );
        console.log('[Contract ' + req.params.id + '] Signature request for ' + signer_email + ' - configure Dropbox Sign for auto-send');
        res.json({
            success: true,
            message: 'Contrat marque en attente de signature. Configurez Dropbox Sign pour envoi automatique.'
        });
    } catch (err) {
        console.error('send-signature error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// ============================================
// CONTRACTS — Modifier un contrat (titre, URL, statut, contenu)
// ============================================
router.put('/contracts/:id', authenticateAdmin, async (req, res) => {
    try {
        const { title, file_url, content, status } = req.body;
        const result = await pool.query(
            `UPDATE contracts 
             SET title=$1, file_url=$2, content=$3, status=$4, updated_at=NOW()
             WHERE id=$5 RETURNING *`,
            [title, file_url || null, content || null, status || 'draft', req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Contrat non trouve.' });
        }
        res.json({ success: true, contract: result.rows[0] });
    } catch (err) {
        console.error('PUT contracts error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// ============================================================
// QUOTES — PDF professionnel
// ============================================================
router.get('/quotes/:id/pdf', authenticateAdmin, async (req, res) => {
    try {
        const q = await pool.query(
            `SELECT q.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province, c.postal_code
             FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = $1`, [req.params.id]
        );
        if (!q.rows.length) return res.status(404).json({ success: false, message: 'Devis non trouve.' });
        const quote = q.rows[0];
        const client = { full_name: quote.full_name, email: quote.email, phone: quote.phone, company_name: quote.company_name, address: quote.address, city: quote.city, province: quote.province, postal_code: quote.postal_code };
        await pdfTemplates.generateQuotePDF(res, quote, client, null);
    } catch (err) {
        console.error('Quote PDF error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});

// ============================================================
// QUOTES — Accepter + générer contrat automatiquement
// ============================================================
router.put('/quotes/:id/accept', authenticateAdmin, async (req, res) => {
    try {
        // Marquer devis comme accepté
        await pool.query('UPDATE quotes SET status=$1 WHERE id=$2', ['accepted', req.params.id]);

        // Générer contrat automatiquement
        const { contract, quote } = await pdfTemplates.autoGenerateContract(pool, req.params.id);

        // Envoyer pour signature Dropbox Sign si configuré
        let signatureRequestSent = false;
        if (process.env.DROPBOXSIGN_API_KEY && quote.email) {
            try {
                const hellosignService = require('../services/hellosign');
                if (hellosignService && hellosignService.sendForSignature) {
                    // Note: le PDF sera généré à la demande - on envoie juste la demande
                    const result = await hellosignService.sendForSignature({
                        title: contract.title,
                        signer_email: quote.email,
                        signer_name: quote.full_name,
                        message: `Bonjour ${quote.full_name}, votre devis ${quote.quote_number} a été accepté. Veuillez signer le contrat de service ci-joint pour confirmer le mandat.`
                    });
                    if (result.success) {
                        signatureRequestSent = true;
                        await pool.query('UPDATE contracts SET status=$1 WHERE id=$2', ['pending', contract.id]);
                    }
                }
            } catch (hsErr) {
                console.warn('Dropbox Sign auto-send error:', hsErr.message);
            }
        }

        res.json({
            success: true,
            contract_number: contract.contract_number,
            signature_sent: signatureRequestSent,
            message: signatureRequestSent
                ? 'Devis accepte et contrat envoye pour signature au client.'
                : 'Devis accepte et contrat cree. Envoyez-le manuellement pour signature.'
        });
    } catch (err) {
        console.error('Accept quote error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// INVOICES — PDF professionnel
// ============================================================
router.get('/invoices/:id/pdf', authenticateAdmin, async (req, res) => {
    try {
        const q = await pool.query(
            `SELECT i.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province, c.postal_code
             FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.id = $1`, [req.params.id]
        );
        if (!q.rows.length) return res.status(404).json({ success: false, message: 'Facture non trouvee.' });
        const invoice = q.rows[0];
        const client = { full_name: invoice.full_name, email: invoice.email, phone: invoice.phone, company_name: invoice.company_name, address: invoice.address, city: invoice.city, province: invoice.province, postal_code: invoice.postal_code };
        await pdfTemplates.generateInvoicePDF(res, invoice, client);
    } catch (err) {
        console.error('Invoice PDF error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});

// ============================================================
// CONTRACTS — PDF professionnel
// ============================================================
router.get('/contracts/:id/pdf', authenticateAdmin, async (req, res) => {
    try {
        const q = await pool.query(
            `SELECT ct.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province, c.postal_code,
                    qo.quote_number, qo.amount_ttc, qo.description as quote_description, qo.title as quote_title
             FROM contracts ct 
             JOIN clients c ON ct.client_id = c.id
             LEFT JOIN quotes qo ON ct.quote_id = qo.id
             WHERE ct.id = $1`, [req.params.id]
        );
        if (!q.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouve.' });
        const row = q.rows[0];
        const contract = { ...row };
        const client = { full_name: row.full_name, email: row.email, phone: row.phone, company_name: row.company_name, address: row.address, city: row.city, province: row.province, postal_code: row.postal_code };
        const quote = row.quote_number ? { quote_number: row.quote_number, amount_ttc: row.amount_ttc, description: row.quote_description, title: row.quote_title } : null;
        await pdfTemplates.generateContractPDF(res, contract, client, quote);
    } catch (err) {
        console.error('Contract PDF error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});


// ============================================
// QUOTES — Modifier un devis
// ============================================
router.put('/quotes/:id', authenticateAdmin, async (req, res) => {
    try {
        const { title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, expiry_date, status } = req.body;
        const result = await pool.query(
            `UPDATE quotes SET title=$1, description=$2, amount_ht=$3, tps_amount=$4, tvq_amount=$5,
             amount_ttc=$6, expiry_date=$7, status=$8 WHERE id=$9 RETURNING *`,
            [title, description || null, amount_ht, tps_amount, tvq_amount, amount_ttc,
                expiry_date || null, status || 'pending', req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Devis non trouve.' });
        res.json({ success: true, quote: result.rows[0] });
    } catch (err) {
        console.error('PUT quote:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// INVOICES — Modifier une facture
// ============================================
router.put('/invoices/:id', authenticateAdmin, async (req, res) => {
    try {
        const { title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, due_date, status } = req.body;
        const result = await pool.query(
            `UPDATE invoices SET title=$1, description=$2, amount_ht=$3, tps_amount=$4, tvq_amount=$5,
             amount_ttc=$6, due_date=$7, status=$8,
             paid_at=CASE WHEN $8='paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END
             WHERE id=$9 RETURNING *`,
            [title, description || null, amount_ht, tps_amount, tvq_amount, amount_ttc,
                due_date || null, status || 'unpaid', req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Facture non trouvee.' });
        res.json({ success: true, invoice: result.rows[0] });
    } catch (err) {
        console.error('PUT invoice:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// EXPENSES — Modifier une depense
// ============================================
router.put('/expenses/:id', authenticateAdmin, async (req, res) => {
    try {
        const { title, amount, tps_paid, tvq_paid, vendor, expense_date, notes } = req.body;
        const result = await pool.query(
            `UPDATE expenses SET title=$1, amount=$2, tps_paid=$3, tvq_paid=$4, vendor=$5, expense_date=$6, notes=$7
             WHERE id=$8 RETURNING *`,
            [title, amount, tps_paid || 0, tvq_paid || 0, vendor || null, expense_date, notes || null, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Depense non trouvee.' });
        res.json({ success: true, expense: result.rows[0] });
    } catch (err) {
        console.error('PUT expense:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// DELETE — Suppression complète sans restriction
// ============================================
router.delete('/quotes/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM quotes WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/invoices/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/mandates/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM mandates WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/contracts/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM contracts WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/clients/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;