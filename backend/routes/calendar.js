/* ════════════════════════════════════════════════════════════════
   VNK Automatisation — Routes calendrier custom
   backend/routes/calendar.js
   ════════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('./admin');

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
            `SELECT a.*, c.full_name as client_full_name, c.company_name
             FROM appointments a
             LEFT JOIN clients c ON a.client_id = c.id
             WHERE ${conds.join(' AND ')}
             ORDER BY a.appointment_date, a.start_time`,
            params
        );
        res.json({ success: true, appointments: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/calendar/appointments/:id — ajouter lien meeting, notes, statut
router.patch('/appointments/:id', authenticateAdmin, async (req, res) => {
    try {
        const { meeting_link, meeting_type, meeting_id, meeting_password, notes_admin, status } = req.body;
        const r = await pool.query(
            `UPDATE appointments SET
                meeting_link     = COALESCE($1, meeting_link),
                meeting_type     = COALESCE($2, meeting_type),
                meeting_id       = COALESCE($3, meeting_id),
                meeting_password = COALESCE($4, meeting_password),
                notes_admin      = COALESCE($5, notes_admin),
                status           = COALESCE($6, status),
                updated_at       = NOW()
             WHERE id=$7 RETURNING *`,
            [meeting_link || null, meeting_type || null, meeting_id || null,
            meeting_password || null, notes_admin || null, status || null, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'RDV introuvable' });

        // Si lien meeting ajouté → envoyer message au client
        const appt = r.rows[0];
        if (meeting_link && appt.client_id) {
            const dateStr = new Date(appt.appointment_date).toLocaleDateString('fr-CA');
            await pool.query(
                `INSERT INTO messages (client_id, sender, content, is_read, created_at)
                 VALUES ($1, 'admin', $2, false, NOW())`,
                [appt.client_id,
                `📅 Lien de réunion pour votre RDV du ${dateStr} à ${appt.start_time.substring(0, 5)}\n\nType : ${meeting_type || 'Vidéo'}\nLien : ${meeting_link}${meeting_password ? '\nMot de passe : ' + meeting_password : ''}\n\nÀ bientôt !`]
            );
        }
        res.json({ success: true, appointment: appt });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/calendar/appointments/admin-create — admin crée un RDV direct
router.post('/appointments/admin-create', authenticateAdmin, async (req, res) => {
    try {
        const { slot_id, client_id, client_name, client_email, client_company,
            appointment_date, start_time, end_time, duration_min,
            subject, meeting_type } = req.body;

        // Créer le RDV
        const apptRes = await pool.query(
            `INSERT INTO appointments
             (slot_id, client_id, client_name, client_email, client_company,
              appointment_date, start_time, end_time, duration_min,
              subject, meeting_type, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed') RETURNING *`,
            [slot_id, client_id, client_name, client_email, client_company || null,
                appointment_date, start_time, end_time, duration_min || 30,
                subject || 'Consultation VNK', meeting_type || 'video']
        );

        // Marquer le créneau comme réservé
        if (slot_id) {
            await pool.query(
                `UPDATE availability_slots SET status='booked', updated_at=NOW() WHERE id=$1`, [slot_id]
            );
        }

        // Notifier le client par message
        if (client_id) {
            const dateStr = new Date(appointment_date).toLocaleDateString('fr-CA', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const time = start_time.substring(0, 5);
            await pool.query(
                `INSERT INTO messages (client_id, sender, content, is_read, created_at)
                 VALUES ($1, 'admin', $2, false, NOW())`,
                [client_id,
                    `📅 Rendez-vous confirmé — ${dateStr} à ${time}

Durée : ${duration_min || 30} minutes
Objet : ${subject || 'Consultation VNK'}

Votre lien de réunion vous sera envoyé prochainement. À bientôt !`]
            );
        }

        res.json({ success: true, appointment: apptRes.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
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

        // Vérifier le créneau
        const slotRes = await pool.query(
            `SELECT * FROM availability_slots WHERE id=$1 AND status='available'`, [slot_id]
        );
        if (!slotRes.rows.length)
            return res.status(400).json({ success: false, message: 'Créneau non disponible' });
        const slot = slotRes.rows[0];

        // Récupérer infos client
        const clientRes = await pool.query(`SELECT * FROM clients WHERE id=$1`, [clientId]);
        const client = clientRes.rows[0];

        // Créer le RDV
        const apptRes = await pool.query(
            `INSERT INTO appointments
             (slot_id, client_id, client_name, client_email, client_company,
              appointment_date, start_time, end_time, duration_min,
              subject, notes_client, meeting_type, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'confirmed') RETURNING *`,
            [slot_id, clientId, client.full_name, client.email, client.company_name || null,
                slot.slot_date, slot.start_time, slot.end_time, slot.duration_min,
                subject || null, notes_client || null, meeting_type]
        );

        // Marquer le créneau comme réservé
        await pool.query(
            `UPDATE availability_slots SET status='booked', updated_at=NOW() WHERE id=$1`, [slot_id]
        );

        // Message de confirmation au client
        const dateStr = new Date(slot.slot_date).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        await pool.query(
            `INSERT INTO messages (client_id, sender, content, is_read, created_at)
             VALUES ($1, 'admin', $2, false, NOW())`,
            [clientId,
                `✅ RDV confirmé — ${dateStr} à ${slot.start_time.substring(0, 5)}\n\nDurée : ${slot.duration_min} minutes\nObjet : ${subject || 'Consultation VNK'}\n\nVotre lien de réunion vous sera envoyé dans ce chat d\'ici 24h. À bientôt !`]
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
                a.subject, a.notes_client, a.meeting_link, a.meeting_type,
                a.meeting_password, a.cancelled_at, a.cancellation_reason,
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

        // Libérer le créneau
        if (r.rows[0].slot_id) {
            await pool.query(
                `UPDATE availability_slots SET status='available', updated_at=NOW() WHERE id=$1`,
                [r.rows[0].slot_id]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;