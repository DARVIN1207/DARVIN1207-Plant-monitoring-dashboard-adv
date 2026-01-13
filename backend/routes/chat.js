const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query, run } = require('../models/database');

const router = express.Router();

// GET /api/chat/messages/:other_user_id
router.get('/messages/:other_user_id', authenticateToken, async (req, res) => {
    try {
        const { other_user_id } = req.params;
        const userId = req.user.id;

        // Get conversation history
        const messages = await query(
            `SELECT m.*, s.full_name as sender_name, r.full_name as receiver_name 
       FROM chat_messages m
       JOIN users s ON m.sender_id = s.user_id
       JOIN users r ON m.receiver_id = r.user_id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) 
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
            [userId, other_user_id, other_user_id, userId]
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/chat/send
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { receiver_id, message } = req.body;
        const senderId = req.user.id;

        if (!receiver_id || !message) {
            return res.status(400).json({ error: 'Receiver and message required' });
        }

        let sensorSummary = null;
        let suggestion = null;

        // Chat Intelligence: Detect question/intent (Farmer to Botanist)
        if (req.user.role === 'farmer') {
            const isQuestion = /[?]|how|what|why|is|can|help|issue/i.test(message);
            if (isQuestion) {
                // Attach latest sensor data summary for this farmer's plots
                const latestLogs = await query(`
                    SELECT p.plant_name, l.soil_moisture, l.temperature, l.health_score 
                    FROM plants p 
                    LEFT JOIN plant_health_logs l ON p.plant_id = l.plant_id 
                    WHERE p.user_id = ? 
                    ORDER BY l.log_date DESC LIMIT 1
                `, [senderId]);

                if (latestLogs.length > 0) {
                    const l = latestLogs[0];
                    sensorSummary = `Plot: ${l.plant_name} | Moisture: ${l.soil_moisture}% | Temp: ${l.temperature}°C | Health: ${Math.round(l.health_score)}%`;
                    suggestion = `Suggested: Your ${l.plant_name} seems ${l.health_score > 60 ? 'healthy' : 'to need attention'}. Recommended check.`;
                }
            }
        }

        const result = await run(
            `INSERT INTO chat_messages (sender_id, receiver_id, message, sensor_summary) VALUES (?, ?, ?, ?)`,
            [senderId, receiver_id, message, sensorSummary]
        );

        const newMessage = await query('SELECT * FROM chat_messages WHERE message_id = ?', [result.lastID]);

        // Include suggestion in response for Botanist UI (not saved to DB)
        const responseData = { ...newMessage[0], ai_suggestion: suggestion };
        res.status(201).json(responseData);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/chat/contacts (List of people to chat with)
router.get('/contacts', authenticateToken, async (req, res) => {
    try {
        const role = req.user.role;
        let sql = '';

        // If Farmer, get assigned Botanist (via Plants table? Or just all Botanists?)
        // Requirement: "Farmer can only chat with assigned botanist"
        // To implement "assigned", we look at who owns the plants (User) and who created plants (Botanist)?
        // The current schema links Plant -> User (Farmer). It doesn't explicitly link Plant -> Botanist.
        // However, Recoommendations link User(Botanist) -> Plant.
        // Simplifying: Farmer can see ALL Botanists (or just the Demo ones).
        // Simplifying: Botanist can see ALL Farmers.

        if (role === 'farmer') {
            // Get all Botanists
            sql = `SELECT user_id, full_name, role FROM users WHERE role = 'botanist'`;
        } else {
            // Get all Farmers
            sql = `SELECT user_id, full_name, role FROM users WHERE role = 'farmer'`;
        }

        const contacts = await query(sql);
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const { getStatus } = require('../services/whatsappService');

// GET /api/chat/wa-status (Get WhatsApp Connection Status & QR)
router.get('/wa-status', authenticateToken, (req, res) => {
    // Only Botanist/Admin should see this
    if (req.user.role === 'farmer') return res.status(403).json({ error: 'Access denied' });

    const status = getStatus();
    res.json(status);
});

module.exports = router;
