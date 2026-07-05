import React, { useState, useEffect } from 'react';
import { fetchSapSettings, updateSapSettings } from '../services/api';
import { SettingsIcon } from './Icons';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    baseUrl: '',
    mockMode: false,
    syncEnabled: true
  });
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSapSettings();
      setFormData({
        username: data.settings.username || '',
        password: '',
        baseUrl: data.settings.baseUrl || '',
        mockMode: data.settings.mockMode || false,
        syncEnabled: data.settings.syncEnabled !== false
      });
    } catch (err) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'password') setPasswordChanged(true);
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        username: formData.username,
        baseUrl: formData.baseUrl,
        mockMode: formData.mockMode,
        syncEnabled: formData.syncEnabled
      };
      if (passwordChanged && formData.password.trim()) {
        payload.password = formData.password;
      }

      await updateSapSettings(payload);
      setSuccess('Settings saved. Changes will take effect on the next SAP sync.');
      setPasswordChanged(false);
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-mgmt">
      <div className="user-mgmt-header">
        <div>
          <h1 className="user-mgmt-title">SAP Integration Settings</h1>
          <p className="user-mgmt-subtitle">Configure SAP OData connection credentials and sync options</p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--color-error-light)',
          color: 'var(--color-error)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-md)',
          fontSize: '13px',
          borderLeft: '3px solid var(--color-error)'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--color-success-light)',
          color: 'var(--color-success)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-md)',
          fontSize: '13px',
          borderLeft: '3px solid var(--color-success)'
        }}>
          {success}
        </div>
      )}

      <div className="user-form-card">
        <div className="user-form-header">
          <h3>
            <SettingsIcon size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            SAP OData Credentials
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-gray-400)' }}>
            Loading settings...
          </div>
        ) : (
          <div className="user-form-body">
            <form onSubmit={handleSubmit}>
              <div className="user-form-grid">

                <div className="user-form-group">
                  <label className="user-form-label">SAP Username *</label>
                  <input
                    className="user-form-input"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="e.g. BIPL_FICO"
                    autoComplete="off"
                  />
                </div>

                <div className="user-form-group">
                  <label className="user-form-label">
                    SAP Password{' '}
                    {!passwordChanged && (
                      <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave blank to keep current)</span>
                    )}
                  </label>
                  <input
                    className="user-form-input"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={passwordChanged ? 'Enter new password' : '••••••••'}
                    autoComplete="new-password"
                  />
                  {passwordChanged && (
                    <span style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: 3 }}>
                      Password will be updated — make sure it matches your SAP system
                    </span>
                  )}
                </div>

                <div className="user-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="user-form-label">SAP OData Base URL *</label>
                  <input
                    className="user-form-input"
                    type="text"
                    name="baseUrl"
                    value={formData.baseUrl}
                    onChange={handleChange}
                    required
                    placeholder="https://10.10.2.212:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV"
                    autoComplete="off"
                  />
                </div>

                <div className="user-form-group">
                  <label className="user-form-label">Mock Mode</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="mockMode"
                      checked={formData.mockMode}
                      onChange={handleChange}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary-600)' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--color-gray-600)' }}>
                      Use sample XML files instead of live SAP API (for testing)
                    </span>
                  </label>
                </div>

                <div className="user-form-group">
                  <label className="user-form-label">Automatic Sync</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="syncEnabled"
                      checked={formData.syncEnabled}
                      onChange={handleChange}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary-600)' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--color-gray-600)' }}>
                      Enable scheduled automatic synchronisation with SAP
                    </span>
                  </label>
                </div>

              </div>

              <div className="user-form-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadSettings} disabled={saving}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
