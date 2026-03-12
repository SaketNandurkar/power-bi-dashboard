const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    logger.warn('Invalid JWT token', { error: err.message });
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
