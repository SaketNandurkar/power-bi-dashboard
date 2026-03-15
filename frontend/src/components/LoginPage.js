import React, { useState } from 'react';
import { UserIcon, LockIcon } from './Icons';
import { login } from '../services/api';
import { setAuth } from '../services/auth';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await login(username.trim(), password);
      setAuth(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left: Login Form */}
        <div className="login-card">
          <div className="login-header">
            <img
              src={process.env.PUBLIC_URL + '/logo.png'}
              alt="Apothecon"
              className="login-logo"
            />
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Sign in to Apothecon Analytics Dashboard</p>
          </div>

          <div className="login-body">
            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="login-form-group">
                <label className="login-label">Username</label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <UserIcon size={16} />
                  </span>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="login-form-group">
                <label className="login-label">Password</label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <LockIcon size={16} />
                  </span>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                <span className="login-btn-content">
                  {loading && <span className="login-spinner" />}
                  {loading ? 'Signing in...' : 'Sign In'}
                </span>
              </button>
            </form>
          </div>

          <div className="login-footer">
            Apothecon Lifesciences Ltd. &mdash; Enterprise Analytics Platform
          </div>
        </div>

        {/* Right: Illustration Panel */}
        <div className="login-illustration">
          <div className="login-illus-bg-shapes">
            <div className="login-illus-circle login-illus-circle-1" />
            <div className="login-illus-circle login-illus-circle-2" />
            <div className="login-illus-circle login-illus-circle-3" />
          </div>
          <div className="login-illus-content">
            {/* Analytics SVG Illustration */}
            <svg className="login-illus-svg" viewBox="0 0 200 140" fill="none">
              {/* Grid lines */}
              <line x1="30" y1="20" x2="30" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <line x1="30" y1="110" x2="180" y2="110" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="30" y1="80" x2="180" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
              <line x1="30" y1="50" x2="180" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />

              {/* Bar chart */}
              <rect x="45" y="65" width="16" height="45" rx="2" fill="rgba(255,255,255,0.5)" />
              <rect x="70" y="45" width="16" height="65" rx="2" fill="rgba(255,255,255,0.7)" />
              <rect x="95" y="55" width="16" height="55" rx="2" fill="rgba(255,255,255,0.5)" />
              <rect x="120" y="35" width="16" height="75" rx="2" fill="rgba(255,255,255,0.85)" />
              <rect x="145" y="50" width="16" height="60" rx="2" fill="rgba(255,255,255,0.6)" />

              {/* Trend line */}
              <polyline
                points="53,60 78,38 103,48 128,28 153,42"
                stroke="#60a5fa"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots on trend line */}
              <circle cx="53" cy="60" r="3.5" fill="#60a5fa" stroke="white" strokeWidth="1.5" />
              <circle cx="78" cy="38" r="3.5" fill="#60a5fa" stroke="white" strokeWidth="1.5" />
              <circle cx="103" cy="48" r="3.5" fill="#60a5fa" stroke="white" strokeWidth="1.5" />
              <circle cx="128" cy="28" r="3.5" fill="#60a5fa" stroke="white" strokeWidth="1.5" />
              <circle cx="153" cy="42" r="3.5" fill="#60a5fa" stroke="white" strokeWidth="1.5" />

              {/* Axis labels */}
              <text x="50" y="125" fill="rgba(255,255,255,0.5)" fontSize="7" textAnchor="middle">Q1</text>
              <text x="78" y="125" fill="rgba(255,255,255,0.5)" fontSize="7" textAnchor="middle">Q2</text>
              <text x="103" y="125" fill="rgba(255,255,255,0.5)" fontSize="7" textAnchor="middle">Q3</text>
              <text x="128" y="125" fill="rgba(255,255,255,0.5)" fontSize="7" textAnchor="middle">Q4</text>
              <text x="153" y="125" fill="rgba(255,255,255,0.5)" fontSize="7" textAnchor="middle">Q5</text>
            </svg>

            <h2 className="login-illus-title">Enterprise Analytics Platform</h2>
            <p className="login-illus-desc">
              Real-time insights powered by SAP integration
            </p>

            <div className="login-illus-features">
              <div className="login-illus-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Live SAP Data Synchronization</span>
              </div>
              <div className="login-illus-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Sales, Budget &amp; Bank Dashboards</span>
              </div>
              <div className="login-illus-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Accounts Payable Tracking</span>
              </div>
              <div className="login-illus-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Role-Based Access Control</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
