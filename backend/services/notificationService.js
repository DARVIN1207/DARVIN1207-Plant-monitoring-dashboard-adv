const { sendFromBotanist } = require('./whatsappService');

/**
 * Centralized Notification Service
 * Handles sending messages via WhatsApp, Email, & SMS.
 */
const NotificationService = {

    /**
     * Send a notification to a user via available channels.
     * @param {Object} user - User object { phone, email, whatsapp_number }
     * @param {String} message - The message content
     * @param {Array} channels - List of channels ['whatsapp', 'email', 'sms'] (default: all)
     * @param {Number} botanistId - ID of botanist sending the message (required for WhatsApp)
     */
    async send(user, message, channels = ['whatsapp'], botanistId = null) {
        const results = [];

        if (channels.includes('whatsapp') && user.whatsapp_number && botanistId) {
            const sent = await sendFromBotanist(botanistId, user.whatsapp_number, message);
            results.push({ channel: 'whatsapp', success: sent });
        } else if (channels.includes('whatsapp') && user.whatsapp_number && !botanistId) {
            console.warn('[NotificationService] WhatsApp requested but no botanistId provided');
            results.push({ channel: 'whatsapp', success: false, error: 'No botanist ID' });
        }

        if (channels.includes('email') && user.email) {
            // Mock Email Sending
            console.log(`[📧 Mock Email] To: ${user.email} | Subject: Farm Alert | Body: ${message}`);
            results.push({ channel: 'email', success: true });
        }

        if (channels.includes('sms') && user.phone) {
            // Mock SMS Sending
            console.log(`[📱 Mock SMS] To: ${user.phone} | Msg: ${message}`);
            results.push({ channel: 'sms', success: true });
        }

        return results;
    }
};

module.exports = NotificationService;
