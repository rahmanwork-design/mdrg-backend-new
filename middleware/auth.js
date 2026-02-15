const jwt = require('jsonwebtoken');
const { dbGet } = require('../src/database');

const JWT_SECRET = process.env.JWT_SECRET || 'mdrg-secret-key-2024';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      client_id: user.client_id, 
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user exists in database
    const user = await dbGet(
      'SELECT client_id, email, first_name, last_name, status FROM clients WHERE client_id = ?',
      [decoded.client_id]
    );

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is inactive or suspended.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

// Optional authentication (for public routes that can show different content for logged-in users)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await dbGet(
        'SELECT client_id, email, first_name, last_name FROM clients WHERE client_id = ?',
        [decoded.client_id]
      );
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token, continue without user
    }
  }
  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  JWT_SECRET
};
