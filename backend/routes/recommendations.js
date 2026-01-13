const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');

const router = express.Router();

// GET /api/recommendations/:plant_id
router.get('/:plant_id', authenticateToken, async (req, res) => {
  try {
    const { plant_id } = req.params;
    const recs = await query(
      'SELECT * FROM recommendations WHERE plant_id = ? ORDER BY created_at DESC',
      [plant_id]
    );
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations (Create manual)
router.post('/', authenticateToken, requireBotanist, async (req, res) => {
  try {
    const { plant_id, recommendation_text, action_type, priority } = req.body;

    await run(
      `INSERT INTO recommendations (plant_id, recommendation_text, action_type, priority) 
       VALUES (?, ?, ?, ?)`,
      [plant_id, recommendation_text, action_type || 'General', priority || 'Medium']
    );

    res.status(201).json({ message: 'Recommendation created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/recommendations/generate/:plant_id (Auto-Suggest)
router.get('/generate/:plant_id', authenticateToken, async (req, res) => {
  try {
    const { plant_id } = req.params;
    const logs = await query('SELECT * FROM plant_health_logs WHERE plant_id = ? ORDER BY log_date DESC LIMIT 1', [plant_id]);

    const suggestions = [];
    if (logs.length > 0) {
      const log = logs[0];
      if (log.soil_moisture < 40) suggestions.push({ action: 'Watering', text: 'Soil moisture is low (<40%). Consider irrigation.', priority: 'High' });
      if (log.disease_risk > 20) suggestions.push({ action: 'Treatment', text: `Disease risk detected (${log.disease_risk}%). Check for pests.`, priority: 'Critical' });
      if (log.nutrient_n < 30) suggestions.push({ action: 'Fertilizer', text: 'Nitrogen levels appear low.', priority: 'Medium' });
    } else {
      suggestions.push({ action: 'Data', text: 'No health data available to generate recommendations.', priority: 'Low' });
    }
    res.json(suggestions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

