-- =============================================================================
-- DATABASE VERIFICATION SCRIPT
-- Run this against PostgreSQL after uploading CSVs to verify everything works
-- Connect: psql -h localhost -p 5432 -U bizware_user -d bizware_dashboards
-- =============================================================================

-- 1. Check schemas exist
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('raw', 'curated', 'audit')
ORDER BY schema_name;

-- 2. Check all tables exist
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('raw', 'curated', 'audit')
ORDER BY table_schema, table_name;

-- 3. Check all views exist
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'curated'
ORDER BY table_name;

-- 4. Row counts (raw)
SELECT 'raw.raw_accounts_payable' AS table_name, COUNT(*) AS row_count FROM raw.raw_accounts_payable
UNION ALL
SELECT 'raw.raw_bank_report', COUNT(*) FROM raw.raw_bank_report
UNION ALL
SELECT 'raw.raw_budget_report', COUNT(*) FROM raw.raw_budget_report
UNION ALL
SELECT 'raw.raw_sales_register', COUNT(*) FROM raw.raw_sales_register;

-- 5. Row counts (curated)
SELECT 'curated.accounts_payable' AS table_name, COUNT(*) AS row_count FROM curated.accounts_payable
UNION ALL
SELECT 'curated.bank_report', COUNT(*) FROM curated.bank_report
UNION ALL
SELECT 'curated.budget_report', COUNT(*) FROM curated.budget_report
UNION ALL
SELECT 'curated.sales_register', COUNT(*) FROM curated.sales_register;

-- 6. Verify raw = curated counts match
SELECT
    'accounts_payable' AS report,
    (SELECT COUNT(*) FROM raw.raw_accounts_payable) AS raw_count,
    (SELECT COUNT(*) FROM curated.accounts_payable) AS curated_count,
    CASE WHEN (SELECT COUNT(*) FROM raw.raw_accounts_payable) = (SELECT COUNT(*) FROM curated.accounts_payable)
         THEN 'MATCH' ELSE 'MISMATCH' END AS status
UNION ALL
SELECT 'bank_report',
    (SELECT COUNT(*) FROM raw.raw_bank_report),
    (SELECT COUNT(*) FROM curated.bank_report),
    CASE WHEN (SELECT COUNT(*) FROM raw.raw_bank_report) = (SELECT COUNT(*) FROM curated.bank_report)
         THEN 'MATCH' ELSE 'MISMATCH' END
UNION ALL
SELECT 'budget_report',
    (SELECT COUNT(*) FROM raw.raw_budget_report),
    (SELECT COUNT(*) FROM curated.budget_report),
    CASE WHEN (SELECT COUNT(*) FROM raw.raw_budget_report) = (SELECT COUNT(*) FROM curated.budget_report)
         THEN 'MATCH' ELSE 'MISMATCH' END
UNION ALL
SELECT 'sales_register',
    (SELECT COUNT(*) FROM raw.raw_sales_register),
    (SELECT COUNT(*) FROM curated.sales_register),
    CASE WHEN (SELECT COUNT(*) FROM raw.raw_sales_register) = (SELECT COUNT(*) FROM curated.sales_register)
         THEN 'MATCH' ELSE 'MISMATCH' END;

-- 7. Sample data from Power BI views
SELECT * FROM curated.v_bank_report;
SELECT * FROM curated.v_budget_report LIMIT 10;
SELECT * FROM curated.v_sales_register LIMIT 10;
SELECT * FROM curated.v_accounts_payable LIMIT 10;

-- 8. Audit trail
SELECT id, report_type, file_name, rows_total, rows_inserted, rows_updated,
       upload_status, started_at, completed_at, duration_ms
FROM audit.upload_audit
ORDER BY id DESC
LIMIT 20;

-- 9. Error log (should be empty if all went well)
SELECT * FROM audit.error_log ORDER BY id DESC LIMIT 10;

-- 10. Verify hash uniqueness
SELECT 'accounts_payable' AS report, COUNT(*) AS total, COUNT(DISTINCT row_hash) AS unique_hashes FROM curated.accounts_payable
UNION ALL
SELECT 'bank_report', COUNT(*), COUNT(DISTINCT row_hash) FROM curated.bank_report
UNION ALL
SELECT 'budget_report', COUNT(*), COUNT(DISTINCT row_hash) FROM curated.budget_report
UNION ALL
SELECT 'sales_register', COUNT(*), COUNT(DISTINCT row_hash) FROM curated.sales_register;
