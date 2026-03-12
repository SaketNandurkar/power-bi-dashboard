const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../services/dbService');
const logger = require('../utils/logger');

const router = express.Router();

const VALID_ROLES = ['ADMIN', 'SALES_MANAGER', 'ACCOUNTS_MANAGER', 'BANK_MANAGER', 'CEO_CFO'];

/**
 * GET /api/users
 * List all users (without password_hash).
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active, created_at, updated_at FROM audit.users ORDER BY created_at ASC'
    );
    res.json({ status: 'success', users: result.rows });
  } catch (err) {
    logger.error('Failed to list users', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});

/**
 * POST /api/users
 * Create a new user.
 */
router.post('/', async (req, res) => {
  const { username, password, full_name, role } = req.body || {};

  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ status: 'error', message: 'All fields required: username, password, full_name, role' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ status: 'error', message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM audit.users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Username already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO audit.users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, is_active, created_at`,
      [username, hash, full_name, role]
    );

    logger.info('User created', { username, role, createdBy: req.user.username });
    res.status(201).json({ status: 'success', user: result.rows[0] });
  } catch (err) {
    logger.error('Failed to create user', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to create user' });
  }
});

/**
 * PUT /api/users/:id
 * Update user (name, role, is_active, optional password reset).
 */
router.put('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { full_name, role, is_active, password } = req.body || {};

  // Prevent admin from deactivating or demoting themselves
  if (userId === req.user.id) {
    if (is_active === false) {
      return res.status(400).json({ status: 'error', message: 'Cannot deactivate your own account' });
    }
    if (role && role !== 'ADMIN') {
      return res.status(400).json({ status: 'error', message: 'Cannot change your own role' });
    }
  }

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ status: 'error', message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM audit.users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); params.push(full_name); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); params.push(role); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(userId);

    const result = await pool.query(
      `UPDATE audit.users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, username, full_name, role, is_active, updated_at`,
      params
    );

    logger.info('User updated', { userId, updatedBy: req.user.username });
    res.json({ status: 'success', user: result.rows[0] });
  } catch (err) {
    logger.error('Failed to update user', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete: sets is_active = false.
 */
router.delete('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (userId === req.user.id) {
    return res.status(400).json({ status: 'error', message: 'Cannot deactivate your own account' });
  }

  try {
    const result = await pool.query(
      `UPDATE audit.users SET is_active = false, updated_at = NOW() WHERE id = $1
       RETURNING id, username, full_name, role, is_active`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    logger.info('User deactivated', { userId, deactivatedBy: req.user.username });
    res.json({ status: 'success', user: result.rows[0] });
  } catch (err) {
    logger.error('Failed to deactivate user', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to deactivate user' });
  }
});

module.exports = router;
