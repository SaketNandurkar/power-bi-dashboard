const { pool } = require('./dbService');
const logger = require('../utils/logger');

/**
 * Get database schema context for AI
 * Includes table/view names, columns, and business logic
 * @returns {Promise<string>} Schema description
 */
async function getSchemaContext() {
  logger.info('Building schema context for AI');

  try {
    const result = await pool.query(`
      SELECT
        table_schema,
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'curated'
        AND table_name LIKE 'v_%'
      ORDER BY table_name, ordinal_position;
    `);

    // Group by table
    const tables = {};
    result.rows.forEach(row => {
      const tableName = `${row.table_schema}.${row.table_name}`;
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
      tables[tableName].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES'
      });
    });

    // Build schema description
    let schemaText = 'Available Tables/Views:\n\n';

    for (const [tableName, columns] of Object.entries(tables)) {
      schemaText += `${tableName}:\n`;
      columns.forEach(col => {
        schemaText += `  - ${col.name} (${col.type})${col.nullable ? ' NULL' : ''}\n`;
      });
      schemaText += '\n';
    }

    // Add business context
    schemaText += `
Business Context:

curated.v_sales_register:
  - Contains invoice-level sales data
  - group_name: Customer grouping (APPL, Waymade PLC, Navinta, CMO sales, scrap)
  - fiscal_year: Financial year (April-March)
  - total: Total invoice amount including tax (in INR)
  - net_value: Invoice amount before tax

curated.v_accounts_payable:
  - Contains vendor payment data
  - Classification categories: formulation_plant, capex, rm_pm, service, opex
  - debit_credit: 'H' for debit, 'S' for credit
  - local_amount: Transaction amount (in INR)

curated.v_budget_report:
  - Budget allocations by group and month
  - budget_cr: Budget amount in crores (multiply by 10,000,000 for rupees)

curated.v_bank_report:
  - Bank account balances
  - parent_bank: HDFC, SBI, ICICI, UCO, Yes Bank
  - balance: Current account balance (in INR)
`;

    logger.info('Schema context built successfully', {
      tableCount: Object.keys(tables).length,
      contextLength: schemaText.length
    });

    return schemaText;
  } catch (err) {
    logger.error('Failed to build schema context', { error: err.message });
    throw err;
  }
}

module.exports = { getSchemaContext };
