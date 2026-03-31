require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Cache headers middleware ──────────────────────────────────
// HTML → jamais en cache (toujours frais)
// CSS/JS → ETag (revalidation)
// Images → 1 heure
app.use((req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.html' || req.path === '/') {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    } else if (ext === '.css' || ext === '.js') {
        res.set('Cache-Control', 'no-cache');  // force revalidation via ETag
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
        res.set('Cache-Control', 'public, max-age=3600');
    }
    next();
});

// ── Fichiers statiques ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Routes API ────────────────────────────────────────────────
// ── Email inbound webhook (public — pas d'auth, pour SendGrid/Mailgun) ──
const _adminRoutes = require('./backend/routes/admin');
app.post('/api/email-inbound', (req, res) => {
    // Forward vers la route admin sans authentification
    req.url = '/email-inbound';
    _adminRoutes(req, res, (err) => res.status(500).json({ error: err?.message }));
});

app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/clients', require('./backend/routes/clients'));
app.use('/api/mandates', require('./backend/routes/mandates'));
app.use('/api/quotes', require('./backend/routes/quotes'));
app.use('/api/invoices', require('./backend/routes/invoices'));
app.use('/api/contracts', require('./backend/routes/contracts'));
app.use('/api/messages', require('./backend/routes/messages'));
app.use('/api/documents', require('./backend/routes/documents'));
app.use('/api/payments', require('./backend/routes/payments'));
app.use('/api/contact', require('./backend/routes/contact'));
app.use('/api/analytics', require('./backend/routes/analytics'));
app.use('/api/calendly', require('./backend/routes/calendly'));
app.use('/api/calendar', require('./backend/routes/calendar'));

// ── Stripe (optionnel) ────────────────────────────────────────
try {
    app.use('/api/stripe', require('./backend/routes/stripe'));
} catch (e) {
    console.warn('Stripe non configuré — payments non disponibles');
}

// ── Routes de test (DEV SEULEMENT — supprimer en production) ──
if (process.env.NODE_ENV !== 'production') {
    // Test d'envoi email : http://localhost:3000/test-email
    app.get('/test-email', async (req, res) => {
        const _email = require('./backend/email');
        const fakeClient = { full_name: 'Jean Tremblay', email: 'jean@industries-xyz.com', company_name: 'Industries XYZ Inc.' };
        const fakeQuote = { quote_number: 'D-2026-TEST', title: 'Test email', amount_ht: 1000, tps_amount: 50, tvq_amount: 99.75, amount_ttc: 1149.75, expiry_date: new Date(Date.now() + 30 * 86400000) };
        try {
            await _email.sendEmail(fakeClient.email, _email.tplNewQuote(fakeClient, fakeQuote));
            await _email.notifyAdmin(_email.tplAdminNewMessage(fakeClient, { content: 'Ceci est un test de notification admin.', channel: 'chat' }));
            res.json({ success: true, message: 'Emails envoyés — vérifiez votre boîte mail.' });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // Prévisualisation template HTML : http://localhost:3000/preview-email/quote
    app.get('/preview-email/:type', (req, res) => {
        const _email = require('./backend/email');
        const cl = { full_name: 'Jean Tremblay', email: 'jean@industries-xyz.com', company_name: 'Industries XYZ Inc.' };
        const now = new Date();
        const templates = {
            quote: _email.tplNewQuote(cl, { quote_number: 'D-2026-001', title: 'Support PLC Siemens S7-1500', amount_ht: 1000, tps_amount: 50, tvq_amount: 99.75, amount_ttc: 1149.75, expiry_date: now }),
            contract: _email.tplNewContract(cl, { contract_number: 'CT-2026-001', title: 'Contrat de service', created_at: now, admin_signed_at: now }),
            contract_signed: _email.tplContractSigned(cl, { contract_number: 'CT-2026-001', title: 'Contrat de service', signed_at: now }),
            invoice: _email.tplNewInvoice(cl, { invoice_number: 'F-2026-001', title: 'Support PLC', amount_ht: 1000, tps_amount: 50, tvq_amount: 99.75, amount_ttc: 1149.75, due_date: now, created_at: now }),
            paid: _email.tplInvoicePaid(cl, { invoice_number: 'F-2026-001', amount_ttc: 1149.75, paid_at: now, stripe_payment_intent_id: 'pi_test_abc123' }),
            document: _email.tplNewDocument(cl, { title: 'Rapport diagnostic Ligne 3', category: 'Rapports techniques', file_type: 'pdf' }),
            message: _email.tplNewMessage(cl, { content: 'Bonjour Jean, votre mandat avance bien ! Progression à 80%.' }),
            mandate: _email.tplMandateUpdate(cl, { title: 'Support PLC Siemens S7-1500 — Ligne 3', progress: 80, status: 'active', notes: 'Calibration en cours' }),
            admin_message: _email.tplAdminNewMessage(cl, { content: 'Bonjour, j\'ai un problème urgent avec ma ligne 3.', channel: 'chat' }),
            admin_email_recv: _email.tplAdminNewMessage(cl, { content: 'Objet: Question sur ma facture\n\nBonjour, je voudrais des précisions sur la facture F-2026-001.', channel: 'email_received' }),
            admin_client: _email.tplAdminNewClient({ full_name: 'Marie Dupont', email: 'marie@fabrique-nord.com', company_name: 'Fabrique Nord Inc.', phone: '418-555-0123', sector: 'Fabrication industrielle' }),
            admin_payment: _email.tplAdminPaymentReceived(cl, { invoice_number: 'F-2026-001', amount_ttc: 1149.75, paid_at: now, stripe_payment_intent_id: 'pi_3abc123def456' }),
            admin_quote: _email.tplAdminQuoteAccepted(cl, { quote_number: 'D-2026-001', title: 'Support PLC Siemens S7-1500', amount_ttc: 1149.75 }),
            admin_contract: _email.tplAdminContractSignedByClient(cl, { contract_number: 'CT-2026-001', title: 'Contrat de service', signed_at: now }),
            admin_dispute: _email.tplAdminDisputeOpened(cl, { title: 'Litige — Facturation incorrecte', description: 'Le montant facturé ne correspond pas au devis D-2026-001.', priority: 'high' }),
            admin_refund: _email.tplAdminRefundRequested(cl, { refund_number: 'RMB-2026-001', total_amount: 574.88, reason: 'Service non rendu à 100%' }),
            admin_contact: _email.tplAdminContactForm({ name: 'Robert Tremblay', email: 'robert@usine-abc.com', company: 'Usine ABC Ltée', service: 'Support PLC', message: 'Bonjour, nous cherchons un partenaire pour la maintenance de nos automates Siemens. Pouvez-vous nous contacter ?' }),
        };
        const tpl = templates[req.params.type];
        if (!tpl) return res.json({ templates_disponibles: Object.keys(templates).map(k => '/preview-email/' + k) });
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(tpl.html);
    });
}

// ── Catch-all ─────────────────────────────────────────────────
// Ne sert JAMAIS index.html pour les requêtes .html explicites
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') return next();
    if (ext === '.html') {
        // Servir le fichier HTML demandé directement
        return res.sendFile(path.join(__dirname, 'frontend', req.path), err => {
            if (err) res.status(404).send('Page non trouvée');
        });
    }
    // Pas d'extension → index.html (SPA fallback)
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ── Démarrage ─────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`VNK Automatisation Inc. — http://localhost:${PORT}`);
});

// ── WebSocket ─────────────────────────────────────────────────
try {
    const { initWebSocket } = require('./backend/ws-server');
    initWebSocket(server);
    console.log('WebSocket initialisé sur /ws');
} catch (e) {
    console.warn('WebSocket non disponible:', e.message);
}

module.exports = { app, server };