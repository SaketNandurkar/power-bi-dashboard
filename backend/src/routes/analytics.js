const express = require('express');
const { pool } = require('../services/dbService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Helper: build WHERE clause fragments from query params.
 */
function buildFilters(query) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (query.year) {
    conditions.push(`fiscal_year = $${idx++}`);
    params.push(Number(query.year));
  }
  if (query.group) {
    conditions.push(`COALESCE(gm.group_name, sr.bill_to_name) = $${idx++}`);
    params.push(query.group);
  }
  if (query.date_from) {
    conditions.push(`invoice_date >= $${idx++}`);
    params.push(query.date_from);
  }
  if (query.date_to) {
    conditions.push(`invoice_date <= $${idx++}`);
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
    conditions.push(`group_name = $${idx++}`);
    params.push(query.group);
  }

  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

/**
 * GET /api/analytics/sales-summary
 * Returns aggregated sales data for HOME page charts.
 */
router.get('/sales-summary', async (req, res, next) => {
  try {
    const { where, params } = buildFilters(req.query);

    // Sales by group & fiscal year (stacked bar)
    const salesByGroupYear = await pool.query(`
      SELECT COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
             sr.fiscal_year,
             SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${where}
      GROUP BY COALESCE(gm.group_name, sr.bill_to_name), sr.fiscal_year
      ORDER BY group_name, sr.fiscal_year
    `, params);

    // Total by group (donut)
    const salesByGroup = await pool.query(`
      SELECT COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
             SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${where}
      GROUP BY COALESCE(gm.group_name, sr.bill_to_name)
      ORDER BY total_amount DESC
    `, params);

    // Sales trend by year & group (multi-line — yearly)
    const salesTrend = await pool.query(`
      SELECT sr.fiscal_year,
             COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
             SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${where}
      GROUP BY sr.fiscal_year, COALESCE(gm.group_name, sr.bill_to_name)
      ORDER BY sr.fiscal_year, group_name
    `, params);

    // Monthly sales trend by group (for monthly line chart)
    const monthlyTrend = await pool.query(`
      SELECT EXTRACT(YEAR FROM sr.invoice_date)::int AS year,
             EXTRACT(MONTH FROM sr.invoice_date)::int AS month,
             COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
             SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${where}
      GROUP BY EXTRACT(YEAR FROM sr.invoice_date), EXTRACT(MONTH FROM sr.invoice_date),
               COALESCE(gm.group_name, sr.bill_to_name)
      ORDER BY year, month, group_name
    `, params);

    // Grand total for KPI card
    const grandTotal = await pool.query(`
      SELECT SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${where}
    `, params);

    res.json({
      sales_by_group_year: salesByGroupYear.rows,
      sales_by_group: salesByGroup.rows,
      sales_trend: salesTrend.rows,
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
 * Returns aggregated budget data for HOME + DETAIL page charts.
 */
router.get('/budget-summary', async (req, res, next) => {
  try {
    const { where, params } = buildBudgetFilters(req.query);

    // Budget by group
    const budgetByGroup = await pool.query(`
      SELECT group_name, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${where}
      GROUP BY group_name
      ORDER BY budget_cr DESC
    `, params);

    // Budget by income group
    const budgetByIncomeGroup = await pool.query(`
      SELECT income_group, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${where}
      GROUP BY income_group
      ORDER BY budget_cr DESC
    `, params);

    // Budget by month
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
 * Returns combined budget + sales by group for dual-axis chart.
 */
router.get('/budget-vs-sales', async (req, res, next) => {
  try {
    const groupFilter = req.query.group;
    const yearFilter = req.query.year;

    // Budget by group
    const budgetConditions = [];
    const budgetParams = [];
    let bidx = 1;
    if (yearFilter) {
      budgetConditions.push(`year = $${bidx++}`);
      budgetParams.push(Number(yearFilter));
    }
    if (groupFilter) {
      budgetConditions.push(`group_name = $${bidx++}`);
      budgetParams.push(groupFilter);
    }
    const budgetWhere = budgetConditions.length ? 'WHERE ' + budgetConditions.join(' AND ') : '';

    const budgetRes = await pool.query(`
      SELECT group_name, SUM(budget_cr) AS budget_cr
      FROM curated.budget_report
      ${budgetWhere}
      GROUP BY group_name
      ORDER BY group_name
    `, budgetParams);

    // Sales by group (same groups as budget)
    const salesConditions = [];
    const salesParams = [];
    let sidx = 1;
    if (yearFilter) {
      salesConditions.push(`sr.fiscal_year = $${sidx++}`);
      salesParams.push(Number(yearFilter));
    }
    if (groupFilter) {
      salesConditions.push(`COALESCE(gm.group_name, sr.bill_to_name) = $${sidx++}`);
      salesParams.push(groupFilter);
    }
    const salesWhere = salesConditions.length ? 'WHERE ' + salesConditions.join(' AND ') : '';

    const salesRes = await pool.query(`
      SELECT COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
             SUM(sr.total) AS total_amount
      FROM curated.sales_register sr
      LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
      ${salesWhere}
      GROUP BY COALESCE(gm.group_name, sr.bill_to_name)
      ORDER BY group_name
    `, salesParams);

    // Merge budget + sales by group_name
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
      groupWhere = `WHERE COALESCE(gm.group_name, sr.bill_to_name) = $1`;
    }

    const result = await pool.query(`
      WITH grouped_sales AS (
        SELECT COALESCE(gm.group_name, sr.bill_to_name) AS group_name,
               sr.bill_to_name AS sub_group,
               sr.fiscal_year,
               SUM(sr.total) AS total_amount
        FROM curated.sales_register sr
        LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
        ${groupWhere}
        GROUP BY COALESCE(gm.group_name, sr.bill_to_name), sr.bill_to_name, sr.fiscal_year
      )
      SELECT group_name,
             sub_group,
             fiscal_year,
             total_amount
      FROM grouped_sales
      ORDER BY group_name, sub_group, fiscal_year
    `, params);

    // Pivot the data: collect all fiscal years and build matrix
    const years = [...new Set(result.rows.map(r => r.fiscal_year))].sort();
    const matrixMap = {};

    for (const row of result.rows) {
      const key = `${row.group_name}|${row.sub_group}`;
      if (!matrixMap[key]) {
        matrixMap[key] = { group_name: row.group_name, sub_group: row.sub_group, years: {} };
      }
      matrixMap[key].years[row.fiscal_year] = Number(row.total_amount);
    }

    // Compute YoY percentages
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

    // Also compute group-level totals
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
 * Returns available filter values.
 */
router.get('/filters', async (req, res, next) => {
  try {
    const [yearsRes, groupsRes, budgetGroupsRes] = await Promise.all([
      pool.query('SELECT DISTINCT fiscal_year FROM curated.sales_register ORDER BY fiscal_year'),
      pool.query(`
        SELECT DISTINCT COALESCE(gm.group_name, sr.bill_to_name) AS group_name
        FROM curated.sales_register sr
        LEFT JOIN curated.customer_group_mapping gm ON sr.bill_to = gm.bill_to
        ORDER BY group_name
      `),
      pool.query('SELECT DISTINCT group_name FROM curated.budget_report ORDER BY group_name')
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
