'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
// ws-server chargé à la demande (évite dépendance circulaire au démarrage)
const { authenticateAdmin } = require('./admin');
const crypto = require('crypto');

// ── Migration auto des tables analytics ──────────────────────
async function migrateAnalytics() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS page_views (
            id          SERIAL PRIMARY KEY,
            session_id  VARCHAR(64),
            client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
            page        VARCHAR(255) NOT NULL,
            referrer    VARCHAR(512),
            user_agent  VARCHAR(512),
            ip_hash     VARCHAR(64),
            duration_ms INTEGER,
            created_at  TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id)`).catch(() => { });
}
migrateAnalytics();

// ── POST /api/analytics/pageview — tracker JS (public, sans auth) ──
router.post('/pageview', async (req, res) => {
    try {
        const { session_id, page, referrer, duration_ms, client_id } = req.body;
        if (!page) return res.json({ ok: false });
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
        const ip_hash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
        const ua = req.headers['user-agent']?.substring(0, 255) || '';
        await pool.query(
            `INSERT INTO page_views (session_id, client_id, page, referrer, user_agent, ip_hash, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [session_id || null, client_id || null, page, referrer || null, ua, ip_hash, duration_ms || null]
        );
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false });
    }
});

// ── GET /api/analytics/dashboard — données pour admin ────────
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const [
            revenueMonths,
            trafficDays,
            trafficToday,
            clientHealth,
            onlineClients
        ] = await Promise.all([

            // Revenus 6 derniers mois
            pool.query(`
                SELECT
                    TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon') as month,
                    DATE_TRUNC('month', paid_at) as month_date,
                    COALESCE(SUM(amount_ttc), 0) as revenue
                FROM invoices
                WHERE status = 'paid'
                  AND paid_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
                GROUP BY DATE_TRUNC('month', paid_at)
                ORDER BY month_date ASC
            `),

            // Trafic site 7 derniers jours
            pool.query(`
                SELECT
                    TO_CHAR(DATE_TRUNC('day', created_at), 'Dy') as day_label,
                    DATE_TRUNC('day', created_at) as day_date,
                    COUNT(DISTINCT session_id) as visits,
                    COUNT(*) as pageviews
                FROM page_views
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY DATE_TRUNC('day', created_at)
                ORDER BY day_date ASC
            `),

            // Visiteurs actifs aujourd'hui
            pool.query(`
                SELECT COUNT(DISTINCT session_id) as today_visits,
                       COUNT(DISTINCT ip_hash) as unique_ips
                FROM page_views
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `),

            // Santé clients (Phase 2) ─────────────────────────
            pool.query(`
                SELECT
                    c.id, c.full_name, c.company_name,
                    c.last_login,
                    EXTRACT(DAY FROM NOW() - c.last_login)::int as days_inactive,
                    (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.status = 'unpaid'
                        AND i.due_date < NOW()) as overdue_invoices,
                    (SELECT COUNT(*) FROM quotes q WHERE q.client_id = c.id AND q.status = 'pending'
                        AND q.created_at < NOW() - INTERVAL '7 days') as pending_quotes_old,
                    (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id AND m.sender = 'client'
                        AND m.created_at > NOW() - INTERVAL '7 days') as recent_messages
                FROM clients c
                WHERE c.is_active = true
                ORDER BY days_inactive DESC NULLS LAST
                LIMIT 20
            `).catch(() => ({ rows: [] })),

            // Pas de vraie présence ici — vient du WS, géré côté frontend
            Promise.resolve({ rows: [] })
        ]);

        // Remplir les jours manquants (7 derniers jours)
        const today = new Date();
        const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        const trafficMap = {};
        trafficDays.rows.forEach(r => {
            const d = new Date(r.day_date);
            const key = d.toISOString().substring(0, 10);
            trafficMap[key] = { visits: parseInt(r.visits), pageviews: parseInt(r.pageviews), label: r.day_label };
        });
        const traffic7 = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().substring(0, 10);
            const dayName = dayLabels[d.getDay()];
            traffic7.push(trafficMap[key] || { visits: 0, pageviews: 0, label: dayName });
        }

        // Remplir les mois manquants (6 derniers mois)
        const revenueMap = {};
        revenueMonths.rows.forEach(r => {
            const key = new Date(r.month_date).toISOString().substring(0, 7);
            revenueMap[key] = { month: r.month, revenue: parseFloat(r.revenue) };
        });
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const revenue6 = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = d.toISOString().substring(0, 7);
            const label = monthNames[d.getMonth()];
            revenue6.push(revenueMap[key] || { month: label, revenue: 0 });
        }

        // Calculer score de santé client
        const clientHealthData = clientHealth.rows.map(c => {
            const issues = [];
            if (c.overdue_invoices > 0) issues.push({ type: 'overdue', label: `${c.overdue_invoices} facture(s) en retard` });
            if (c.days_inactive > 30 && c.days_inactive !== null) issues.push({ type: 'inactive', label: `Inactif depuis ${c.days_inactive}j` });
            if (c.pending_quotes_old > 0) issues.push({ type: 'quote', label: `${c.pending_quotes_old} devis sans réponse` });
            return {
                id: c.id,
                name: c.full_name,
                company: c.company_name,
                lastLogin: c.last_login,
                daysInactive: c.days_inactive,
                issues,
                score: issues.length === 0 ? 'good' : issues.some(i => i.type === 'overdue') ? 'critical' : 'warning'
            };
        });

        res.json({
            success: true,
            revenue6,
            traffic7,
            trafficToday: trafficToday.rows[0],
            clientHealth: clientHealthData
        });
    } catch (err) {
        console.error('Analytics dashboard error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── GET /api/analytics/presence — clients en ligne (admin) ──
router.get('/presence', authenticateAdmin, async (req, res) => {
    try {
        let online = [];
        try {
            const ws = require('../ws-server');
            if (typeof ws.getOnlineClients === 'function') online = ws.getOnlineClients();
        } catch (e) { }
        if (!online.length) return res.json({ success: true, online: [] });
        const ids = online.map(o => o.clientId);
        const result = await pool.query(
            `SELECT id, full_name, company_name, last_login FROM clients WHERE id = ANY($1)`,
            [ids]
        );
        const clientMap = {};
        result.rows.forEach(c => { clientMap[c.id] = c; });
        const enriched = online.map(o => ({
            ...o,
            name: clientMap[o.clientId]?.full_name || 'Client',
            company: clientMap[o.clientId]?.company_name || null
        }));
        res.json({ success: true, online: enriched });
    } catch (err) {
        res.json({ success: true, online: [] });
    }
});

module.exports = router;