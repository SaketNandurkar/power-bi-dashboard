import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SapSyncPanel from './components/SapSyncPanel';
import StatusPanel from './components/StatusPanel';
import PowerBIDashboard from './components/PowerBIDashboard';
import Notification from './components/Notification';
import { CalendarIcon } from './components/Icons';
import { fetchStatus, fetchSapStatus } from './services/api';
import './App.css';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [reports, setReports] = useState([
    { report_type: 'accounts_payable', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'bank_report', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'budget_report', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'sales_register', last_uploaded: null, rows_total: 0, status: 'pending' }
  ]);
  const [sapStatus, setSapStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: 'info' });

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const [reportsData, sapData] = await Promise.all([
        fetchStatus(),
        fetchSapStatus()
      ]);
      setReports(reportsData);
      setSapStatus(sapData);
    } catch (err) {
      // Silently fail on status refresh
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleNotify = useCallback((message, type) => {
    setNotification({ message, type });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification({ message: '', type: 'info' });
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard reports={reports} sapStatus={sapStatus} />;
      case 'sync':
        return <SapSyncPanel onNotify={handleNotify} onSyncComplete={loadStatus} />;
      case 'reports':
        return <StatusPanel reports={reports} loading={statusLoading} />;
      case 'analytics':
        return <PowerBIDashboard />;
      default:
        return <Dashboard reports={reports} sapStatus={sapStatus} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Header */}
        <header className="app-header">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)'
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--color-gray-900)',
              margin: 0
            }}>
              {activeView === 'dashboard' && 'Dashboard Overview'}
              {activeView === 'sync' && 'SAP Synchronization'}
              {activeView === 'reports' && 'Data Status'}
              {activeView === 'analytics' && 'Analytics Dashboard'}
            </h2>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            fontSize: '13px',
            color: 'var(--color-gray-600)',
            fontWeight: 500
          }}>
            <CalendarIcon size={16} />
            <span>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            <span style={{
              padding: '4px 10px',
              background: 'var(--color-gray-100)',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
              color: 'var(--color-gray-700)'
            }}>
              {new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="app-content">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={clearNotification}
          />
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
