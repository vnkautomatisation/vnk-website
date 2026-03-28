/* ============================================
   VNK Automatisation Inc. - Contracts Routes
   Flux: créer → PDF auto → Dropbox Sign → webhook signé
============================================ */
'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
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
            `SELECT c.id, c.contract_number, c.title, c.status,
                    c.file_url, c.signed_at, c.created_at, c.hellosign_request_id,
                    q.quote_number, q.amount_ttc
             FROM contracts c
             LEFT JOIN quotes q ON c.quote_id = q.id
             WHERE c.client_id = $1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, count: result.rows.length, contracts: result.rows });
    } catch (e) {
        console.error('Get contracts error:', e);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
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

module.exports = router;