const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown';

  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'error',
      message: 'File too large. Maximum size is 50MB.',
      requestId
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 'error',
      message: 'Unexpected file field.',
      requestId
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    requestId
  });
}

module.exports = errorHandler;
