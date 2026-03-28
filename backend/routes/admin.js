/* ============================================
   VNK Admin Routes — Patch nouvelles routes
   Ajouter ces routes dans backend/routes/admin.js
   APRÈS les routes existantes, AVANT module.exports
   ============================================ */

// ============================================
// CLIENTS — toggle actif/archivé
// ============================================
router.put('/clients/:id/toggle-active', authenticateAdmin, async (req, res) => {
    try {
        const current = await pool.query('SELECT is_active FROM clients WHERE id=$1', [req.params.id]);
        if (!current.rows.length) return res.status(404).json({ success: false, message: 'Client non trouvé.' });
        const newState = !current.rows[0].is_active;
        await pool.query('UPDATE clients SET is_active=$1 WHERE id=$2', [newState, req.params.id]);
        res.json({ success: true, is_active: newState });
    } catch (err) {
        console.error('toggle-active error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// MESSAGES — marquer comme lu
// ============================================
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

router.put('/messages/mark-all-read', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(`UPDATE messages SET is_read=true WHERE sender='client' AND is_read=false`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PAYMENTS — Transactions Stripe
// ============================================
router.get('/payments/transactions', authenticateAdmin, async (req, res) => {
    try {
        // Récupérer les paiements depuis la table payments
        const result = await pool.query(`
            SELECT p.*, i.invoice_number, i.client_id, c.full_name as client_name
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN clients c ON i.client_id = c.id
            ORDER BY p.paid_at DESC
        `);
        res.json({ success: true, transactions: result.rows });
    } catch (err) {
        // Fallback si table payments n'existe pas encore
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

        // Récupérer le paiement Stripe associé à la facture
        const invResult = await pool.query(
            'SELECT * FROM invoices WHERE id=$1', [invoice_id]
        );
        if (!invResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Facture non trouvée.' });
        }

        const inv = invResult.rows[0];

        // Si Stripe est configuré, tenter un vrai remboursement
        if (process.env.STRIPE_SECRET_KEY && inv.stripe_payment_intent_id) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: inv.stripe_payment_intent_id,
                    amount: Math.round(amount * 100), // en centimes
                    reason: reason || 'requested_by_customer'
                });

                // Enregistrer le remboursement
                const year = new Date().getFullYear();
                const count = await pool.query("SELECT COUNT(*) FROM refunds WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
                const num = `RMB-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

                await pool.query(
                    `INSERT INTO refunds (client_id, invoice_id, refund_number, reason, amount, tps_amount, tvq_amount, total_amount, status, notes, created_at)
                     VALUES ($1,$2,$3,$4,$5,0,0,$5,'processed','Remboursement Stripe: '+$6,NOW())`,
                    [inv.client_id, invoice_id, num, reason || 'Remboursement client', amount, refund.id]
                );

                return res.json({ success: true, refund_id: refund.id, message: 'Remboursement Stripe initié.' });
            } catch (stripeErr) {
                return res.status(400).json({ success: false, message: `Erreur Stripe: ${stripeErr.message}` });
            }
        }

        // Fallback: enregistrer manuellement comme note de crédit
        const year = new Date().getFullYear();
        const count = await pool.query("SELECT COUNT(*) FROM refunds WHERE EXTRACT(YEAR FROM created_at)=$1", [year]);
        const num = `RMB-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
        const tps = parseFloat((amount * 0.05).toFixed(2));
        const tvq = parseFloat((amount * 0.09975).toFixed(2));
        const total = amount + tps + tvq;

        await pool.query(
            `INSERT INTO refunds (client_id, invoice_id, refund_number, reason, amount, tps_amount, tvq_amount, total_amount, status, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW())`,
            [inv.client_id, invoice_id, num, reason || 'Remboursement client', amount, tps, tvq, total,
                'Remboursement manuel — Aucun Stripe payment intent trouvé']
        );

        res.json({ success: true, message: 'Remboursement enregistré comme note de crédit (manuel).' });
    } catch (err) {
        console.error('Refund error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// MESSAGES — envoi avec pièce jointe (fallback URL)
// ============================================
router.post('/messages/:clientId/with-attachment', authenticateAdmin, async (req, res) => {
    try {
        // Sans stockage S3, on enregistre juste le texte
        const content = req.body?.content || '(pièce jointe)';
        const result = await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at)
             VALUES ($1, 'vnk', $2, false, NOW()) RETURNING *`,
            [req.params.clientId, content]
        );
        await pool.query(
            `UPDATE messages SET is_read=true WHERE client_id=$1 AND sender='client' AND is_read=false`,
            [req.params.clientId]
        );
        res.status(201).json({ success: true, message: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});