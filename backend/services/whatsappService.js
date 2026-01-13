const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const { query, run } = require('../models/database');

// Store multiple client instances: { userId: { client, isReady, qrCodeImage } }
const botanistClients = new Map();

/**
 * Initialize WhatsApp client for a specific botanist
 * @param {Number} userId - Botanist's user ID
 * @returns {Promise} Resolves when client is initialized
 */
const initializeBotanistWhatsApp = async (userId) => {
    console.log(`[WhatsApp] Initializing session for botanist ${userId}...`);

    // Check if client already exists
    if (botanistClients.has(userId)) {
        const existing = botanistClients.get(userId);
        if (existing.isReady) {
            console.log(`[WhatsApp] Botanist ${userId} already connected`);
            return existing.client;
        }
    }

    // Create new client with separate auth directory
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `botanist_${userId}`,
            dataPath: path.join(__dirname, '..', '.wwebjs_auth')
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Store client data
    const clientData = {
        client,
        isReady: false,
        qrCodeImage: null,
        qrCodeData: null
    };
    botanistClients.set(userId, clientData);

    // QR Code event
    client.on('qr', async (qr) => {
        clientData.qrCodeData = qr;
        try {
            clientData.qrCodeImage = await QRCode.toDataURL(qr);
            console.log(`[WhatsApp] QR Code generated for botanist ${userId}`);
        } catch (err) {
            console.error(`[WhatsApp] Error generating QR for botanist ${userId}:`, err);
        }

        // Also show in terminal
        console.log(`\n=== QR CODE FOR BOTANIST ${userId} ===`);
        qrcodeTerminal.generate(qr, { small: true });
        console.log('=====================================\n');
    });

    // Ready event
    client.on('ready', async () => {
        console.log(`✅ WhatsApp connected for botanist ${userId}`);
        clientData.isReady = true;
        clientData.qrCodeImage = null;
        clientData.qrCodeData = null;

        // Update database
        await run(
            `UPDATE users SET whatsapp_session_active = 1, whatsapp_session_id = ?, whatsapp_last_connected = CURRENT_TIMESTAMP WHERE user_id = ?`,
            [`botanist_${userId}`, userId]
        );
    });

    // Auth failure event
    client.on('auth_failure', (msg) => {
        console.error(`❌ WhatsApp auth failed for botanist ${userId}:`, msg);
        clientData.isReady = false;
    });

    // Disconnected event
    client.on('disconnected', async (reason) => {
        console.log(`WhatsApp disconnected for botanist ${userId}:`, reason);
        clientData.isReady = false;

        // Update database
        await run(
            `UPDATE users SET whatsapp_session_active = 0 WHERE user_id = ?`,
            [userId]
        );
    });

    // Initialize the client
    client.initialize();
    return client;
};

/**
 * Get status for a specific botanist's WhatsApp session
 * @param {Number} userId - Botanist's user ID
 * @returns {Object} { isReady, qrCodeImage }
 */
const getBotanistStatus = (userId) => {
    const clientData = botanistClients.get(userId);
    if (!clientData) {
        return { isReady: false, qrCodeImage: null };
    }
    return {
        isReady: clientData.isReady,
        qrCodeImage: clientData.qrCodeImage
    };
};

/**
 * Send WhatsApp message from a specific botanist's account
 * @param {Number} botanistId - Botanist's user ID
 * @param {String} to - Recipient phone number
 * @param {String} body - Message content
 * @returns {Promise<Boolean>} Success status
 */
const sendFromBotanist = async (botanistId, to, body) => {
    const clientData = botanistClients.get(botanistId);

    if (!clientData || !clientData.isReady) {
        console.log(`⚠️ Botanist ${botanistId} WhatsApp not connected. Message queued/skipped.`);
        return false;
    }

    try {
        console.log(`[WhatsApp] Sending from botanist ${botanistId} to: ${to}`);

        // Format number
        let number = to.replace(/\D/g, '');
        if (number.length === 10) {
            number = '91' + number;
        }
        if (!number.endsWith('@c.us')) {
            number = `${number}@c.us`;
        }

        const chatId = number;
        console.log(`[WhatsApp] Target Chat ID: ${chatId}`);

        // Check registration
        const isRegistered = await clientData.client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`[WhatsApp] Number ${number} not registered on WhatsApp`);
        }

        await clientData.client.sendMessage(chatId, body);
        console.log(`✅ Message sent from botanist ${botanistId} to ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send from botanist ${botanistId}:`, error);
        return false;
    }
};

/**
 * Disconnect a botanist's WhatsApp session
 * @param {Number} userId - Botanist's user ID
 */
const disconnectBotanist = async (userId) => {
    const clientData = botanistClients.get(userId);
    if (clientData && clientData.client) {
        await clientData.client.destroy();
        botanistClients.delete(userId);

        // Update database
        await run(
            `UPDATE users SET whatsapp_session_active = 0 WHERE user_id = ?`,
            [userId]
        );

        console.log(`[WhatsApp] Disconnected botanist ${userId}`);
    }
};

/**
 * Get an active botanist client (fallback for system messages)
 * @returns {Client|null} First available active client
 */
const getAnyActiveClient = () => {
    for (const [userId, clientData] of botanistClients.entries()) {
        if (clientData.isReady) {
            console.log(`[WhatsApp] Using botanist ${userId}'s session for system message`);
            return clientData.client;
        }
    }
    console.warn('[WhatsApp] No active botanist sessions available');
    return null;
};

module.exports = {
    initializeBotanistWhatsApp,
    getBotanistStatus,
    sendFromBotanist,
    disconnectBotanist,
    getAnyActiveClient
};
