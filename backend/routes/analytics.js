const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../models/database');

const router = express.Router();

/**
 * GET /api/analytics/trends/:plant_id
 * Returns daily trends for moisture, temperature, and health score.
 */
router.get('/trends/:plant_id', authenticateToken, async (req, res) => {
    try {
        const { plant_id } = req.params;
        const { range } = req.query; // 'day', 'week', 'month'

        let days = 7;
        if (range === 'day') days = 1;
        if (range === 'month') days = 30;

        const results = await query(
            `SELECT log_date, 
                    AVG(soil_moisture) as avg_moisture, 
                    AVG(temperature) as avg_temp, 
                    AVG(health_score) as avg_health
             FROM plant_health_logs 
             WHERE plant_id = ? AND log_date >= date('now', ?)
             GROUP BY log_date 
             ORDER BY log_date ASC`,
            [plant_id, `-${days} days`]
        );

        res.json(results);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/comparison
 * Side-by-side metrics for a farmer's plots.
 */
router.get('/comparison', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const results = await query(
            `SELECT p.plant_id, p.plant_name, l.soil_moisture, l.temperature, l.health_score, l.log_date
             FROM plants p
             LEFT JOIN (
                 SELECT plant_id, soil_moisture, temperature, health_score, log_date,
                        ROW_NUMBER() OVER (PARTITION BY plant_id ORDER BY log_date DESC) as rn
                 FROM plant_health_logs
             ) l ON p.plant_id = l.plant_id AND l.rn = 1
             WHERE p.user_id = ?`,
            [userId]
        );

        res.json(results);
    } catch (error) {
        console.error('Comparison error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/admin-stats
 * High-level system stats for Admin.
 */
router.get('/admin-stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }

        const stats = await query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'farmer') as total_farmers,
                (SELECT COUNT(*) FROM plants) as total_plots,
                (SELECT COUNT(*) FROM alerts) as total_alerts,
                (SELECT species FROM plants GROUP BY species ORDER BY COUNT(*) DESC LIMIT 1) as common_crop
        `);

        // Get daily alert trend
        const dailyAlerts = await query(`
            SELECT date(created_at) as date, COUNT(*) as count 
            FROM alerts 
            GROUP BY date(created_at) 
            ORDER BY date DESC LIMIT 7
        `);

        // Most affected crops (Critical/High alerts)
        const affectedCrops = await query(`
            SELECT p.species, COUNT(*) as alert_count
            FROM alerts a
            JOIN plants p ON a.plant_id = p.plant_id
            WHERE a.priority IN ('critical', 'high')
            GROUP BY p.species
            ORDER BY alert_count DESC
        `);

        res.json({
            summary: stats[0],
            dailyAlerts,
            affectedCrops
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
