import React from 'react';
import {
  DatabaseIcon,
  SyncIcon,
  ChartIcon,
  ActivityIcon,
  UsersIcon,
  XIcon
} from './Icons';

export default function Sidebar({ activeView, onViewChange, user, isOpen, onClose }) {
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
      id: 'chatbot',
      label: 'AI Assistant',
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

  const handleNavClick = (id) => {
    onViewChange(id);
    if (onClose) onClose();
  };

  return (
    <div className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <img
          src={process.env.PUBLIC_URL + '/logo.png'}
          alt="Apothecon - Caring For Humanity"
          className="sidebar-logo-img"
        />
        <button className="sidebar-close-btn" onClick={onClose}>
          <XIcon size={20} />
        </button>
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
                onClick={() => handleNavClick(item.id)}
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
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {user.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">
                {user.full_name}
              </div>
              <div className="sidebar-user-role">
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
