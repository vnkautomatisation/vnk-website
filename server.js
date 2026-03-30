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
app.use('/api/calendly', require('./backend/routes/calendly'));

// ── Stripe (optionnel) ────────────────────────────────────────
try {
    app.use('/api/stripe', require('./backend/routes/stripe'));
} catch (e) {
    console.warn('Stripe non configuré — payments non disponibles');
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