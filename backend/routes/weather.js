const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getWeatherForecast } = require('../services/weatherService');

const router = express.Router();

router.get('/:location', authenticateToken, async (req, res) => {
    try {
        const { location } = req.params;
        const forecast = await getWeatherForecast(location);
        res.json(forecast);
    } catch (error) {
        console.error('Weather API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
