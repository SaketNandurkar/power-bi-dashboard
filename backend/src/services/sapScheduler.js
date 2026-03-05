const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('./dbService');
const { syncAll, setNextSyncTime } = require('./sapSyncService');

let cronJob = null;
let currentCron = null;

/**
 * Compute a rough next-fire time from a cron expression.
 * Handles common patterns; falls back to +1 hour for complex expressions.
 */
function computeNextFireTime(cronExpr) {
  const now = new Date();
  const parts = cronExpr.trim().split(/\s+/);

  // Standard 5-part cron: minute hour day month weekday
  if (parts.length !== 5) {
    const fallback = new Date(now.getTime() + 3600000);
    return fallback.toISOString();
  }

  const [minPart, hourPart] = parts;

  // Every N minutes: */N * * * *
  if (minPart.startsWith('*/') && hourPart === '*') {
    const interval = parseInt(minPart.slice(2), 10);
    if (!isNaN(interval) && interval > 0) {
      const next = new Date(now);
      const currentMin = next.getMinutes();
      const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
      if (nextMin >= 60) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(nextMin - 60, 0, 0);
      } else {
        next.setMinutes(nextMin, 0, 0);
      }
      return next.toISOString();
    }
  }

  // Fixed minute, every N hours: M */N * * * or M * * * *
  if (/^\d+$/.test(minPart)) {
    const fixedMin = parseInt(minPart, 10);

    // Every hour at fixed minute: M * * * *
    if (hourPart === '*') {
      const next = new Date(now);
      if (next.getMinutes() >= fixedMin) {
        next.setHours(next.getHours() + 1);
      }
      next.setMinutes(fixedMin, 0, 0);
      return next.toISOString();
    }

    // Every N hours: M */N * * *
    if (hourPart.startsWith('*/')) {
      const interval = parseInt(hourPart.slice(2), 10);
      if (!isNaN(interval) && interval > 0) {
        const next = new Date(now);
        const currentHour = next.getHours();
        let nextHour = Math.ceil((currentHour + (next.getMinutes() >= fixedMin ? 1 : 0)) / interval) * interval;
        if (nextHour >= 24) nextHour = 0;
        next.setHours(nextHour, fixedMin, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next.toISOString();
      }
    }

    // Fixed hour: M H * * *
    if (/^\d+$/.test(hourPart)) {
      const fixedHour = parseInt(hourPart, 10);
      const next = new Date(now);
      next.setHours(fixedHour, fixedMin, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
  }

  // Fallback: +1 hour
  return new Date(now.getTime() + 3600000).toISOString();
}

function updateNextSyncTime(cronExpr) {
  const nextIso = computeNextFireTime(cronExpr || currentCron || config.sapSyncCron);
  setNextSyncTime(nextIso);
}

function createCronJob(cronExpression) {
  return cron.schedule(cronExpression, async () => {
    logger.info('SAP auto-sync triggered by scheduler');
    try {
      const result = await syncAll('scheduler');
      logger.info('SAP auto-sync completed', {
        duration_ms: result.duration_ms,
        reports: Object.keys(result.results).length
      });
    } catch (err) {
      logger.error('SAP auto-sync failed', { error: err.message });
    }
    updateNextSyncTime(cronExpression);
  }, {
    timezone: 'Asia/Kolkata'
  });
}

async function startScheduler() {
  if (!config.sapSyncEnabled) {
    logger.info('SAP sync scheduler is disabled (SAP_SYNC_ENABLED=false)');
    return;
  }

  if (!config.sapUsername && !config.sapMockMode) {
    logger.warn('SAP sync scheduler not started: SAP_USERNAME not configured and SAP_MOCK_MODE is false');
    return;
  }

  // Load cron from DB if available, fallback to env var
  let cronExpression = config.sapSyncCron;
  try {
    const result = await pool.query(
      `SELECT value FROM audit.settings WHERE key = 'sap_sync_cron'`
    );
    if (result.rows.length > 0) {
      cronExpression = result.rows[0].value;
      logger.info('Loaded cron expression from database', { cron: cronExpression });
    }
  } catch (err) {
    logger.warn('Failed to load cron from database, using env var', { error: err.message });
  }

  if (!cron.validate(cronExpression)) {
    logger.error('Invalid cron expression', { cronExpression });
    return;
  }

  currentCron = cronExpression;
  cronJob = createCronJob(cronExpression);

  updateNextSyncTime(cronExpression);
  logger.info('SAP sync scheduler started', {
    cron: cronExpression,
    mockMode: config.sapMockMode,
    timezone: 'Asia/Kolkata'
  });
}

function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('SAP sync scheduler stopped');
  }
}

/**
 * Restart the scheduler with a new cron expression.
 * Persists the new expression to the database.
 */
async function restartScheduler(newCron) {
  if (!cron.validate(newCron)) {
    throw new Error(`Invalid cron expression: "${newCron}"`);
  }

  stopScheduler();

  // Persist to DB
  await pool.query(
    `INSERT INTO audit.settings (key, value, updated_at) VALUES ('sap_sync_cron', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [newCron]
  );

  currentCron = newCron;
  cronJob = createCronJob(newCron);
  updateNextSyncTime(newCron);

  logger.info('SAP sync scheduler restarted with new cron', {
    cron: newCron,
    timezone: 'Asia/Kolkata'
  });
}

function getSchedulerStatus() {
  return {
    enabled: config.sapSyncEnabled,
    running: cronJob !== null,
    cron: currentCron || config.sapSyncCron,
    mockMode: config.sapMockMode
  };
}

module.exports = { startScheduler, stopScheduler, restartScheduler, getSchedulerStatus };
