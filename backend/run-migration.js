#!/usr/bin/env node
/**
 * Database Migration Runner
 * Runs the AI schema migration directly using Node.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`
});

async function runMigration() {
  console.log('='.repeat(70));
  console.log('AI Schema Migration Runner');
  console.log('='.repeat(70));
  console.log();

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'database', 'add-ai-schema.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✓ Migration file loaded (${migrationSQL.length} bytes)`);
    console.log();

    // Connect to database
    console.log('🔌 Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✓ Connected successfully');
    console.log();

    // Check if migration was already applied
    console.log('🔍 Checking if AI schema exists...');
    const schemaCheck = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'ai'
    `);

    if (schemaCheck.rows.length > 0) {
      console.log('⚠️  AI schema already exists');

      const tableCheck = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'ai'
        AND table_name IN ('conversations', 'messages')
        ORDER BY table_name
      `);

      console.log(`   Found ${tableCheck.rows.length} existing tables:`);
      tableCheck.rows.forEach(row => {
        console.log(`   - ai.${row.table_name}`);
      });

      console.log();
      console.log('Migration may have already been applied.');
      console.log('Re-running migration (CREATE IF NOT EXISTS will skip existing objects)...');
      console.log();
    }

    // Run the migration
    console.log('🚀 Executing migration...');
    await client.query(migrationSQL);
    console.log('✓ Migration executed successfully');
    console.log();

    // Verify tables were created
    console.log('✅ Verifying migration...');
    const verifyQuery = await client.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'ai' AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'ai'
      ORDER BY table_name
    `);

    console.log(`   AI schema tables (${verifyQuery.rows.length}):`);
    verifyQuery.rows.forEach(row => {
      console.log(`   - ai.${row.table_name} (${row.column_count} columns)`);
    });

    // Verify indexes
    const indexQuery = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'ai'
      ORDER BY indexname
    `);

    console.log();
    console.log(`   AI schema indexes (${indexQuery.rows.length}):`);
    indexQuery.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    client.release();
    console.log();
    console.log('='.repeat(70));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(70));
    console.log();

    process.exit(0);
  } catch (err) {
    console.error();
    console.error('='.repeat(70));
    console.error('❌ Migration failed!');
    console.error('='.repeat(70));
    console.error();
    console.error('Error:', err.message);
    console.error();

    if (err.stack) {
      console.error('Stack trace:');
      console.error(err.stack);
    }

    console.error();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();
