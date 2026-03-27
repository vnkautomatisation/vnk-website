/* ============================================
   VNK Automatisation Inc. - Contracts Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendSignatureRequest, getSignatureStatus } = require('../services/hellosign');

// GET /api/contracts — get client contracts
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.status, c.signature_date, c.signature_url,
              c.created_at, q.quote_number, q.title, q.amount_ttc
       FROM contracts c
       JOIN quotes q ON c.quote_id = q.id
       WHERE c.client_id = $1
       ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            count: result.rows.length,
            contracts: result.rows
        });

    } catch (error) {
        console.error('Get contracts error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/contracts/:id — get single contract
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, q.quote_number, q.title, q.amount_ttc,
              cl.full_name, cl.company_name, cl.email
       FROM contracts c
       JOIN quotes q ON c.quote_id = q.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE c.id = $1 AND c.client_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contract not found.'
            });
        }

        res.json({
            success: true,
            contract: result.rows[0]
        });

    } catch (error) {
        console.error('Get contract error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/contracts — create contract from accepted quote (admin)
router.post('/', async (req, res) => {
    try {
        const { quote_id, content } = req.body;

        // Get quote and client info
        const quoteResult = await pool.query(
            `SELECT q.*, cl.full_name, cl.email, cl.company_name
       FROM quotes q
       JOIN clients cl ON q.client_id = cl.id
       WHERE q.id = $1 AND q.status = 'accepted'`,
            [quote_id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Accepted quote not found.'
            });
        }

        const quote = quoteResult.rows[0];

        // Create contract in database
        const contractResult = await pool.query(
            `INSERT INTO contracts (quote_id, client_id, content, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING *`,
            [quote_id, quote.client_id, content]
        );

        const contract = contractResult.rows[0];

        // Send HelloSign signature request if configured
        const signatureResult = await sendSignatureRequest({
            clientEmail: quote.email,
            clientName: quote.full_name,
            title: `Service Contract — ${quote.title}`,
            documentUrl: process.env.CONTRACT_TEMPLATE_URL || null
        });

        // Update contract with HelloSign ID if successful
        if (signatureResult.success) {
            await pool.query(
                `UPDATE contracts 
         SET hellosign_request_id = $1, updated_at = NOW()
         WHERE id = $2`,
                [signatureResult.signatureRequestId, contract.id]
            );
        }

        res.status(201).json({
            success: true,
            message: 'Contract created successfully.',
            contract,
            signature: signatureResult
        });

    } catch (error) {
        console.error('Create contract error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/contracts/:id/status — check signature status
router.get('/:id/status', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT hellosign_request_id, status FROM contracts WHERE id = $1 AND client_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contract not found.'
            });
        }

        const contract = result.rows[0];

        if (!contract.hellosign_request_id) {
            return res.json({
                success: true,
                status: 'pending',
                message: 'Signature request not yet sent.'
            });
        }

        // Check status with HelloSign
        const statusResult = await getSignatureStatus(contract.hellosign_request_id);

        // Update database if completed
        if (statusResult.success && statusResult.isComplete) {
            await pool.query(
                `UPDATE contracts 
         SET status = 'signed', signature_date = NOW(), updated_at = NOW()
         WHERE id = $1`,
                [req.params.id]
            );
        }

        res.json({
            success: true,
            status: statusResult.status,
            isComplete: statusResult.isComplete
        });

    } catch (error) {
        console.error('Contract status error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/contracts/webhook — HelloSign webhook
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;

        if (event.event && event.event.event_type === 'signature_request_signed') {
            const signatureRequestId = event.signature_request.signature_request_id;

            // Update contract status
            await pool.query(
                `UPDATE contracts 
         SET status = 'signed', signature_date = NOW(), updated_at = NOW()
         WHERE hellosign_request_id = $1`,
                [signatureRequestId]
            );

            console.log(`Contract signed — HelloSign ID: ${signatureRequestId}`);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('HelloSign webhook error:', error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;