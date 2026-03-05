import React from 'react';

export default function Header() {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
      color: '#fff',
      padding: '20px 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Logo & Brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        animation: 'slideInLeft 0.5s ease-out'
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: '800',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          letterSpacing: '-0.5px'
        }}>
          B
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            fontSize: '13px',
            opacity: 0.85,
            fontWeight: '500',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}>
            Bizware
          </span>
          <div style={{
            width: '40px',
            height: '2px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
            borderRadius: '2px'
          }} />
        </div>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '24px',
        fontWeight: '700',
        letterSpacing: '-0.5px',
        background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'fadeIn 0.6s ease-out',
        textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        Analytics Dashboard
      </h1>

      {/* Date & Time */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
        animation: 'slideInRight 0.5s ease-out'
      }}>
        <div style={{
          fontSize: '13px',
          opacity: 0.95,
          fontWeight: '600',
          letterSpacing: '0.025em'
        }}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
        <div style={{
          fontSize: '11px',
          opacity: 0.7,
          fontWeight: '500',
          padding: '3px 10px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          {new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </header>
  );
}
