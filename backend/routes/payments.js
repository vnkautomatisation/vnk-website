/* ============================================
   VNK Automatisation Inc. - Payments Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
let _email = null;
try { _email = require('../email'); } catch (e) { }
const { authenticateToken } = require('../middleware/auth');

// Initialize Stripe
let stripe;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
    console.warn('Stripe not configured — payments will be unavailable');
}

// POST /api/payments/create-intent — create Stripe payment intent
router.post('/create-intent', authenticateToken, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                success: false,
                message: 'Payment service not configured yet.'
            });
        }

        const { invoice_id } = req.body;

        // Get invoice
        const invoiceResult = await pool.query(
            "SELECT * FROM invoices WHERE id = $1 AND client_id = $2 AND status IN ('unpaid', 'overdue')",
            [invoice_id, req.user.id]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or already paid.'
            });
        }

        const invoice = invoiceResult.rows[0];

        // Create Stripe payment intent (amount in cents)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(invoice.amount_ttc * 100),
            currency: 'cad',
            metadata: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                client_id: req.user.id
            }
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            amount: invoice.amount_ttc
        });

    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({ success: false, message: 'Payment error.' });
    }
});

// POST /api/payments/webhook — Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ received: false });
        }

        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook signature error:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Ajouter colonnes si manquantes
        await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`).catch(() => { });

        // Handle payment success
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const invoiceId = paymentIntent.metadata.invoice_id;

            await pool.query(
                `UPDATE invoices 
         SET status = 'paid', paid_at = NOW(), 
             stripe_payment_intent_id = $1, updated_at = NOW()
         WHERE id = $2`,
                [paymentIntent.id, invoiceId]
            );

            // Record payment
            await pool.query(
                `INSERT INTO payments (invoice_id, amount, status, paid_at)
         VALUES ($1, $2, 'completed', NOW())`,
                [invoiceId, paymentIntent.amount / 100]
            ).catch(() => { });

            console.log(`Payment confirmed for invoice ID: ${invoiceId}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});


// POST /api/payments/confirm — confirmation côté client après paiement Stripe réussi
// Utilisé quand le webhook n'est pas configuré (local dev ou pas de webhook secret)
router.post('/confirm', authenticateToken, async (req, res) => {
    try {
        if (!stripe) return res.status(503).json({ success: false, message: 'Stripe non configuré.' });
        const { payment_intent_id, invoice_id } = req.body;
        // Ajouter colonnes si manquantes
        await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`).catch(() => { });
        await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id INTEGER`).catch(() => { });
        if (!payment_intent_id || !invoice_id) {
            return res.status(400).json({ success: false, message: 'payment_intent_id et invoice_id requis.' });
        }
        // Vérifier le statut du paiement directement via l'API Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ success: false, message: 'Paiement non confirmé par Stripe.' });
        }
        // Vérifier que la facture appartient au client
        const inv = await pool.query(
            "SELECT * FROM invoices WHERE id=$1 AND client_id=$2",
            [invoice_id, req.user.id]
        );
        if (!inv.rows.length) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
        if (inv.rows[0].status === 'paid') return res.json({ success: true, message: 'Déjà payée.' });
        // Marquer payée
        await pool.query(
            `UPDATE invoices SET status='paid', paid_at=NOW(), stripe_payment_intent_id=$1, updated_at=NOW() WHERE id=$2`,
            [payment_intent_id, invoice_id]
        );
        // Enregistrer le paiement (colonnes de base seulement)
        await pool.query(
            `INSERT INTO payments (invoice_id, amount, status, paid_at, created_at)
             VALUES ($1,$2,'completed',NOW(),NOW())`,
            [invoice_id, paymentIntent.amount / 100]
        ).catch(() => { });
        console.log('Payment confirmed via client: invoice', invoice_id, payment_intent_id);
        res.json({ success: true, message: 'Paiement confirmé.' });
        // Email confirmation paiement
        if (_email) {
            const invFull = await pool.query('SELECT * FROM invoices WHERE id=$1', [invoice_id]).catch(() => ({ rows: [] }));
            const clFull = invFull.rows[0] ? await pool.query('SELECT * FROM clients WHERE id=$1', [invFull.rows[0].client_id]).catch(() => ({ rows: [] })) : { rows: [] };
            if (invFull.rows[0] && clFull.rows[0]) {
                const paidInv = { ...invFull.rows[0], stripe_payment_intent_id: payment_intent_id };
                _email.sendEmail(clFull.rows[0].email, _email.tplInvoicePaid(clFull.rows[0], paidInv)).catch(() => { });
                _email.notifyAdmin(_email.tplAdminPaymentReceived(clFull.rows[0], paidInv)).catch(() => { });
            }
        }
    } catch (err) {
        console.error('Confirm payment error:', err.message);
        res.status(500).json({ success: false, message: 'Erreur: ' + err.message });
    }
});

module.exports = router;