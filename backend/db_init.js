const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database', 'plant_monitoring.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to SQLite database');
});

// Helper to run SQL with error logging
const run = (sql, params = []) => {
  db.run(sql, params, function (err) {
    if (err) {
      console.error('Error executing SQL:', err.message);
      console.error('Query:', sql);
    }
  });
};

db.serialize(() => {
  // Drop existing tables
  run('DROP TABLE IF EXISTS chat_messages');
  run('DROP TABLE IF EXISTS crop_calendar');
  run('DROP TABLE IF EXISTS audit_logs');
  run('DROP TABLE IF EXISTS alerts');
  run('DROP TABLE IF EXISTS recommendations');
  run('DROP TABLE IF EXISTS plant_health_logs');
  run('DROP TABLE IF EXISTS plants');
  run('DROP TABLE IF EXISTS users');
  run('DROP TABLE IF EXISTS agronomists');
  run('DROP TABLE IF EXISTS weather_forecasts');
  run('DROP TABLE IF EXISTS report_schedules');

  console.log('Dropped existing tables');

  // --- Create Users ---
  run(`CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'farmer',
    full_name TEXT NOT NULL,
    specialization TEXT,
    phone TEXT,
    email TEXT,
    whatsapp_number TEXT,
    language TEXT DEFAULT 'en',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  run('CREATE INDEX idx_users_role ON users(role)');

  // --- Create Plants ---
  run(`CREATE TABLE plants (
    plant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_name TEXT NOT NULL,
    species TEXT NOT NULL,
    age_days INTEGER NOT NULL,
    location TEXT NOT NULL,
    plot_name TEXT,
    user_id INTEGER,
    farmer_name TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )`);
  run('CREATE INDEX idx_plants_user_id ON plants(user_id)');

  // --- Create Plant Health Logs ---
  run(`CREATE TABLE plant_health_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    log_date DATE NOT NULL,
    soil_moisture REAL,
    soil_ph REAL,
    temperature REAL,
    humidity REAL,
    sunlight_lux INTEGER,
    nutrient_n REAL,
    nutrient_p REAL,
    nutrient_k REAL,
    growth_height_cm REAL,
    disease_risk INTEGER,
    health_score REAL,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id)
  )`);
  run('CREATE INDEX idx_health_logs_plant_id ON plant_health_logs(plant_id)');

  // --- Create Recommendations ---
  run(`CREATE TABLE recommendations (
    rec_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    advice_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )`);

  // --- Create Alerts ---
  run(`CREATE TABLE alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium',
    scheduled_time DATETIME,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id)
  )`);
  run('CREATE INDEX idx_alerts_plant_id ON alerts(plant_id)');

  // --- Create Chat Messages ---
  run(`CREATE TABLE chat_messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sensor_summary TEXT,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (receiver_id) REFERENCES users(user_id)
  )`);
  run('CREATE INDEX idx_chat_sender_receiver ON chat_messages(sender_id, receiver_id)');

  // --- Create Crop Calendar ---
  run(`CREATE TABLE crop_calendar (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    task_date DATE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    growth_stage TEXT,
    FOREIGN KEY (plant_id) REFERENCES plants(plant_id)
  )`);

  // --- Other Tables ---
  run(`CREATE TABLE weather_forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    temp_min REAL,
    temp_max REAL,
    rain_probability REAL,
    condition TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  run(`CREATE TABLE report_schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_type TEXT NOT NULL,
    format TEXT DEFAULT 'csv',
    last_sent DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )`);

  run(`CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )`);

  console.log('Database tables created');

  // --- Seeding ---
  // (Original Seeding Logic - Preserved)
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const saltRounds = 10;
  const userPromises = [];

  // Seed Botanists
  const specializations = ['Crop Management', 'Soil Science', 'Pest Control', 'Irrigation Systems', 'Organic Farming'];
  for (let i = 1; i <= 5; i++) {
    const username = `botanist${i.toString().padStart(2, '0')}`;
    const password = 'pass01';
    const hashedPassword = bcrypt.hashSync(password, saltRounds);
    const fullName = `Botanist ${i}`;
    const specialization = specializations[random(0, specializations.length - 1)];

    userPromises.push(new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (username, password, role, full_name, specialization, phone, email, whatsapp_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, 'botanist', fullName, specialization, `+1-555-${random(100, 999)}-${random(1000, 9999)}`, `botanist${i}@farm.com`, `+1555${random(1000000, 9999999)}`],
        function (err) { if (err) reject(err); else resolve({ id: this.lastID, role: 'botanist' }); }
      );
    }));
  }

  // Admin
  userPromises.push(new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (username, password, role, full_name, phone, email) VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin01', bcrypt.hashSync('admin123', saltRounds), 'admin', 'System Admin', '+1-555-999-9999', 'admin@farm.com'],
      function (err) { if (err) reject(err); else resolve({ id: this.lastID, role: 'admin', name: 'Admin' }); }
    );
  }));

  // Farmers
  for (let i = 1; i <= 5; i++) {
    const username = i === 1 ? 'farmer001' : `farmer${i.toString().padStart(3, '0')}`;
    const hashedPassword = bcrypt.hashSync('pwd001', saltRounds);
    const fullName = `Farmer ${i}`;
    userPromises.push(new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (username, password, role, full_name, phone, email, whatsapp_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, 'farmer', fullName, '+1-555-000-0000', `farmer${i}@farm.com`, `+1555000000${i}`],
        function (err) { if (err) reject(err); else resolve({ id: this.lastID, role: 'farmer', name: fullName }); }
      );
    }));
  }

  Promise.all(userPromises).then((createdUsers) => {
    console.log(`Created ${createdUsers.length} users`);
    const farmerUsers = createdUsers.filter(u => u.role === 'farmer');
    const species = ['Tomato', 'Corn', 'Wheat', 'Rice'];
    const locations = ['Field A', 'Field B', 'Greenhouse 1'];
    const plantPromises = [];

    for (let i = 1; i <= 50; i++) {
      const plantName = `plant${i.toString().padStart(3, '0')}`;
      const plantSpecies = species[random(0, species.length - 1)];
      const ageDays = random(10, 180);
      const location = locations[random(0, locations.length - 1)];
      const farmer = farmerUsers[random(0, farmerUsers.length - 1)];

      plantPromises.push(new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO plants (plant_name, species, age_days, location, plot_name, user_id, farmer_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [plantName, plantSpecies, ageDays, location, `${location} - Plot ${random(1, 5)}`, farmer.id, farmer.name, `Notes for ${plantName}`],
          function (err) { if (err) reject(err); else resolve({ id: this.lastID }); }
        );
      }));
    }

    return Promise.all(plantPromises);
  }).then((plants) => {
    console.log(`Created ${plants.length} plants`);
    // Add chat message
    db.run("INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (1, 7, 'Hello Farmer')"); // IDs are approximate, just test

    console.log('Database initialization fully completed!');
    db.close();
  }).catch((err) => {
    console.error("Seeding Error:", err);
    db.close();
  });

});
