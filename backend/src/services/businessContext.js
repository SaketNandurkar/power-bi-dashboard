const { pool } = require('./dbService');
const logger = require('../utils/logger');

/**
 * Business Context Service
 * Enriches AI responses with targets, trends, and comparisons
 */

/**
 * Get budget vs actual comparison for sales
 * @param {string} period - 'current_month', 'last_month', 'ytd', 'last_year'
 * @param {string} customerGroup - Optional customer group filter
 */
async function getSalesBudgetComparison(period = 'last_month', customerGroup = null) {
  try {
    let dateFilter = '';
    const now = new Date();
    const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // April = FY start

    if (period === 'current_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = `AND s."Invoice Date" >= '${startOfMonth.toISOString().split('T')[0]}'`;
    } else if (period === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFilter = `AND s."Invoice Date" BETWEEN '${lastMonth.toISOString().split('T')[0]}' AND '${lastMonthEnd.toISOString().split('T')[0]}'`;
    } else if (period === 'ytd') {
      const fyStart = new Date(currentFY, 3, 1); // April 1st
      dateFilter = `AND s."Invoice Date" >= '${fyStart.toISOString().split('T')[0]}'`;
    }

    const query = `
      WITH sales_actual AS (
        SELECT
          CASE
            WHEN s."Billing Type" = 'ZSC1' THEN 'scrap'
            WHEN s."Bill To Name" ILIKE '%waymade%' THEN 'Waymade PLC'
            WHEN s."Bill To Name" ILIKE '%navinta%' OR s."Bill To Name" ILIKE '%immacule%' THEN 'Navinta'
            WHEN s."Bill To Name" IN ('11001163', '11001275', '11001340') THEN 'CMO sales'
            ELSE 'APPL'
          END as customer_group,
          SUM(s." Total") as actual_sales
        FROM curated.v_sales_register s
        WHERE 1=1 ${dateFilter}
        GROUP BY (CASE
            WHEN s."Billing Type" = 'ZSC1' THEN 'scrap'
            WHEN s."Bill To Name" ILIKE '%waymade%' THEN 'Waymade PLC'
            WHEN s."Bill To Name" ILIKE '%navinta%' OR s."Bill To Name" ILIKE '%immacule%' THEN 'Navinta'
            WHEN s."Bill To Name" IN ('11001163', '11001275', '11001340') THEN 'CMO sales'
            ELSE 'APPL'
          END)
      ),
      budget_target AS (
        SELECT
          CASE
            WHEN b."GROUP" = 'CMO Sales for Mfg our FG' THEN 'CMO sales'
            WHEN b."GROUP" = 'Scrap & Others Sales' THEN 'scrap'
            ELSE b."GROUP"
          END as customer_group,
          SUM(b."BUDGET_CR" * 10000000) as budget_amount
        FROM curated.v_budget_report b
        WHERE b."Year" = ${currentFY}
        GROUP BY (CASE
            WHEN b."GROUP" = 'CMO Sales for Mfg our FG' THEN 'CMO sales'
            WHEN b."GROUP" = 'Scrap & Others Sales' THEN 'scrap'
            ELSE b."GROUP"
          END)
      )
      SELECT
        COALESCE(s.customer_group, b.customer_group) as customer_group,
        COALESCE(s.actual_sales, 0) as actual,
        COALESCE(b.budget_amount, 0) as budget,
        CASE
          WHEN b.budget_amount > 0 THEN
            ((s.actual_sales - b.budget_amount) / b.budget_amount * 100)
          ELSE NULL
        END as variance_pct
      FROM sales_actual s
      FULL OUTER JOIN budget_target b ON s.customer_group = b.customer_group
      ORDER BY actual DESC NULLS LAST;
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    logger.error('Failed to get sales budget comparison', { error: err.message });
    return [];
  }
}

/**
 * Get year-over-year comparison
 */
async function getYoYComparison(metric = 'sales', period = 'last_month') {
  try {
    const now = new Date();
    const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const previousFY = currentFY - 1;

    if (metric === 'sales') {
      const query = `
        WITH current_year AS (
          SELECT SUM(s." Total") as total
          FROM curated.v_sales_register s
          WHERE s."Fiscal Year" = ${currentFY}
        ),
        previous_year AS (
          SELECT SUM(s." Total") as total
          FROM curated.v_sales_register s
          WHERE s."Fiscal Year" = ${previousFY}
        )
        SELECT
          c.total as current_year_sales,
          p.total as previous_year_sales,
          CASE
            WHEN p.total > 0 THEN ((c.total - p.total) / p.total * 100)
            ELSE NULL
          END as yoy_growth_pct
        FROM current_year c, previous_year p;
      `;

      const result = await pool.query(query);
      return result.rows[0] || {};
    }

    return {};
  } catch (err) {
    logger.error('Failed to get YoY comparison', { error: err.message });
    return {};
  }
}

/**
 * Get trend analysis (last 3 months)
 */
async function getTrend(metric = 'sales') {
  try {
    if (metric === 'sales') {
      const query = `
        SELECT
          DATE_TRUNC('month', s."Invoice Date") as month,
          SUM(s." Total") as total_sales
        FROM curated.v_sales_register s
        WHERE s."Invoice Date" >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 3;
      `;

      const result = await pool.query(query);
      const data = result.rows;

      if (data.length >= 2) {
        const latest = data[0].total_sales;
        const previous = data[1].total_sales;
        const change = ((latest - previous) / previous * 100);

        return {
          trend: change > 5 ? '📈 Growing' : change < -5 ? '📉 Declining' : '➡️ Stable',
          change_pct: change.toFixed(1),
          last_3_months: data.map(d => ({
            month: d.month,
            value: d.total_sales
          }))
        };
      }
    }

    return { trend: '➡️ Stable', change_pct: 0, last_3_months: [] };
  } catch (err) {
    logger.error('Failed to get trend', { error: err.message });
    return { trend: '➡️ Stable', change_pct: 0, last_3_months: [] };
  }
}

/**
 * Get comprehensive business context for AI responses
 */
async function getBusinessContext(question, queryResult) {
  const context = {
    budget_comparison: null,
    yoy_comparison: null,
    trend: null,
    alerts: []
  };

  try {
    // Detect if question is about sales
    if (question.toLowerCase().includes('sales') || question.toLowerCase().includes('revenue')) {
      context.budget_comparison = await getSalesBudgetComparison('last_month');
      context.yoy_comparison = await getYoYComparison('sales');
      context.trend = await getTrend('sales');

      // Generate alerts based on data
      if (context.budget_comparison && context.budget_comparison.length > 0) {
        context.budget_comparison.forEach(group => {
          if (group.variance_pct && group.variance_pct < -10) {
            context.alerts.push({
              severity: 'warning',
              message: `${group.customer_group} is ${Math.abs(group.variance_pct).toFixed(1)}% below budget`
            });
          }
        });
      }

      if (context.yoy_comparison && context.yoy_comparison.yoy_growth_pct < -5) {
        context.alerts.push({
          severity: 'critical',
          message: `Sales declining ${Math.abs(context.yoy_comparison.yoy_growth_pct).toFixed(1)}% YoY`
        });
      }
    }

    logger.info('Business context retrieved', {
      has_budget: !!context.budget_comparison,
      has_yoy: !!context.yoy_comparison,
      alerts_count: context.alerts.length
    });

    return context;
  } catch (err) {
    logger.error('Failed to get business context', { error: err.message });
    return context;
  }
}

module.exports = {
  getBusinessContext,
  getSalesBudgetComparison,
  getYoYComparison,
  getTrend
};
