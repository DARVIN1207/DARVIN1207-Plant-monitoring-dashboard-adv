const express = require('express');
const { authenticateToken, requireBotanist } = require('../middleware/auth');
const { query, run } = require('../models/database');

const router = express.Router();

// GET /api/plants (role based)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, species, location } = req.query;
    let sql = 'SELECT p.*, u.full_name as farmer_name, u.whatsapp_number FROM plants p LEFT JOIN users u ON p.user_id = u.user_id WHERE 1=1';
    const params = [];

    // Filter by user role
    if (req.user.role === 'farmer') {
      sql += ' AND p.user_id = ?';
      params.push(req.user.id);
    }

    if (search) {
      sql += ' AND (p.plant_name LIKE ? OR p.farmer_name LIKE ? OR p.notes LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (species) {
      sql += ' AND p.species = ?';
      params.push(species);
    }

    if (location) {
      sql += ' AND p.location = ?';
      params.push(location);
    }

    sql += ' ORDER BY p.plant_id DESC';

    const plants = await query(sql, params);
    res.json(plants);
  } catch (error) {
    console.error('Error fetching plants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plants/:id (role based check)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const plants = await query('SELECT * FROM plants WHERE plant_id = ?', [id]);

    if (plants.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = plants[0];

    // Security check: Farmers can only view their own plants
    if (req.user.role === 'farmer' && plant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(plant);
  } catch (error) {
    console.error('Error fetching plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/plants (botanist only)
router.post('/', authenticateToken, requireBotanist, async (req, res) => {
  try {
    const { plant_name, species, age_days, location, plot_name, user_id, notes } = req.body;

    if (!plant_name || !species || !age_days || !location || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch farmer details 
    const users = await query('SELECT full_name FROM users WHERE user_id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid Farmer ID' });
    }
    const farmer_name = users[0].full_name;

    const result = await run(
      `INSERT INTO plants (plant_name, species, age_days, location, plot_name, user_id, farmer_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [plant_name, species, age_days, location, plot_name || location, user_id, farmer_name, notes || '']
    );

    const plants = await query('SELECT * FROM plants WHERE plant_id = ?', [result.lastID]);
    res.status(201).json(plants[0]);
  } catch (error) {
    console.error('Error creating plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/plants/:id (botanist only)
router.put('/:id', authenticateToken, requireBotanist, async (req, res) => {
  try {
    const { id } = req.params;
    const { plant_name, species, age_days, location, plot_name, user_id, notes } = req.body;

    // Check if plant exists
    const existingPlants = await query('SELECT * FROM plants WHERE plant_id = ?', [id]);
    if (existingPlants.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    let farmer_name = existingPlants[0].farmer_name;
    if (user_id) {
      const users = await query('SELECT full_name FROM users WHERE user_id = ?', [user_id]);
      if (users.length > 0) farmer_name = users[0].full_name;
    }

    await run(
      `UPDATE plants 
       SET plant_name = ?, species = ?, age_days = ?, location = ?, plot_name = ?, user_id = ?, farmer_name = ?, notes = ?
       WHERE plant_id = ?`,
      [plant_name, species, age_days, location, plot_name || location, user_id, farmer_name, notes || '', id]
    );

    const updatedPlants = await query('SELECT * FROM plants WHERE plant_id = ?', [id]);
    res.json(updatedPlants[0]);
  } catch (error) {
    console.error('Error updating plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

