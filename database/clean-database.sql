-- ============================================================================
-- CLEAN DATABASE - Remove all data and resync fresh from production
-- ============================================================================

-- Truncate all tables (removes all data but keeps structure)
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

-- Verify all tables are empty
SELECT 'raw.raw_accounts_payable' AS table_name, COUNT(*) AS row_count FROM raw.raw_accounts_payable
UNION ALL
SELECT 'curated.accounts_payable', COUNT(*) FROM curated.accounts_payable
UNION ALL
SELECT 'raw.raw_bank_report', COUNT(*) FROM raw.raw_bank_report
UNION ALL
SELECT 'curated.bank_report', COUNT(*) FROM curated.bank_report
UNION ALL
SELECT 'raw.raw_budget_report', COUNT(*) FROM raw.raw_budget_report
UNION ALL
SELECT 'curated.budget_report', COUNT(*) FROM curated.budget_report
UNION ALL
SELECT 'raw.raw_sales_register', COUNT(*) FROM raw.raw_sales_register
UNION ALL
SELECT 'curated.sales_register', COUNT(*) FROM curated.sales_register;

SELECT 'Database cleaned successfully! All tables are empty.' AS status;
