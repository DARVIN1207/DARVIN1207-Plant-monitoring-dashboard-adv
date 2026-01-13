const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const router = express.Router();

// GET /api/alerts/:plant_id
router.get('/:plant_id', authenticateToken, async (req, res) => {
  try {
    const { plant_id } = req.params;
    const { status } = req.query; // Optional: filter by status

    // Ensure farmer owns the plant
    if (req.user.role === 'farmer') {
      const plant = await query('SELECT user_id FROM plants WHERE plant_id = ?', [plant_id]);
      if (plant.length === 0 || plant[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    let sql = 'SELECT * FROM alerts WHERE plant_id = ?';
    const params = [plant_id];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // Sort by priority (custom sort needs raw SQL case or logic, simple method: created_at)
    // We will handle sorting on Frontend
    sql += ' ORDER BY created_at DESC';

    const alerts = await query(sql, params);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alerts (botanist only) --> SCHEDULE OR IMMEDIATE ALERT
router.post('/', authenticateToken, requireBotanist, async (req, res) => {
  try {
    const { plant_id, message, type, priority, scheduled_time } = req.body;
    const botanistId = req.user.id; // Track who created this alert

    if (!plant_id || !message) {
      return res.status(400).json({ error: 'Plant ID and message required' });
    }

    // Check if plant exists and get farmer details for immediate sending
    const plantDetails = await query(
      `SELECT p.plant_name, u.whatsapp_number, u.phone, u.email, u.full_name as farmer_name 
       FROM plants p 
       JOIN users u ON p.user_id = u.user_id 
       WHERE p.plant_id = ?`,
      [plant_id]
    );

    if (plantDetails.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const { plant_name, whatsapp_number, phone, email, farmer_name } = plantDetails[0];
    const farmerUser = { whatsapp_number, phone, email };

    let status = 'active';
    let schedule = null;

    if (scheduled_time) {
      status = 'pending';
      // FIX: Replace 'T' with space and ensure seconds for SQLite compatibility
      // Input: "2024-06-15T14:30" -> Output: "2024-06-15 14:30:00"
      schedule = scheduled_time.replace('T', ' ');
      if (schedule.length === 16) {
        schedule += ':00';
      }
    } else {
      // Immediate Alert: Send via NotificationService
      console.log(`[Alert] Sending immediate message to ${farmer_name}`);
      const fullMessage = `🌱 Alert for ${plant_name}: ${message}`;

      try {
        const { send } = require('../services/notificationService');
        await send(farmerUser, fullMessage, ['whatsapp', 'email', 'sms'], botanistId); // Pass botanist ID

        status = 'sent';
        schedule = new Date().toISOString().replace('T', ' ').split('.')[0];
      } catch (msgError) {
        console.error('Failed to send notification:', msgError);
        // Keep status as active/failed? Let's stick to active logic.
      }
    }

    const alertType = type || 'general';
    const alertPriority = priority || 'medium';

    const result = await run(
      `INSERT INTO alerts (plant_id, message, type, priority, scheduled_time, status, created_by_botanist_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [plant_id, message, alertType, alertPriority, schedule, status, botanistId]
    );

    const alerts = await query('SELECT * FROM alerts WHERE alert_id = ?', [result.lastID]);
    res.status(201).json(alerts[0]);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

