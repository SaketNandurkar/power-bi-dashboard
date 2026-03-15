import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SapSyncPanel from './components/SapSyncPanel';
import StatusPanel from './components/StatusPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import Notification from './components/Notification';
import { CalendarIcon, LogoutIcon, MenuIcon } from './components/Icons';
import { fetchStatus, fetchSapStatus, fetchCurrentUser } from './services/api';
import { getToken, clearAuth } from './services/auth';
import './App.css';

export default function App() {
  // ── Auth State ──
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // ── App State ──
  const isAdmin = user?.role === 'ADMIN';
  const defaultView = isAdmin ? 'dashboard' : 'analytics';
  const [activeView, setActiveView] = useState(defaultView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState([
    { report_type: 'accounts_payable', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'bank_report', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'budget_report', last_uploaded: null, rows_total: 0, status: 'pending' },
    { report_type: 'sales_register', last_uploaded: null, rows_total: 0, status: 'pending' }
  ]);
  const [sapStatus, setSapStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: 'info' });

  // ── Auth: Check stored token on mount ──
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => clearAuth())
      .finally(() => setAuthChecking(false));
  }, []);

  // ── Reset view when user changes ──
  useEffect(() => {
    if (user) {
      setActiveView(user.role === 'ADMIN' ? 'dashboard' : 'analytics');
    }
  }, [user]);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setStatusLoading(true);
    try {
      const [reportsData, sapData] = await Promise.all([
        fetchStatus(),
        fetchSapStatus().catch(() => null)
      ]);
      setReports(reportsData);
      if (sapData) setSapStatus(sapData);
    } catch (err) {
      // Silently fail on status refresh
    } finally {
      setStatusLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus, user]);

  const handleNotify = useCallback((message, type) => {
    setNotification({ message, type });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification({ message: '', type: 'info' });
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  const handleLogin = (u) => {
    setUser(u);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setActiveView('dashboard');
  };

  // ── Auth checking spinner ──
  if (authChecking) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  // ── Login page ──
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ── Render content based on active view ──
  const renderContent = () => {
    // Non-admin roles only see analytics
    if (!isAdmin && activeView !== 'analytics') {
      return <AnalyticsDashboard user={user} />;
    }

    switch (activeView) {
      case 'dashboard':
        return <Dashboard reports={reports} sapStatus={sapStatus} />;
      case 'sync':
        return <SapSyncPanel onNotify={handleNotify} onSyncComplete={loadStatus} />;
      case 'reports':
        return <StatusPanel reports={reports} loading={statusLoading} />;
      case 'analytics':
        return <AnalyticsDashboard user={user} />;
      case 'users':
        return <UserManagement currentUser={user} />;
      default:
        return <Dashboard reports={reports} sapStatus={sapStatus} />;
    }
  };

  // ── Header title ──
  const getHeaderTitle = () => {
    if (!isAdmin) return 'Analytics Dashboard';
    switch (activeView) {
      case 'dashboard': return 'Dashboard Overview';
      case 'sync': return 'SAP Synchronization';
      case 'reports': return 'Data Status';
      case 'analytics': return 'Analytics Dashboard';
      case 'users': return 'User Management';
      default: return 'Dashboard Overview';
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar — only for ADMIN */}
      {isAdmin && (
        <>
          {sidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
          )}
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            user={user}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* Main Content Area */}
      <div className={`app-main ${!isAdmin ? 'app-main-full' : ''}`}>
        {/* Top Header */}
        <header className="app-header">
          <div className="header-left">
            {isAdmin && (
              <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
                <MenuIcon size={20} />
              </button>
            )}
            <h2 className="header-title">
              {getHeaderTitle()}
            </h2>
          </div>

          <div className="header-user-section">
            <div className="header-date-info">
              <CalendarIcon size={16} />
              <span>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="header-divider" />

            <div className="header-user-info">
              <span className="header-user-name">{user.full_name}</span>
              <span className="header-role-badge">{user.role.replace('_', ' ')}</span>
            </div>

            <button className="btn-logout" onClick={handleLogout}>
              <LogoutIcon size={14} />
              <span>Logout</span>
            </button>
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
