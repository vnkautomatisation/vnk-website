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

// ============================================================
// WORKFLOW HELPER — Notification client interne
// Envoie un message automatique dans la messagerie du client
// ============================================================
let _broadcast = null;
try { _broadcast = require('../ws-server').broadcast; } catch (e) { }
const wsBroadcast = (opts) => { if (_broadcast) _broadcast(opts); };


async function notifyClient(pool, clientId, content) {
    try {
        await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW())`,
            [clientId, content]
        );
    } catch (e) {
        console.warn('[Workflow] Notification client failed:', e.message);
    }
}

// Helper : générer numéro de facture séquentiel
async function nextInvoiceNumber(pool) {
    const year = new Date().getFullYear();
    const r = await pool.query("SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
    return `F-${year}-${String(parseInt(r.rows[0].count) + 1).padStart(3, '0')}`;
}

// Helper : générer numéro de contrat séquentiel
async function nextContractNumber(pool) {
    const year = new Date().getFullYear();
    const r = await pool.query("SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
    return `CT-${year}-${String(parseInt(r.rows[0].count) + 1).padStart(3, '0')}`;
}


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
        const mandate = result.rows[0];

        // Workflow — notifier le client de l'ouverture du mandat
        await notifyClient(pool, client_id,
            `Bonjour,\n\nVotre mandat « ${title} » a été ouvert et est maintenant actif sur votre portail.\n\nVous pouvez suivre l'avancement en temps réel dans la section Mandats de votre espace client.\n\nÀ votre disposition pour toute question.\n\nÉquipe VNK Automatisation Inc.`
        );

        res.status(201).json({ success: true, mandate, workflow: 'Mandat créé — client notifié.' });
    } catch (err) {
        console.error('POST mandate error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/mandates/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, progress, notes } = req.body;
        const prev = await pool.query('SELECT * FROM mandates WHERE id=$1', [req.params.id]);
        const result = await pool.query(
            `UPDATE mandates SET status=$1, progress=$2, notes=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
            [status, progress, notes || null, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Mandat non trouvé.' });
        const mandate = result.rows[0];

        // Workflow — notifier le client si changement significatif
        if (prev.rows.length) {
            const old = prev.rows[0];
            const statusLabels = { active: 'Actif', in_progress: 'En cours', completed: 'Complété', paused: 'En pause', cancelled: 'Annulé' };
            if (old.status !== status) {
                await notifyClient(pool, mandate.client_id,
                    `Mise à jour de votre mandat « ${mandate.title} ».\n\nStatut : ${statusLabels[status] || status}${progress !== undefined ? `\nAvancement : ${progress}%` : ''}\n\nÉquipe VNK Automatisation Inc.`
                );
            } else if (progress !== undefined && Math.abs((old.progress || 0) - progress) >= 25) {
                await notifyClient(pool, mandate.client_id,
                    `Avancement de votre mandat « ${mandate.title} » mis à jour : ${progress}% complété.\n\nÉquipe VNK Automatisation Inc.`
                );
            }
            // Workflow : si mandat complété → proposer clôture
            if (status === 'completed' && old.status !== 'completed') {
                await notifyClient(pool, mandate.client_id,
                    `Félicitations ! Votre mandat « ${mandate.title} » est maintenant complété à 100%.\n\nUne facture finale sera émise sous peu. Merci de votre confiance.\n\nÉquipe VNK Automatisation Inc.`
                );
            }
        }

        res.json({ success: true, mandate });
    } catch (err) {
        console.error('PUT mandate error:', err);
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
        // Migration douce — colonnes potentiellement manquantes
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS service_type VARCHAR(100)`).catch(() => { });
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP`).catch(() => { });
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`).catch(() => { });

        const { client_id, title, description, amount_ht, service_type } = req.body;
        // Sanitize expiry_days: vide, NaN ou 0 → défaut 30 jours
        const expiryDays = (parseInt(req.body.expiry_days) > 0) ? parseInt(req.body.expiry_days) : 30;
        if (!client_id || !title || !amount_ht) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `D-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const expiry = new Date(); expiry.setDate(expiry.getDate() + expiryDays);
        const result = await pool.query(
            `INSERT INTO quotes (client_id,quote_number,title,description,service_type,amount_ht,tps_amount,tvq_amount,amount_ttc,status,expiry_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,NOW()) RETURNING *`,
            [client_id, num, title, description || null, service_type || null, amount_ht, tps, tvq, ttc, expiry]
        );
        const quote = result.rows[0];

        // Workflow — notifier le client qu'un devis est disponible
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
        await notifyClient(pool, client_id,
            `Un nouveau devis est disponible sur votre portail.\n\nDossier : ${num} — ${title}\nMontant HT : ${fmtCA(amount_ht)}\nTPS (5%) : ${fmtCA(tps)}\nTVQ (9,975%) : ${fmtCA(tvq)}\nTotal TTC : ${fmtCA(ttc)}\nValide jusqu'au : ${expiry.toLocaleDateString('fr-CA')}\n\nVeuillez consulter et accepter ou refuser ce devis depuis votre espace client.\n\nÉquipe VNK Automatisation Inc.`
        );

        res.status(201).json({ success: true, quote, workflow: 'Devis créé — client notifié.' });
    } catch (err) {
        console.error('POST /quotes error:', err.message);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
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
        const { client_id, title, description, amount_ht } = req.body;
        // Sanitize due_days: vide, NaN ou 0 → défaut 30 jours
        const dueDays = (parseInt(req.body.due_days) > 0) ? parseInt(req.body.due_days) : 30;
        if (!client_id || !title || !amount_ht) return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
        const tps = parseFloat((amount_ht * 0.05).toFixed(2));
        const tvq = parseFloat((amount_ht * 0.09975).toFixed(2));
        const ttc = parseFloat((parseFloat(amount_ht) + tps + tvq).toFixed(2));
        const num = await nextInvoiceNumber(pool);
        const due = new Date(); due.setDate(due.getDate() + dueDays);
        const result = await pool.query(
            `INSERT INTO invoices (client_id,invoice_number,title,description,amount_ht,tps_amount,tvq_amount,amount_ttc,status,due_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'unpaid',$9,NOW()) RETURNING *`,
            [client_id, num, title, description || null, amount_ht, tps, tvq, ttc, due]
        );
        const invoice = result.rows[0];

        // Workflow — notifier le client de la nouvelle facture
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
        await notifyClient(pool, client_id,
            `Une nouvelle facture est disponible sur votre portail.\n\nFacture : ${num} — ${title}\nMontant HT : ${fmtCA(amount_ht)}\nTPS (5%) : ${fmtCA(tps)}\nTVQ (9,975%) : ${fmtCA(tvq)}\nTotal TTC : ${fmtCA(ttc)}\nDate d'échéance : ${due.toLocaleDateString('fr-CA')}\n\nVeuillez procéder au paiement depuis votre espace client avant la date d'échéance.\n\nMerci pour votre confiance.\nÉquipe VNK Automatisation Inc.`
        );

        res.status(201).json({ success: true, invoice, workflow: 'Facture créée — client notifié.' });
    } catch (err) {
        console.error('POST invoice error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.put('/invoices/:id/mark-paid', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Facture non trouvée.' });
        const invoice = result.rows[0];

        // Enregistrer le paiement
        await pool.query(
            `INSERT INTO payments (invoice_id, client_id, amount, currency, status, paid_at, created_at)
             VALUES ($1,$2,$3,'cad','completed',NOW(),NOW())`,
            [req.params.id, invoice.client_id, invoice.amount_ttc]
        );

        // Workflow — notifier le client de la confirmation de paiement
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
        await notifyClient(pool, invoice.client_id,
            `Votre paiement a été reçu et confirmé.\n\nFacture : ${invoice.invoice_number} — ${invoice.title}\nMontant réglé : ${fmtCA(invoice.amount_ttc)}\nDate : ${new Date().toLocaleDateString('fr-CA')}\n\nMerci pour votre paiement. Le reçu PDF est disponible dans votre espace client.\n\nÉquipe VNK Automatisation Inc.`
        );

        res.json({ success: true, invoice, workflow: 'Facture marquée payée — client notifié.' });
    } catch (err) {
        console.error('mark-paid error:', err);
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
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        res.json({ success: true, contract: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PUT /api/admin/contracts/:id/admin-sign
// Signature admin → si client aussi signé : générer facture automatiquement
// ============================================
router.put('/contracts/:id/admin-sign', authenticateAdmin, async (req, res) => {
    try {
        const { signature_data } = req.body;
        // Migrations douces
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signature_data TEXT`).catch(() => { });

        let query, params;
        if (signature_data && signature_data.startsWith('data:image/')) {
            query = `UPDATE contracts SET admin_signed_at=NOW(), admin_signature_data=$1, status='signed', updated_at=NOW() WHERE id=$2 RETURNING *`;
            params = [signature_data, req.params.id];
        } else {
            query = `UPDATE contracts SET admin_signed_at=NOW(), status='signed', updated_at=NOW() WHERE id=$1 RETURNING *`;
            params = [req.params.id];
        }
        const result = await pool.query(query, params);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        const contract = result.rows[0];

        // Workflow — récupérer infos complètes du contrat (client + devis lié)
        const fullContract = await pool.query(
            `SELECT ct.*, c.full_name, c.company_name, c.email, c.client_id as cid,
                    q.quote_number, q.amount_ht, q.tps_amount, q.tvq_amount, q.amount_ttc, q.title as quote_title
             FROM contracts ct
             JOIN clients c ON ct.client_id = c.id
             LEFT JOIN quotes q ON ct.quote_id = q.id
             WHERE ct.id = $1`,
            [req.params.id]
        );

        let autoInvoice = null;
        let workflowSteps = ['Contrat signé par l\'administrateur'];

        if (fullContract.rows.length) {
            const fc = fullContract.rows[0];

            // Notifier le client — contrat signé des deux parties
            await notifyClient(pool, contract.client_id,
                `Votre contrat ${contract.contract_number} — « ${contract.title} » est maintenant signé des deux parties.\n\nLe contrat signé est disponible en téléchargement dans votre espace client.\n\nUne facture sera émise prochainement.\n\nMerci de votre confiance.\nÉquipe VNK Automatisation Inc.`
            );
            workflowSteps.push('Client notifié — contrat signé');

            // Auto-générer la facture si un devis est lié et qu'aucune facture n'existe encore
            if (fc.quote_id && fc.amount_ttc) {
                const existingInvoice = await pool.query(
                    `SELECT id FROM invoices WHERE quote_id = $1 LIMIT 1`,
                    [fc.quote_id]
                );

                if (!existingInvoice.rows.length) {
                    const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
                    const num = await nextInvoiceNumber(pool);
                    const due = new Date(); due.setDate(due.getDate() + 30);

                    const invoiceResult = await pool.query(
                        `INSERT INTO invoices
                         (client_id, quote_id, mandate_id, invoice_number, title, description,
                          amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date, created_at, updated_at)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'unpaid',$11,NOW(),NOW()) RETURNING *`,
                        [
                            contract.client_id,
                            fc.quote_id,
                            contract.mandate_id || null,
                            num,
                            `Facture — ${fc.quote_title || contract.title}`,
                            `Conformément au contrat ${contract.contract_number} et au devis ${fc.quote_number}`,
                            fc.amount_ht, fc.tps_amount, fc.tvq_amount, fc.amount_ttc,
                            due
                        ]
                    );
                    autoInvoice = invoiceResult.rows[0];

                    // Lier la facture au devis si possible
                    await pool.query(
                        `UPDATE invoices SET quote_id=$1 WHERE id=$2`,
                        [fc.quote_id, autoInvoice.id]
                    ).catch(() => { });

                    // Notifier le client de la nouvelle facture
                    await notifyClient(pool, contract.client_id,
                        `Suite à la signature de votre contrat, une facture a été générée automatiquement.\n\nFacture : ${num}\nMontant HT : ${fmtCA(fc.amount_ht)}\nTPS (5%) : ${fmtCA(fc.tps_amount)}\nTVQ (9,975%) : ${fmtCA(fc.tvq_amount)}\nTotal TTC : ${fmtCA(fc.amount_ttc)}\nDate d'échéance : ${due.toLocaleDateString('fr-CA')}\n\nVeuillez procéder au paiement depuis votre espace client.\n\nMerci.\nÉquipe VNK Automatisation Inc.`
                    );
                    workflowSteps.push(`Facture ${num} générée automatiquement`);
                    workflowSteps.push('Client notifié de la nouvelle facture');
                }
            }
        }

        res.json({
            success: true,
            contract,
            auto_invoice: autoInvoice,
            workflow: workflowSteps
        });
    } catch (err) {
        console.error('admin-sign error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
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
        const { client_id, mandate_id, title, description, file_type, file_name, file_url, file_data, file_size } = req.body;
        if (!client_id || !title) return res.status(400).json({ success: false, message: 'client_id et title requis.' });
        let finalUrl = file_url || null;
        // If base64 data provided (direct upload), store as data URL
        if (file_data && !finalUrl) {
            const mimes = {
                pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip'
            };
            const ext = (file_type || 'other').toLowerCase();
            finalUrl = 'data:' + (mimes[ext] || 'application/octet-stream') + ';base64,' + file_data;
        }
        const result = await pool.query(
            `INSERT INTO documents (client_id, mandate_id, title, description, file_type, file_name, file_url, file_size, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
            [client_id, mandate_id || null, title, description || null, file_type || 'other',
                file_name || title, finalUrl, file_size || null]
        );
        res.status(201).json({ success: true, document: result.rows[0] });
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
            const msgs = await pool.query(`SELECT id, client_id, sender, content, attachment_data, is_read, created_at FROM messages WHERE client_id=$1 ORDER BY created_at ASC`, [c.id]);
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
        const { content } = req.body;
        if (!content) return res.status(400).json({ success: false, message: 'Message vide.' });
        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, 'vnk', $2, false, NOW()) RETURNING *`,
            [req.params.clientId, content.trim()]
        );
        // Marquer les messages du client comme lus en même temps
        await pool.query(
            `UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`,
            [req.params.clientId]
        );
        res.status(201).json({ success: true, message: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
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
// QUOTES — Accepter + workflow complet automatique
// Étapes : Marquer accepté → Générer contrat → Notifier client
// ============================================================
router.put('/quotes/:id/accept', authenticateAdmin, async (req, res) => {
    try {
        // 1. Marquer devis comme accepté
        await pool.query(
            'UPDATE quotes SET status=$1, accepted_at=NOW(), updated_at=NOW() WHERE id=$2',
            ['accepted', req.params.id]
        );

        // 2. Générer contrat automatiquement
        const { contract, quote } = await pdfTemplates.autoGenerateContract(pool, req.params.id);

        // 3. Notification interne au client — devis accepté + contrat à signer
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
        await notifyClient(pool, quote.client_id,
            `Bonjour ${quote.full_name},\n\nVotre devis ${quote.quote_number} — « ${quote.title} » a été accepté.\n\nMontant : ${fmtCA(quote.amount_ttc)} TTC\n\nUn contrat de service (${contract.contract_number}) a été généré automatiquement. Vous pouvez le consulter et le signer depuis la section Contrats de votre espace client.\n\nUne fois le contrat signé des deux parties, une facture vous sera transmise.\n\nÉquipe VNK Automatisation Inc.`
        );

        // 4. Tenter envoi Dropbox Sign si configuré
        let signatureRequestSent = false;
        if (process.env.DROPBOXSIGN_API_KEY && quote.email) {
            try {
                const hellosignService = require('../services/hellosign');
                if (hellosignService && hellosignService.sendForSignature) {
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
            contract_id: contract.id,
            signature_sent: signatureRequestSent,
            workflow: [
                'Devis accepté',
                `Contrat ${contract.contract_number} généré`,
                'Client notifié par messagerie',
                signatureRequestSent ? 'Demande de signature Dropbox Sign envoyée' : 'Signature manuelle requise dans le portail'
            ],
            message: signatureRequestSent
                ? 'Devis accepté, contrat généré et envoyé pour signature au client.'
                : 'Devis accepté et contrat créé. Le client est notifié et peut signer depuis son portail.'
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
        const safeExpiry = (expiry_date && String(expiry_date).trim() !== '') ? expiry_date : null;
        const result = await pool.query(
            `UPDATE quotes SET title=$1, description=$2, amount_ht=$3, tps_amount=$4, tvq_amount=$5,
             amount_ttc=$6, expiry_date=$7, status=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
            [title, description || null, amount_ht, tps_amount, tvq_amount, amount_ttc,
                safeExpiry, status || 'pending', req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Devis non trouvé.' });
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
        const safeDue = (due_date && String(due_date).trim() !== '') ? due_date : null;

        // Récupérer le statut précédent pour détecter un changement
        const prev = await pool.query('SELECT status, client_id, invoice_number FROM invoices WHERE id=$1', [req.params.id]);

        const result = await pool.query(
            `UPDATE invoices SET title=$1, description=$2, amount_ht=$3, tps_amount=$4, tvq_amount=$5,
             amount_ttc=$6, due_date=$7, status=$8, updated_at=NOW(),
             paid_at=CASE WHEN $8='paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END
             WHERE id=$9 RETURNING *`,
            [title, description || null, amount_ht, tps_amount, tvq_amount, amount_ttc,
                safeDue, status || 'unpaid', req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Facture non trouvée.' });
        const invoice = result.rows[0];

        // Workflow — notifier si passage à "payé" ou "en retard"
        if (prev.rows.length && prev.rows[0].status !== status) {
            const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);
            if (status === 'paid') {
                await pool.query(
                    `INSERT INTO payments (invoice_id, client_id, amount, currency, status, paid_at, created_at)
                     VALUES ($1,$2,$3,'cad','completed',NOW(),NOW())
                     ON CONFLICT DO NOTHING`,
                    [req.params.id, invoice.client_id, invoice.amount_ttc]
                ).catch(() => { });
                await notifyClient(pool, invoice.client_id,
                    `Votre paiement a été confirmé.\n\nFacture : ${invoice.invoice_number} — ${invoice.title}\nMontant : ${fmtCA(invoice.amount_ttc)}\nDate : ${new Date().toLocaleDateString('fr-CA')}\n\nMerci pour votre paiement.\nÉquipe VNK Automatisation Inc.`
                );
            } else if (status === 'overdue') {
                await notifyClient(pool, invoice.client_id,
                    `RAPPEL : Votre facture ${invoice.invoice_number} est en retard de paiement.\n\nMontant dû : ${fmtCA(invoice.amount_ttc)}\n\nVeuillez régulariser depuis votre espace client dès que possible.\n\nÉquipe VNK Automatisation Inc.`
                );
            }
        }

        res.json({ success: true, invoice });
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
        const safeDate = (expense_date && String(expense_date).trim() !== '') ? expense_date : null;
        if (!safeDate) return res.status(400).json({ success: false, message: 'La date de dépense est requise.' });
        const result = await pool.query(
            `UPDATE expenses SET title=$1, amount=$2, tps_paid=$3, tvq_paid=$4, vendor=$5, expense_date=$6, notes=$7
             WHERE id=$8 RETURNING *`,
            [title, amount, tps_paid || 0, tvq_paid || 0, vendor || null, safeDate, notes || null, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Dépense non trouvée.' });
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

// ============================================================
// WORKFLOW — Générer facture depuis un contrat signé (manuel)
// POST /api/admin/contracts/:id/generate-invoice
// ============================================================
router.post('/contracts/:id/generate-invoice', authenticateAdmin, async (req, res) => {
    try {
        const { due_days } = req.body;
        const dueDays = (parseInt(due_days) > 0) ? parseInt(due_days) : 30;

        const q = await pool.query(
            `SELECT ct.*, c.full_name, c.company_name, c.email,
                    qo.quote_number, qo.amount_ht, qo.tps_amount, qo.tvq_amount, qo.amount_ttc, qo.title as quote_title
             FROM contracts ct
             JOIN clients c ON ct.client_id = c.id
             LEFT JOIN quotes qo ON ct.quote_id = q.id
             WHERE ct.id = $1`,
            [req.params.id]
        );
        if (!q.rows.length) return res.status(404).json({ success: false, message: 'Contrat non trouvé.' });
        const row = q.rows[0];

        if (!row.amount_ttc) return res.status(400).json({ success: false, message: 'Aucun devis lié avec montant.' });

        const num = await nextInvoiceNumber(pool);
        const due = new Date(); due.setDate(due.getDate() + dueDays);
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);

        const result = await pool.query(
            `INSERT INTO invoices (client_id, quote_id, mandate_id, invoice_number, title, description,
             amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'unpaid',$11,NOW(),NOW()) RETURNING *`,
            [row.client_id, row.quote_id || null, row.mandate_id || null, num,
            `Facture — ${row.quote_title || row.title}`,
            `Conformément au contrat ${row.contract_number}`,
            row.amount_ht, row.tps_amount, row.tvq_amount, row.amount_ttc, due]
        );
        const invoice = result.rows[0];

        await notifyClient(pool, row.client_id,
            `Une facture a été générée suite à votre contrat.\n\nFacture : ${num}\nMontant TTC : ${fmtCA(row.amount_ttc)}\nÉchéance : ${due.toLocaleDateString('fr-CA')}\n\nVeuillez procéder au paiement depuis votre espace client.\n\nÉquipe VNK Automatisation Inc.`
        );

        res.status(201).json({ success: true, invoice, workflow: 'Facture générée et client notifié.' });
    } catch (err) {
        console.error('generate-invoice error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// WORKFLOW — Statut global du workflow pour un client
// GET /api/admin/clients/:id/workflow-status
// ============================================================
router.get('/clients/:id/workflow-status', authenticateAdmin, async (req, res) => {
    try {
        const cid = req.params.id;
        const [mandates, quotes, contracts, invoices, payments] = await Promise.all([
            pool.query(`SELECT id, title, status, progress FROM mandates WHERE client_id=$1 ORDER BY created_at DESC LIMIT 5`, [cid]),
            pool.query(`SELECT id, quote_number, title, status, amount_ttc FROM quotes WHERE client_id=$1 ORDER BY created_at DESC LIMIT 5`, [cid]),
            pool.query(`SELECT id, contract_number, title, status, signed_at, admin_signed_at FROM contracts WHERE client_id=$1 ORDER BY created_at DESC LIMIT 5`, [cid]),
            pool.query(`SELECT id, invoice_number, title, status, amount_ttc, due_date, paid_at FROM invoices WHERE client_id=$1 ORDER BY created_at DESC LIMIT 5`, [cid]),
            pool.query(`SELECT SUM(amount) as total_paid FROM payments WHERE client_id=$1 AND status='completed'`, [cid])
        ]);

        // Déterminer l'étape courante du workflow
        const activeMandate = mandates.rows.find(m => m.status === 'active' || m.status === 'in_progress');
        const pendingQuote = quotes.rows.find(q => q.status === 'pending');
        const pendingContract = contracts.rows.find(c => c.status === 'draft' || c.status === 'pending');
        const unpaidInvoice = invoices.rows.find(i => i.status === 'unpaid' || i.status === 'overdue');

        let currentStep = 'idle';
        let nextAction = null;
        if (!mandates.rows.length) { currentStep = 'no_mandate'; nextAction = 'Créer un mandat'; }
        else if (!quotes.rows.length) { currentStep = 'mandate_active'; nextAction = 'Créer un devis'; }
        else if (pendingQuote) { currentStep = 'quote_pending'; nextAction = 'Attendre acceptation du devis par le client'; }
        else if (pendingContract) { currentStep = 'contract_pending'; nextAction = 'Signer le contrat'; }
        else if (unpaidInvoice) { currentStep = 'invoice_unpaid'; nextAction = 'Attendre le paiement du client'; }
        else { currentStep = 'complete'; nextAction = 'Workflow complet'; }

        res.json({
            success: true,
            current_step: currentStep,
            next_action: nextAction,
            summary: {
                mandates: mandates.rows,
                quotes: quotes.rows,
                contracts: contracts.rows,
                invoices: invoices.rows,
                total_paid: parseFloat(payments.rows[0]?.total_paid || 0)
            }
        });
    } catch (err) {
        console.error('workflow-status error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// WORKFLOW — Rappels automatiques factures en retard
// POST /api/admin/invoices/send-reminders
// ============================================================
router.post('/invoices/send-reminders', authenticateAdmin, async (req, res) => {
    try {
        const overdue = await pool.query(
            `SELECT i.*, c.full_name FROM invoices i
             JOIN clients c ON i.client_id = c.id
             WHERE i.status = 'unpaid' AND i.due_date < NOW()
             ORDER BY i.due_date ASC`
        );

        let notified = 0;
        const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v);

        for (const inv of overdue.rows) {
            const daysPast = Math.floor((Date.now() - new Date(inv.due_date)) / 86400000);
            await notifyClient(pool, inv.client_id,
                `RAPPEL DE PAIEMENT — ${daysPast} jour(s) de retard\n\nFacture : ${inv.invoice_number} — ${inv.title}\nMontant dû : ${fmtCA(inv.amount_ttc)}\nDate d'échéance : ${new Date(inv.due_date).toLocaleDateString('fr-CA')}\n\nVeuillez régulariser ce solde depuis votre espace client.\n\nPour toute question, contactez-nous directement.\n\nÉquipe VNK Automatisation Inc.`
            );
            // Marquer comme overdue
            await pool.query(`UPDATE invoices SET status='overdue', updated_at=NOW() WHERE id=$1`, [inv.id]);
            notified++;
        }

        res.json({ success: true, notified, message: `${notified} rappel(s) envoyé(s).` });
    } catch (err) {
        console.error('send-reminders error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;