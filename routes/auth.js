const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbRun } = require('../src/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new client
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      first_name, 
      last_name, 
      company_name, 
      phone, 
      address, 
      city, 
      postcode 
    } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required.'
      });
    }

    // Check if email already exists
    const existingUser = await dbGet('SELECT email FROM clients WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate unique client ID
    const clientId = 'MDRG' + Date.now().toString(36).toUpperCase();

    // Insert new client
    await dbRun(
      `INSERT INTO clients (client_id, email, password, first_name, last_name, company_name, phone, address, city, postcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, email, hashedPassword, first_name, last_name, company_name, phone, address, city, postcode]
    );

    // Generate token
    const token = generateToken({
      client_id: clientId,
      email,
      first_name,
      last_name
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        client_id: clientId,
        email,
        first_name,
        last_name,
        company_name,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration.',
      error: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Find user
    const user = await dbGet(
      'SELECT client_id, email, password, first_name, last_name, company_name, status, last_login FROM clients WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or suspended. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Update last login
    await dbRun(
      'UPDATE clients SET last_login = CURRENT_TIMESTAMP WHERE client_id = ?',
      [user.client_id]
    );

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        client_id: user.client_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login.',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT client_id, email, first_name, last_name, company_name, phone, 
              address, city, postcode, country, status, created_at, last_login 
       FROM clients WHERE client_id = ?`,
      [req.user.client_id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile.',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, company_name, phone, address, city, postcode } = req.body;

    await dbRun(
      `UPDATE clients SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        company_name = COALESCE(?, company_name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        postcode = COALESCE(?, postcode),
        updated_at = CURRENT_TIMESTAMP
       WHERE client_id = ?`,
      [first_name, last_name, company_name, phone, address, city, postcode, req.user.client_id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating profile.',
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    // Get current password hash
    const user = await dbGet('SELECT password FROM clients WHERE client_id = ?', [req.user.client_id]);

    // Verify current password
    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await dbRun(
      'UPDATE clients SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?',
      [hashedPassword, req.user.client_id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing password.',
      error: error.message
    });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await dbGet('SELECT client_id, email FROM clients WHERE email = ?', [email]);

    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // In production, send email with reset link
    // For now, just return success
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.',
      error: error.message
    });
  }
});

// Logout (client-side token removal, but we can log the action)
router.post('/logout', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful.'
  });
});

module.exports = router;
