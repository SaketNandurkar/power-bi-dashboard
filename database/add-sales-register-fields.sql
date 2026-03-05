-- ============================================================================
-- Add new fields to Sales Register tables
-- ============================================================================

-- Add new columns to raw.raw_sales_register
ALTER TABLE raw.raw_sales_register
ADD COLUMN IF NOT EXISTS billing_quantity NUMERIC(18,3),
ADD COLUMN IF NOT EXISTS net_value NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2);

-- Add new columns to curated.sales_register
ALTER TABLE curated.sales_register
ADD COLUMN IF NOT EXISTS billing_quantity NUMERIC(18,3),
ADD COLUMN IF NOT EXISTS net_value NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2);

-- Update the Power BI view to include new columns
CREATE OR REPLACE VIEW curated.v_sales_register AS
SELECT
    invoice_no              AS "Invoice No",
    billing_type            AS "Billing Type",
    billing_type_description AS "Billing Type description",
    invoice_date            AS "Invoice Date",
    bill_to                 AS "Bill To",
    bill_to_name            AS "Bill To Name",
    fiscal_year             AS "Fiscal Year",
    billing_quantity        AS "Billing Quantity",
    net_value               AS "Net Value",
    tax_amount              AS "Tax Amount",
    total                   AS " Total"
FROM curated.sales_register;

COMMENT ON VIEW curated.v_sales_register IS 'Power BI view - sales register with original CSV column names (updated with new fields).';

-- Verify columns added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'raw'
  AND table_name = 'raw_sales_register'
ORDER BY ordinal_position;
