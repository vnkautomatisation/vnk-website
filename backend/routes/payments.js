/* ============================================
   VNK Automatisation Inc. - Payments Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
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
            'SELECT * FROM invoices WHERE id = $1 AND client_id = $2 AND status = $3',
            [invoice_id, req.user.id, 'unpaid']
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

        // Handle payment success
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const invoiceId = paymentIntent.metadata.invoice_id;

            await pool.query(
                `UPDATE invoices 
         SET status = 'paid', paid_at = NOW(), 
             stripe_payment_id = $1, updated_at = NOW()
         WHERE id = $2`,
                [paymentIntent.id, invoiceId]
            );

            // Record payment
            await pool.query(
                `INSERT INTO payments (invoice_id, amount, stripe_payment_id, status, paid_at)
         VALUES ($1, $2, $3, 'completed', NOW())`,
                [invoiceId, paymentIntent.amount / 100, paymentIntent.id]
            );

            console.log(`Payment confirmed for invoice ID: ${invoiceId}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});

module.exports = router;