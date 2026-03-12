-- ============================================================================
-- Apothecon Analytics Dashboards - PostgreSQL Schema
-- Production-ready migration with hash-based delta detection
-- ============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS curated;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================================
-- UTILITY: Auto-update updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RAW SCHEMA TABLES
-- ============================================================================

-- Raw Accounts Payable
CREATE TABLE IF NOT EXISTS raw.raw_accounts_payable (
    company_code        TEXT NOT NULL,
    document_number     TEXT NOT NULL,
    fiscal_year         INTEGER NOT NULL,
    posting_date        DATE,
    vendor              TEXT,
    msme                TEXT,
    purchasing_document TEXT,
    item                TEXT NOT NULL,
    po_document_type    TEXT,
    internal_order      TEXT,
    debit_credit        TEXT,
    local_amount        NUMERIC(18,2),
    currency            TEXT,
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (company_code, document_number, fiscal_year, item)
);

CREATE INDEX IF NOT EXISTS idx_raw_ap_posting_date ON raw.raw_accounts_payable(posting_date);
CREATE INDEX IF NOT EXISTS idx_raw_ap_vendor ON raw.raw_accounts_payable(vendor);
CREATE INDEX IF NOT EXISTS idx_raw_ap_fiscal_year ON raw.raw_accounts_payable(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_raw_ap_row_hash ON raw.raw_accounts_payable(row_hash);

CREATE TRIGGER trg_raw_ap_updated_at
    BEFORE UPDATE ON raw.raw_accounts_payable
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE raw.raw_accounts_payable IS 'Raw accounts payable data from SAP CSV exports. Hash-based delta detection.';

-- Raw Bank Report
CREATE TABLE IF NOT EXISTS raw.raw_bank_report (
    gl_account          TEXT NOT NULL PRIMARY KEY,
    short_text          TEXT,
    long_text           TEXT,
    balance             NUMERIC(18,2),
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_bank_row_hash ON raw.raw_bank_report(row_hash);

CREATE TRIGGER trg_raw_bank_updated_at
    BEFORE UPDATE ON raw.raw_bank_report
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE raw.raw_bank_report IS 'Raw bank report balances from SAP CSV exports. Hash-based delta detection.';

-- Raw Budget Report
CREATE TABLE IF NOT EXISTS raw.raw_budget_report (
    year                INTEGER NOT NULL,
    group_name          TEXT NOT NULL,
    income_group        TEXT NOT NULL,
    zmonth              TEXT NOT NULL,
    budget_cr           NUMERIC(18,2),
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (year, group_name, income_group, zmonth)
);

CREATE INDEX IF NOT EXISTS idx_raw_budget_year ON raw.raw_budget_report(year);
CREATE INDEX IF NOT EXISTS idx_raw_budget_group ON raw.raw_budget_report(group_name);
CREATE INDEX IF NOT EXISTS idx_raw_budget_row_hash ON raw.raw_budget_report(row_hash);

CREATE TRIGGER trg_raw_budget_updated_at
    BEFORE UPDATE ON raw.raw_budget_report
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE raw.raw_budget_report IS 'Raw budget report data from SAP CSV exports. Hash-based delta detection.';

-- Raw Sales Register
CREATE TABLE IF NOT EXISTS raw.raw_sales_register (
    invoice_no              TEXT NOT NULL PRIMARY KEY,
    billing_type            TEXT,
    billing_type_description TEXT,
    invoice_date            DATE,
    bill_to                 TEXT,
    bill_to_name            TEXT,
    fiscal_year             INTEGER,
    billing_quantity        NUMERIC(18,3),
    net_value               NUMERIC(18,2),
    tax_amount              NUMERIC(18,2),
    total                   NUMERIC(18,2),
    row_hash                VARCHAR(64) NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_sales_invoice_date ON raw.raw_sales_register(invoice_date);
CREATE INDEX IF NOT EXISTS idx_raw_sales_fiscal_year ON raw.raw_sales_register(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_raw_sales_billing_type ON raw.raw_sales_register(billing_type);
CREATE INDEX IF NOT EXISTS idx_raw_sales_bill_to ON raw.raw_sales_register(bill_to);
CREATE INDEX IF NOT EXISTS idx_raw_sales_row_hash ON raw.raw_sales_register(row_hash);

CREATE TRIGGER trg_raw_sales_updated_at
    BEFORE UPDATE ON raw.raw_sales_register
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE raw.raw_sales_register IS 'Raw sales register data from SAP CSV exports. Hash-based delta detection.';

-- ============================================================================
-- CURATED SCHEMA TABLES (identical structure, curated/cleaned data)
-- ============================================================================

-- Curated Accounts Payable
CREATE TABLE IF NOT EXISTS curated.accounts_payable (
    company_code        TEXT NOT NULL,
    document_number     TEXT NOT NULL,
    fiscal_year         INTEGER NOT NULL,
    posting_date        DATE,
    vendor              TEXT,
    msme                TEXT,
    purchasing_document TEXT,
    item                TEXT NOT NULL,
    po_document_type    TEXT,
    internal_order      TEXT,
    debit_credit        TEXT,
    local_amount        NUMERIC(18,2),
    currency            TEXT,
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (company_code, document_number, fiscal_year, item)
);

CREATE INDEX IF NOT EXISTS idx_cur_ap_posting_date ON curated.accounts_payable(posting_date);
CREATE INDEX IF NOT EXISTS idx_cur_ap_vendor ON curated.accounts_payable(vendor);
CREATE INDEX IF NOT EXISTS idx_cur_ap_fiscal_year ON curated.accounts_payable(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cur_ap_debit_credit ON curated.accounts_payable(debit_credit);
CREATE INDEX IF NOT EXISTS idx_cur_ap_currency ON curated.accounts_payable(currency);

CREATE TRIGGER trg_cur_ap_updated_at
    BEFORE UPDATE ON curated.accounts_payable
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE curated.accounts_payable IS 'Curated accounts payable - cleaned and validated, source for Power BI.';

-- Curated Bank Report
CREATE TABLE IF NOT EXISTS curated.bank_report (
    gl_account          TEXT NOT NULL PRIMARY KEY,
    short_text          TEXT,
    long_text           TEXT,
    balance             NUMERIC(18,2),
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_cur_bank_updated_at
    BEFORE UPDATE ON curated.bank_report
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE curated.bank_report IS 'Curated bank report - cleaned and validated, source for Power BI.';

-- Curated Budget Report
CREATE TABLE IF NOT EXISTS curated.budget_report (
    year                INTEGER NOT NULL,
    group_name          TEXT NOT NULL,
    income_group        TEXT NOT NULL,
    zmonth              TEXT NOT NULL,
    budget_cr           NUMERIC(18,2),
    row_hash            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (year, group_name, income_group, zmonth)
);

CREATE INDEX IF NOT EXISTS idx_cur_budget_year ON curated.budget_report(year);
CREATE INDEX IF NOT EXISTS idx_cur_budget_group ON curated.budget_report(group_name);
CREATE INDEX IF NOT EXISTS idx_cur_budget_income ON curated.budget_report(income_group);

CREATE TRIGGER trg_cur_budget_updated_at
    BEFORE UPDATE ON curated.budget_report
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE curated.budget_report IS 'Curated budget report - cleaned and validated, source for Power BI.';

-- Curated Sales Register
CREATE TABLE IF NOT EXISTS curated.sales_register (
    invoice_no              TEXT NOT NULL PRIMARY KEY,
    billing_type            TEXT,
    billing_type_description TEXT,
    invoice_date            DATE,
    bill_to                 TEXT,
    bill_to_name            TEXT,
    fiscal_year             INTEGER,
    billing_quantity        NUMERIC(18,3),
    net_value               NUMERIC(18,2),
    tax_amount              NUMERIC(18,2),
    total                   NUMERIC(18,2),
    row_hash                VARCHAR(64) NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cur_sales_invoice_date ON curated.sales_register(invoice_date);
CREATE INDEX IF NOT EXISTS idx_cur_sales_fiscal_year ON curated.sales_register(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cur_sales_billing_type ON curated.sales_register(billing_type);
CREATE INDEX IF NOT EXISTS idx_cur_sales_bill_to ON curated.sales_register(bill_to);
CREATE INDEX IF NOT EXISTS idx_cur_sales_bill_to_name ON curated.sales_register(bill_to_name);

CREATE TRIGGER trg_cur_sales_updated_at
    BEFORE UPDATE ON curated.sales_register
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE curated.sales_register IS 'Curated sales register - cleaned and validated, source for Power BI.';

-- ============================================================================
-- AUDIT SCHEMA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.upload_audit (
    id                  SERIAL PRIMARY KEY,
    report_type         TEXT NOT NULL,
    file_name           TEXT NOT NULL,
    file_size_bytes     BIGINT,
    rows_total          INTEGER DEFAULT 0,
    rows_inserted       INTEGER DEFAULT 0,
    rows_updated        INTEGER DEFAULT 0,
    rows_unchanged      INTEGER DEFAULT 0,
    upload_status       TEXT NOT NULL DEFAULT 'processing',
    error_message       TEXT,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    duration_ms         INTEGER,
    uploaded_by         TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_audit_report_type ON audit.upload_audit(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_started_at ON audit.upload_audit(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit.upload_audit(upload_status);
CREATE INDEX IF NOT EXISTS idx_audit_uploaded_by ON audit.upload_audit(uploaded_by);

COMMENT ON TABLE audit.upload_audit IS 'Audit trail for all CSV upload operations with row-level delta statistics.';

CREATE TABLE IF NOT EXISTS audit.error_log (
    id                  SERIAL PRIMARY KEY,
    report_type         TEXT,
    file_name           TEXT,
    error_type          TEXT NOT NULL,
    error_message       TEXT NOT NULL,
    error_detail        TEXT,
    row_number          INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_report_type ON audit.error_log(report_type);
CREATE INDEX IF NOT EXISTS idx_error_created_at ON audit.error_log(created_at DESC);

COMMENT ON TABLE audit.error_log IS 'Error log for failed upload operations and row-level processing errors.';

-- Settings key-value store (scheduler config, etc.)
CREATE TABLE IF NOT EXISTS audit.settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit.settings IS 'Key-value settings store for runtime configuration (e.g. SAP sync cron schedule).';

-- ============================================================================
-- POWER BI VIEWS (exact original CSV column names)
-- ============================================================================

CREATE OR REPLACE VIEW curated.v_accounts_payable AS
SELECT
    company_code        AS "Company Code",
    document_number     AS "Document Number",
    fiscal_year         AS "Fiscal Year",
    posting_date        AS "Posting Date",
    vendor              AS "Vendor",
    msme                AS "MSME",
    purchasing_document AS "Purchasing Document",
    item                AS "Item",
    po_document_type    AS "PO Document Type",
    internal_order      AS "Internal Order",
    debit_credit        AS "Debit/Credit",
    local_amount        AS "Local Amount",
    currency            AS "Currency"
FROM curated.accounts_payable;

COMMENT ON VIEW curated.v_accounts_payable IS 'Power BI view - accounts payable with original CSV column names.';

CREATE OR REPLACE VIEW curated.v_bank_report AS
SELECT
    gl_account          AS "G/L Account",
    short_text          AS "Short Text",
    long_text           AS "Long Text",
    balance             AS "Balance"
FROM curated.bank_report;

COMMENT ON VIEW curated.v_bank_report IS 'Power BI view - bank report with original CSV column names.';

CREATE OR REPLACE VIEW curated.v_budget_report AS
SELECT
    year                AS "Year",
    group_name          AS "GROUP",
    income_group        AS "INCOME_GROUP",
    zmonth              AS "ZMONTH",
    budget_cr           AS "BUDGET_CR"
FROM curated.budget_report;

COMMENT ON VIEW curated.v_budget_report IS 'Power BI view - budget report with original CSV column names.';

CREATE OR REPLACE VIEW curated.v_sales_register AS
SELECT
    invoice_no                  AS "Invoice No",
    billing_type                AS "Billing Type",
    billing_type_description    AS "Billing Type description",
    invoice_date                AS "Invoice Date",
    bill_to                     AS "Bill To",
    bill_to_name                AS "Bill To Name",
    fiscal_year                 AS "Fiscal Year",
    billing_quantity            AS "Billing Quantity",
    net_value                   AS "Net Value",
    tax_amount                  AS "Tax Amount",
    total                       AS " Total"
FROM curated.sales_register;

COMMENT ON VIEW curated.v_sales_register IS 'Power BI view - sales register with original CSV column names (updated with new fields).';

-- Sheet1 view: Budget Report with Power BI's original column names
CREATE OR REPLACE VIEW curated."Sheet1" AS
SELECT
    budget_cr    AS "Budget (CR)",
    group_name   AS "Group",
    income_group AS "Income Group",
    zmonth       AS "Month",
    year         AS "Year"
FROM curated.budget_report;

COMMENT ON VIEW curated."Sheet1" IS 'Power BI view - budget report with original Sheet1 column names.';

-- ZSDR01 view: Sales Register with Power BI's original column names
CREATE OR REPLACE VIEW curated."ZSDR01" AS
SELECT
    billing_type             AS "Bill Type",
    billing_type_description AS "Bill Type Descc",
    bill_to_name             AS "Bill-To Name",
    bill_to                  AS "Bill-To Party Customer",
    fiscal_year              AS "Fiscal Year",
    invoice_no               AS "Invoice No.",
    invoice_no               AS "inv no",
    invoice_date             AS "Inv. Date",
    total                    AS "Total amount",
    NULL::TEXT               AS "Group",
    billing_quantity         AS "Billing quantity in SKU",
    net_value                AS "Inv. Net value(LOC)",
    tax_amount               AS "Inv. Tax Amount(LOC)",
    NULL::TEXT               AS "Inv group",
    NULL::TEXT               AS "Text Before Delimiter"
FROM curated.sales_register;

COMMENT ON VIEW curated."ZSDR01" IS 'Power BI view - sales register with original ZSDR01 column names.';

-- ============================================================================
-- UPSERT FUNCTIONS (hash-based delta detection)
-- ============================================================================

-- Accounts Payable upsert
CREATE OR REPLACE FUNCTION raw.upsert_accounts_payable(
    p_company_code TEXT, p_document_number TEXT, p_fiscal_year INTEGER,
    p_posting_date DATE, p_vendor TEXT, p_msme TEXT,
    p_purchasing_document TEXT, p_item TEXT, p_po_document_type TEXT,
    p_internal_order TEXT, p_debit_credit TEXT, p_local_amount NUMERIC,
    p_currency TEXT, p_row_hash VARCHAR(64)
) RETURNS TEXT AS $$
DECLARE
    v_action TEXT;
    v_xmax xid;
BEGIN
    INSERT INTO raw.raw_accounts_payable (
        company_code, document_number, fiscal_year, posting_date, vendor, msme,
        purchasing_document, item, po_document_type, internal_order,
        debit_credit, local_amount, currency, row_hash
    ) VALUES (
        p_company_code, p_document_number, p_fiscal_year, p_posting_date, p_vendor, p_msme,
        p_purchasing_document, p_item, p_po_document_type, p_internal_order,
        p_debit_credit, p_local_amount, p_currency, p_row_hash
    )
    ON CONFLICT (company_code, document_number, fiscal_year, item) DO UPDATE SET
        posting_date = EXCLUDED.posting_date,
        vendor = EXCLUDED.vendor,
        msme = EXCLUDED.msme,
        purchasing_document = EXCLUDED.purchasing_document,
        po_document_type = EXCLUDED.po_document_type,
        internal_order = EXCLUDED.internal_order,
        debit_credit = EXCLUDED.debit_credit,
        local_amount = EXCLUDED.local_amount,
        currency = EXCLUDED.currency,
        row_hash = EXCLUDED.row_hash
    WHERE raw.raw_accounts_payable.row_hash != EXCLUDED.row_hash
    RETURNING xmax INTO v_xmax;

    IF NOT FOUND THEN
        v_action := 'unchanged';
    ELSIF v_xmax = 0 THEN
        v_action := 'inserted';
    ELSE
        v_action := 'updated';
    END IF;

    -- Mirror to curated
    INSERT INTO curated.accounts_payable (
        company_code, document_number, fiscal_year, posting_date, vendor, msme,
        purchasing_document, item, po_document_type, internal_order,
        debit_credit, local_amount, currency, row_hash
    ) VALUES (
        p_company_code, p_document_number, p_fiscal_year, p_posting_date, p_vendor, p_msme,
        p_purchasing_document, p_item, p_po_document_type, p_internal_order,
        p_debit_credit, p_local_amount, p_currency, p_row_hash
    )
    ON CONFLICT (company_code, document_number, fiscal_year, item) DO UPDATE SET
        posting_date = EXCLUDED.posting_date,
        vendor = EXCLUDED.vendor,
        msme = EXCLUDED.msme,
        purchasing_document = EXCLUDED.purchasing_document,
        po_document_type = EXCLUDED.po_document_type,
        internal_order = EXCLUDED.internal_order,
        debit_credit = EXCLUDED.debit_credit,
        local_amount = EXCLUDED.local_amount,
        currency = EXCLUDED.currency,
        row_hash = EXCLUDED.row_hash
    WHERE curated.accounts_payable.row_hash != EXCLUDED.row_hash;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql;

-- Bank Report upsert
CREATE OR REPLACE FUNCTION raw.upsert_bank_report(
    p_gl_account TEXT, p_short_text TEXT, p_long_text TEXT,
    p_balance NUMERIC, p_row_hash VARCHAR(64)
) RETURNS TEXT AS $$
DECLARE
    v_action TEXT;
    v_xmax xid;
BEGIN
    INSERT INTO raw.raw_bank_report (gl_account, short_text, long_text, balance, row_hash)
    VALUES (p_gl_account, p_short_text, p_long_text, p_balance, p_row_hash)
    ON CONFLICT (gl_account) DO UPDATE SET
        short_text = EXCLUDED.short_text,
        long_text = EXCLUDED.long_text,
        balance = EXCLUDED.balance,
        row_hash = EXCLUDED.row_hash
    WHERE raw.raw_bank_report.row_hash != EXCLUDED.row_hash
    RETURNING xmax INTO v_xmax;

    IF NOT FOUND THEN v_action := 'unchanged';
    ELSIF v_xmax = 0 THEN v_action := 'inserted';
    ELSE v_action := 'updated';
    END IF;

    INSERT INTO curated.bank_report (gl_account, short_text, long_text, balance, row_hash)
    VALUES (p_gl_account, p_short_text, p_long_text, p_balance, p_row_hash)
    ON CONFLICT (gl_account) DO UPDATE SET
        short_text = EXCLUDED.short_text,
        long_text = EXCLUDED.long_text,
        balance = EXCLUDED.balance,
        row_hash = EXCLUDED.row_hash
    WHERE curated.bank_report.row_hash != EXCLUDED.row_hash;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql;

-- Budget Report upsert
CREATE OR REPLACE FUNCTION raw.upsert_budget_report(
    p_year INTEGER, p_group_name TEXT, p_income_group TEXT,
    p_zmonth TEXT, p_budget_cr NUMERIC, p_row_hash VARCHAR(64)
) RETURNS TEXT AS $$
DECLARE
    v_action TEXT;
    v_xmax xid;
BEGIN
    INSERT INTO raw.raw_budget_report (year, group_name, income_group, zmonth, budget_cr, row_hash)
    VALUES (p_year, p_group_name, p_income_group, p_zmonth, p_budget_cr, p_row_hash)
    ON CONFLICT (year, group_name, income_group, zmonth) DO UPDATE SET
        budget_cr = EXCLUDED.budget_cr,
        row_hash = EXCLUDED.row_hash
    WHERE raw.raw_budget_report.row_hash != EXCLUDED.row_hash
    RETURNING xmax INTO v_xmax;

    IF NOT FOUND THEN v_action := 'unchanged';
    ELSIF v_xmax = 0 THEN v_action := 'inserted';
    ELSE v_action := 'updated';
    END IF;

    INSERT INTO curated.budget_report (year, group_name, income_group, zmonth, budget_cr, row_hash)
    VALUES (p_year, p_group_name, p_income_group, p_zmonth, p_budget_cr, p_row_hash)
    ON CONFLICT (year, group_name, income_group, zmonth) DO UPDATE SET
        budget_cr = EXCLUDED.budget_cr,
        row_hash = EXCLUDED.row_hash
    WHERE curated.budget_report.row_hash != EXCLUDED.row_hash;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql;

-- Sales Register upsert
CREATE OR REPLACE FUNCTION raw.upsert_sales_register(
    p_invoice_no TEXT,
    p_billing_type TEXT,
    p_billing_type_description TEXT,
    p_invoice_date DATE,
    p_bill_to TEXT,
    p_bill_to_name TEXT,
    p_fiscal_year INTEGER,
    p_billing_quantity NUMERIC,
    p_net_value NUMERIC,
    p_tax_amount NUMERIC,
    p_total NUMERIC,
    p_row_hash VARCHAR(64)
) RETURNS TEXT AS $$
DECLARE
    v_action TEXT;
    v_xmax xid;
BEGIN
    INSERT INTO raw.raw_sales_register (
        invoice_no, billing_type, billing_type_description, invoice_date,
        bill_to, bill_to_name, fiscal_year,
        billing_quantity, net_value, tax_amount, total, row_hash
    ) VALUES (
        p_invoice_no, p_billing_type, p_billing_type_description, p_invoice_date,
        p_bill_to, p_bill_to_name, p_fiscal_year,
        p_billing_quantity, p_net_value, p_tax_amount, p_total, p_row_hash
    )
    ON CONFLICT (invoice_no) DO UPDATE SET
        billing_type = EXCLUDED.billing_type,
        billing_type_description = EXCLUDED.billing_type_description,
        invoice_date = EXCLUDED.invoice_date,
        bill_to = EXCLUDED.bill_to,
        bill_to_name = EXCLUDED.bill_to_name,
        fiscal_year = EXCLUDED.fiscal_year,
        billing_quantity = EXCLUDED.billing_quantity,
        net_value = EXCLUDED.net_value,
        tax_amount = EXCLUDED.tax_amount,
        total = EXCLUDED.total,
        row_hash = EXCLUDED.row_hash
    WHERE raw.raw_sales_register.row_hash != EXCLUDED.row_hash
    RETURNING xmax INTO v_xmax;

    IF NOT FOUND THEN v_action := 'unchanged';
    ELSIF v_xmax = 0 THEN v_action := 'inserted';
    ELSE v_action := 'updated';
    END IF;

    INSERT INTO curated.sales_register (
        invoice_no, billing_type, billing_type_description, invoice_date,
        bill_to, bill_to_name, fiscal_year,
        billing_quantity, net_value, tax_amount, total, row_hash
    ) VALUES (
        p_invoice_no, p_billing_type, p_billing_type_description, p_invoice_date,
        p_bill_to, p_bill_to_name, p_fiscal_year,
        p_billing_quantity, p_net_value, p_tax_amount, p_total, p_row_hash
    )
    ON CONFLICT (invoice_no) DO UPDATE SET
        billing_type = EXCLUDED.billing_type,
        billing_type_description = EXCLUDED.billing_type_description,
        invoice_date = EXCLUDED.invoice_date,
        bill_to = EXCLUDED.bill_to,
        bill_to_name = EXCLUDED.bill_to_name,
        fiscal_year = EXCLUDED.fiscal_year,
        billing_quantity = EXCLUDED.billing_quantity,
        net_value = EXCLUDED.net_value,
        tax_amount = EXCLUDED.tax_amount,
        total = EXCLUDED.total,
        row_hash = EXCLUDED.row_hash
    WHERE curated.sales_register.row_hash != EXCLUDED.row_hash;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CUSTOMER GROUP MAPPING (for analytics dashboard grouping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS curated.customer_group_mapping (
    bill_to     TEXT NOT NULL PRIMARY KEY,
    group_name  TEXT NOT NULL
);

COMMENT ON TABLE curated.customer_group_mapping IS 'Maps bill_to customer codes to high-level group names for analytics charts.';

-- Seed data: customer-to-group mapping (from Power BI reference sheet)
-- Navinta group
INSERT INTO curated.customer_group_mapping (bill_to, group_name) VALUES
  ('1200004', 'Navinta'),   -- Navinta LLC
  ('1200005', 'Navinta'),   -- Navinta NV Inc.
  ('1200089', 'Navinta'),   -- Navinta II LLC (Export Goods)
  ('1100003', 'Navinta')    -- Immacule Lifesciences Pvt. Ltd.
ON CONFLICT (bill_to) DO UPDATE SET group_name = EXCLUDED.group_name;

-- Waymade PLC group
INSERT INTO curated.customer_group_mapping (bill_to, group_name) VALUES
  ('1200010', 'Waymade PLC'),  -- Waymade Australia PTY Limited
  ('1200030', 'Waymade PLC'),  -- Waymade PLC
  ('1200057', 'Waymade PLC'),  -- Waymade PLC
  ('1200078', 'Waymade PLC'),  -- Waymade BV
  ('1200079', 'Waymade PLC'),  -- Waymade Canada Inc
  ('1200096', 'Waymade PLC')   -- Waymade Australia Pvt. Ltd.
ON CONFLICT (bill_to) DO UPDATE SET group_name = EXCLUDED.group_name;

-- CMO Sales group (display name: 'CMO sales')
INSERT INTO curated.customer_group_mapping (bill_to, group_name) VALUES
  ('1100218', 'CMO sales'),  -- Krufren Pharma Pvt Ltd
  ('1100021', 'CMO sales'),  -- Reine Life Science
  ('1100041', 'CMO sales')   -- Samrudh Pharmaceuticals Pvt. Ltd.
ON CONFLICT (bill_to) DO UPDATE SET group_name = EXCLUDED.group_name;

-- Note: Scrap is determined by billing_type = 'ZSC1', not by customer code.
-- Note: APPL is the default for any customer not in the above groups.

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
DO $$
BEGIN
    -- Grant usage on schemas
    EXECUTE 'GRANT USAGE ON SCHEMA raw TO aposap_user';
    EXECUTE 'GRANT USAGE ON SCHEMA curated TO aposap_user';
    EXECUTE 'GRANT USAGE ON SCHEMA audit TO aposap_user';

    -- Grant table permissions
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA raw TO aposap_user';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA curated TO aposap_user';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA audit TO aposap_user';

    -- Grant sequence permissions
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO aposap_user';

    -- Grant function permissions
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA raw TO aposap_user';
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'Role aposap_user does not exist yet - skipping grants';
END $$;
