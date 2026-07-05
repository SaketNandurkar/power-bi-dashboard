import React, { useState, useEffect } from 'react';
import { fetchSapSettings, updateSapSettings } from '../services/api';

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
        password: '', // Don't show masked password
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
    if (name === 'password') {
      setPasswordChanged(true);
    }
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
      // Build update payload
      const payload = {
        username: formData.username,
        baseUrl: formData.baseUrl,
        mockMode: formData.mockMode,
        syncEnabled: formData.syncEnabled
      };

      // Only include password if it was changed
      if (passwordChanged && formData.password.trim()) {
        payload.password = formData.password;
      }

      await updateSapSettings(payload);
      setSuccess('Settings updated successfully. Changes will take effect on the next SAP sync.');
      setPasswordChanged(false);

      // Clear password field after successful update
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">SAP Integration Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure SAP OData connection credentials and sync options
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              SAP Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., BIPL_FICO"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              SAP Password {!passwordChanged && <span className="text-xs text-gray-500">(leave empty to keep current)</span>}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={passwordChanged ? "Enter new password" : "••••••••"}
            />
            {passwordChanged && (
              <p className="text-xs text-orange-600 mt-1">
                Password will be updated. Make sure it matches your SAP system.
              </p>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
              SAP OData Base URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="baseUrl"
              name="baseUrl"
              value={formData.baseUrl}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://10.10.2.212:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV"
            />
          </div>

          {/* Mock Mode */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="mockMode"
                name="mockMode"
                checked={formData.mockMode}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="mockMode" className="text-sm font-medium text-gray-700">
                Mock Mode
              </label>
              <p className="text-xs text-gray-500">Use sample XML files instead of calling real SAP API (for testing)</p>
            </div>
          </div>

          {/* Sync Enabled */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="syncEnabled"
                name="syncEnabled"
                checked={formData.syncEnabled}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="syncEnabled" className="text-sm font-medium text-gray-700">
                Automatic Sync Enabled
              </label>
              <p className="text-xs text-gray-500">Enable scheduled automatic synchronization with SAP</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-gray-500">
              Changes take effect on next sync. No service restart required.
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
