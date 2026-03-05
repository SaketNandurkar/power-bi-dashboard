const fs = require('fs');
const path = require('path');
const config = require('../config');
const { pool } = require('./dbService');
const logger = require('../utils/logger');

const EXPORT_VIEWS = [
  { view: 'curated."Sheet1"',           filename: 'Sheet1.csv' },
  { view: 'curated."ZSDR01"',           filename: 'ZSDR01.csv' },
  { view: 'curated.v_accounts_payable', filename: 'v_accounts_payable.csv' },
  { view: 'curated.v_bank_report',      filename: 'v_bank_report.csv' },
  { view: 'curated.v_budget_report',    filename: 'v_budget_report.csv' },
  { view: 'curated.v_sales_register',   filename: 'v_sales_register.csv' }
];

/**
 * Escape a value for CSV per RFC 4180.
 * Wraps in double quotes if value contains comma, quote, or newline.
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build a CSV string from pg query result fields and rows.
 */
function buildCsv(fields, rows) {
  const headers = fields.map(f => escapeCsvField(f.name));
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = fields.map(f => {
      const val = row[f.name];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return escapeCsvField(String(val));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n') + '\n';
}

/**
 * Export a single view to CSV file.
 * Uses atomic write (write to .tmp, then rename).
 */
async function exportViewToCsv(exportDir, viewConfig) {
  const startTime = Date.now();

  const result = await pool.query(`SELECT * FROM ${viewConfig.view}`);
  const csvContent = buildCsv(result.fields, result.rows);

  const filePath = path.join(exportDir, viewConfig.filename);
  const tempPath = filePath + '.tmp';

  await fs.promises.writeFile(tempPath, csvContent, 'utf8');
  await fs.promises.rename(tempPath, filePath);

  const duration = Date.now() - startTime;
  return { rows: result.rows.length, file: filePath, duration_ms: duration };
}

/**
 * Export all curated views to CSV files.
 * Each view is exported independently — one failure does not block others.
 *
 * @param {string} triggeredBy - Who triggered the export (scheduler, manual, upload, manual_api)
 * @returns {Object} Results keyed by view name
 */
async function exportAllCsvFiles(triggeredBy = 'unknown') {
  const exportDir = config.csvExportPath;
  const results = {};

  // Ensure export directory exists
  fs.mkdirSync(exportDir, { recursive: true });

  for (const viewConfig of EXPORT_VIEWS) {
    try {
      const info = await exportViewToCsv(exportDir, viewConfig);
      results[viewConfig.view] = { status: 'success', ...info };

      logger.info('CSV export completed', {
        view: viewConfig.view,
        file: viewConfig.filename,
        rows: info.rows,
        duration_ms: info.duration_ms,
        triggeredBy
      });
    } catch (err) {
      results[viewConfig.view] = { status: 'failed', error: err.message };

      logger.error('CSV export failed for view', {
        view: viewConfig.view,
        error: err.message,
        triggeredBy
      });
    }
  }

  return results;
}

module.exports = { exportAllCsvFiles, EXPORT_VIEWS };
