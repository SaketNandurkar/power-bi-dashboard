-- ============================================================================
-- FIX DUPLICATE RECORDS - Bizware Power BI Dashboards
-- ============================================================================

-- Step 1: Check if PRIMARY KEY constraints exist
SELECT
    tc.table_schema,
    tc.table_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS primary_key_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema IN ('raw', 'curated')
ORDER BY tc.table_schema, tc.table_name;

-- Step 2: Count duplicates in accounts_payable
SELECT 'Total rows in raw.raw_accounts_payable' AS description, COUNT(*) AS count
FROM raw.raw_accounts_payable
UNION ALL
SELECT 'Unique rows by PRIMARY KEY', COUNT(DISTINCT (company_code, document_number, fiscal_year, item))
FROM raw.raw_accounts_payable
UNION ALL
SELECT 'Duplicate rows', COUNT(*) - COUNT(DISTINCT (company_code, document_number, fiscal_year, item))
FROM raw.raw_accounts_payable;

-- Step 3: Show example duplicates
SELECT company_code, document_number, fiscal_year, item, COUNT(*) as duplicate_count
FROM raw.raw_accounts_payable
GROUP BY company_code, document_number, fiscal_year, item
HAVING COUNT(*) > 1
LIMIT 10;

-- ============================================================================
-- FIX: Remove duplicates (keeps most recent record)
-- ============================================================================

-- UNCOMMENT BELOW TO EXECUTE THE FIX (DO NOT RUN WITHOUT BACKUP!)

/*
-- For raw.raw_accounts_payable
DELETE FROM raw.raw_accounts_payable
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM raw.raw_accounts_payable
    GROUP BY company_code, document_number, fiscal_year, item
);

-- For curated.accounts_payable
DELETE FROM curated.accounts_payable
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM curated.accounts_payable
    GROUP BY company_code, document_number, fiscal_year, item
);

-- For raw.raw_bank_report
DELETE FROM raw.raw_bank_report
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM raw.raw_bank_report
    GROUP BY gl_account
);

-- For curated.bank_report
DELETE FROM curated.bank_report
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM curated.bank_report
    GROUP BY gl_account
);

-- For raw.raw_budget_report
DELETE FROM raw.raw_budget_report
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM raw.raw_budget_report
    GROUP BY year, group_name, income_group, zmonth
);

-- For curated.budget_report
DELETE FROM curated.budget_report
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM curated.budget_report
    GROUP BY year, group_name, income_group, zmonth
);

-- For raw.raw_sales_register
DELETE FROM raw.raw_sales_register
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM raw.raw_sales_register
    GROUP BY invoice_no
);

-- For curated.sales_register
DELETE FROM curated.sales_register
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM curated.sales_register
    GROUP BY invoice_no
);

-- Verify counts after cleanup
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
*/
