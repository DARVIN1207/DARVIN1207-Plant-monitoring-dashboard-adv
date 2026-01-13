const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const plantRoutes = require('./routes/plants');
const healthLogRoutes = require('./routes/healthLogs');
const recommendationRoutes = require('./routes/recommendations');
const alertRoutes = require('./routes/alerts');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const calendarRoutes = require('./routes/calendar');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/reports');
const weatherRoutes = require('./routes/weather');
const whatsappRoutes = require('./routes/whatsapp');
const { initScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/healthlogs', healthLogRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Serve frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Check if database exists before starting
const dbPath = path.join(__dirname, 'database', 'plant_monitoring.db');

if (!fs.existsSync(dbPath)) {
  console.warn('⚠️  Warning: Database not found. Please run "npm run init-db" first.');
  console.warn('   Server will start, but database operations will fail.');
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Frontend available at http://localhost:${PORT}`);
  console.log(`\n📝 To initialize database, run: npm run init-db`);

  // Start scheduler
  initScheduler();

  console.log('\n📱 WhatsApp: Each botanist must connect their own account via dashboard');
});
