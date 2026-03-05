const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const { syncAll, syncReportType, getSyncStatus } = require('../services/sapSyncService');
const { getSchedulerStatus, restartScheduler } = require('../services/sapScheduler');
const { exportAllCsvFiles } = require('../services/csvExportService');

const router = express.Router();

/**
 * POST /api/sap/sync
 * Trigger SAP sync. Optional body: { reportType: 'accounts_payable' } for single report.
 */
router.post('/sync', async (req, res, next) => {
  const requestId = req.requestId;
  const { reportType } = req.body || {};

  try {
    logger.info('Manual SAP sync triggered', { requestId, reportType: reportType || 'all' });

    let result;
    if (reportType) {
      if (!config.validReportTypes.includes(reportType)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid reportType: "${reportType}". Valid: ${config.validReportTypes.join(', ')}`,
          requestId
        });
      }
      result = await syncReportType(reportType, 'manual');

      // Export curated views to CSV after single report sync
      try {
        const csvResults = await exportAllCsvFiles('manual');
        logger.info('Post-sync CSV export completed', { requestId, csvResults });
      } catch (csvErr) {
        logger.error('Post-sync CSV export failed (non-fatal)', { requestId, error: csvErr.message });
      }

      return res.json({
        status: 'success',
        message: `SAP sync completed for ${reportType}`,
        result,
        requestId
      });
    }

    result = await syncAll('manual');
    res.json({
      status: 'success',
      message: 'SAP sync completed for all reports',
      result,
      requestId
    });
  } catch (err) {
    if (err.message === 'Sync already in progress') {
      return res.status(409).json({
        status: 'error',
        message: 'A sync operation is already in progress. Please wait.',
        requestId
      });
    }

    logger.error('SAP sync request failed', { requestId, error: err.message });
    next(err);
  }
});

/**
 * GET /api/sap/status
 * Returns SAP sync status and scheduler info.
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'success',
    sync: getSyncStatus(),
    scheduler: getSchedulerStatus()
  });
});

// PUT /api/sap/schedule
// Update the cron schedule. Body: { cron: "0 * * * *" }
router.put('/schedule', async (req, res) => {
  const requestId = req.requestId;
  const { cron: cronExpr } = req.body || {};

  if (!cronExpr || typeof cronExpr !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'cron is required (e.g. "*/30 * * * *")',
      requestId
    });
  }

  try {
    await restartScheduler(cronExpr.trim());
    logger.info('SAP sync schedule updated', { requestId, cron: cronExpr.trim() });
    res.json({
      status: 'success',
      message: 'Schedule updated successfully',
      cron: cronExpr.trim(),
      requestId
    });
  } catch (err) {
    logger.error('Failed to update SAP schedule', { requestId, error: err.message });
    res.status(400).json({
      status: 'error',
      message: err.message,
      requestId
    });
  }
});

module.exports = router;
