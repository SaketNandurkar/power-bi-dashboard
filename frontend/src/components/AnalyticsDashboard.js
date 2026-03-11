import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { RefreshIcon } from './Icons';
import {
  fetchSalesSummary, fetchBudgetSummary, fetchSalesYoY,
  fetchBudgetVsSales, fetchAnalyticsFilters, fetchSapStatus
} from '../services/api';

// ══════════════════════════════════════════════════════
// COLOR PALETTE — Power BI theme
// ══════════════════════════════════════════════════════
const GROUP_COLORS = {
  'APPL':         '#5B9BD5',
  'Waymade PLC':  '#ED3690',
  'Navinta LLC':  '#ED7D31',
  'CMO sales':    '#4472C4',
  'scrap':        '#404040',
};
const GROUP_ORDER = ['APPL', 'Waymade PLC', 'Navinta LLC', 'CMO sales', 'scrap'];
const FY_COLORS = ['#4472C4', '#70AD47', '#ED7D31', '#FFC000', '#5B9BD5', '#A5A5A5'];
const FALLBACK_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9B57A0'];

function getGroupColor(name) {
  return GROUP_COLORS[name] || FALLBACK_COLORS[GROUP_ORDER.indexOf(name) % FALLBACK_COLORS.length] || '#888';
}

// ══════════════════════════════════════════════════════
// NUMBER FORMATTING
// ══════════════════════════════════════════════════════
function formatM(num) {
  if (num == null || isNaN(num)) return '';
  const n = Number(num);
  if (n === 0) return '0';
  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
}

function formatMComma(num) {
  if (num == null || isNaN(num)) return '0';
  const m = (Number(num) / 1e6);
  // Indian-style comma: 1,519.15M
  const parts = m.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.') + 'M';
}

function formatFullIndian(num) {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAxisM(num) {
  if (num == null || isNaN(num)) return '0';
  const n = Number(num);
  if (n === 0) return '0M';
  return (n / 1e6).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'M';
}

function formatRupeeM(num) {
  if (num == null || isNaN(num)) return '';
  return '\u20B9' + formatMComma(num);
}

// ══════════════════════════════════════════════════════
// MONTH HELPERS
// ══════════════════════════════════════════════════════
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ══════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ══════════════════════════════════════════════════════
function PBITooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pbi-tooltip">
      <div className="pbi-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="pbi-tooltip-row">
          <span className="pbi-tooltip-dot" style={{ background: p.color }} />
          <span className="pbi-tooltip-name">{p.name}:</span>
          <span className="pbi-tooltip-value">{formatFullIndian(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PANEL WRAPPER (blue header like Power BI)
// ══════════════════════════════════════════════════════
function PBIPanel({ title, className, children, rightContent }) {
  return (
    <div className={`pbi-panel ${className || ''}`}>
      <div className="pbi-panel-header">
        <span className="pbi-panel-title">{title}</span>
        {rightContent && <div className="pbi-panel-header-right">{rightContent}</div>}
      </div>
      <div className="pbi-panel-body">
        {children}
      </div>
    </div>
  );
}

// Custom bar label (show value in M above bar)
function BarLabel({ x, y, width, value }) {
  if (!value || value === 0) return null;
  return (
    <text x={x + width / 2} y={y - 4} fill="#333" fontSize={9} textAnchor="middle">
      {formatM(value)}
    </text>
  );
}

// ═══════════════════════════════════════════════════════════
// HOME TAB — 6 panels matching Power BI exactly
// ═══════════════════════════════════════════════════════════
function HomeTab({ salesData, budgetVsSalesData }) {
  if (!salesData) return <div className="analytics-loading">Loading sales data...</div>;

  const grandTotal = salesData.grand_total || 0;
  const groups = salesData.sales_by_group.map(r => r.group_name);
  // Prefer a fixed order, fallback to whatever the data has
  const orderedGroups = GROUP_ORDER.filter(g => groups.includes(g))
    .concat(groups.filter(g => !GROUP_ORDER.includes(g)));

  // ═══ PANEL 1: Grouped Bar — Sales by Group & Fiscal Year ═══
  const years = [...new Set(salesData.sales_by_group_year.map(r => r.fiscal_year))].sort();
  const barDataMap = {};
  for (const g of orderedGroups) barDataMap[g] = { group: g };
  for (const row of salesData.sales_by_group_year) {
    const g = row.group_name;
    if (!barDataMap[g]) barDataMap[g] = { group: g };
    barDataMap[g][`FY${row.fiscal_year}`] = Number(row.total_amount);
  }
  const barData = orderedGroups.map(g => barDataMap[g] || { group: g });

  // ═══ PANEL 2: Monthly Trend ═══
  const monthlyRaw = salesData.sales_monthly_trend || [];
  const trendGroups = orderedGroups;
  const monthlyMap = {};
  for (const row of monthlyRaw) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    const label = `${MONTH_ABBR[row.month]} ${row.year}`;
    if (!monthlyMap[key]) monthlyMap[key] = { key, label, sortKey: Number(row.year) * 100 + Number(row.month) };
    monthlyMap[key][row.group_name] = (monthlyMap[key][row.group_name] || 0) + Number(row.total_amount);
  }
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.sortKey - b.sortKey);

  // ═══ PANEL 3: Pie ═══
  const pieData = salesData.sales_by_group
    .map(r => ({ name: r.group_name, value: Number(r.total_amount) }))
    .sort((a, b) => b.value - a.value);

  // ═══ PANEL 4: Sales Matrix Table (Group × Year in Millions) ═══
  const matrixGroups = {};
  for (const row of salesData.sales_by_group_year) {
    if (!matrixGroups[row.group_name]) matrixGroups[row.group_name] = {};
    matrixGroups[row.group_name][row.fiscal_year] = (matrixGroups[row.group_name][row.fiscal_year] || 0) + Number(row.total_amount);
  }
  const matrixRows = orderedGroups.filter(g => matrixGroups[g]).map(group => {
    const yearData = matrixGroups[group];
    const total = Object.values(yearData).reduce((s, v) => s + v, 0);
    return { group, ...yearData, total };
  });
  const matrixTotals = {};
  let matrixGrandTotal = 0;
  for (const y of years) {
    matrixTotals[y] = matrixRows.reduce((s, r) => s + (r[y] || 0), 0);
    matrixGrandTotal += matrixTotals[y];
  }

  // ═══ PANEL 5: Dual-axis Budget ═══
  const budgetVsData = (budgetVsSalesData?.data || [])
    .filter(r => r.budget_cr > 0 || r.total_amount > 0)
    .sort((a, b) => b.budget_cr - a.budget_cr);

  return (
    <div className="home-grid">
      {/* ─── ROW 1: Bar + Trend ─── */}
      <div className="home-row">

        {/* Panel 1: Grouped Bar */}
        <PBIPanel
          title="Total sales amount by Group and Fiscal Year"
          className="home-panel-bar"
          rightContent={
            <div className="pbi-kpi-badge">
              <span className="pbi-kpi-number">{formatMComma(grandTotal)}</span>
              <span className="pbi-kpi-text">Total amount</span>
            </div>
          }
        >
          <div className="pbi-legend-row">
            <span className="pbi-legend-prefix">Fiscal Year</span>
            {years.map((y, i) => (
              <span key={y} className="pbi-legend-item">
                <span className="pbi-legend-dot" style={{ background: FY_COLORS[i % FY_COLORS.length] }} />
                {y}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
              <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis tickFormatter={formatAxisM} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip content={<PBITooltip />} />
              {years.map((y, i) => (
                <Bar key={y} dataKey={`FY${y}`} name={String(y)} fill={FY_COLORS[i % FY_COLORS.length]} barSize={years.length > 3 ? 18 : 28}>
                  <LabelList dataKey={`FY${y}`} content={<BarLabel />} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </PBIPanel>

        {/* Panel 2: Monthly Trend */}
        <PBIPanel
          title="Total Sales amount by Year and Group"
          className="home-panel-trend"
          rightContent={
            <div className="pbi-kpi-badge">
              <span className="pbi-kpi-number">{formatMComma(grandTotal)}</span>
              <span className="pbi-kpi-text">Total amount</span>
            </div>
          }
        >
          <div className="pbi-legend-row">
            <span className="pbi-legend-prefix">Group</span>
            {trendGroups.map(g => (
              <span key={g} className="pbi-legend-item">
                <span className="pbi-legend-dot" style={{ background: getGroupColor(g) }} />
                {g}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData} margin={{ top: 15, right: 15, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#555' }}
                angle={-45}
                textAnchor="end"
                height={55}
                interval={Math.max(0, Math.floor(monthlyData.length / 10))}
              />
              <YAxis tickFormatter={formatAxisM} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip content={<PBITooltip />} />
              {trendGroups.map(g => (
                <Line
                  key={g}
                  type="monotone"
                  dataKey={g}
                  name={g}
                  stroke={getGroupColor(g)}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: getGroupColor(g) }}
                  activeDot={{ r: 5 }}
                  connectNulls
                >
                  <LabelList
                    dataKey={g}
                    position="top"
                    formatter={v => v ? formatM(v) : ''}
                    style={{ fontSize: 8, fill: getGroupColor(g) }}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </PBIPanel>
      </div>

      {/* ─── ROW 2: Pie + Matrix + Budget ─── */}
      <div className="home-row">

        {/* Panel 3: Pie */}
        <PBIPanel title="Total amount by Group" className="home-panel-pie">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                outerRadius="75%"
                dataKey="value"
                label={({ name, value, percent }) => {
                  if (percent < 0.01) return '';
                  return `${formatMComma(value)} (${(percent * 100).toFixed(2)}%)`;
                }}
                labelLine={{ strokeWidth: 1, stroke: '#999' }}
                startAngle={90}
                endAngle={-270}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={getGroupColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatFullIndian(val)} />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{ fontSize: 11, paddingLeft: 10 }}
                formatter={(value) => <span style={{ color: '#333' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </PBIPanel>

        {/* Panel 4: Sales Matrix Table */}
        <PBIPanel title="Total sales by Group Rs in Millions" className="home-panel-matrix">
          <div className="pbi-matrix-scroll">
            <table className="pbi-matrix">
              <thead>
                <tr>
                  <th className="pbi-matrix-th-group">Group</th>
                  {years.map(y => <th key={y}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, idx) => (
                  <tr key={row.group} className="pbi-matrix-row">
                    <td className="pbi-matrix-group">
                      <span className="pbi-matrix-dot" style={{ background: getGroupColor(row.group) }} />
                      <strong>{row.group}</strong>
                    </td>
                    {years.map(y => (
                      <td key={y} className="pbi-matrix-val">{formatMComma(row[y] || 0)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="pbi-matrix-total-row">
                  <td className="pbi-matrix-group"><strong>Total</strong></td>
                  {years.map(y => (
                    <td key={y} className="pbi-matrix-val pbi-matrix-total-val">
                      <strong>{formatMComma(matrixTotals[y])}</strong>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </PBIPanel>

        {/* Panel 5: Budget by Group — Dual Axis */}
        <PBIPanel title="Budget by Group" className="home-panel-budget">
          {budgetVsData.length > 0 ? (
            <>
              <div className="pbi-legend-row" style={{ marginBottom: 4 }}>
                <span className="pbi-legend-item">
                  <span className="pbi-legend-dot" style={{ background: '#B0B0B0' }} />
                  Sum of Budget (M)
                </span>
                <span className="pbi-legend-item">
                  <span className="pbi-legend-dot" style={{ background: '#C00000' }} />
                  Sum of Total amount
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={budgetVsData} margin={{ top: 15, right: 50, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="group_name"
                    tick={{ fontSize: 10, fill: '#555' }}
                    angle={-20}
                    textAnchor="end"
                    height={40}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={v => formatRupeeM(v)}
                    tick={{ fontSize: 9, fill: '#888' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Sum of Budget (M)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#888' } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatAxisM}
                    tick={{ fontSize: 9, fill: '#888' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Sum of Total amount', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#888' } }}
                  />
                  <Tooltip content={<PBITooltip />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="budget_cr"
                    name="Sum of Budget (M)"
                    fill="#C8C8C8"
                    fillOpacity={0.6}
                    stroke="#A0A0A0"
                    strokeWidth={1}
                  >
                    <LabelList
                      dataKey="budget_cr"
                      position="top"
                      formatter={v => v ? formatRupeeM(v) : ''}
                      style={{ fontSize: 9, fill: '#666' }}
                    />
                  </Area>
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="total_amount"
                    name="Sum of Total amount"
                    fill="#C00000"
                    fillOpacity={0.3}
                    stroke="#C00000"
                    strokeWidth={2}
                  >
                    <LabelList
                      dataKey="total_amount"
                      position="bottom"
                      formatter={v => v ? formatMComma(v) : ''}
                      style={{ fontSize: 9, fill: '#C00000' }}
                    />
                  </Area>
                </ComposedChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="analytics-empty" style={{ padding: '60px 0' }}>No budget data available</div>
          )}
        </PBIPanel>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// YoY TAB
// ═══════════════════════════════════════════════════════════
function YoYTab({ yoyData }) {
  if (!yoyData) return <div className="analytics-loading">Loading YoY data...</div>;

  const { years, matrix, group_totals } = yoyData;
  if (!years?.length) return <div className="analytics-empty">No YoY data available</div>;

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

// ═══════════════════════════════════════════════════════════
// DETAIL TAB
// ═══════════════════════════════════════════════════════════
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
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={groupData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatAxisM} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Bar dataKey="value" name="Budget (CR)" fill="#4472C4" radius={[4, 4, 0, 0]}>
              {groupData.map((_, i) => (
                <Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by INCOME_GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={incomeData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatAxisM} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Bar dataKey="value" name="Budget (CR)" fill="#4472C4" radius={[4, 4, 0, 0]}>
              {incomeData.map((_, i) => (
                <Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={groupData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
              label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(1)}%)` : ''}
              labelLine={{ strokeWidth: 1 }}
            >
              {groupData.map((_, i) => (
                <Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Sum of BUDGET_CR by INCOME_GROUP</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={incomeData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
              label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(1)}%)` : ''}
              labelLine={{ strokeWidth: 1 }}
            >
              {incomeData.map((_, i) => (
                <Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart-card analytics-chart-full">
        <h3 className="analytics-chart-title">Budget (CR) by Month</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tickFormatter={formatAxisM} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Line type="monotone" dataKey="budget_cr" name="Budget (CR)" stroke="#4472C4" strokeWidth={2}
              dot={{ r: 5, fill: '#4472C4' }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════
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

  useEffect(() => {
    fetchAnalyticsFilters().then(setFilters).catch(() => {});
  }, []);

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
      if (value === '' || value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-gray-900)', marginBottom: 'var(--spacing-sm)', letterSpacing: '-0.025em' }}>
          Analytics
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>
          Interactive reports and visualizations — auto-refreshes after every SAP sync
        </p>
      </div>

      <div className="analytics-toolbar">
        <div className="analytics-tabs">
          {[
            { key: 'home', label: 'HOME' },
            { key: 'yoy', label: 'YoY' },
            { key: 'detail', label: 'DETAIL' }
          ].map(tab => (
            <button key={tab.key}
              className={`analytics-tab ${activeTab === tab.key ? 'analytics-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="analytics-filters">
          <select className="analytics-filter-select" value={selectedFilters.year || ''}
            onChange={e => handleFilterChange('year', e.target.value)}>
            <option value="">All Years</option>
            {filters?.years?.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select className="analytics-filter-select" value={selectedFilters.group || ''}
            onChange={e => handleFilterChange('group', e.target.value)}>
            <option value="">All Groups</option>
            {(activeTab === 'detail' ? filters?.budget_groups : filters?.sales_groups)?.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <button onClick={loadData} className="btn btn-secondary btn-sm" disabled={loading}>
            <RefreshIcon size={16} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-error-light)', marginBottom: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-error)', margin: 0 }}>Failed to load analytics data: {error}</p>
        </div>
      )}

      {loading && (
        <div style={{ height: '3px', background: 'var(--color-primary-600)', animation: 'shimmer 1.5s infinite', marginBottom: 'var(--spacing-lg)', borderRadius: 'var(--radius-full)' }} />
      )}

      {activeTab === 'home' && <HomeTab salesData={salesData} budgetVsSalesData={budgetVsSalesData} />}
      {activeTab === 'yoy' && <YoYTab yoyData={yoyData} />}
      {activeTab === 'detail' && <DetailTab budgetData={budgetData} />}
    </div>
  );
}
