/* ════════════════════════════════════════════════════════════════
   VNK Automatisation — Routes calendrier custom
   backend/routes/calendar.js
   ════════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('./admin');

// ── ADMIN : Paramètres de disponibilités ─────────────────────────

// GET /api/calendar/settings — charger les disponibilités depuis la DB
router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        // Créer la table si elle n'existe pas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_settings (
                key   VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        const keys = ['vnk-cal-settings', 'vnk-cal-exceptions', 'vnk-cal-default-dur',
            'vnk-cal-timezone', 'vnk-cal-buffer', 'vnk-cal-notice', 'vnk-cal-horizon',
            'vnk-cal-auto-approve', 'vnk-cal-meeting-link'];
        const rows = await pool.query(
            `SELECT key, value FROM admin_settings WHERE key = ANY($1)`,
            [keys]
        );
        const settings = {};
        rows.rows.forEach(r => { settings[r.key] = r.value; });
        res.json({ success: true, settings });
    } catch (e) {
        console.error('GET /api/calendar/settings error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// PUT /api/calendar/settings — sauvegarder les disponibilités en DB
router.put('/settings', authenticateAdmin, async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_settings (
                key   VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        const allowed = ['vnk-cal-settings', 'vnk-cal-exceptions', 'vnk-cal-default-dur',
            'vnk-cal-timezone', 'vnk-cal-buffer', 'vnk-cal-notice', 'vnk-cal-horizon',
            'vnk-cal-auto-approve', 'vnk-cal-meeting-link'];
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, message: 'settings requis' });
        }
        for (const [key, value] of Object.entries(settings)) {
            if (!allowed.includes(key)) continue;
            await pool.query(`
                INSERT INTO admin_settings (key, value, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
            `, [key, typeof value === 'string' ? value : JSON.stringify(value)]);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/calendar/settings error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── ADMIN : Gestion des créneaux ─────────────────────────────────

// GET /api/calendar/slots?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/slots', authenticateAdmin, async (req, res) => {
    try {
        const { start, end } = req.query;
        const where = start && end
            ? 'WHERE s.slot_date BETWEEN $1 AND $2'
            : start ? 'WHERE s.slot_date >= $1'
                : '';
        const params = start && end ? [start, end] : start ? [start] : [];
        const rows = await pool.query(
            `SELECT s.id,
                TO_CHAR(s.slot_date, 'YYYY-MM-DD') as slot_date,
                s.start_time::text, s.end_time::text, s.duration_min,
                s.status, s.notes, s.created_at, s.updated_at,
                a.id AS appointment_id, a.client_name, a.client_email,
                a.client_company, a.subject, a.meeting_link, a.meeting_type,
                a.status AS appt_status, a.notes_client, a.notes_admin,
                a.client_id
             FROM availability_slots s
             LEFT JOIN appointments a ON a.slot_id = s.id AND a.status != 'cancelled'
             ${where}
             ORDER BY s.slot_date, s.start_time`,
            params
        );
        res.json({ success: true, slots: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/calendar/slots — créer un ou plusieurs créneaux
router.post('/slots', authenticateAdmin, async (req, res) => {
    try {
        const { slot_date, start_time, end_time, duration_min = 30, notes, repeat_weekly = 0 } = req.body;
        const created = [];
        for (let w = 0; w <= repeat_weekly; w++) {
            const date = new Date(slot_date);
            date.setDate(date.getDate() + w * 7);
            const d = date.toISOString().split('T')[0];
            const r = await pool.query(
                `INSERT INTO availability_slots (slot_date, start_time, end_time, duration_min, notes)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [d, start_time, end_time, duration_min, notes || null]
            );
            created.push(r.rows[0]);
        }
        res.json({ success: true, slots: created });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/calendar/slots/:id — modifier statut ou notes
router.patch('/slots/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const r = await pool.query(
            `UPDATE availability_slots SET status=COALESCE($1,status), notes=COALESCE($2,notes), updated_at=NOW()
             WHERE id=$3 RETURNING *`,
            [status || null, notes !== undefined ? notes : null, req.params.id]
        );
        res.json({ success: true, slot: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/calendar/slots/:id — supprimer un créneau
router.delete('/slots/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM availability_slots WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── ADMIN : Gestion des RDV ──────────────────────────────────────

// GET /api/calendar/appointments?start=&end=
router.get('/appointments', authenticateAdmin, async (req, res) => {
    try {
        const { start, end } = req.query;
        const params = [], conds = ["a.status != 'cancelled'"];
        if (start) { params.push(start); conds.push(`a.appointment_date >= $${params.length}`); }
        if (end) { params.push(end); conds.push(`a.appointment_date <= $${params.length}`); }
        const rows = await pool.query(
            `SELECT a.id, a.status,
                TO_CHAR(a.appointment_date, 'YYYY-MM-DD') as appointment_date,
                a.start_time::text, a.end_time::text, a.duration_min,
                a.subject, a.notes_client, a.notes_admin,
                a.meeting_link, a.meeting_type, a.meeting_id, a.meeting_password,
                a.client_id, a.client_name, a.client_email, a.client_company,
                a.slot_id, a.created_at
             FROM appointments a
             ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
             ORDER BY a.appointment_date, a.start_time`,
            params
        );
        res.json({ success: true, appointments: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/calendar/appointments/:id — modifier un RDV (admin)
router.patch('/appointments/:id', authenticateAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide' });

        const { meeting_link, meeting_type, meeting_id, meeting_password, notes_admin, status, cancellation_reason, subject } = req.body;

        // Vérifier que le RDV existe
        const existing = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Rendez-vous introuvable' });

        const isCancelling = status === 'cancelled';

        // Construire la requête dynamiquement pour éviter les ambiguïtés de type PostgreSQL
        const sets = [];
        const params = [];
        let idx = 1;

        if (meeting_link !== undefined) { sets.push(`meeting_link = $${idx}::text`); params.push(meeting_link || null); idx++; }
        if (meeting_type !== undefined) { sets.push(`meeting_type = $${idx}::text`); params.push(meeting_type || null); idx++; }
        if (meeting_id !== undefined) { sets.push(`meeting_id = $${idx}::text`); params.push(meeting_id || null); idx++; }
        if (meeting_password !== undefined) { sets.push(`meeting_password = $${idx}::text`); params.push(meeting_password || null); idx++; }
        if (notes_admin !== undefined) { sets.push(`notes_admin = $${idx}::text`); params.push(notes_admin || null); idx++; }
        if (subject !== undefined) { sets.push(`subject = $${idx}::text`); params.push(subject || null); idx++; }
        if (status !== undefined) { sets.push(`status = $${idx}::text`); params.push(status); idx++; }

        if (isCancelling) {
            sets.push(`cancelled_at = NOW()`);
            sets.push(`cancelled_by = 'admin'`);
            if (cancellation_reason) {
                sets.push(`cancellation_reason = $${idx}::text`);
                params.push(cancellation_reason);
                idx++;
            }
        }

        sets.push(`updated_at = NOW()`);
        params.push(id);

        const r = await pool.query(
            `UPDATE appointments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        const appt = r.rows[0];

        // Si annulé → libérer le créneau
        if (isCancelling && appt.slot_id) {
            await pool.query(
                `UPDATE availability_slots SET status='available', updated_at=NOW() WHERE id=$1`,
                [appt.slot_id]
            );
        }

        res.json({ success: true, appointment: appt });
    } catch (e) {
        console.error('PATCH appointment error:', e);
        res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour : ' + e.message });
    }
});

// ── CLIENT : Voir les créneaux disponibles ────────────────────────

// GET /api/calendar/available — créneaux libres (client authentifié)
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const in60d = new Date(Date.now() + 60 * 24 * 3600000).toISOString().split('T')[0];
        const rows = await pool.query(
            `SELECT id,
                    TO_CHAR(slot_date, 'YYYY-MM-DD') as slot_date,
                    start_time::text, end_time::text, duration_min
             FROM availability_slots
             WHERE status='available' AND slot_date BETWEEN $1 AND $2
             ORDER BY slot_date, start_time`,
            [today, in60d]
        );
        res.json({ success: true, slots: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/calendar/book — client réserve un créneau
router.post('/book', authenticateToken, async (req, res) => {
    try {
        const { slot_id, subject, notes_client, meeting_type = 'video' } = req.body;
        const clientId = req.user.id;

        const slotRes = await pool.query(
            `SELECT * FROM availability_slots WHERE id=$1 AND status='available'`, [slot_id]
        );
        if (!slotRes.rows.length)
            return res.status(400).json({ success: false, message: 'Créneau non disponible' });
        const slot = slotRes.rows[0];

        const clientRes = await pool.query(`SELECT * FROM clients WHERE id=$1`, [clientId]);
        const client = clientRes.rows[0];

        const apptRes = await pool.query(
            `INSERT INTO appointments
             (slot_id, client_id, client_name, client_email, client_company,
              appointment_date, start_time, end_time, duration_min,
              subject, notes_client, meeting_type, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'confirmed')
             RETURNING *`,
            [slot.id, clientId, client.full_name, client.email, client.company_name || null,
            slot.slot_date, slot.start_time, slot.end_time, slot.duration_min,
            subject || 'Appel de qualification', notes_client || null, meeting_type]
        );

        await pool.query(
            `UPDATE availability_slots SET status='booked', updated_at=NOW() WHERE id=$1`,
            [slot.id]
        );

        res.json({ success: true, appointment: apptRes.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/calendar/my-appointments — client voit ses RDV
router.get('/my-appointments', authenticateToken, async (req, res) => {
    try {
        const clientId = req.user.id;
        const rows = await pool.query(
            `SELECT a.id, a.status,
                TO_CHAR(a.appointment_date, 'YYYY-MM-DD') as appointment_date,
                a.start_time::text, a.end_time::text, a.duration_min,
                a.subject, a.notes_client, a.notes_admin, a.meeting_link, a.meeting_type,
                a.meeting_id, a.meeting_password, a.cancelled_at, a.cancellation_reason,
                a.created_at
             FROM appointments a
             WHERE a.client_id = $1
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [clientId]
        );
        res.json({ success: true, appointments: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/calendar/appointments/:id/cancel — client annule son RDV
router.delete('/appointments/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const { reason } = req.body;
        const clientId = req.user.id;
        const r = await pool.query(
            `UPDATE appointments
             SET status='cancelled', cancelled_by='client', cancelled_at=NOW(),
                 cancellation_reason=$1, updated_at=NOW()
             WHERE id=$2 AND client_id=$3 AND status='confirmed' RETURNING *`,
            [reason || null, req.params.id, clientId]
        );
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'RDV introuvable ou déjà annulé' });

        if (r.rows[0].slot_id) {
            await pool.query(
                `UPDATE availability_slots SET status='available', updated_at=NOW() WHERE id=$1`,
                [r.rows[0].slot_id]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/calendar/slots/:id/book-admin — admin réserve un créneau pour un client
router.post('/slots/:id/book-admin', authenticateAdmin, async (req, res) => {
    try {
        const slotId = req.params.id;
        const { client_id, subject, meeting_type = 'video', meeting_link, notes_admin, send_confirmation } = req.body;

        if (!client_id) return res.status(400).json({ success: false, message: 'client_id requis' });

        const slotRes = await pool.query(`SELECT * FROM availability_slots WHERE id=$1`, [slotId]);
        if (!slotRes.rows.length)
            return res.status(404).json({ success: false, message: 'Créneau introuvable' });
        const slot = slotRes.rows[0];

        const clientRes = await pool.query(`SELECT * FROM clients WHERE id=$1`, [client_id]);
        if (!clientRes.rows.length)
            return res.status(404).json({ success: false, message: 'Client introuvable' });
        const client = clientRes.rows[0];

        const apptRes = await pool.query(
            `INSERT INTO appointments
             (slot_id, client_id, client_name, client_email, client_company,
              appointment_date, start_time, end_time, duration_min,
              subject, meeting_type, meeting_link, notes_admin, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'confirmed')
             RETURNING *`,
            [slot.id, client_id, client.full_name, client.email, client.company_name || null,
            slot.slot_date, slot.start_time, slot.end_time, slot.duration_min,
            subject || 'Rendez-vous', meeting_type, meeting_link || null, notes_admin || null]
        );

        await pool.query(
            `UPDATE availability_slots SET status='booked', updated_at=NOW() WHERE id=$1`,
            [slot.id]
        );

        res.json({ success: true, appointment: apptRes.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;