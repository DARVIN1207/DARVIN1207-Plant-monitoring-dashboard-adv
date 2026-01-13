/**
 * Computes a Health Score (0–100) using weighted factors.
 * @param {Object} data - Sensor data (moisture, temperature, ph, n, p, k)
 * @returns {Number} Calculated health score
 */
const calculateHealthScore = (data) => {
    let score = 100;

    // 1. Soil Moisture (40% Weight) - Ideal: 40-70%
    if (data.soil_moisture < 30 || data.soil_moisture > 90) score -= 30;
    else if (data.soil_moisture < 40 || data.soil_moisture > 80) score -= 15;

    // 2. Temperature (20% Weight) - Ideal: 18-32°C
    if (data.temperature > 38 || data.temperature < 5) score -= 20;
    else if (data.temperature > 32 || data.temperature < 15) score -= 10;

    // 3. Soil pH (20% Weight) - Ideal: 6.0-7.0
    if (data.soil_ph < 5.0 || data.soil_ph > 8.0) score -= 20;
    else if (data.soil_ph < 6.0 || data.soil_ph > 7.0) score -= 10;

    // 4. Nutrient Balance (20% Weight) - Dummy proxy for now
    // If any nutrient is extremely low, penalize
    if (data.nutrient_n < 10 || data.nutrient_p < 10 || data.nutrient_k < 10) score -= 20;

    return Math.max(0, Math.min(100, score));
};

const getHealthStatus = (score) => {
    if (score >= 80) return { label: 'Good', color: 'green', code: 'GOOD' };
    if (score >= 50) return { label: 'Moderate', color: 'yellow', code: 'MODERATE' };
    return { label: 'Critical', color: 'red', code: 'CRITICAL' };
};

module.exports = { calculateHealthScore, getHealthStatus };
