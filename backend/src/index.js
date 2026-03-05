require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const statusRouter = require('./routes/status');
const sapRouter = require('./routes/sap');
const exportRouter = require('./routes/export');
const { startScheduler } = require('./services/sapScheduler');

const app = express();

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Rate limiting
app.use('/api/', apiLimiter);

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start
    });
  });
  next();
});

// JSON parsing for non-upload routes
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/status', statusRouter);
app.use('/api/sap', sapRouter);
app.use('/api/export', exportRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Bizware API server started`, {
    port: config.port,
    env: config.nodeEnv,
    cors: config.corsOrigins
  });
  startScheduler();
});
