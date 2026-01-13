const cron = require('node-cron');
const { query, run } = require('../models/database');
const { sendWhatsAppMessage } = require('./whatsappService');
const { processScheduledReports } = require('./reportWorker');

const initScheduler = () => {
    // Check for alerts every minute
    cron.schedule('* * * * *', async () => {
        console.log('Running alert scheduler...');
        try {
            // Find pending alerts whose time has come
            const alerts = await query(
                `SELECT a.*, u.whatsapp_number, u.phone, u.email, u.full_name as farmer_name, p.plant_name,
                        a.created_by_botanist_id
                 FROM alerts a
                 JOIN plants p ON a.plant_id = p.plant_id
                 JOIN users u ON p.user_id = u.user_id
                 WHERE a.status = 'pending' AND a.scheduled_time <= datetime('now', 'localtime')`
            );

            if (alerts.length === 0) return;

            console.log(`Found ${alerts.length} pending alerts.`);
            const { sendFromBotanist } = require('./whatsappService');

            for (const alert of alerts) {
                const message = `🌱 Alert for ${alert.plant_name}: ${alert.message}`;
                const botanistId = alert.created_by_botanist_id;

                if (!botanistId) {
                    console.warn(`Alert ${alert.alert_id} has no botanist creator. Skipping WhatsApp.`);
                } else {
                    // Send via botanist's WhatsApp session
                    await sendFromBotanist(botanistId, alert.whatsapp_number, message);
                }

                // Send email/SMS (mock)
                if (alert.email) {
                    console.log(`[📧 Mock Email] To: ${alert.email} | ${message}`);
                }
                if (alert.phone) {
                    console.log(`[📱 Mock SMS] To: ${alert.phone} | ${message}`);
                }

                // Mark as sent
                await run(
                    `UPDATE alerts SET status = 'sent' WHERE alert_id = ?`,
                    [alert.alert_id]
                );
            }
        } catch (error) {
            console.error('Error in scheduler:', error);
        }
    });

    // Check for scheduled reports every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running report worker...');
        await processScheduledReports();
    });

    console.log('✅ Alert & Report Scheduler initialized');
};

module.exports = { initScheduler };
