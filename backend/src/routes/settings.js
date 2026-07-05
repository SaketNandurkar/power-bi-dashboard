const express = require('express');
const { getSapSettings, updateSapSettings } = require('../services/settingsService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/settings/sap
 * Get current SAP settings (password masked)
 */
router.get('/sap', async (req, res, next) => {
  try {
    const settings = await getSapSettings();

    // Mask password for security
    const masked = {
      ...settings,
      password: settings.password ? '********' : ''
    };

    res.json({ status: 'success', settings: masked });
  } catch (err) {
    logger.error('Failed to fetch SAP settings', { error: err.message });
    next(err);
  }
});

/**
 * PUT /api/settings/sap
 * Update SAP settings
 * Body: { username, password, baseUrl, mockMode, syncEnabled }
 */
router.put('/sap', async (req, res, next) => {
  try {
    const { username, password, baseUrl, mockMode, syncEnabled } = req.body;

    // Validate required fields
    if (!username || !baseUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and Base URL are required'
      });
    }

    // Update settings
    await updateSapSettings({
      username,
      password, // Only update if provided
      baseUrl,
      mockMode,
      syncEnabled
    });

    logger.info('SAP settings updated via API', {
      requestId: req.requestId,
      user: req.user?.username || 'unknown'
    });

    res.json({
      status: 'success',
      message: 'SAP settings updated successfully'
    });
  } catch (err) {
    logger.error('Failed to update SAP settings', { error: err.message });
    next(err);
  }
});

module.exports = router;
