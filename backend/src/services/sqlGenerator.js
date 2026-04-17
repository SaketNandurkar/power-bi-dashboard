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
    schemaText += 'IMPORTANT: Column names with spaces or special characters MUST be wrapped in double quotes.\n\n';

    for (const [tableName, columns] of Object.entries(tables)) {
      schemaText += `${tableName}:\n`;
      columns.forEach(col => {
        // Check if column name needs quoting (has spaces, special chars, or starts with space)
        const needsQuotes = /[\s\-\/\.]/.test(col.name) || col.name !== col.name.toLowerCase();
        const columnDisplay = needsQuotes ? `"${col.name}"` : col.name;
        schemaText += `  - ${columnDisplay} (${col.type})${col.nullable ? ' NULL' : ''}\n`;
      });
      schemaText += '\n';
    }

    // Add business context
    schemaText += `
Business Context:

curated.v_sales_register:
  - Contains invoice-level sales data
  - "Fiscal Year": Financial year (April-March)
  - " Total": Total invoice amount including tax (in INR) - NOTE: column name has a leading space, use " Total" with quotes
  - "Net Value": Invoice amount before tax

curated.v_accounts_payable:
  - Contains vendor payment data
  - "Debit/Credit": 'H' for debit, 'S' for credit
  - "Local Amount": Transaction amount (in INR)
  - "Posting Date": Date of transaction

curated.v_budget_report:
  - Budget allocations by group and month
  - "BUDGET_CR": Budget amount in crores (multiply by 10,000,000 for rupees)
  - "GROUP": Customer group name
  - "ZMONTH": Month

curated.v_bank_report:
  - Bank account balances
  - "Balance": Current account balance (in INR)
  - "G/L Account": GL account number

QUERY RULES:
- Always use SELECT statements only
- Column names with spaces MUST be in double quotes: SELECT " Total" FROM curated.v_sales_register
- Use LIMIT clause (max 1000 rows)
- Filter by date using "Invoice Date", "Posting Date" etc with proper quotes
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
