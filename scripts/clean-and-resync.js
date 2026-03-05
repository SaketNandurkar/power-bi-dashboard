#!/usr/bin/env node
/**
 * Clean database and resync fresh data from production SAP API
 */

const { Pool } = require('pg');
const axios = require('axios');

// Database connection (update with your actual credentials)
const pool = new Pool({
  host: 'srv1368855.hstgr.cloud',
  port: 5433,
  database: 'bizware_dashboards',
  user: 'bizware_user',
  password: process.env.DB_PASSWORD || 'changeme', // Use env var or update this
});

async function cleanDatabase() {
  console.log('🗑️  Cleaning database...');

  const cleanSQL = `
    TRUNCATE TABLE raw.raw_accounts_payable CASCADE;
    TRUNCATE TABLE raw.raw_bank_report CASCADE;
    TRUNCATE TABLE raw.raw_budget_report CASCADE;
    TRUNCATE TABLE raw.raw_sales_register CASCADE;

    TRUNCATE TABLE curated.accounts_payable CASCADE;
    TRUNCATE TABLE curated.bank_report CASCADE;
    TRUNCATE TABLE curated.budget_report CASCADE;
    TRUNCATE TABLE curated.sales_register CASCADE;

    TRUNCATE TABLE audit.upload_audit CASCADE;
    TRUNCATE TABLE audit.error_log CASCADE;
  `;

  await pool.query(cleanSQL);
  console.log('✅ Database cleaned!');

  // Verify counts
  const result = await pool.query(`
    SELECT 'raw.raw_accounts_payable' AS table_name, COUNT(*) AS count FROM raw.raw_accounts_payable
    UNION ALL SELECT 'curated.accounts_payable', COUNT(*) FROM curated.accounts_payable
    UNION ALL SELECT 'raw.raw_bank_report', COUNT(*) FROM raw.raw_bank_report
    UNION ALL SELECT 'curated.bank_report', COUNT(*) FROM curated.bank_report
  `);

  console.log('📊 Row counts after cleanup:');
  result.rows.forEach(row => console.log(`   ${row.table_name}: ${row.count}`));
}

async function triggerSync() {
  console.log('\n🔄 Triggering SAP sync from production API...');

  try {
    const response = await axios.post('http://localhost:3001/api/sap/sync', {}, {
      timeout: 300000 // 5 minute timeout
    });

    console.log('✅ Sync completed!');
    console.log('📊 Results:');

    if (response.data.results) {
      for (const [reportType, stats] of Object.entries(response.data.results)) {
        console.log(`\n   ${reportType}:`);
        console.log(`     Total rows: ${stats.rows_total}`);
        console.log(`     Inserted: ${stats.rows_inserted}`);
        console.log(`     Status: ${stats.status}`);
      }
    }

  } catch (error) {
    console.error('❌ Sync failed:', error.response?.data || error.message);
    throw error;
  }
}

async function verifyData() {
  console.log('\n🔍 Verifying final row counts...');

  const result = await pool.query(`
    SELECT 'raw.raw_accounts_payable' AS table_name, COUNT(*) AS count FROM raw.raw_accounts_payable
    UNION ALL SELECT 'curated.accounts_payable', COUNT(*) FROM curated.accounts_payable
    UNION ALL SELECT 'raw.raw_bank_report', COUNT(*) FROM raw.raw_bank_report
    UNION ALL SELECT 'curated.bank_report', COUNT(*) FROM curated.bank_report
    UNION ALL SELECT 'raw.raw_budget_report', COUNT(*) FROM raw.raw_budget_report
    UNION ALL SELECT 'curated.budget_report', COUNT(*) FROM curated.budget_report
    UNION ALL SELECT 'raw.raw_sales_register', COUNT(*) FROM raw.raw_sales_register
    UNION ALL SELECT 'curated.sales_register', COUNT(*) FROM curated.sales_register
  `);

  console.log('📊 Final row counts:');
  result.rows.forEach(row => console.log(`   ${row.table_name}: ${row.count}`));
}

async function main() {
  try {
    console.log('🚀 Starting clean and resync process...\n');

    // Step 1: Clean database
    await cleanDatabase();

    // Step 2: Trigger sync
    await triggerSync();

    // Step 3: Verify
    await verifyData();

    console.log('\n✅ All done! Database is clean with fresh production data.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
