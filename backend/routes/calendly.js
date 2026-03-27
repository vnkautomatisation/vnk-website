/* ============================================
   VNK Automatisation Inc. - Calendly Webhook
   ============================================ */

const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/calendly/webhook — receive booking notifications
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    // New booking created
    if (event.event === 'invitee.created') {
      const booking = event.payload;

      console.log(`New Calendly booking:`);
      console.log(`  Name    : ${booking.name}`);
      console.log(`  Email   : ${booking.email}`);
      console.log(`  Event   : ${booking.event_type_name}`);
      console.log(`  Time    : ${booking.event.start_time}`);

      // Save booking to database
      await pool.query(
        `INSERT INTO contact_messages 
         (full_name, email, message, status, created_at)
         VALUES ($1, $2, $3, 'calendly', NOW())`,
        [
          booking.name,
          booking.email,
          `Calendly booking — ${booking.event_type_name} — ${new Date(booking.event.start_time).toLocaleString('fr-CA')}`
        ]
      );
    }

    // Booking cancelled
    if (event.event === 'invitee.canceled') {
      const booking = event.payload;
      console.log(`Calendly booking cancelled — ${booking.name} <${booking.email}>`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Calendly webhook error:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;