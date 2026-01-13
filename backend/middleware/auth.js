const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'plant_health_monitoring_secret_key_2024';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireBotanist = (req, res, next) => {
  if (req.user.role !== 'botanist' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Botanist or Admin access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireBotanist,
  JWT_SECRET
};

