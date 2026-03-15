import { getToken, clearAuth } from './auth';

const API_URL = process.env.REACT_APP_API_URL || '';

// ── Auth-aware fetch wrapper ──

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Content-Type'] && options.method && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('Session expired');
  }

  return response;
}

// ── Auth API ──

export async function login(username, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Login failed');
  return data;
}

export async function fetchCurrentUser() {
  const response = await authFetch(`${API_URL}/api/auth/me`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch user');
  return data.user;
}

// ── User Management API (ADMIN only) ──

export async function fetchUsers() {
  const response = await authFetch(`${API_URL}/api/users`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch users');
  return data.users;
}

export async function createUser(userData) {
  const response = await authFetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create user');
  return data.user;
}

export async function updateUser(id, userData) {
  const response = await authFetch(`${API_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update user');
  return data.user;
}

export async function deleteUser(id) {
  const response = await authFetch(`${API_URL}/api/users/${id}`, {
    method: 'DELETE'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to deactivate user');
  return data.user;
}

// ── Existing API (now with auth) ──

export async function fetchStatus() {
  const response = await authFetch(`${API_URL}/api/status`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch status');
  return data.reports;
}

export async function triggerSapSync(reportType) {
  const body = reportType ? { reportType } : {};
  const response = await authFetch(`${API_URL}/api/sap/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'SAP sync failed');
  return data;
}

export async function fetchSapStatus() {
  const response = await authFetch(`${API_URL}/api/sap/status`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch SAP status');
  return {
    ...data.sync,
    mockMode: data.scheduler?.mockMode || false,
    scheduler: data.scheduler
  };
}

export async function updateSapSchedule(cronExpr) {
  const response = await authFetch(`${API_URL}/api/sap/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cron: cronExpr })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update schedule');
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
  const response = await authFetch(`${API_URL}/api/analytics/sales-summary${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch sales summary');
  return data;
}

export async function fetchBudgetSummary(filters) {
  const response = await authFetch(`${API_URL}/api/analytics/budget-summary${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch budget summary');
  return data;
}

export async function fetchBudgetVsSales(filters) {
  const response = await authFetch(`${API_URL}/api/analytics/budget-vs-sales${buildQueryString(filters)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch budget vs sales');
  return data;
}

export async function fetchBankSummary() {
  const response = await authFetch(`${API_URL}/api/analytics/bank-summary`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch bank summary');
  return data;
}

export async function fetchAnalyticsFilters() {
  const response = await authFetch(`${API_URL}/api/analytics/filters`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch filters');
  return data;
}

export async function fetchAccountsPayableSummary(fy) {
  const qs = fy ? `?fy=${fy}` : '';
  const response = await authFetch(`${API_URL}/api/analytics/accounts-payable-summary${qs}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch accounts payable data');
  return data;
}
