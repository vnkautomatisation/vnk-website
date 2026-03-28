/* ============================================
   VNK Automatisation Inc. - Main Server
   Value. Network. Knowledge.
   ============================================ */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Stripe webhook must use raw body ----
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Static files ----
app.use(express.static(path.join(__dirname, 'frontend')));

// ---- API Routes ----
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/contact', require('./backend/routes/contact'));
app.use('/api/clients', require('./backend/routes/clients'));
app.use('/api/quotes', require('./backend/routes/quotes'));
app.use('/api/invoices', require('./backend/routes/invoices'));
app.use('/api/payments', require('./backend/routes/payments'));
app.use('/api/mandates', require('./backend/routes/mandates'));
app.use('/api/messages', require('./backend/routes/messages'));
app.use('/api/documents', require('./backend/routes/documents'));
app.use('/api/contracts', require('./backend/routes/contracts'));
app.use('/api/calendly', require('./backend/routes/calendly'));
app.use('/api/admin', require('./backend/routes/admin'));

// Routes admin — le dashboard préfixe avec /api/admin/
app.use('/api/admin/quotes', require('./backend/routes/quotes'));
app.use('/api/admin/invoices', require('./backend/routes/invoices'));
app.use('/api/admin/clients', require('./backend/routes/clients'));
app.use('/api/admin/mandates', require('./backend/routes/mandates'));
app.use('/api/admin/messages', require('./backend/routes/messages'));
app.use('/api/admin/documents', require('./backend/routes/documents'));
app.use('/api/admin/contracts', require('./backend/routes/contracts'));
app.use('/api/admin/payments', require('./backend/routes/payments'));
// PDF download routes
app.get('/api/quotes/:id/pdf', require('./backend/routes/pdf').downloadQuotePDF);
app.get('/api/invoices/:id/pdf', require('./backend/routes/pdf').downloadInvoicePDF);
app.get('/api/contracts/:id/pdf', require('./backend/routes/pdf').downloadContractPDF);

// ---- Health check route ----
app.get('/api/health', (req, res) => {
    res.json({
        status: 'VNK Automatisation Inc. — Server operational',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// ---- Error handler ----
const { errorHandler } = require('./backend/middleware/errorHandler');
app.use(errorHandler);

// ---- Serve frontend for all other routes ----
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ---- Start server ----
app.listen(PORT, () => {
    console.log('============================================');
    console.log('  VNK Automatisation Inc.');
    console.log('  Value. Network. Knowledge.');
    console.log('============================================');
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV}`);
    console.log('============================================');
});

module.exports = app;