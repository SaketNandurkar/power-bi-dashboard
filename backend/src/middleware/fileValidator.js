const multer = require('multer');
const path = require('path');
const config = require('../config');

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/octet-stream'
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: 1
  }
});

function validateReportType(req, res, next) {
  const reportType = req.body.reportType || req.query.reportType;

  if (!reportType) {
    return res.status(400).json({
      status: 'error',
      message: 'reportType is required. Valid types: ' + config.validReportTypes.join(', ')
    });
  }

  if (!config.validReportTypes.includes(reportType)) {
    return res.status(400).json({
      status: 'error',
      message: `Invalid reportType: "${reportType}". Valid types: ${config.validReportTypes.join(', ')}`
    });
  }

  req.reportType = reportType;
  next();
}

module.exports = { upload, validateReportType };
