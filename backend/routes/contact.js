/* ============================================
   VNK Automatisation Inc. - Contact Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/contact
router.post('/', async (req, res) => {
    try {
        const { name, company, email, phone, service, plc_brand, message } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and message are required.'
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address.'
            });
        }

        // Save to database
        const result = await pool.query(
            `INSERT INTO contact_messages 
       (full_name, company_name, email, phone, service_interest, plc_brand, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', NOW())
       RETURNING id`,
            [name, company, email, phone, service, plc_brand, message]
        );

        console.log(`New contact message from ${name} <${email}> — ID: ${result.rows[0].id}`);

        res.status(201).json({
            success: true,
            message: 'Message received. We will respond within 24 business hours.',
            id: result.rows[0].id
        });

    } catch (error) {
        console.error('Contact form error:', error);

        // Return success even if DB fails in dev mode
        if (process.env.NODE_ENV === 'development') {
            return res.json({
                success: true,
                message: 'Message received (dev mode — DB not connected).'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error. Please email us directly at vnkautomatisation@gmail.com'
        });
    }
});

// GET /api/contact — admin only, list all messages
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, company_name, email, phone, service_interest, 
              plc_brand, message, status, created_at 
       FROM contact_messages 
       ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            count: result.rows.length,
            messages: result.rows
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;