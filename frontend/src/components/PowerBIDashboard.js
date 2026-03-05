import React, { useState } from 'react';
import { ChartIcon, RefreshIcon } from './Icons';

export default function PowerBIDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const baseEmbedUrl = process.env.REACT_APP_POWERBI_EMBED_URL;

  const embedUrl = baseEmbedUrl
    ? `${baseEmbedUrl}${baseEmbedUrl.includes('?') ? '&' : '?'}t=${refreshKey}&nocache=${Date.now()}`
    : null;

  if (!embedUrl) {
    return (
      <div>
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--color-gray-900)',
            marginBottom: 'var(--spacing-sm)',
            letterSpacing: '-0.025em'
          }}>
            Analytics
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-gray-600)'
          }}>
            Interactive Power BI reports and visualizations
          </p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
          <ChartIcon size={64} color="var(--color-gray-300)" style={{ margin: '0 auto var(--spacing-xl)' }} />
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--color-gray-700)',
            marginBottom: 'var(--spacing-md)'
          }}>
            Power BI Dashboard Not Configured
          </h3>
          <p style={{
            fontSize: '14px',
            maxWidth: '500px',
            margin: '0 auto',
            color: 'var(--color-gray-600)',
            lineHeight: '1.6'
          }}>
            Configure <code style={{
              background: 'var(--color-gray-100)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-primary-600)'
            }}>REACT_APP_POWERBI_EMBED_URL</code> in your environment to embed the Power BI dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--color-gray-900)',
          marginBottom: 'var(--spacing-sm)',
          letterSpacing: '-0.025em'
        }}>
          Analytics
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-gray-600)'
        }}>
          Interactive Power BI reports and visualizations
        </p>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div className="card-header" style={{ padding: 'var(--spacing-lg) var(--spacing-xl)' }}>
          <h2 className="card-title">
            <ChartIcon size={20} />
            Power BI Dashboard
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-gray-600)' }}>
                <span className="spinner spinner-primary" />
                Loading dashboard...
              </div>
            )}
            <button
              onClick={() => {
                setLoading(true);
                setRefreshKey(Date.now());
              }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshIcon size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'var(--color-primary-600)',
              animation: 'shimmer 1.5s infinite',
              zIndex: 10
            }} />
          )}
          <iframe
            key={refreshKey}
            title="Bizware Power BI Dashboard"
            src={embedUrl}
            onLoad={() => setLoading(false)}
            style={{
              width: '100%',
              height: '800px',
              border: 'none',
              display: 'block',
              background: 'var(--color-gray-50)'
            }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
