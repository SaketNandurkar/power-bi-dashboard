const express = require('express');
const logger = require('../utils/logger');
const { exportAllCsvFiles } = require('../services/csvExportService');

const router = express.Router();

/**
 * POST /api/export/csv
 * Manually trigger CSV export of all curated views.
 */
router.post('/csv', async (req, res, next) => {
  const requestId = req.requestId;
  try {
    logger.info('Manual CSV export triggered', { requestId });

    const startTime = Date.now();
    const results = await exportAllCsvFiles('manual_api');
    const duration = Date.now() - startTime;

    const allSucceeded = Object.values(results).every(r => r.status === 'success');

    res.json({
      status: allSucceeded ? 'success' : 'partial_failure',
      message: allSucceeded
        ? 'All CSV files exported successfully'
        : 'Some CSV exports failed, check details',
      results,
      duration_ms: duration,
      requestId
    });
  } catch (err) {
    logger.error('CSV export request failed', { requestId, error: err.message });
    next(err);
  }
});

module.exports = router;
