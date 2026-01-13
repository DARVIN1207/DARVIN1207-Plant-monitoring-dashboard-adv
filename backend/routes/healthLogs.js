const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');
const { calculateHealthScore } = require('../services/scoreCalculator');
const { processAlertRules } = require('../services/alertEngine');
const { generateRecommendations } = require('../services/recommendationEngine');

const router = express.Router();

// GET /api/healthlogs/:plant_id
router.get('/:plant_id', authenticateToken, async (req, res) => {
  try {
    const { plant_id } = req.params;
    const { days } = req.query; // Optional: filter by last N days

    let sql = 'SELECT * FROM plant_health_logs WHERE plant_id = ?';
    const params = [plant_id];

    if (days) {
      sql += ' AND log_date >= date("now", "-' + parseInt(days) + ' days")';
    }

    sql += ' ORDER BY log_date DESC';

    const logs = await query(sql, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching health logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/healthlogs/:plant_id (botanist only or IoT Device)
router.post('/:plant_id', authenticateToken, requireBotanist, async (req, res) => {
  try {
    const { plant_id } = req.params;
    const sensorData = req.body;

    // Check if plant exists
    const existingPlants = await query('SELECT * FROM plants WHERE plant_id = ?', [plant_id]);
    if (existingPlants.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const date = sensorData.log_date || new Date().toISOString().split('T')[0];

    // Compute Health Score
    const healthScore = calculateHealthScore(sensorData);

    const result = await run(
      `INSERT INTO plant_health_logs 
       (plant_id, log_date, soil_moisture, soil_ph, temperature, humidity, sunlight_lux,
        nutrient_n, nutrient_p, nutrient_k, growth_height_cm, disease_risk, health_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plant_id, date, sensorData.soil_moisture, sensorData.soil_ph, sensorData.temperature,
        sensorData.humidity, sensorData.sunlight_lux, sensorData.nutrient_n,
        sensorData.nutrient_p, sensorData.nutrient_k, sensorData.growth_height_cm,
        sensorData.disease_risk, healthScore
      ]
    );

    // Trigger Engines (Async)
    processAlertRules(plant_id, sensorData).catch(e => console.error('Alert Engine Error:', e));
    generateRecommendations(plant_id, sensorData).catch(e => console.error('Rec Engine Error:', e));

    const logs = await query('SELECT * FROM plant_health_logs WHERE log_id = ?', [result.lastID]);
    res.status(201).json(logs[0]);
  } catch (error) {
    console.error('Error creating health log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

