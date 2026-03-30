const pool = require('../db');
let _email = null;
try { _email = require('../email'); } catch (e) { }
/* ============================================
   VNK Automatisation Inc. - Quotes Routes
   ============================================ */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

// GET /api/quotes
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Migration douce — s'assurer que les colonnes existent
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS service_type VARCHAR(100)`).catch(() => { });
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP`).catch(() => { });

        const clientId = req.query.client_id || req.user.id;
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
// GET /:id/pdf — générer PDF devis (portail client)
router.get('/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT q.*, cl.full_name, cl.company_name, cl.email, cl.phone,
                    cl.address, cl.city, cl.province, cl.postal_code
             FROM quotes q
             JOIN clients cl ON q.client_id = cl.id
             WHERE q.id = $1 AND q.client_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Devis introuvable.' });
        const row = result.rows[0];
        const quote = { ...row };
        const client = { full_name: row.full_name, email: row.email, phone: row.phone, company_name: row.company_name, address: row.address, city: row.city, province: row.province, postal_code: row.postal_code };
        const { generateQuotePDF } = require('./pdf-templates');
        await generateQuotePDF(res, quote, client);
    } catch (e) {
        console.error('Quote PDF client error:', e);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});

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
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS service_type VARCHAR(100)`).catch(() => { });
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP`).catch(() => { });
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
        // Migrations douces
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS quote_id INTEGER`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS amount_ttc NUMERIC(10,2)`).catch(() => { });
        // Migrations douces pour colonnes signature
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_signature_data TEXT`).catch(() => { });
        await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`).catch(() => { });

        const signatureData = req.body && req.body.signature_data ? req.body.signature_data : null;

        const result = await pool.query(
            `UPDATE quotes SET status='accepted', accepted_at=NOW(), signed_at=NOW(), updated_at=NOW(),
             client_signature_data=$3
             WHERE id=$1 AND client_id=$2 AND status='pending' RETURNING *`,
            [req.params.id, req.user.id, signatureData]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quote not found or already processed.' });
        const quote = result.rows[0];

        // Créer automatiquement un contrat lié au devis
        try {
            await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS quote_id INTEGER`).catch(() => { });
            const year = new Date().getFullYear();
            const count = await pool.query("SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
            const num = parseInt(count.rows[0].count) + 1;
            const contractNumber = `CT-${year}-${String(num).padStart(3, '0')}`;
            const contractResult = await pool.query(
                `INSERT INTO contracts (client_id, quote_id, contract_number, title, status, amount_ttc, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW()) RETURNING *`,
                [quote.client_id, quote.id, contractNumber,
                quote.title || ('Contrat de service — ' + quote.quote_number),
                quote.amount_ttc]
            );
            console.log('[workflow] Contrat', contractNumber, 'créé automatiquement pour devis', quote.quote_number);
            const newCtLocal = contractResult.rows[0];
            // Email + chat : nouveau contrat à signer
            if (_email) {
                pool.query('SELECT * FROM clients WHERE id=$1', [quote.client_id]).then(r => {
                    if (r.rows[0]) _email.sendEmail(r.rows[0].email, _email.tplNewContract(r.rows[0], newCtLocal)).catch(() => { });
                }).catch(() => { });
            }
            pool.query(`INSERT INTO messages (client_id, sender, content, is_read, created_at) VALUES ($1, $2, false, NOW())`,
                [quote.client_id, 'Devis ' + quote.quote_number + ' accepté — Contrat ' + newCtLocal.contract_number + ' créé. Votre signature est requise pour démarrer les travaux.']).catch(() => { });
            // Notifier admin
            if (_email) {
                pool.query('SELECT * FROM clients WHERE id=$1', [quote.client_id]).then(r => {
                    if (r.rows[0]) _email.notifyAdmin(_email.tplAdminQuoteAccepted(r.rows[0], quote)).catch(() => { });
                }).catch(() => { });
            }
            // Insérer le devis accepté dans documents (avec statut Approuvé)
            try {
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(100)`).catch(() => { });
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50)`).catch(() => { });
                await pool.query(
                    `INSERT INTO documents (client_id, title, description, file_type, file_name, category, status, is_read, created_at, updated_at)
                     VALUES ($1, $2, $3, 'pdf', $4, 'Devis', 'Approuvé', false, NOW(), NOW())`,
                    [
                        quote.client_id,
                        quote.quote_number + (quote.title ? ' — ' + quote.title : ''),
                        'Devis accepté le ' + new Date().toLocaleDateString('fr-CA') + ' — ' + (quote.amount_ttc ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(quote.amount_ttc) : ''),
                        quote.quote_number + '.pdf'
                    ]
                );
                console.log('[workflow] Devis', quote.quote_number, 'ajouté aux documents');
            } catch (docErr) {
                console.warn('[workflow] Erreur ajout document devis:', docErr.message);
            }

            return res.json({ success: true, message: 'Devis accepté. Un contrat a été créé.', quote, contract: newCtLocal });
        } catch (contractErr) {
            console.warn('[workflow] Erreur création contrat auto:', contractErr.message);
            return res.json({ success: true, message: 'Quote accepted.', quote });
        }
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