const { run } = require('../models/database');

/**
 * Generates smart suggestions based on crop type and sensor data.
 */
const generateRecommendations = async (plantId, data) => {
    // Fetch plant crop type
    const { query } = require('../models/database');
    const plant = await query('SELECT species, user_id FROM plants WHERE plant_id = ?', [plantId]);
    if (plant.length === 0) return;

    const crop = plant[0].species;
    const userId = plant[0].user_id;
    let suggestion = null;

    // Rule Logic
    if (crop === 'Rice' && data.soil_moisture < 40) {
        suggestion = "Recommendation: Rice requires high moisture. Irrigate within next 6 hours.";
    } else if (data.soil_moisture < 35) {
        suggestion = "Recommendation: Soil is dry. Schedule watering for tomorrow morning.";
    }

    if (suggestion) {
        await run(
            `INSERT INTO recommendations (plant_id, user_id, advice_text) VALUES (?, ?, ?)`,
            [plantId, userId, suggestion]
        );
    }
};

module.exports = { generateRecommendations };
