import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { ChartIcon, RefreshIcon } from './Icons';
import {
  fetchSalesSummary, fetchBudgetSummary, fetchSalesYoY,
  fetchBudgetVsSales, fetchAnalyticsFilters, fetchSapStatus
} from '../services/api';

// ── Color palette (Power BI-like) ──
const GROUP_COLORS = {
  'APPL': '#4472C4',
  'CMO Sales for Mfg our FG': '#ED7D31',
  'Navinta LLC': '#A5A5A5',
  'Waymade PLC': '#FFC000',
  'Scrap & Others Sales': '#5B9BD5'
};
const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9B57A0'];
const FY_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];

function getGroupColor(name, idx) {
  return GROUP_COLORS[name] || COLORS[idx % COLORS.length];
}

// ── Number formatting ──
function formatIndian(num) {
  if (num == null || isNaN(num)) return '0';
  const n = Number(num);
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
}

function formatFullIndian(num) {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMillions(num) {
  if (num == null || isNaN(num)) return '0.00';
  return (Number(num) / 1e6).toFixed(2);
}

function formatMillionsShort(num) {
  if (num == null || isNaN(num)) return '0';
  const m = Number(num) / 1e6;
  if (Math.abs(m) >= 1000) return (m / 1000).toFixed(1) + 'B';
  if (Math.abs(m) >= 1) return m.toFixed(1) + 'M';
  return formatIndian(num);
}

// ── Months ──
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Custom tooltip ──
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontSize: 13 }}>
          {p.name}: {formatFullIndian(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Top N + Others aggregation ──
const TOP_N = 8;
function topNWithOthers(data, nameKey, valueKey) {
  if (data.length <= TOP_N) return data;
  const sorted = [...data].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
  const top = sorted.slice(0, TOP_N);
  const othersTotal = sorted.slice(TOP_N).reduce((sum, r) => sum + Number(r[valueKey]), 0);
  return [...top, { [nameKey]: 'Others', [valueKey]: othersTotal }];
}

// ── Pie label ──
function renderPieLabel({ name, value, percent }) {
  if (percent < 0.02) return '';
  return `${name}\n${formatMillions(value)}M`;
}

// ═══════════════════════════════════════════════
// HOME TAB — 6-panel Power BI layout
// ═══════════════════════════════════════════════
function HomeTab({ salesData, budgetData, budgetVsSalesData }) {
  if (!salesData) return <div className="analytics-loading">Loading sales data...</div>;

  // ── Identify top groups ──
  const topGroups = topNWithOthers(salesData.sales_by_group, 'group_name', 'total_amount')
    .map(r => r.group_name);

  // ═══ PANEL 1: Stacked Bar — Sales by Group & Fiscal Year ═══
  const years = [...new Set(salesData.sales_by_group_year.map(r => r.fiscal_year))].sort();
  const barDataMap = {};
  for (const row of salesData.sales_by_group_year) {
    const gName = topGroups.includes(row.group_name) ? row.group_name : 'Others';
    if (!barDataMap[row.fiscal_year]) barDataMap[row.fiscal_year] = { fiscal_year: `FY ${row.fiscal_year}` };
    barDataMap[row.fiscal_year][gName] = (barDataMap[row.fiscal_year][gName] || 0) + Number(row.total_amount);
  }
  const stackedBarData = Object.values(barDataMap).sort((a, b) => {
    const ya = parseInt(a.fiscal_year.replace('FY ', ''));
    const yb = parseInt(b.fiscal_year.replace('FY ', ''));
    return ya - yb;
  });
  const barGroups = [...new Set(salesData.sales_by_group_year.map(r =>
    topGroups.includes(r.group_name) ? r.group_name : 'Others'
  ))];

  // Grand total
  const grandTotal = salesData.grand_total || 0;

  // ═══ PANEL 2: Monthly Trend — Sales by Month & Group ═══
  const monthlyRaw = salesData.sales_monthly_trend || [];
  const trendGroups = topGroups.filter(g => g !== 'Others');
  const monthlyMap = {};
  for (const row of monthlyRaw) {
    const gName = topGroups.includes(row.group_name) ? row.group_name : null;
    if (!gName || gName === 'Others') continue;
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    const label = `${MONTH_ABBR[row.month]} ${row.year}`;
    if (!monthlyMap[key]) monthlyMap[key] = { key, label, sortKey: Number(row.year) * 100 + Number(row.month) };
    monthlyMap[key][gName] = (monthlyMap[key][gName] || 0) + Number(row.total_amount);
  }
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.sortKey - b.sortKey);

  // ═══ PANEL 3: Pie — Total by Group ═══
  const pieData = topNWithOthers(salesData.sales_by_group, 'group_name', 'total_amount')
    .map(r => ({ name: r.group_name, value: Number(r.total_amount) }));

  // ═══ PANEL 4: Sales Matrix Table (Group × Year in Millions) ═══
  const matrixGroups = {};
  for (const row of salesData.sales_by_group_year) {
    const gName = topGroups.includes(row.group_name) ? row.group_name : 'Others';
    if (!matrixGroups[gName]) matrixGroups[gName] = {};
    matrixGroups[gName][row.fiscal_year] = (matrixGroups[gName][row.fiscal_year] || 0) + Number(row.total_amount);
  }
  const matrixRows = Object.entries(matrixGroups).map(([group, yearData]) => {
    const total = Object.values(yearData).reduce((s, v) => s + v, 0);
    return { group, ...yearData, total };
  }).sort((a, b) => b.total - a.total);
  const matrixTotals = {};
  let matrixGrandTotal = 0;
  for (const y of years) {
    matrixTotals[y] = matrixRows.reduce((s, r) => s + (r[y] || 0), 0);
    matrixGrandTotal += matrixTotals[y];
  }

  // ═══ PANEL 5: Dual-axis — Budget by Group ═══
  const budgetVsData = (budgetVsSalesData?.data || [])
    .filter(r => r.budget_cr > 0 || r.total_amount > 0)
    .sort((a, b) => b.budget_cr - a.budget_cr);

  return (
    <div className="home-grid">
      {/* ─── ROW 1 ─── */}
      <div className="home-row">
        {/* Panel 1: Stacked Bar — Sales by Group & Fiscal Year + Total KPI */}
        <div className="analytics-chart-card home-panel-bar">
          <div className="home-panel-header">
            <h3 className="analytics-chart-title" style={{ borderBottom: 'none', marginBottom: 0 }}>
              Total sales amount by Group and Fiscal Year
            </h3>
            <div className="home-kpi-card">
              <span className="home-kpi-value">{formatMillions(grandTotal)}M</span>
              <span className="home-kpi-label">Total amount</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stackedBarData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatMillionsShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {barGroups.map((g, i) => (
                <Bar key={g} dataKey={g} stackId="a" fill={getGroupColor(g, i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 2: Monthly trend — Sales by Year & Group */}
        <div className="analytics-chart-card home-panel-trend">
          <h3 className="analytics-chart-title">Total Sales amount by Year and Group</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={Math.max(0, Math.floor(monthlyData.length / 12) - 1)}
              />
              <YAxis tickFormatter={formatMillionsShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {trendGroups.map((g, i) => (
                <Line
                  key={g}
                  type="monotone"
                  dataKey={g}
                  name={g}
                  stroke={getGroupColor(g, i)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── ROW 2 ─── */}
      <div className="home-row">
        {/* Panel 3: Pie — Total amount by Group */}
        <div className="analytics-chart-card home-panel-pie">
          <h3 className="analytics-chart-title">Total amount by Group</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                outerRadius="70%"
                dataKey="value"
                label={({ name, value, percent }) => {
                  if (percent < 0.03) return '';
                  return `${formatMillions(value)}M`;
                }}
                labelLine={{ strokeWidth: 1 }}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={getGroupColor(entry.name, i)} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatFullIndian(val)} />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 4: Sales Matrix Table */}
        <div className="analytics-chart-card home-panel-matrix">
          <h3 className="analytics-chart-title">Total sales by Group Rs in Millions</h3>
          <div className="home-matrix-wrapper">
            <table className="home-matrix-table">
              <thead>
                <tr>
                  <th className="home-matrix-group-header">Group</th>
                  {years.map(y => (
                    <th key={y}>FY {y}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, idx) => (
                  <tr key={row.group}>
                    <td className="home-matrix-group-cell">
                      <span className="home-matrix-color-dot" style={{ background: getGroupColor(row.group, idx) }} />
                      {row.group}
                    </td>
                    {years.map(y => (
                      <td key={y} className="home-matrix-value">{formatMillions(row[y] || 0)}</td>
                    ))}
                    <td className="home-matrix-value home-matrix-total">{formatMillions(row.total)}</td>
                  </tr>
                ))}
                <tr className="home-matrix-footer">
                  <td className="home-matrix-group-cell"><strong>Total</strong></td>
                  {years.map(y => (
                    <td key={y} className="home-matrix-value"><strong>{formatMillions(matrixTotals[y])}</strong></td>
                  ))}
                  <td className="home-matrix-value home-matrix-total"><strong>{formatMillions(matrixGrandTotal)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 5: Dual-axis — Budget by Group */}
        <div className="analytics-chart-card home-panel-budget">
          <h3 className="analytics-chart-title">Budget by Group</h3>
          {budgetVsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={budgetVsData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="group_name"
                  tick={{ fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={formatMillionsShort}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Budget (CR)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#888' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatMillionsShort}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Total amount', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#888' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="budget_cr"
                  name="Budget (CR)"
                  fill="#C0C0C0"
                  fillOpacity={0.4}
                  stroke="#A0A0A0"
                  strokeWidth={1}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_amount"
                  name="Total amount"
                  stroke="#C00000"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#C00000' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics-empty" style={{ padding: '60px 0' }}>No budget data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// YoY TAB
// ═══════════════════════════════════════════════
function YoYTab({ yoyData }) {
  if (!yoyData) return <div className="analytics-loading">Loading YoY data...</div>;

  const { years, matrix, group_totals } = yoyData;
  if (!years?.length) return <div className="analytics-empty">No YoY data available</div>;

  // Group matrix rows by group_name
  const grouped = {};
  for (const row of matrix) {
    if (!grouped[row.group_name]) grouped[row.group_name] = [];
    grouped[row.group_name].push(row);
  }

  const grandTotal = {};
  for (const y of years) {
    grandTotal[`year_${y}_total`] = group_totals.reduce((sum, g) => sum + (g[`year_${y}_total`] || 0), 0);
  }
  for (const y of years) {
    const prev = grandTotal[`year_${y - 1}_total`];
    grandTotal[`year_${y}_yoy`] = prev && prev > 0
      ? ((grandTotal[`year_${y}_total`] - prev) / prev * 100).toFixed(2)
      : '0.00';
  }

  return (
    <div className="analytics-chart-card analytics-chart-full">
      <h3 className="analytics-chart-title">Year-over-Year Sales Comparison</h3>
      <div className="analytics-table-wrapper">
        <table className="analytics-yoy-table">
          <thead>
            <tr>
              <th rowSpan={2} className="analytics-yoy-header-group">Fiscal Year</th>
              {years.map(y => (
                <th key={y} colSpan={2} className="analytics-yoy-header-year">{y}</th>
              ))}
            </tr>
            <tr>
              {years.map(y => (
                <React.Fragment key={y}>
                  <th>Sum of Total Amount</th>
                  <th>YoY %</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupName, rows]) => {
              const groupTotal = group_totals.find(g => g.group_name === groupName);
              return (
                <React.Fragment key={groupName}>
                  <tr className="analytics-yoy-group-row">
                    <td className="analytics-yoy-group-name">{groupName}</td>
                    {years.map(y => (
                      <React.Fragment key={y}>
                        <td className="analytics-yoy-amount">{formatFullIndian(groupTotal?.[`year_${y}_total`])}</td>
                        <td className="analytics-yoy-pct">{groupTotal?.[`year_${y}_yoy`] || '0.00'}%</td>
                      </React.Fragment>
                    ))}
                  </tr>
                  {rows.filter(r => r.sub_group !== r.group_name).map((row, idx) => (
                    <tr key={idx} className="analytics-yoy-sub-row">
                      <td className="analytics-yoy-sub-name">{row.sub_group}</td>
                      {years.map(y => (
                        <React.Fragment key={y}>
                          <td className="analytics-yoy-amount">{formatFullIndian(row[`year_${y}_total`])}</td>
                          <td className="analytics-yoy-pct">{row[`year_${y}_yoy`] || '0.00'}%</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr className="analytics-yoy-total-row">
              <td><strong>Total</strong></td>
              {years.map(y => (
                <React.Fragment key={y}>
                  <td className="analytics-yoy-amount"><strong>{formatFullIndian(grandTotal[`year_${y}_total`])}</strong></td>
                  <td className="analytics-yoy-pct"><strong>{grandTotal[`year_${y}_yoy`]}%</strong></td>
                </React.Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DETAIL TAB
// ═══════════════════════════════════════════════
function DetailTab({ budgetData }) {
  if (!budgetData) return <div className="analytics-loading">Loading budget data...</div>;

  const groupData = budgetData.budget_by_group.map(r => ({
    name: r.group_name, value: Number(r.budget_cr)
  }));

  const incomeData = budgetData.budget_by_income_group.map(r => ({
    name: r.income_group, value: Number(r.budget_cr)
  }));

  const monthOrder = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const monthData = budgetData.budget_by_month
    .map(r => ({ month: r.zmonth, budget_cr: Number(r.budget_cr) }))
    .sort((a, b) => {
      const ai = monthOrder.indexOf(a.month.toUpperCase());
      const bi = monthOrder.indexOf(b.month.toUpperCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div className="analytics-grid">
      {/* Bar: Budget by GROUP */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={groupData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Bar dataKey="value" name="Budget (CR)" fill="#4472C4" radius={[4, 4, 0, 0]}>
              {groupData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: Budget by INCOME_GROUP */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by INCOME_GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={incomeData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Bar dataKey="value" name="Budget (CR)" fill="#4472C4" radius={[4, 4, 0, 0]}>
              {incomeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie: Budget by GROUP */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={groupData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(1)}%)` : ''}
              labelLine={{ strokeWidth: 1 }}
            >
              {groupData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Pie: Budget by INCOME_GROUP */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by INCOME_GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={incomeData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(1)}%)` : ''}
              labelLine={{ strokeWidth: 1 }}
            >
              {incomeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Line: Budget by Month */}
      <div className="analytics-chart-card analytics-chart-full">
        <h3 className="analytics-chart-title">Budget (CR) by Month</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Line
              type="monotone"
              dataKey="budget_cr"
              name="Budget (CR)"
              stroke="#4472C4"
              strokeWidth={2}
              dot={{ r: 5, fill: '#4472C4' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════
export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [salesData, setSalesData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [yoyData, setYoyData] = useState(null);
  const [budgetVsSalesData, setBudgetVsSalesData] = useState(null);
  const [filters, setFilters] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastSyncRef = useRef(null);

  // Load filter options
  useEffect(() => {
    fetchAnalyticsFilters()
      .then(setFilters)
      .catch(() => {});
  }, []);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sales, budget, yoy, bvs] = await Promise.all([
        fetchSalesSummary(selectedFilters),
        fetchBudgetSummary(selectedFilters),
        fetchSalesYoY(selectedFilters),
        fetchBudgetVsSales(selectedFilters)
      ]);
      setSalesData(sales);
      setBudgetData(budget);
      setYoyData(yoy);
      setBudgetVsSalesData(bvs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFilters]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh: poll SAP status and reload when lastSyncAt changes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await fetchSapStatus();
        if (status.lastSyncAt && status.lastSyncAt !== lastSyncRef.current) {
          lastSyncRef.current = status.lastSyncAt;
          loadData();
          fetchAnalyticsFilters().then(setFilters).catch(() => {});
        }
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleFilterChange = (key, value) => {
    setSelectedFilters(prev => {
      const next = { ...prev };
      if (value === '' || value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: '28px', fontWeight: '700',
          color: 'var(--color-gray-900)', marginBottom: 'var(--spacing-sm)',
          letterSpacing: '-0.025em'
        }}>
          Analytics
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>
          Interactive reports and visualizations — auto-refreshes after every SAP sync
        </p>
      </div>

      {/* Tabs + Filters + Refresh */}
      <div className="analytics-toolbar">
        <div className="analytics-tabs">
          {[
            { key: 'home', label: 'HOME' },
            { key: 'yoy', label: 'YoY' },
            { key: 'detail', label: 'DETAIL' }
          ].map(tab => (
            <button
              key={tab.key}
              className={`analytics-tab ${activeTab === tab.key ? 'analytics-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="analytics-filters">
          {/* Year filter */}
          <select
            className="analytics-filter-select"
            value={selectedFilters.year || ''}
            onChange={e => handleFilterChange('year', e.target.value)}
          >
            <option value="">All Years</option>
            {filters?.years?.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Group filter */}
          <select
            className="analytics-filter-select"
            value={selectedFilters.group || ''}
            onChange={e => handleFilterChange('group', e.target.value)}
          >
            <option value="">All Groups</option>
            {(activeTab === 'detail' ? filters?.budget_groups : filters?.sales_groups)?.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Refresh */}
          <button onClick={loadData} className="btn btn-secondary btn-sm" disabled={loading}>
            <RefreshIcon size={16} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-error-light)', marginBottom: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-error)', margin: 0 }}>Failed to load analytics data: {error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ height: '3px', background: 'var(--color-primary-600)', animation: 'shimmer 1.5s infinite', marginBottom: 'var(--spacing-lg)', borderRadius: 'var(--radius-full)' }} />
      )}

      {/* Tab content */}
      {activeTab === 'home' && <HomeTab salesData={salesData} budgetData={budgetData} budgetVsSalesData={budgetVsSalesData} />}
      {activeTab === 'yoy' && <YoYTab yoyData={yoyData} />}
      {activeTab === 'detail' && <DetailTab budgetData={budgetData} />}
    </div>
  );
}
