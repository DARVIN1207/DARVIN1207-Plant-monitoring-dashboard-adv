const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');

const router = express.Router();

// GET /api/calendar/:plant_id
router.get('/:plant_id', authenticateToken, async (req, res) => {
    try {
        const { plant_id } = req.params;

        // Authorization check
        if (req.user.role === 'farmer') {
            const plant = await query('SELECT user_id FROM plants WHERE plant_id = ?', [plant_id]);
            if (plant.length === 0 || plant[0].user_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const tasks = await query('SELECT * FROM crop_calendar WHERE plant_id = ? ORDER BY task_date ASC', [plant_id]);
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching calendar:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/calendar (botanist only) --> ADD TASK/STAGE
router.post('/', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const { plant_id, task_type, task_date, description, growth_stage } = req.body;

        if (!plant_id || !task_type || !task_date) {
            return res.status(400).json({ error: 'Plant ID, type, and date required' });
        }

        const result = await run(
            `INSERT INTO crop_calendar (plant_id, task_type, task_date, description, status, growth_stage)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
            [plant_id, task_type, task_date, description, growth_stage || null]
        );

        const tasks = await query('SELECT * FROM crop_calendar WHERE task_id = ?', [result.lastID]);
        res.status(201).json(tasks[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/calendar/generate (Botanist Only) - Auto Schedule
router.post('/generate', authenticateToken, requireBotanist, async (req, res) => {
    try {
        const { plant_id, planting_date } = req.body;
        // Simple logic: Water every 3 days, Fertilizer every 14 days

        const tasks = [];
        const start = new Date(planting_date); // e.g., '2023-10-01'

        for (let i = 1; i <= 60; i++) { // Plan for 60 days
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            if (i % 3 === 0) {
                tasks.push({ type: 'Watering', date: dateStr, desc: 'Regular watering' });
            }
            if (i % 14 === 0) {
                tasks.push({ type: 'Fertilizer', date: dateStr, desc: 'Apply NPK' });
            }
        }

        // Harvest at day 60
        const harvestDate = new Date(start);
        harvestDate.setDate(harvestDate.getDate() + 60);
        tasks.push({ type: 'Harvest', date: harvestDate.toISOString().split('T')[0], desc: 'Expected harvest window' });

        for (const t of tasks) {
            await run(
                `INSERT INTO crop_calendar (plant_id, task_type, task_date, description, status)
                 VALUES (?, ?, ?, ?, 'pending')`,
                [plant_id, t.type, t.date, t.desc]
            );
        }

        res.status(201).json({ message: `Generated ${tasks.length} tasks` });

    } catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
