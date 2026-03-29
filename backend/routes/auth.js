/* ============================================
   VNK Automatisation Inc. - Auth Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Ajouter colonne avatar_url si absente (migration douce)
pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => { });

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const result = await pool.query('SELECT * FROM clients WHERE email = $1 AND is_active = true', [email.toLowerCase().trim()]);
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const client = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, client.password_hash);
        if (!isValidPassword) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const token = jwt.sign({ id: client.id, email: client.email, company: client.company_name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        await pool.query('UPDATE clients SET last_login = NOW() WHERE id = $1', [client.id]);

        res.json({
            success: true, token,
            user: {
                id: client.id, name: client.full_name, email: client.email,
                company: client.company_name, phone: client.phone,
                address: client.address, city: client.city,
                province: client.province, postal_code: client.postal_code,
                sector: client.sector, technologies: client.technologies,
                avatar_url: client.avatar_url, created_at: client.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, full_name, email, company_name, phone, address, city, province, postal_code, sector, technologies, avatar_url, created_at FROM clients WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
        const c = result.rows[0];
        res.json({
            success: true, user: {
                id: c.id, name: c.full_name, email: c.email, company: c.company_name,
                phone: c.phone, address: c.address, city: c.city, province: c.province,
                postal_code: c.postal_code, sector: c.sector, technologies: c.technologies,
                avatar_url: c.avatar_url, created_at: c.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

        const result = await pool.query('SELECT password_hash FROM clients WHERE id = $1', [req.user.id]);
        const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE clients SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);
        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/auth/update-profile — avatar (base64) + infos
router.post('/update-profile', authenticateToken, async (req, res) => {
    try {
        const { avatar_url, full_name, phone, address, city, province, postal_code } = req.body;
        const fields = [];
        const values = [];
        let idx = 1;

        if (avatar_url !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(avatar_url); }
        if (full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(full_name); }
        if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
        if (address !== undefined) { fields.push(`address = $${idx++}`); values.push(address); }
        if (city !== undefined) { fields.push(`city = $${idx++}`); values.push(city); }
        if (province !== undefined) { fields.push(`province = $${idx++}`); values.push(province); }
        if (postal_code !== undefined) { fields.push(`postal_code = $${idx++}`); values.push(postal_code); }

        if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update.' });

        fields.push(`updated_at = NOW()`);
        values.push(req.user.id);

        const result = await pool.query(
            `UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, full_name, email, company_name, phone, address, city, province, postal_code, sector, technologies, avatar_url, created_at`,
            values
        );

        const c = result.rows[0];
        res.json({
            success: true, user: {
                id: c.id, name: c.full_name, email: c.email, company: c.company_name,
                phone: c.phone, address: c.address, city: c.city, province: c.province,
                postal_code: c.postal_code, sector: c.sector, technologies: c.technologies,
                avatar_url: c.avatar_url, created_at: c.created_at
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;