const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../services/dbService');
const config = require('../config');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * POST /api/auth/login
 * Validates credentials and returns a JWT token.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, full_name, role, is_active FROM audit.users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    logger.info('User logged in', { username: user.username, role: user.role });

    res.json({
      status: 'success',
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Returns current user info from the JWT token.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active FROM audit.users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ status: 'error', message: 'Account deactivated' });
    }
    res.json({
      status: 'success',
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    logger.error('Fetch current user failed', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to fetch user' });
  }
});

module.exports = router;
