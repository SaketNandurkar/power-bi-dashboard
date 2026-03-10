import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ChartIcon, RefreshIcon } from './Icons';
import {
  fetchSalesSummary, fetchBudgetSummary, fetchSalesYoY,
  fetchAnalyticsFilters, fetchSapStatus
} from '../services/api';

// ── Color palette ──
const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ── Indian number formatting ──
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

// ── Pie label ──
function renderPieLabel({ name, value, percent }) {
  return `${name} (${(percent * 100).toFixed(1)}%)`;
}

// ═══════════════════════════════════════════════
// HOME TAB
// ═══════════════════════════════════════════════
function HomeTab({ salesData, budgetData }) {
  if (!salesData) return <div className="analytics-loading">Loading sales data...</div>;

  // ── Stacked bar: Sales by Group & Fiscal Year ──
  const years = [...new Set(salesData.sales_by_group_year.map(r => r.fiscal_year))].sort();
  const groupsMap = {};
  for (const row of salesData.sales_by_group_year) {
    if (!groupsMap[row.group_name]) groupsMap[row.group_name] = {};
    groupsMap[row.group_name][row.fiscal_year] = Number(row.total_amount);
  }
  const stackedBarData = Object.entries(groupsMap).map(([group, yearData]) => {
    const entry = { group };
    for (const y of years) entry[`FY${y}`] = yearData[y] || 0;
    return entry;
  });

  // ── Donut: Total by Group ──
  const donutData = salesData.sales_by_group.map(r => ({
    name: r.group_name, value: Number(r.total_amount)
  }));

  // ── Multi-line: Sales trend by Year & Group ──
  const trendGroups = [...new Set(salesData.sales_trend.map(r => r.group_name))];
  const trendByYear = {};
  for (const row of salesData.sales_trend) {
    if (!trendByYear[row.fiscal_year]) trendByYear[row.fiscal_year] = { year: row.fiscal_year };
    trendByYear[row.fiscal_year][row.group_name] = Number(row.total_amount);
  }
  const trendData = Object.values(trendByYear).sort((a, b) => a.year - b.year);

  // ── Budget by group line (from budgetData) ──
  const budgetGroupData = budgetData?.budget_by_group?.map(r => ({
    group: r.group_name, budget_cr: Number(r.budget_cr)
  })) || [];

  return (
    <div className="analytics-grid">
      {/* Chart 1: Stacked Bar - Sales by Group & FY */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Total Sales Amount by Group and Fiscal Year</h3>
        <div className="analytics-chart-legend">
          {years.map((y, i) => (
            <span key={y} className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
              Fiscal Year {y}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stackedBarData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="group" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            {years.map((y, i) => (
              <Bar key={y} dataKey={`FY${y}`} name={`FY ${y}`} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Donut - Total by Group */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Total Amount by Group</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              dataKey="value"
              label={renderPieLabel}
              labelLine={{ strokeWidth: 1 }}
            >
              {donutData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatFullIndian(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Budget by Group */}
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">Budget by Group</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={budgetGroupData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="group" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="budget_cr" name="Budget (CR)" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Multi-line - Sales Trend by Year & Group */}
      <div className="analytics-chart-card analytics-chart-full">
        <h3 className="analytics-chart-title">Total Sales Amount by Year and Group</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trendData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatIndian} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {trendGroups.map((g, i) => (
              <Line
                key={g}
                type="monotone"
                dataKey={g}
                name={g}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
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
                  {/* Group total row */}
                  <tr className="analytics-yoy-group-row">
                    <td className="analytics-yoy-group-name">{groupName}</td>
                    {years.map(y => (
                      <React.Fragment key={y}>
                        <td className="analytics-yoy-amount">{formatFullIndian(groupTotal?.[`year_${y}_total`])}</td>
                        <td className="analytics-yoy-pct">{groupTotal?.[`year_${y}_yoy`] || '0.00'}%</td>
                      </React.Fragment>
                    ))}
                  </tr>
                  {/* Sub-group rows */}
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
            {/* Grand total */}
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
            <Bar dataKey="value" name="Budget (CR)" fill="#2563eb" radius={[4, 4, 0, 0]}>
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
            <Bar dataKey="value" name="Budget (CR)" fill="#2563eb" radius={[4, 4, 0, 0]}>
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
              label={renderPieLabel}
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
              label={renderPieLabel}
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
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 5, fill: '#2563eb' }}
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
      const [sales, budget, yoy] = await Promise.all([
        fetchSalesSummary(selectedFilters),
        fetchBudgetSummary(selectedFilters),
        fetchSalesYoY(selectedFilters)
      ]);
      setSalesData(sales);
      setBudgetData(budget);
      setYoyData(yoy);
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
      {activeTab === 'home' && <HomeTab salesData={salesData} budgetData={budgetData} />}
      {activeTab === 'yoy' && <YoYTab yoyData={yoyData} />}
      {activeTab === 'detail' && <DetailTab budgetData={budgetData} />}
    </div>
  );
}
