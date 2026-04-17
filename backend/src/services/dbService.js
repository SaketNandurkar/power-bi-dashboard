const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

async function getUploadStatus() {
  const query = `
    SELECT DISTINCT ON (report_type)
      report_type,
      file_name,
      rows_total,
      rows_inserted,
      rows_updated,
      upload_status AS status,
      started_at AS last_uploaded,
      duration_ms,
      uploaded_by
    FROM audit.upload_audit
    ORDER BY report_type, started_at DESC
  `;

  const result = await pool.query(query);
  return result.rows;
}

async function healthCheck() {
  const result = await pool.query('SELECT NOW() as time');
  return result.rows[0].time;
}

module.exports = { pool, getUploadStatus, healthCheck };
