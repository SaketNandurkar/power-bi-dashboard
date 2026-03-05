import React, { useEffect } from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from './Icons';

export default function Notification({ message, type, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 6000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const configs = {
    success: {
      bg: 'var(--color-success-light)',
      border: 'var(--color-success)',
      text: '#065f46',
      icon: CheckCircleIcon
    },
    error: {
      bg: 'var(--color-error-light)',
      border: 'var(--color-error)',
      text: '#991b1b',
      icon: AlertCircleIcon
    },
    info: {
      bg: 'var(--color-info-light)',
      border: 'var(--color-info)',
      text: '#1e3a8a',
      icon: InfoIcon
    }
  };

  const config = configs[type] || configs.info;
  const Icon = config.icon;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: 'var(--spacing-xl)',
      width: '420px',
      maxWidth: 'calc(100vw - var(--spacing-xl) * 2)',
      zIndex: 1000,
      animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={{
        padding: 'var(--spacing-lg)',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderLeft: `4px solid ${config.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          flexShrink: 0,
          marginTop: '2px'
        }}>
          <Icon size={24} color={config.border} />
        </div>
        <div style={{
          flex: 1,
          fontSize: '14px',
          lineHeight: '1.5',
          color: config.text,
          fontWeight: 500
        }}>
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            transition: 'background var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <XIcon size={18} color={config.text} />
        </button>
      </div>
    </div>
  );
}
