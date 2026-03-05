const express = require('express');
const { getUploadStatus, healthCheck } = require('../services/dbService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const reports = await getUploadStatus();

    const allTypes = ['accounts_payable', 'bank_report', 'budget_report', 'sales_register'];
    const statusMap = {};

    for (const r of reports) {
      statusMap[r.report_type] = {
        report_type: r.report_type,
        last_uploaded: r.last_uploaded,
        rows_total: r.rows_total,
        status: r.status,
        source: r.uploaded_by && r.uploaded_by.startsWith('sap_sync') ? 'SAP Sync' : 'CSV Upload'
      };
    }

    const result = allTypes.map(type => statusMap[type] || {
      report_type: type,
      last_uploaded: null,
      rows_total: 0,
      status: 'pending',
      source: null
    });

    res.json({ status: 'success', reports: result });
  } catch (err) {
    logger.error('Status fetch failed', { error: err.message });
    next(err);
  }
});

router.get('/health', async (req, res) => {
  try {
    const dbTime = await healthCheck();
    res.json({ status: 'healthy', database: 'connected', timestamp: dbTime });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

module.exports = router;
