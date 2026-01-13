const { query, run } = require('../models/database');
const { sendWhatsAppMessage } = require('./whatsappService');

/**
 * Background worker to process scheduled reports.
 */
const processScheduledReports = async () => {
    console.log('[ReportWorker] Checking for due reports...');
    try {
        const schedules = await query(`
            SELECT rs.*, u.full_name, u.whatsapp_number, u.email 
            FROM report_schedules rs
            JOIN users u ON rs.user_id = u.user_id
            WHERE rs.last_sent IS NULL 
               OR (rs.report_type = 'weekly' AND rs.last_sent <= datetime('now', '-7 days'))
               OR (rs.report_type = 'monthly' AND rs.last_sent <= datetime('now', '-30 days'))
        `);

        for (const s of schedules) {
            console.log(`[ReportWorker] Generating ${s.report_type} report for ${s.full_name}`);

            // Mock Data Retrieval for Farmer
            const plots = await query('SELECT * FROM plants WHERE user_id = ?', [s.user_id]);
            if (plots.length === 0) {
                console.log(`[ReportWorker] No plots for ${s.full_name}, skipping.`);
                continue;
            }

            // Simulate File Generation
            const fileName = `${s.report_type}_report_${new Date().toISOString().split('T')[0]}.${s.format}`;

            // Delivery - WhatsApp Attachment (Mocked as text notification)
            if (s.whatsapp_number) {
                const message = `📂 Your ${s.report_type} ${s.format.toUpperCase()} report is ready: ${fileName}`;
                await sendWhatsAppMessage(s.whatsapp_number, message);
            }

            // Update last_sent
            await run('UPDATE report_schedules SET last_sent = CURRENT_TIMESTAMP WHERE schedule_id = ?', [s.schedule_id]);
        }
    } catch (error) {
        console.error('[ReportWorker] Error:', error);
    }
};

module.exports = { processScheduledReports };
