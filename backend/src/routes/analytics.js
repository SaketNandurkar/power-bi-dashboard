const express = require('express');
const { pool } = require('../services/dbService');
const logger = require('../utils/logger');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
// GROUP MAPPING
// ══════════════════════════════════════════════════════════════
// CTE that assigns a display group to each sales_register row.
// Priority: billing_type ZSC1 → scrap > customer_group_mapping > name CASE > APPL default.
// The 5 groups match the Power BI Output sheet:
//   APPL, Waymade PLC, Navinta, CMO sales, scrap
const SALES_GROUP_CTE = `
  sales_grouped AS (
    SELECT sr.invoice_no, sr.billing_type, sr.billing_type_description,
           sr.invoice_date, sr.bill_to, sr.bill_to_name,
           sr.fiscal_year, sr.billing_quantity, sr.net_value,
           sr.tax_amount, sr.total,
      CASE
        WHEN sr.billing_type = 'ZSC1' THEN 'scrap'
        ELSE COALESCE(
          gm.group_name,
          CASE
            WHEN sr.bill_to_name ILIKE '%Waymade%' THEN 'Waymade PLC'
            WHEN sr.bill_to_name ILIKE '%Navinta%' THEN 'Navinta'
            WHEN sr.bill_to_name ILIKE '%Immacule%' THEN 'Navinta'
            WHEN sr.bill_to_name ILIKE '%Krufren%' THEN 'CMO sales'
            WHEN sr.bill_to_name ILIKE '%Reine%' THEN 'CMO sales'
            WHEN sr.bill_to_name ILIKE '%Samrudh%' THEN 'CMO sales'
            ELSE 'APPL'
          END
        )
      END AS group_name
    FROM curated.sales_register sr
    LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
  )
`;

// SQL CASE to map budget_report.group_name → short display name
const BUDGET_DISPLAY = `
  CASE group_name
    WHEN 'CMO Sales for Mfg our FG' THEN 'CMO sales'
    WHEN 'Scrap & Others Sales' THEN 'scrap'
    ELSE group_name
  END
`;

// Reverse-map: short display name → actual budget_report.group_name
const DISPLAY_TO_BUDGET = {
  'CMO sales': 'CMO Sales for Mfg our FG',
  'scrap': 'Scrap & Others Sales'
};

// ══════════════════════════════════════════════════════════════
// FILTER BUILDERS
// ══════════════════════════════════════════════════════════════
function buildSalesFilters(query) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (query.year) {
    conditions.push(`sg.fiscal_year = $${idx++}`);
    params.push(Number(query.year));
  }
  if (query.group) {
    conditions.push(`sg.group_name = $${idx++}`);
    params.push(query.group);
  }
  if (query.date_from) {
    conditions.push(`sg.invoice_date >= $${idx++}`);
    params.push(query.date_from);
  }
  if (query.date_to) {
    conditions.push(`sg.invoice_date <= $${idx++}`);
    params.push(query.date_to);
  }

  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

function buildBudgetFilters(query) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (query.year) {
    conditions.push(`year = $${idx++}`);
    params.push(Number(query.year));
  }
  if (query.group) {
    // Reverse-map short name → actual budget group_name
    const actual = DISPLAY_TO_BUDGET[query.group] || query.group;
    conditions.push(`group_name = $${idx++}`);
    params.push(actual);
  }

  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

// ══════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/analytics/sales-summary
 * Returns aggregated sales data for HOME page charts.
 */
router.get('/sales-summary', async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilters(req.query);

    // Sales by group & fiscal year (grouped bar)
    const salesByGroupYear = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT sg.group_name, sg.fiscal_year, SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${where}
      GROUP BY sg.group_name, sg.fiscal_year
      ORDER BY sg.group_name, sg.fiscal_year
    `, params);

    // Total by group (pie chart)
    const salesByGroup = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT sg.group_name, SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${where}
      GROUP BY sg.group_name
      ORDER BY total_amount DESC
    `, params);

    // Monthly sales trend by group (line chart — monthly x-axis)
    const monthlyTrend = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT EXTRACT(YEAR FROM sg.invoice_date)::int AS year,
             EXTRACT(MONTH FROM sg.invoice_date)::int AS month,
             sg.group_name,
             SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${where}
      GROUP BY EXTRACT(YEAR FROM sg.invoice_date), EXTRACT(MONTH FROM sg.invoice_date), sg.group_name
      ORDER BY year, month, sg.group_name
    `, params);

    // Grand total for KPI card
    const grandTotal = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${where}
    `, params);

    res.json({
      sales_by_group_year: salesByGroupYear.rows,
      sales_by_group: salesByGroup.rows,
      sales_monthly_trend: monthlyTrend.rows,
      grand_total: Number(grandTotal.rows[0]?.total_amount || 0)
    });
  } catch (err) {
    logger.error('Analytics sales-summary failed', { error: err.message });
    next(err);
  }
});

/**
 * GET /api/analytics/budget-summary
 * Returns aggregated budget data for DETAIL page charts.
 */
router.get('/budget-summary', async (req, res, next) => {
  try {
    const { where, params } = buildBudgetFilters(req.query);

    const budgetByGroup = await pool.query(`
      SELECT ${BUDGET_DISPLAY} AS group_name, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${where}
      GROUP BY ${BUDGET_DISPLAY}
      ORDER BY budget_cr DESC
    `, params);

    const budgetByIncomeGroup = await pool.query(`
      SELECT income_group, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${where}
      GROUP BY income_group
      ORDER BY budget_cr DESC
    `, params);

    const budgetByMonth = await pool.query(`
      SELECT zmonth, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${where}
      GROUP BY zmonth
      ORDER BY zmonth
    `, params);

    res.json({
      budget_by_group: budgetByGroup.rows,
      budget_by_income_group: budgetByIncomeGroup.rows,
      budget_by_month: budgetByMonth.rows
    });
  } catch (err) {
    logger.error('Analytics budget-summary failed', { error: err.message });
    next(err);
  }
});

/**
 * GET /api/analytics/budget-vs-sales
 * Returns combined budget + sales by group for the dual-axis chart.
 * Both sides use short display names so they merge correctly.
 */
router.get('/budget-vs-sales', async (req, res, next) => {
  try {
    const yearFilter = req.query.year;
    const groupFilter = req.query.group;

    // Budget by group (mapped to short display name)
    const bCond = [];
    const bParams = [];
    let bi = 1;
    if (yearFilter) { bCond.push(`year = $${bi++}`); bParams.push(Number(yearFilter)); }
    if (groupFilter) {
      const actual = DISPLAY_TO_BUDGET[groupFilter] || groupFilter;
      bCond.push(`group_name = $${bi++}`);
      bParams.push(actual);
    }
    const bWhere = bCond.length ? 'WHERE ' + bCond.join(' AND ') : '';

    const budgetRes = await pool.query(`
      SELECT ${BUDGET_DISPLAY} AS group_name, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${bWhere}
      GROUP BY ${BUDGET_DISPLAY}
      ORDER BY budget_cr DESC
    `, bParams);

    // Sales by group (using CTE)
    const sCond = [];
    const sParams = [];
    let si = 1;
    if (yearFilter) { sCond.push(`sg.fiscal_year = $${si++}`); sParams.push(Number(yearFilter)); }
    if (groupFilter) { sCond.push(`sg.group_name = $${si++}`); sParams.push(groupFilter); }
    const sWhere = sCond.length ? 'WHERE ' + sCond.join(' AND ') : '';

    const salesRes = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT sg.group_name, SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${sWhere}
      GROUP BY sg.group_name
      ORDER BY total_amount DESC
    `, sParams);

    // Merge by group_name (both use short display names now)
    const mergedMap = {};
    for (const r of budgetRes.rows) {
      mergedMap[r.group_name] = { group_name: r.group_name, budget_cr: Number(r.budget_cr), total_amount: 0 };
    }
    for (const r of salesRes.rows) {
      if (!mergedMap[r.group_name]) {
        mergedMap[r.group_name] = { group_name: r.group_name, budget_cr: 0, total_amount: 0 };
      }
      mergedMap[r.group_name].total_amount = Number(r.total_amount);
    }

    res.json({ data: Object.values(mergedMap) });
  } catch (err) {
    logger.error('Analytics budget-vs-sales failed', { error: err.message });
    next(err);
  }
});

/**
 * GET /api/analytics/sales-yoy
 * Returns Year-over-Year comparison matrix.
 */
router.get('/sales-yoy', async (req, res, next) => {
  try {
    const groupFilter = req.query.group;
    const params = [];
    let groupWhere = '';

    if (groupFilter) {
      params.push(groupFilter);
      groupWhere = `WHERE sg.group_name = $1`;
    }

    const result = await pool.query(`
      WITH ${SALES_GROUP_CTE}
      SELECT sg.group_name,
             sg.bill_to_name AS sub_group,
             sg.fiscal_year,
             SUM(sg.total) AS total_amount
      FROM sales_grouped sg
      ${groupWhere}
      GROUP BY sg.group_name, sg.bill_to_name, sg.fiscal_year
      ORDER BY sg.group_name, sg.bill_to_name, sg.fiscal_year
    `, params);

    const years = [...new Set(result.rows.map(r => r.fiscal_year))].sort();
    const matrixMap = {};

    for (const row of result.rows) {
      const key = `${row.group_name}|${row.sub_group}`;
      if (!matrixMap[key]) {
        matrixMap[key] = { group_name: row.group_name, sub_group: row.sub_group, years: {} };
      }
      matrixMap[key].years[row.fiscal_year] = Number(row.total_amount);
    }

    const matrix = Object.values(matrixMap).map(entry => {
      const row = { group_name: entry.group_name, sub_group: entry.sub_group };
      for (const year of years) {
        row[`year_${year}_total`] = entry.years[year] || 0;
        const prev = entry.years[year - 1];
        if (prev && prev > 0) {
          row[`year_${year}_yoy`] = ((entry.years[year] - prev) / prev * 100).toFixed(2);
        } else {
          row[`year_${year}_yoy`] = '0.00';
        }
      }
      return row;
    });

    const groupTotals = {};
    for (const row of result.rows) {
      if (!groupTotals[row.group_name]) groupTotals[row.group_name] = {};
      if (!groupTotals[row.group_name][row.fiscal_year]) groupTotals[row.group_name][row.fiscal_year] = 0;
      groupTotals[row.group_name][row.fiscal_year] += Number(row.total_amount);
    }

    const groupRows = Object.entries(groupTotals).map(([group_name, yearData]) => {
      const row = { group_name, sub_group: null, is_group_total: true };
      for (const year of years) {
        row[`year_${year}_total`] = yearData[year] || 0;
        const prev = yearData[year - 1];
        if (prev && prev > 0) {
          row[`year_${year}_yoy`] = (((yearData[year] || 0) - prev) / prev * 100).toFixed(2);
        } else {
          row[`year_${year}_yoy`] = '0.00';
        }
      }
      return row;
    });

    res.json({ years, matrix, group_totals: groupRows });
  } catch (err) {
    logger.error('Analytics sales-yoy failed', { error: err.message });
    next(err);
  }
});

/**
 * GET /api/analytics/filters
 * Returns available filter values (short display names).
 */
router.get('/filters', async (req, res, next) => {
  try {
    const [yearsRes, groupsRes, budgetGroupsRes] = await Promise.all([
      pool.query('SELECT DISTINCT fiscal_year FROM curated.sales_register ORDER BY fiscal_year'),
      pool.query(`
        WITH ${SALES_GROUP_CTE}
        SELECT DISTINCT sg.group_name
        FROM sales_grouped sg
        ORDER BY sg.group_name
      `),
      pool.query(`
        SELECT DISTINCT ${BUDGET_DISPLAY} AS group_name
        FROM curated.budget_report
        ORDER BY group_name
      `)
    ]);

    res.json({
      years: yearsRes.rows.map(r => r.fiscal_year),
      sales_groups: groupsRes.rows.map(r => r.group_name),
      budget_groups: budgetGroupsRes.rows.map(r => r.group_name)
    });
  } catch (err) {
    logger.error('Analytics filters failed', { error: err.message });
    next(err);
  }
});

module.exports = router;
