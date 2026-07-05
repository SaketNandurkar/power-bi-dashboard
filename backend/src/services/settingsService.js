const { pool } = require('./dbService');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * Get a setting value from the database
 * @param {string} key - Setting key
 * @param {boolean} encrypted - Whether the value is encrypted
 * @returns {Promise<string|null>} - Setting value or null if not found
 */
async function getSetting(key, encrypted = false) {
  const result = await pool.query(
    'SELECT value FROM audit.settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const value = result.rows[0].value;
  return encrypted ? decrypt(value) : value;
}

/**
 * Set a setting value in the database
 * @param {string} key - Setting key
 * @param {string} value - Setting value
 * @param {boolean} encrypted - Whether to encrypt the value
 */
async function setSetting(key, value, encrypted = false) {
  const storedValue = encrypted ? encrypt(value) : value;

  await pool.query(
    `INSERT INTO audit.settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, storedValue]
  );

  logger.info('Setting updated', { key, encrypted });
}

/**
 * Get all SAP settings
 * @returns {Promise<Object>} - SAP settings object
 */
async function getSapSettings() {
  const username = await getSetting('sap_username', false);
  const password = await getSetting('sap_password', true); // Encrypted
  const baseUrl = await getSetting('sap_odata_base_url', false);
  const mockMode = await getSetting('sap_mock_mode', false);
  const syncEnabled = await getSetting('sap_sync_enabled', false);

  return {
    username: username || process.env.SAP_USERNAME || '',
    password: password || process.env.SAP_PASSWORD || '',
    baseUrl: baseUrl || process.env.SAP_ODATA_BASE_URL || '',
    mockMode: mockMode === 'true' || process.env.SAP_MOCK_MODE === 'true',
    syncEnabled: syncEnabled !== 'false' && process.env.SAP_SYNC_ENABLED !== 'false'
  };
}

/**
 * Update SAP settings
 * @param {Object} settings - SAP settings to update
 */
async function updateSapSettings(settings) {
  if (settings.username !== undefined) {
    await setSetting('sap_username', settings.username, false);
  }
  if (settings.password !== undefined) {
    await setSetting('sap_password', settings.password, true); // Encrypted
  }
  if (settings.baseUrl !== undefined) {
    await setSetting('sap_odata_base_url', settings.baseUrl, false);
  }
  if (settings.mockMode !== undefined) {
    await setSetting('sap_mock_mode', String(settings.mockMode), false);
  }
  if (settings.syncEnabled !== undefined) {
    await setSetting('sap_sync_enabled', String(settings.syncEnabled), false);
  }

  logger.info('SAP settings updated');
}

module.exports = {
  getSetting,
  setSetting,
  getSapSettings,
  updateSapSettings
};
