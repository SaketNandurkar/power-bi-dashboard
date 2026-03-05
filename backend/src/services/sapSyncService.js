const crypto = require('crypto');
const { pool } = require('./dbService');
const { fetchEntitySet } = require('./sapOdataClient');
const { ENTITY_SET_CONFIG } = require('./sapFieldMappings');
const logger = require('../utils/logger');
const { exportAllCsvFiles } = require('./csvExportService');

// In-memory sync state
const syncState = {
  lastSyncAt: null,
  nextSyncAt: null,
  syncing: false,
  currentReport: null,
  results: {},
  lastError: null,
  triggeredBy: null
};

// --- Type converters ---

function convertValue(value, type) {
  if (value === undefined || value === null || value === '') return null;

  const str = String(value).trim();
  if (str === '') return null;

  switch (type) {
    case 'integer': {
      const n = parseInt(str, 10);
      return isNaN(n) ? null : n;
    }
    case 'numeric': {
      const n = parseFloat(str);
      return isNaN(n) ? null : n;
    }
    case 'date_yyyymmdd': {
      // SAP format: '20230221' → '2023-02-21'
      if (str.length !== 8) return null;
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    case 'date_ddmmyyyy': {
      // SAP format: '17.10.2022' → '2022-10-17'
      const parts = str.split('.');
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    default:
      return str;
  }
}

function transformEntry(sapEntry, fields) {
  const dbRow = {};
  for (const field of fields) {
    dbRow[field.db] = convertValue(sapEntry[field.sap], field.type);
  }
  return dbRow;
}

function computeRowHash(dbRow, paramOrder) {
  const values = paramOrder.map(col => String(dbRow[col] ?? ''));
  return crypto.createHash('sha256').update(values.join('|')).digest('hex');
}

// --- Sync operations ---

/**
 * Syncs a single report type from SAP to PostgreSQL.
 */
async function syncReportType(reportType, triggeredBy = 'manual') {
  const entityConfig = ENTITY_SET_CONFIG[reportType];
  if (!entityConfig) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  const startTime = Date.now();
  let auditId = null;

  try {
    // Create audit record
    const auditResult = await pool.query(
      `INSERT INTO audit.upload_audit
       (report_type, file_name, file_size_bytes, upload_status, uploaded_by)
       VALUES ($1, $2, 0, 'processing', $3) RETURNING id`,
      [reportType, `sap_sync_${entityConfig.entitySetName}`, `sap_sync_${triggeredBy}`]
    );
    auditId = auditResult.rows[0].id;

    // TRUNCATE tables to replace with fresh snapshot from SAP
    try {
      logger.info('Truncating tables for snapshot sync', { reportType });

      // Truncate raw table
      await pool.query(`TRUNCATE TABLE raw.raw_${reportType} CASCADE`);

      // Truncate curated table
      await pool.query(`TRUNCATE TABLE curated.${reportType} CASCADE`);

      logger.info('Tables truncated successfully', { reportType });
    } catch (truncateError) {
      logger.error('Truncate failed, continuing with upsert', {
        reportType,
        error: truncateError.message
      });
      // Don't fail the sync if truncate fails - upsert will still work
    }

    // Fetch from SAP (or mock XML)
    const sapEntries = await fetchEntitySet(entityConfig.entitySetName);

    let rowsInserted = 0;
    let rowsUpdated = 0;
    let rowsUnchanged = 0;

    // Process each entry
    for (const sapEntry of sapEntries) {
      const dbRow = transformEntry(sapEntry, entityConfig.fields);
      const rowHash = computeRowHash(dbRow, entityConfig.upsertParamOrder);

      // Build params array: columns in upsert order + row_hash at the end
      const params = [
        ...entityConfig.upsertParamOrder.map(col => dbRow[col]),
        rowHash
      ];

      // Build the function call: SELECT raw.upsert_xxx($1, $2, ..., $N)
      const funcName = `raw.upsert_${reportType}`;
      const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');

      const result = await pool.query(
        `SELECT ${funcName}(${placeholders}) AS action`,
        params
      );

      const action = result.rows[0]?.action;
      if (action === 'inserted') rowsInserted++;
      else if (action === 'updated') rowsUpdated++;
      else rowsUnchanged++;
    }

    const duration = Date.now() - startTime;

    // Update audit record with success
    await pool.query(
      `UPDATE audit.upload_audit SET
       rows_total = $1, rows_inserted = $2, rows_updated = $3, rows_unchanged = $4,
       upload_status = 'success', completed_at = NOW(), duration_ms = $5
       WHERE id = $6`,
      [sapEntries.length, rowsInserted, rowsUpdated, rowsUnchanged, duration, auditId]
    );

    const result = {
      report_type: reportType,
      rows_total: sapEntries.length,
      rows_inserted: rowsInserted,
      rows_updated: rowsUpdated,
      rows_unchanged: rowsUnchanged,
      duration_ms: duration,
      status: 'success'
    };

    logger.info('SAP sync completed for report type', result);
    return result;

  } catch (err) {
    const duration = Date.now() - startTime;

    // Update audit record with failure
    if (auditId) {
      await pool.query(
        `UPDATE audit.upload_audit SET
         upload_status = 'failed', error_message = $1,
         completed_at = NOW(), duration_ms = $2
         WHERE id = $3`,
        [err.message, duration, auditId]
      ).catch(auditErr => logger.error('Failed to update audit on error', { auditErr: auditErr.message }));

      await pool.query(
        `INSERT INTO audit.error_log (report_type, file_name, error_type, error_message, error_detail)
         VALUES ($1, $2, $3, $4, $5)`,
        [reportType, `sap_sync_${entityConfig.entitySetName}`, 'sap_sync_error', err.message, err.stack]
      ).catch(logErr => logger.error('Failed to write error log', { logErr: logErr.message }));
    }

    logger.error('SAP sync failed for report type', {
      reportType,
      error: err.message,
      duration_ms: duration
    });

    return {
      report_type: reportType,
      rows_total: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_unchanged: 0,
      duration_ms: duration,
      status: 'failed',
      error: err.message
    };
  }
}

/**
 * Syncs all 4 report types sequentially.
 */
async function syncAll(triggeredBy = 'scheduler') {
  if (syncState.syncing) {
    throw new Error('Sync already in progress');
  }

  syncState.syncing = true;
  syncState.lastError = null;
  syncState.currentReport = null;
  syncState.triggeredBy = triggeredBy;

  const startTime = Date.now();
  const reportTypes = Object.keys(ENTITY_SET_CONFIG);
  const results = {};

  try {
    for (const reportType of reportTypes) {
      syncState.currentReport = reportType;
      results[reportType] = await syncReportType(reportType, triggeredBy);
    }

    syncState.results = results;
    syncState.lastSyncAt = new Date().toISOString();

    // Export curated views to CSV for Power BI
    try {
      const csvResults = await exportAllCsvFiles(triggeredBy);
      logger.info('Post-sync CSV export completed', { csvResults, triggeredBy });
    } catch (csvErr) {
      logger.error('Post-sync CSV export failed (non-fatal)', {
        error: csvErr.message,
        triggeredBy
      });
    }

    logger.info('SAP sync completed for all reports', {
      triggeredBy,
      duration_ms: Date.now() - startTime,
      summary: Object.entries(results).map(([k, v]) => `${k}: ${v.rows_total} rows (${v.status})`).join(', ')
    });

    return {
      success: true,
      results,
      duration_ms: Date.now() - startTime
    };
  } catch (err) {
    syncState.lastError = err.message;
    logger.error('SAP syncAll failed', { error: err.message, triggeredBy });
    throw err;
  } finally {
    syncState.syncing = false;
    syncState.currentReport = null;
  }
}

function getSyncStatus() {
  return { ...syncState };
}

function setNextSyncTime(nextDate) {
  syncState.nextSyncAt = nextDate;
}

module.exports = { syncAll, syncReportType, getSyncStatus, setNextSyncTime };
