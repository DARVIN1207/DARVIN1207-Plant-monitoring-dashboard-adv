const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const {
    initializeBotanistWhatsApp,
    getBotanistStatus,
    disconnectBotanist
} = require('../services/whatsappService');

const router = express.Router();

// GET /api/whatsapp/status - Get current user's WhatsApp connection status
router.get('/status', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const botanistId = req.user.id;
        const status = getBotanistStatus(botanistId);
        res.json(status);
    } catch (error) {
        console.error('Error getting WhatsApp status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/whatsapp/connect - Initialize WhatsApp connection for current botanist
router.post('/connect', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const botanistId = req.user.id;
        console.log(`[API] Botanist ${botanistId} requesting WhatsApp connection`);

        // Initialize the WhatsApp client
        await initializeBotanistWhatsApp(botanistId);

        res.json({
            message: 'WhatsApp initialization started. Scan QR code to connect.',
            botanistId
        });
    } catch (error) {
        console.error('Error initializing WhatsApp:', error);
        res.status(500).json({ error: 'Failed to initialize WhatsApp' });
    }
});

// POST /api/whatsapp/disconnect - Disconnect WhatsApp for current botanist
router.post('/disconnect', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const botanistId = req.user.id;
        await disconnectBotanist(botanistId);
        res.json({ message: 'WhatsApp disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting WhatsApp:', error);
        res.status(500).json({ error: 'Failed to disconnect WhatsApp' });
    }
});

module.exports = router;
