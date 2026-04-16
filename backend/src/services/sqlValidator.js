const logger = require('../utils/logger');
const config = require('../config');

/**
 * Validate SQL query for safety
 * @param {string} sql - SQL query to validate
 * @returns {Object} { valid: boolean, error: string|null, sanitized: string }
 */
function validateSQL(sql) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'Invalid SQL: empty or not a string' };
  }

  const normalizedSQL = sql.trim().toLowerCase();

  // 1. Check for forbidden keywords (DML/DDL)
  const forbiddenKeywords = [
    'insert', 'update', 'delete', 'drop', 'truncate', 'alter',
    'create', 'grant', 'revoke', 'exec', 'execute'
  ];

  for (const keyword of forbiddenKeywords) {
    // Match keyword as whole word (not part of another word)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSQL)) {
      logger.warn('SQL validation failed: forbidden keyword', { keyword, sql });
      return {
        valid: false,
        error: `Forbidden SQL operation: ${keyword.toUpperCase()}. Only SELECT queries allowed.`
      };
    }
  }

  // 2. Must start with SELECT
  if (!normalizedSQL.startsWith('select')) {
    return {
      valid: false,
      error: 'Query must start with SELECT'
    };
  }

  // 3. Cannot query raw.* schema (only curated views allowed)
  if (/\braw\.[a-z_]+/i.test(sql)) {
    return {
      valid: false,
      error: 'Cannot query raw schema. Use curated.v_* views only.'
    };
  }

  // 4. Cannot query system tables
  if (/\bpg_[a-z_]+/i.test(sql) || /\binformation_schema\b/i.test(sql)) {
    return {
      valid: false,
      error: 'Cannot query PostgreSQL system tables'
    };
  }

  // 5. Check for LIMIT clause, add if missing
  let sanitized = sql.trim();
  if (!/\blimit\s+\d+/i.test(sanitized)) {
    sanitized += ` LIMIT ${config.sqlMaxRows}`;
    logger.info('Added LIMIT clause to query', { limit: config.sqlMaxRows });
  } else {
    // Verify LIMIT is not too high
    const limitMatch = sanitized.match(/\blimit\s+(\d+)/i);
    if (limitMatch && parseInt(limitMatch[1], 10) > config.sqlMaxRows) {
      sanitized = sanitized.replace(/\blimit\s+\d+/i, `LIMIT ${config.sqlMaxRows}`);
      logger.info('Reduced LIMIT to maximum allowed', { limit: config.sqlMaxRows });
    }
  }

  // 6. Remove trailing semicolons (pg library doesn't need them)
  sanitized = sanitized.replace(/;\s*$/, '');

  logger.info('SQL validation passed', { originalLength: sql.length, sanitizedLength: sanitized.length });

  return { valid: true, error: null, sanitized };
}

module.exports = { validateSQL };
