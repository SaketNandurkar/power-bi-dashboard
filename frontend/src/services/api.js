const API_URL = process.env.REACT_APP_API_URL || '';

export async function uploadFile(file, reportType) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('reportType', reportType);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Upload failed');
  }

  return data;
}

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
