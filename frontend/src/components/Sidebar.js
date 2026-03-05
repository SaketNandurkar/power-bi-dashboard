import React from 'react';
import {
  DatabaseIcon,
  UploadIcon,
  SyncIcon,
  ChartIcon,
  ActivityIcon,
  SettingsIcon
} from './Icons';

export default function Sidebar({ activeView, onViewChange }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: ActivityIcon,
      section: 'main'
    },
    {
      id: 'upload',
      label: 'Upload Data',
      icon: UploadIcon,
      section: 'data'
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
    }
  ];

  const sections = {
    main: 'Overview',
    data: 'Data Management',
    insights: 'Insights'
  };

  const groupedItems = Object.entries(sections).map(([sectionId, sectionLabel]) => ({
    label: sectionLabel,
    items: navItems.filter(item => item.section === sectionId)
  }));

  return (
    <div className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">B</div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">Bizware</div>
          <div className="sidebar-brand-subtitle">Analytics Portal</div>
        </div>
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <SettingsIcon size={16} color="var(--color-gray-400)" />
          <span style={{ color: 'var(--color-gray-600)', fontWeight: 600 }}>Settings</span>
        </div>
        <div style={{ color: 'var(--color-gray-400)' }}>
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}
