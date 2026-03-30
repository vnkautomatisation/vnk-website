/* ============================================
   VNK Automatisation Inc. - Contracts Routes
   Flux: créer → PDF auto → Dropbox Sign → webhook signé
============================================ */
'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
let _email = null;
try { _email = require('../email'); } catch (e) { }
const { authenticateToken } = require('../middleware/auth');
const { sendSignatureRequest, getSignatureStatus } = require('../services/hellosign');

async function nextContractNumber() {
    const year = new Date().getFullYear();
    const res = await pool.query(
        "SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at) = $1", [year]
    );
    return `CT-${year}-${String(parseInt(res.rows[0].count) + 1).padStart(3, '0')}`;
}

// GET / — liste contrats client
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.client_id, c.contract_number, c.title, c.status,
                    c.file_url, c.signed_at, c.admin_signed_at, c.created_at,
                    c.hellosign_request_id, c.content, c.amount_ttc,
                    q.quote_number, q.amount_ttc as quote_amount_ttc
             FROM contracts c
             LEFT JOIN quotes q ON c.quote_id = q.id
             WHERE c.client_id = $1 AND c.status != 'draft'
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, count: result.rows.length, contracts: result.rows });
    } catch (e) {
        console.error('Get contracts error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /:id/pdf — PDF du contrat pour le client
router.get('/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, q.quote_number, q.amount_ttc, q.description as quote_description, q.title as quote_title,
                    cl.full_name, cl.company_name, cl.email, cl.phone, cl.address, cl.city, cl.province, cl.postal_code
             FROM contracts c
             LEFT JOIN quotes q ON c.quote_id = q.id
             JOIN clients cl ON c.client_id = cl.id
             WHERE c.id = $1 AND c.client_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });
        const row = result.rows[0];
        const contract = { ...row };
        const client = { full_name: row.full_name, email: row.email, phone: row.phone, company_name: row.company_name, address: row.address, city: row.city, province: row.province, postal_code: row.postal_code };
        const quote = row.quote_number ? { quote_number: row.quote_number, amount_ttc: row.amount_ttc, description: row.quote_description, title: row.quote_title } : null;
        const pdfTemplates = require('./pdf-templates');
        await pdfTemplates.generateContractPDF(res, contract, client, quote);
    } catch (e) {
        console.error('Contract PDF error:', e);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF.' });
    }
});

// GET /:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, q.quote_number, q.amount_ttc, cl.full_name, cl.company_name, cl.email
             FROM contracts c
             LEFT JOIN quotes q ON c.quote_id = q.id
             JOIN clients cl ON c.client_id = cl.id
             WHERE c.id = $1 AND c.client_id = $2`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });
        res.json({ success: true, contract: result.rows[0] });
    } catch (e) {
        console.error('Get contract error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST / — créer contrat (admin)
// Body: { client_id, quote_id?, mandate_id?, title, content?, file_url? }
router.post('/', async (req, res) => {
    try {
        const { client_id, quote_id, mandate_id, title, content, file_url } = req.body;

        if (!client_id || !title)
            return res.status(400).json({ success: false, message: 'client_id et title sont obligatoires.' });

        // Récupérer client
        const clientRes = await pool.query('SELECT * FROM clients WHERE id = $1', [client_id]);
        if (!clientRes.rows.length)
            return res.status(404).json({ success: false, message: 'Client introuvable.' });
        const client = clientRes.rows[0];

        // Récupérer devis si fourni
        let quote = null;
        if (quote_id) {
            const qr = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
            if (qr.rows.length) quote = qr.rows[0];
        }

        // Numéro auto + contenu auto
        const contractNumber = await nextContractNumber();
        const contractContent = content || (quote
            ? `Services d'automatisation industrielle conformément au devis ${quote.quote_number}.\n\n${quote.description || ''}`
            : "Services d'automatisation industrielle selon entente préalable.");

        // Insérer en DB
        const contractRes = await pool.query(
            `INSERT INTO contracts
                (client_id, quote_id, mandate_id, contract_number, title, content, file_url, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',NOW(),NOW()) RETURNING *`,
            [client_id, quote_id || null, mandate_id || null, contractNumber, title, contractContent, file_url || null]
        );
        const contract = contractRes.rows[0];

        // URL du PDF : file_url fourni OU lien vers notre endpoint PDF
        const domain = process.env.APP_URL || ('https://' + (process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000'));
        const pdfUrl = file_url || `${domain}/api/contracts/${contract.id}/pdf`;

        // Envoyer à Dropbox Sign
        const signResult = await sendSignatureRequest({
            clientEmail: client.email,
            clientName: client.full_name,
            title: `${contractNumber} — ${title}`,
            documentUrl: pdfUrl,
        });

        if (signResult.success && signResult.signatureRequestId) {
            await pool.query(
                `UPDATE contracts SET hellosign_request_id=$1, status='pending_signature', updated_at=NOW() WHERE id=$2`,
                [signResult.signatureRequestId, contract.id]
            );
            contract.status = 'pending_signature';
            contract.hellosign_request_id = signResult.signatureRequestId;
        }

        res.status(201).json({
            success: true,
            message: signResult.success
                ? `Contrat ${contractNumber} créé et envoyé pour signature à ${client.email}.`
                : `Contrat ${contractNumber} créé. Signature non envoyée : ${signResult.message}`,
            contract,
            signature: signResult
        });

    } catch (e) {
        console.error('Create contract error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur : ' + e.message });
    }
});

// PUT /:id/sign — signer manuellement (admin)
router.put('/:id/sign', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE contracts SET status='signed', signed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });
        res.json({ success: true, message: 'Contrat marqué comme signé.', contract: result.rows[0] });
    } catch (e) {
        console.error('Sign contract error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /:id/resend — renvoyer la demande de signature
router.put('/:id/resend', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, cl.full_name, cl.email FROM contracts c JOIN clients cl ON c.client_id=cl.id WHERE c.id=$1`,
            [req.params.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });

        const c = result.rows[0];
        const domain = process.env.APP_URL || ('https://' + (process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000'));
        const pdfUrl = c.file_url || `${domain}/api/contracts/${c.id}/pdf`;

        const signResult = await sendSignatureRequest({
            clientEmail: c.email, clientName: c.full_name,
            title: `${c.contract_number} — ${c.title}`, documentUrl: pdfUrl,
        });

        if (signResult.success) {
            await pool.query(
                `UPDATE contracts SET hellosign_request_id=$1, status='pending_signature', updated_at=NOW() WHERE id=$2`,
                [signResult.signatureRequestId, c.id]
            );
        }

        res.json({
            success: signResult.success,
            message: signResult.success ? `Demande renvoyée à ${c.email}.` : signResult.message
        });
    } catch (e) {
        console.error('Resend error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /:id/status — statut Dropbox Sign
router.get('/:id/status', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT hellosign_request_id, status FROM contracts WHERE id=$1 AND client_id=$2',
            [req.params.id, req.user.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });

        const c = result.rows[0];
        if (!c.hellosign_request_id)
            return res.json({ success: true, status: c.status, message: 'Demande non encore envoyée.' });

        const statusResult = await getSignatureStatus(c.hellosign_request_id);
        if (statusResult.success && statusResult.isComplete) {
            await pool.query(
                `UPDATE contracts SET status='signed', signed_at=NOW(), updated_at=NOW() WHERE id=$1`,
                [req.params.id]
            );
        }
        res.json({ success: true, status: statusResult.status, isComplete: statusResult.isComplete });
    } catch (e) {
        console.error('Contract status error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /webhook — HelloSign webhook
router.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        if (payload?.event) {
            const eventType = payload.event.event_type;
            const sigId = payload.signature_request?.signature_request_id;
            console.log(`HelloSign event: ${eventType}`);

            if (eventType === 'signature_request_signed' && sigId) {
                await pool.query(
                    `UPDATE contracts SET status='signed', signed_at=NOW(), updated_at=NOW() WHERE hellosign_request_id=$1`,
                    [sigId]
                );
            }
            if (eventType === 'signature_request_viewed' && sigId) {
                await pool.query(
                    `UPDATE contracts SET status='viewed', updated_at=NOW() WHERE hellosign_request_id=$1 AND status='pending_signature'`,
                    [sigId]
                );
            }
        }
        res.status(200).send('Hello API Event Received');
    } catch (e) {
        console.error('Webhook error:', e);
        res.status(200).send('Hello API Event Received');
    }
});


// ── Créer une facture automatiquement après signature des deux parties ──
async function _autoCreateInvoice(pool, contract) {
    try {
        // Vérifier si une facture existe déjà pour ce contrat
        const existing = await pool.query(
            `SELECT id FROM invoices WHERE contract_id = $1`,
            [contract.id]
        ).catch(() => ({ rows: [] }));
        if (existing.rows.length) return; // Déjà créée

        // Ajouter colonne contract_id si manquante
        await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id)`).catch(() => { });

        // Récupérer le devis associé si disponible
        let amount_ht = contract.amount_ht || 0;
        let amount_ttc = contract.amount_ttc || 0;
        let tps = contract.tps_amount || 0;
        let tvq = contract.tvq_amount || 0;

        if (!amount_ttc && contract.quote_id) {
            const quote = await pool.query('SELECT * FROM quotes WHERE id=$1', [contract.quote_id]).catch(() => ({ rows: [] }));
            if (quote.rows[0]) {
                amount_ht = quote.rows[0].amount_ht || 0;
                tps = quote.rows[0].tps_amount || 0;
                tvq = quote.rows[0].tvq_amount || 0;
                amount_ttc = quote.rows[0].amount_ttc || 0;
            }
        }

        // Numéro de facture automatique
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = parseInt(count.rows[0].count) + 1;
        const invoice_number = `F-${year}-${String(num).padStart(3, '0')}`;

        // Date d'échéance : 30 jours
        const due = new Date(); due.setDate(due.getDate() + 30);

        await pool.query(
            `INSERT INTO invoices (client_id, contract_id, invoice_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid',$10,NOW(),NOW())`,
            [contract.client_id, contract.id, invoice_number,
            `Contrat de service — ${contract.title || contract.contract_number}`,
            `Conformément au contrat ${contract.contract_number}`,
                amount_ht, tps, tvq, amount_ttc, due.toISOString().split('T')[0]]
        );
        console.log(`[workflow] Facture ${invoice_number} créée automatiquement pour contrat ${contract.contract_number}`);
    } catch (e) {
        console.warn('[workflow] Erreur création facture auto:', e.message);
    }
}

// POST /:id/client-sign — signature dessin du client (canvas base64)
router.post('/:id/client-sign', authenticateToken, async (req, res) => {
    try {
        const { signature_data, ip_address } = req.body;
        if (!signature_data || !signature_data.startsWith('data:image/')) {
            return res.status(400).json({ success: false, message: 'Données de signature invalides.' });
        }

        // Vérifier que le contrat appartient bien à ce client
        const check = await pool.query(
            `SELECT id FROM contracts WHERE id=$1 AND client_id=$2`,
            [req.params.id, req.user.id]
        );
        if (!check.rows.length)
            return res.status(404).json({ success: false, message: 'Contrat introuvable.' });

        // Migrations douces — ajouter colonnes si elles n'existent pas encore
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_signature_data TEXT`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_signature_ip VARCHAR(64)`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signature_data TEXT`).catch(() => { });

        const ip = ip_address || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

        // Récupérer l'état actuel pour savoir si l'admin a déjà signé
        const current = await pool.query('SELECT admin_signed_at FROM contracts WHERE id=$1', [req.params.id]);
        const adminAlreadySigned = current.rows.length && !!current.rows[0].admin_signed_at;
        // Status = signed seulement si les DEUX ont signé
        const newStatus = adminAlreadySigned ? 'signed' : 'pending';

        const result = await pool.query(
            `UPDATE contracts
             SET client_signature_data = $1,
                 client_signature_ip   = $2,
                 signed_at             = NOW(),
                 status                = $3,
                 updated_at            = NOW()
             WHERE id = $4
             RETURNING *`,
            [signature_data, ip.split(',')[0].trim(), newStatus, req.params.id]
        );

        const signedContract = result.rows[0];
        if (adminAlreadySigned && signedContract.status === 'signed') {
            _autoCreateInvoice(pool, signedContract);
            // Email confirmation contrat signé
            if (_email) {
                pool.query('SELECT * FROM clients WHERE id=$1', [signedContract.client_id]).then(r => {
                    if (r.rows[0]) _email.sendEmail(r.rows[0].email, _email.tplContractSigned(r.rows[0], signedContract)).catch(() => { });
                }).catch(() => { });
            }
        } else if (!adminAlreadySigned) {
            // Client a signé, en attente admin — email d'info
            if (_email) {
                pool.query('SELECT * FROM clients WHERE id=$1', [signedContract.client_id]).then(r => {
                    if (r.rows[0]) _email.sendEmail(r.rows[0].email, _email.tplNewContract(r.rows[0], signedContract)).catch(() => { });
                }).catch(() => { });
            }
        }
        // Notifier admin si client vient de signer
        if (!adminAlreadySigned && _email) {
            pool.query('SELECT * FROM clients WHERE id=$1', [signedContract.client_id]).then(r => {
                if (r.rows[0]) _email.notifyAdmin(_email.tplAdminContractSignedByClient(r.rows[0], signedContract)).catch(() => { });
            }).catch(() => { });
        }
        res.json({ success: true, message: adminAlreadySigned ? 'Contrat signé des deux parties.' : 'Signature enregistrée — en attente de la signature VNK.', contract: signedContract });
    } catch (e) {
        console.error('Client sign error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur : ' + e.message });
    }
});

// POST /:id/admin-sign — signature dessin de l'admin (canvas base64) [client routes]
router.post('/:id/admin-sign-canvas', async (req, res) => {
    try {
        const { signature_data } = req.body;
        if (!signature_data || !signature_data.startsWith('data:image/')) {
            return res.status(400).json({ success: false, message: 'Données de signature invalides.' });
        }
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signature_data TEXT`).catch(() => { });
        await pool.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`).catch(() => { });
        const result = await pool.query(
            `UPDATE contracts SET admin_signature_data=$1, admin_signed_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
            [signature_data, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Contrat introuvable.' });
        res.json({ success: true, contract: result.rows[0] });
    } catch (e) {
        console.error('Admin sign canvas error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur : ' + e.message });
    }
});

module.exports = router;