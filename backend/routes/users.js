const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');

const router = express.Router();

// GET /api/users/farmers (botanist only)
router.get('/farmers', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const farmers = await query('SELECT user_id, full_name, username, whatsapp_number FROM users WHERE role = "farmer" ORDER BY full_name');
        res.json(farmers);
    } catch (error) {
        console.error('Error fetching farmers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/users (botanist/admin only) - Comprehensive User List
router.get('/', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const users = await query('SELECT user_id, username, role, full_name, specialization, phone, email, whatsapp_number, joined_at FROM users ORDER BY role, full_name');
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/users/:id/contact (Update contact info)
router.put('/:id/contact', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const { id } = req.params;
        const { whatsapp_number, phone } = req.body;

        await run('UPDATE users SET whatsapp_number = ?, phone = ? WHERE user_id = ?', [whatsapp_number, phone, id]);

        res.json({ success: true, message: 'Contact updated' });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
