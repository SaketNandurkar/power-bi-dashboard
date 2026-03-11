const API_URL = process.env.REACT_APP_API_URL || '';

export async function fetchStatus() {
  const response = await fetch(`${API_URL}/api/status`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch status');
  }

  return data.reports;
}

export async function triggerSapSync(reportType) {
  const body = reportType ? { reportType } : {};
  const response = await fetch(`${API_URL}/api/sap/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'SAP sync failed');
  }

  return data;
}

export async function fetchSapStatus() {
  const response = await fetch(`${API_URL}/api/sap/status`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch SAP status');
  }

  // Flatten sync + scheduler into a single object for the UI
  return {
    ...data.sync,
    mockMode: data.scheduler?.mockMode || false,
    scheduler: data.scheduler
  };
}

export async function updateSapSchedule(cronExpr) {
  const response = await fetch(`${API_URL}/api/sap/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cron: cronExpr })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to update schedule');
  }

  return data;
}

// ── Analytics API ──

function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters?.year) params.set('year', filters.year);
  if (filters?.group) params.set('group', filters.group);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchSalesSummary(filters) {
  const response = await fetch(`${API_URL}/api/analytics/sales-summary${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch sales summary');
  return data;
}

export async function fetchBudgetSummary(filters) {
  const response = await fetch(`${API_URL}/api/analytics/budget-summary${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch budget summary');
  return data;
}

export async function fetchSalesYoY(filters) {
  const response = await fetch(`${API_URL}/api/analytics/sales-yoy${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch YoY data');
  return data;
}

export async function fetchBudgetVsSales(filters) {
  const response = await fetch(`${API_URL}/api/analytics/budget-vs-sales${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch budget vs sales');
  return data;
}

export async function fetchAnalyticsFilters() {
  const response = await fetch(`${API_URL}/api/analytics/filters`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch filters');
  return data;
}
