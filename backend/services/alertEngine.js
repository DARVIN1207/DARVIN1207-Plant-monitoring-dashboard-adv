const { run, query } = require('../models/database');
const { sendWhatsAppMessage } = require('./whatsappService');

/**
 * Evaluates sensor data and generates alerts if rules are violated.
 * @param {Number} plantId - ID of the plant
 * @param {Object} data - Sensor data
 */
const processAlertRules = async (plantId, data) => {
    const alerts = [];

    // Rules
    if (data.soil_moisture < 30) {
        alerts.push({ message: "Irrigation needed: Soil moisture is below 30%", type: "irrigation", priority: "high" });
    }
    if (data.temperature > 38) {
        alerts.push({ message: "Heat stress alert: Temperature exceeds 38°C", type: "weather", priority: "critical" });
    }
    if (data.soil_ph < 5.5 || data.soil_ph > 7.5) {
        alerts.push({ message: "Soil correction required: pH level is outside optimal range (5.5-7.5)", type: "soil", priority: "medium" });
    }

    if (alerts.length === 0) return;

    // Get Farmer Details for Notifications
    const plantDetails = await query(
        `SELECT p.plant_name, u.whatsapp_number, u.user_id, u.full_name 
         FROM plants p 
         JOIN users u ON p.user_id = u.user_id 
         WHERE p.plant_id = ?`,
        [plantId]
    );

    if (plantDetails.length === 0) return;
    const { plant_name, whatsapp_number, user_id, full_name } = plantDetails[0];

    for (const alert of alerts) {
        const fullMessage = `🚨 [${alert.priority.toUpperCase()}] ${plant_name}: ${alert.message}`;

        // 1. Store in Database
        await run(
            `INSERT INTO alerts (plant_id, message, type, priority, status) VALUES (?, ?, ?, ?, ?)`,
            [plantId, alert.message, alert.type, alert.priority, 'sent']
        );

        // 2. Delivery - WhatsApp
        if (whatsapp_number) {
            console.log(`[AlertEngine] Sending WhatsApp to ${full_name}: ${fullMessage}`);
            await sendWhatsAppMessage(whatsapp_number, fullMessage);
        }

        // 3. Delivery - Chat Notification (Inject as a system message)
        // Botanist (ID 1 for demo) -> Farmer
        await run(
            `INSERT INTO chat_messages (sender_id, receiver_id, message, sensor_summary) VALUES (?, ?, ?, ?)`,
            [1, user_id, `SYSTEM ALERT: ${fullMessage}`, JSON.stringify(data)]
        );
    }
};

module.exports = { processAlertRules };
