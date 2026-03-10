require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://aposap_user:aposap@2026@localhost:5432/aposap_dashboards',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,https://apothecon.bizwareinternational.com').split(',').map(s => s.trim()),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  logLevel: process.env.LOG_LEVEL || 'info',
  validReportTypes: ['accounts_payable', 'bank_report', 'budget_report', 'sales_register'],

  // SAP OData Integration
  sapOdataBaseUrl: process.env.SAP_ODATA_BASE_URL || 'https://10.10.2.212:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV',
  sapUsername: process.env.SAP_USERNAME || '',
  sapPassword: process.env.SAP_PASSWORD || '',
  sapMockMode: process.env.SAP_MOCK_MODE === 'true',
  sapSyncCron: process.env.SAP_SYNC_CRON || '0 * * * *',
  sapSyncEnabled: process.env.SAP_SYNC_ENABLED !== 'false',
  sapRequestTimeout: parseInt(process.env.SAP_REQUEST_TIMEOUT, 10) || 120000,

  // CSV Export
  csvExportPath: process.env.CSV_EXPORT_PATH || '/data/powerbi_exports'
};
