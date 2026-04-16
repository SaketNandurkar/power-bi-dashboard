require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const logger = require('./utils/logger');
const { readLimiter, writeLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const statusRouter = require('./routes/status');
const sapRouter = require('./routes/sap');
const exportRouter = require('./routes/export');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const chatbotRouter = require('./routes/chatbot');
const { authenticate, authorize } = require('./middleware/authMiddleware');
const { startScheduler } = require('./services/sapScheduler');
const { seedAdmin } = require('./utils/seedAdmin');

const app = express();

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Rate limiting — generous for reads, strict for writes
app.use('/api/', (req, res, next) => {
  if (req.method === 'GET') return readLimiter(req, res, next);
  return writeLimiter(req, res, next);
});

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

// JSON parsing
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRouter);                                       // public
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() })); // public
app.use('/api/status', authenticate, statusRouter);
app.use('/api/analytics', authenticate, analyticsRouter);
app.use('/api/chatbot', authenticate, chatbotRouter);                   // AI chatbot
app.use('/api/sap', authenticate, authorize('ADMIN'), sapRouter);
app.use('/api/export', authenticate, authorize('ADMIN'), exportRouter);
app.use('/api/users', authenticate, authorize('ADMIN'), usersRouter);

// Serve frontend static files (production: backend serves the React build)
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// SPA fallback: serve index.html for any non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Apothecon API server started`, {
    port: config.port,
    env: config.nodeEnv,
    cors: config.corsOrigins
  });
  startScheduler();
  seedAdmin();
});
