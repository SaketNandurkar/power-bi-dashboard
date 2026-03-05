const express = require('express');
const { upload, validateReportType } = require('../middleware/fileValidator');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { forwardToN8n } = require('../services/n8nService');
const logger = require('../utils/logger');
const { exportAllCsvFiles } = require('../services/csvExportService');

const router = express.Router();

router.post('/',
  uploadLimiter,
  upload.single('file'),
  validateReportType,
  async (req, res, next) => {
    const requestId = req.requestId;

    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded. Please attach a CSV or XLSX file.',
          requestId
        });
      }

      logger.info('Upload request received', {
        requestId,
        reportType: req.reportType,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });

      const result = await forwardToN8n(req.file, req.reportType, requestId);

      // Export curated views to CSV after successful upload
      try {
        const csvResults = await exportAllCsvFiles('upload');
        logger.info('Post-upload CSV export completed', { requestId, csvResults });
      } catch (csvErr) {
        logger.error('Post-upload CSV export failed (non-fatal)', {
          requestId,
          error: csvErr.message
        });
      }

      res.json({
        status: 'success',
        message: 'File processed successfully',
        reportType: req.reportType,
        fileName: req.file.originalname,
        result,
        requestId
      });
    } catch (err) {
      logger.error('Upload processing failed', {
        requestId,
        error: err.message,
        reportType: req.reportType,
        fileName: req.file?.originalname
      });

      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        return res.status(503).json({
          status: 'error',
          message: 'Processing service unavailable. Please try again later.',
          requestId
        });
      }

      next(err);
    }
  }
);

module.exports = router;
