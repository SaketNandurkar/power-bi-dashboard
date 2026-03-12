import React from 'react';
import {
  DatabaseIcon,
  SyncIcon,
  ChartIcon,
  ActivityIcon,
  UsersIcon
} from './Icons';

export default function Sidebar({ activeView, onViewChange, user }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: ActivityIcon,
      section: 'main'
    },
    {
      id: 'sync',
      label: 'SAP Sync',
      icon: SyncIcon,
      section: 'data'
    },
    {
      id: 'reports',
      label: 'Data Status',
      icon: DatabaseIcon,
      section: 'data'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: ChartIcon,
      section: 'insights'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: UsersIcon,
      section: 'admin'
    }
  ];

  const sections = {
    main: 'Overview',
    data: 'Data Management',
    insights: 'Insights',
    admin: 'Administration'
  };

  // Only show admin section items if user is ADMIN
  const filteredItems = navItems.filter(item =>
    item.section !== 'admin' || user?.role === 'ADMIN'
  );

  const groupedItems = Object.entries(sections)
    .map(([sectionId, sectionLabel]) => ({
      label: sectionLabel,
      items: filteredItems.filter(item => item.section === sectionId)
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img
          src={process.env.PUBLIC_URL + '/logo.png'}
          alt="Apothecon - Caring For Humanity"
          className="sidebar-logo-img"
        />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {groupedItems.map((section) => (
          <div key={section.label} className="sidebar-nav-section">
            <div className="sidebar-nav-label">{section.label}</div>
            {section.items.map((item) => (
              <div
                key={item.id}
                className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon size={20} className="sidebar-nav-icon" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--color-primary-100)',
              color: 'var(--color-primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {user.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ color: 'var(--color-gray-600)', fontWeight: 600, fontSize: '12px' }}>
                {user.full_name}
              </div>
              <div style={{ color: 'var(--color-gray-400)', fontSize: '10px', textTransform: 'uppercase' }}>
                {user.role.replace('_', ' ')}
              </div>
            </div>
          </div>
        )}
        <div style={{ color: 'var(--color-gray-400)' }}>
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}
