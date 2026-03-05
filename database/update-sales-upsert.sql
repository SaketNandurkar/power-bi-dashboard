-- ============================================================================
-- Update Sales Register upsert function with new fields
-- ============================================================================

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

SELECT 'Upsert function updated successfully!' AS status;
