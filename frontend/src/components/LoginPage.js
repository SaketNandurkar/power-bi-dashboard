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
    </div>
  );
}
