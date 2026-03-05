import React from 'react';
import {
  DatabaseIcon,
  UploadIcon,
  ActivityIcon,
  TrendingUpIcon,
  CheckCircleIcon
} from './Icons';

export default function Dashboard({ reports, sapStatus }) {
  // Calculate KPI metrics
  const totalRecords = reports.reduce((sum, r) => sum + (r.rows_total || 0), 0);
  const activeReports = reports.filter(r => r.status === 'success').length;
  const lastSyncDate = sapStatus?.lastSyncAt
    ? new Date(sapStatus.lastSyncAt).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Never';

  const syncStatus = sapStatus?.syncing ? 'Syncing...' : 'Active';

  const kpis = [
    {
      title: 'Total Records',
      value: totalRecords.toLocaleString(),
      icon: DatabaseIcon,
      color: 'var(--color-primary-600)',
      bgColor: 'var(--color-primary-50)',
      change: null
    },
    {
      title: 'Active Reports',
      value: `${activeReports}/${reports.length}`,
      icon: CheckCircleIcon,
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-light)',
      change: null
    },
    {
      title: 'Last Sync',
      value: lastSyncDate,
      icon: ActivityIcon,
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-light)',
      change: null
    },
    {
      title: 'Sync Status',
      value: syncStatus,
      icon: TrendingUpIcon,
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-light)',
      change: null
    }
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--color-gray-900)',
          marginBottom: 'var(--spacing-sm)',
          letterSpacing: '-0.025em'
        }}>
          Dashboard Overview
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-gray-600)'
        }}>
          Monitor your data pipeline and business analytics in real-time
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-title">{kpi.title}</div>
              <div className="kpi-icon" style={{
                background: kpi.bgColor,
                color: kpi.color
              }}>
                <kpi.icon size={20} />
              </div>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            {kpi.change && (
              <div className={`kpi-change ${kpi.change > 0 ? 'positive' : 'negative'}`}>
                <span>{kpi.change > 0 ? '↑' : '↓'}</span>
                <span>{Math.abs(kpi.change)}%</span>
                <span style={{ color: 'var(--color-gray-500)', fontWeight: 500 }}>
                  vs last month
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Report Status Summary */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <DatabaseIcon size={20} />
            Data Reports Summary
          </h2>
        </div>
        <div className="card-body">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Records</th>
                  <th>Last Updated</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const reportNames = {
                    accounts_payable: 'Accounts Payable',
                    bank_report: 'Bank Report',
                    budget_report: 'Budget Report',
                    sales_register: 'Sales Register'
                  };

                  return (
                    <tr key={report.report_type}>
                      <td style={{ fontWeight: 600 }}>
                        {reportNames[report.report_type] || report.report_type}
                      </td>
                      <td>
                        <span className={`badge ${
                          report.status === 'success' ? 'badge-success' :
                          report.status === 'failed' ? 'badge-error' :
                          report.status === 'processing' ? 'badge-primary' :
                          'badge-gray'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {(report.rows_total || 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--color-gray-600)' }}>
                        {report.last_uploaded
                          ? new Date(report.last_uploaded).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '—'}
                      </td>
                      <td>
                        {report.source ? (
                          <span className={`badge ${
                            report.source === 'SAP Sync' ? 'badge-primary' : 'badge-success'
                          }`}>
                            {report.source}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-gray-400)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
