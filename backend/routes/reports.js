const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../models/database');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Helper to convert JSON to CSV
function jsonToCsv(items) {
    if (items.length === 0) return '';
    const header = Object.keys(items[0]).join(',');
    const rows = items.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    return [header, ...rows].join('\n');
}

// GET /api/reports/alerts/csv
router.get('/alerts/csv', authenticateToken, async (req, res) => {
    try {
        const { role, id } = req.user;
        let sql = `
            SELECT a.alert_id, p.plant_name, a.message, a.priority, a.status, a.created_at 
            FROM alerts a 
            JOIN plants p ON a.plant_id = p.plant_id
        `;
        const params = [];

        // Filter for farmers
        if (role === 'farmer') {
            sql += ` WHERE p.user_id = ? `;
            params.push(id);
        }

        sql += ` ORDER BY a.created_at DESC`;

        const alerts = await query(sql, params);

        // If empty, return headers if possible, or just empty string
        if (alerts.length === 0) {
            // Return just a header row if we know the schema, or empty string.
            // For better UX, let's return a static header if empty
            const emptyHeader = "alert_id,plant_name,message,priority,status,created_at";
            res.header('Content-Type', 'text/csv');
            res.attachment('alerts_report.csv');
            return res.send(emptyHeader);
        }

        const csv = jsonToCsv(alerts);
        res.header('Content-Type', 'text/csv');
        res.attachment('alerts_report.csv');
        return res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// GET /api/reports/health/csv
router.get('/health/csv', authenticateToken, async (req, res) => {
    try {
        const { role, id } = req.user;
        let sql = `
            SELECT l.log_id, p.plant_name, l.soil_moisture, l.temperature, l.humidity, l.log_date 
            FROM plant_health_logs l 
            JOIN plants p ON l.plant_id = p.plant_id
        `;
        const params = [];

        if (role === 'farmer') {
            sql += ` WHERE p.user_id = ? `;
            params.push(id);
        }

        sql += ` ORDER BY l.log_date DESC`;

        const logs = await query(sql, params);

        if (logs.length === 0) {
            const emptyHeader = "log_id,plant_name,soil_moisture,temperature,humidity,log_date";
            res.header('Content-Type', 'text/csv');
            res.attachment('health_logs_report.csv');
            return res.send(emptyHeader);
        }

        const csv = jsonToCsv(logs);
        res.header('Content-Type', 'text/csv');
        res.attachment('health_logs_report.csv');
        return res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Export failed' });
    }
});

module.exports = router;
