const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const logger = require('../utils/logger');

async function forwardToN8n(file, reportType, requestId) {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype
  });

  const url = `${config.n8nWebhookUrl}?report_type=${encodeURIComponent(reportType)}`;

  logger.info('Forwarding file to n8n', {
    requestId,
    reportType,
    fileName: file.originalname,
    fileSize: file.size,
    url
  });

  const response = await axios.post(url, form, {
    headers: {
      ...form.getHeaders()
    },
    timeout: 120000,
    maxContentLength: config.maxFileSize,
    maxBodyLength: config.maxFileSize
  });

  logger.info('n8n response received', {
    requestId,
    status: response.status,
    data: response.data
  });

  return response.data;
}

module.exports = { forwardToN8n };
