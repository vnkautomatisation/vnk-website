/* ============================================
   VNK Automatisation Inc. - Auth Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        // Find client by email
        const result = await pool.query(
            'SELECT * FROM clients WHERE email = $1 AND is_active = true',
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const client = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, client.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: client.id,
                email: client.email,
                company: client.company_name
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update last login
        await pool.query(
            'UPDATE clients SET last_login = NOW() WHERE id = $1',
            [client.id]
        );

        res.json({
            success: true,
            token,
            user: {
                id: client.id,
                name: client.full_name,
                email: client.email,
                company: client.company_name,
                phone: client.phone,
                address: client.address,
                city: client.city,
                province: client.province,
                postal_code: client.postal_code,
                sector: client.sector,
                technologies: client.technologies,
                created_at: client.created_at
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login.'
        });
    }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
    // JWT is stateless — client deletes the token
    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, full_name, email, company_name, phone, created_at FROM clients WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password are required.'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters.'
            });
        }

        // Get current password hash
        const result = await pool.query(
            'SELECT password_hash FROM clients WHERE id = $1',
            [req.user.id]
        );

        const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 12);

        await pool.query(
            'UPDATE clients SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password updated successfully.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;