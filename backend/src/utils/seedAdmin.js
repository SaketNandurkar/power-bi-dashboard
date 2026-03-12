const bcrypt = require('bcryptjs');
const { pool } = require('../services/dbService');
const logger = require('./logger');

async function seedAdmin() {
  try {
    // Ensure audit.users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit.users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name     VARCHAR(100) NOT NULL,
        role          VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN','SALES_MANAGER','ACCOUNTS_MANAGER','BANK_MANAGER','CEO_CFO')),
        is_active     BOOLEAN DEFAULT true,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Only seed if no users exist
    const existing = await pool.query('SELECT COUNT(*) FROM audit.users');
    if (parseInt(existing.rows[0].count) > 0) return;

    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO audit.users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', hash, 'System Administrator', 'ADMIN']
    );
    logger.info('Default admin user seeded (username: admin)');
  } catch (err) {
    logger.error('Failed to seed admin user', { error: err.message });
  }
}

module.exports = { seedAdmin };
