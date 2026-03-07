/**
 * SAP OData field → PostgreSQL column mappings for all 4 entity sets.
 * Parameter order MUST match the raw.upsert_*() function signatures in database/init.sql.
 */

const ENTITY_SET_CONFIG = {
  accounts_payable: {
    entitySetName: 'ZENTITY_ACCPAYABLESet',
    fields: [
      { sap: 'Zcompcode',    db: 'company_code',        type: 'text' },
      { sap: 'ZdocNo',       db: 'document_number',     type: 'text' },
      { sap: 'Zyear',        db: 'fiscal_year',         type: 'integer' },
      { sap: 'ZpostDt',      db: 'posting_date',        type: 'date_yyyymmdd' },
      { sap: 'Zvendor',      db: 'vendor',              type: 'text' },
      { sap: 'Zmsme',        db: 'msme',                type: 'text' },
      { sap: 'ZpurchDoc',    db: 'purchasing_document',  type: 'text' },
      { sap: 'ZpurchDocitm', db: 'item',                type: 'text' },
      { sap: 'ZpoDoctyp',    db: 'po_document_type',    type: 'text' },
      { sap: 'ZintOrdr',     db: 'internal_order',      type: 'text' },
      { sap: 'ZdebCrdt',     db: 'debit_credit',        type: 'text' },
      { sap: 'ZlclAmt',      db: 'local_amount',        type: 'numeric' },
      { sap: 'Zcurr',        db: 'currency',            type: 'text' }
    ],
    // Matches raw.upsert_accounts_payable() param order (init.sql L337)
    upsertParamOrder: [
      'company_code', 'document_number', 'fiscal_year', 'posting_date',
      'vendor', 'msme', 'purchasing_document', 'item', 'po_document_type',
      'internal_order', 'debit_credit', 'local_amount', 'currency'
    ]
  },

  bank_report: {
    entitySetName: 'ZENTITY_BankSet',
    fields: [
      { sap: 'Zgl',       db: 'gl_account', type: 'text' },
      { sap: 'ZshrtTxt',  db: 'short_text', type: 'text' },
      { sap: 'ZlongTxt',  db: 'long_text',  type: 'text' },
      { sap: 'Zbalance',  db: 'balance',    type: 'numeric' }
    ],
    // Matches raw.upsert_bank_report() param order (init.sql L405)
    upsertParamOrder: ['gl_account', 'short_text', 'long_text', 'balance']
  },

  budget_report: {
    entitySetName: 'ZENTITY_AL11Set',
    fields: [
      { sap: 'Zyear',     db: 'year',          type: 'integer' },
      { sap: 'Zgroup',    db: 'group_name',    type: 'text' },
      { sap: 'ZincmGrp',  db: 'income_group',  type: 'text' },
      { sap: 'Zmonth',    db: 'zmonth',        type: 'text' },
      { sap: 'Zbudget',   db: 'budget_cr',     type: 'numeric' }
    ],
    // Matches raw.upsert_budget_report() param order (init.sql L440)
    upsertParamOrder: ['year', 'group_name', 'income_group', 'zmonth', 'budget_cr']
  },

  sales_register: {
    entitySetName: 'zentity_salesregSet',
    fields: [
      { sap: 'ZinvNo',       db: 'invoice_no',               type: 'text' },
      { sap: 'ZbillingTyp',  db: 'billing_type',             type: 'text' },
      { sap: 'ZbilltypDesc', db: 'billing_type_description',  type: 'text' },
      { sap: 'ZinvDate',     db: 'invoice_date',             type: 'date_ddmmyyyy' },
      { sap: 'ZbillTo',      db: 'bill_to',                  type: 'text' },
      { sap: 'ZbillyoNm',    db: 'bill_to_name',             type: 'text' },
      { sap: 'Zyear',        db: 'fiscal_year',              type: 'integer' },
      { sap: 'ZbillQty',     db: 'billing_quantity',         type: 'numeric' },
      { sap: 'ZinvNetvalue', db: 'net_value',                type: 'numeric' },
      { sap: 'ZinvTaxamt',   db: 'tax_amount',               type: 'numeric' },
      { sap: 'Ztotal',       db: 'total',                    type: 'numeric' }
    ],
    // Matches raw.upsert_sales_register() param order
    upsertParamOrder: [
      'invoice_no', 'billing_type', 'billing_type_description',
      'invoice_date', 'bill_to', 'bill_to_name', 'fiscal_year',
      'billing_quantity', 'net_value', 'tax_amount', 'total'
    ]
  }
};

module.exports = { ENTITY_SET_CONFIG };
