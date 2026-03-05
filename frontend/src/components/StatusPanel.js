import React from 'react';
import { DatabaseIcon, CheckCircleIcon, AlertCircleIcon, ActivityIcon } from './Icons';

const LABELS = {
  accounts_payable: 'Accounts Payable',
  bank_report: 'Bank Report',
  budget_report: 'Budget Report',
  sales_register: 'Sales Register'
};

export default function StatusPanel({ reports, loading }) {
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
          Data Status
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-gray-600)'
        }}>
          Monitor the status and health of your data reports
        </p>
      </div>

      {/* Status Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <DatabaseIcon size={20} />
            Report Status Overview
          </h2>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-gray-600)' }}>
              <span className="spinner spinner-primary" />
              Refreshing...
            </div>
          )}
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Records</th>
                  <th>Last Updated</th>
                  <th>Data Source</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const reportName = LABELS[r.report_type] || r.report_type;
                  const statusConfig = {
                    success: { badge: 'badge-success', icon: CheckCircleIcon },
                    failed: { badge: 'badge-error', icon: AlertCircleIcon },
                    processing: { badge: 'badge-primary', icon: ActivityIcon },
                    pending: { badge: 'badge-gray', icon: ActivityIcon }
                  };
                  const config = statusConfig[r.status] || statusConfig.pending;

                  return (
                    <tr key={r.report_type} className="fade-in">
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <DatabaseIcon size={18} color="var(--color-gray-400)" />
                          {reportName}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${config.badge}`}>
                          <config.icon size={12} />
                          {r.status}
                        </span>
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--color-gray-900)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '15px'
                      }}>
                        {(r.rows_total || 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--color-gray-600)' }}>
                        {r.last_uploaded
                          ? new Date(r.last_uploaded).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '—'}
                      </td>
                      <td>
                        {r.source ? (
                          <span className={`badge ${r.source === 'SAP Sync' ? 'badge-primary' : 'badge-success'}`}>
                            {r.source}
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
