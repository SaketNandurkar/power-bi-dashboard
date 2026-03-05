const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const config = require('../config');
const logger = require('../utils/logger');

// Mock file mapping: OData entity set name → local XML file
const MOCK_FILES = {
  'ZENTITY_ACCPAYABLESet': 'Accounts_payable.xml',
  'ZENTITY_BankSet': 'BankRecords.xml',
  'ZENTITY_AL11Set': 'AL11Set.xml',
  'ZENTITY_SALESREGSet': 'SalesRegister.xml'
};

// XML parser configured for SAP OData v2 Atom feeds
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  isArray: (name) => name === 'entry'
});

// HTTPS agent for self-signed SAP certs
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Fetches and parses an OData entity set from SAP or local mock XML.
 * @param {string} entitySetName - e.g., 'ZENTITY_ACCPAYABLESet'
 * @returns {Promise<Object[]>} Array of parsed entry objects with namespace prefixes stripped
 */
async function fetchEntitySet(entitySetName) {
  const isMock = config.sapMockMode;

  logger.info('Fetching entity set', { entitySetName, mock: isMock });

  let xmlText;

  if (isMock) {
    const fileName = MOCK_FILES[entitySetName];
    if (!fileName) {
      throw new Error(`No mock file mapping for entity set: ${entitySetName}`);
    }

    const sampleDir = process.env.SAP_SAMPLE_XML_DIR
      || path.join(__dirname, '..', '..', 'sampleXML');
    const filePath = path.join(sampleDir, fileName);

    logger.info('Reading mock XML file', { filePath });
    xmlText = fs.readFileSync(filePath, 'utf-8');
  } else {
    if (!config.sapUsername || !config.sapPassword) {
      throw new Error('SAP credentials not configured (SAP_USERNAME / SAP_PASSWORD)');
    }

    // Fetch ALL pages (handle OData pagination)
    let allXmlPages = [];
    let nextUrl = `${config.sapOdataBaseUrl}/${entitySetName}`;
    let pageNum = 1;

    while (nextUrl) {
      logger.info('Calling SAP OData API', { url: nextUrl, page: pageNum });

      const response = await axios.get(nextUrl, {
        headers: { 'Accept': 'application/atom+xml' },
        auth: {
          username: config.sapUsername,
          password: config.sapPassword
        },
        httpsAgent,
        timeout: config.sapRequestTimeout,
        responseType: 'text'
      });

      allXmlPages.push(response.data);

      // Check for pagination link in response
      const tempParsed = parser.parse(response.data);
      const links = tempParsed.feed?.link || [];
      const nextLink = Array.isArray(links)
        ? links.find(l => l.rel === 'next')
        : (links.rel === 'next' ? links : null);

      nextUrl = nextLink?.href || null;
      pageNum++;

      if (pageNum > 100) {
        logger.warn('Pagination limit reached (100 pages), stopping', { entitySetName });
        break;
      }
    }

    logger.info('Fetched all pages', { entitySetName, totalPages: pageNum - 1 });

    // Merge all pages by concatenating entries
    xmlText = allXmlPages[0]; // Use first page as base
    if (allXmlPages.length > 1) {
      // Parse and merge entries from all pages
      const allEntries = [];
      for (const pageXml of allXmlPages) {
        const pageParsed = parser.parse(pageXml);
        const pageEntries = pageParsed.feed?.entry || [];
        allEntries.push(...(Array.isArray(pageEntries) ? pageEntries : [pageEntries]));
      }

      // Reconstruct XML with all entries (or just return merged entries directly)
      // For now, we'll modify the parsing logic below to use allEntries
      xmlText = allXmlPages[0]; // Keep first page structure
      parsed._allEntries = allEntries; // Attach merged entries
    }
  }

  // Parse the Atom XML feed
  const parsed = parser.parse(xmlText);

  if (!parsed.feed) {
    throw new Error(`Invalid OData response: missing <feed> element for ${entitySetName}`);
  }

  // Use merged entries if available (from pagination), otherwise use single page
  let entries = parsed._allEntries || parsed.feed.entry || [];

  // Ensure entries is always an array
  if (!Array.isArray(entries)) {
    entries = [entries];
  }

  // Extract the properties from each entry
  const results = entries.map(entry => {
    if (entry.content && entry.content.properties) {
      return entry.content.properties;
    }
    return {};
  });

  logger.info('Entity set parsed', {
    entitySetName,
    count: results.length,
    mock: isMock
  });

  return results;
}

module.exports = { fetchEntitySet };
