const rateLimit = require('express-rate-limit');
const config = require('../config');

// Read-only GET endpoints (status polling, analytics) — generous limit
const readLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests. Please try again later.'
  }
});

// Mutating POST/PUT endpoints (sync, schedule) — stricter limit
const writeLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests. Please try again later.'
  }
});

const uploadLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Upload rate limit exceeded. Maximum 10 uploads per minute.'
  }
});

module.exports = { readLimiter, writeLimiter, uploadLimiter };
