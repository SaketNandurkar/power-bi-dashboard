import React, { useState, useEffect, useCallback, useRef } from 'react';
import { triggerSapSync, fetchSapStatus, updateSapSchedule } from '../services/api';
import { SyncIcon, ClockIcon, SettingsIcon, ActivityIcon } from './Icons';

const REPORT_TYPES = [
  { value: '', label: 'All Reports' },
  { value: 'accounts_payable', label: 'Accounts Payable' },
  { value: 'bank_report', label: 'Bank Report' },
  { value: 'budget_report', label: 'Budget Report' },
  { value: 'sales_register', label: 'Sales Register' }
];

const SCHEDULE_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
  { value: 'custom', label: 'Custom...' }
];

function cronToLabel(cronExpr) {
  if (!cronExpr) return 'Not set';
  const preset = SCHEDULE_PRESETS.find(p => p.value === cronExpr);
  if (preset) return preset.label;
  return cronExpr;
}

export default function SapSyncPanel({ onNotify, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [reportType, setReportType] = useState('');
  const [sapStatus, setSapStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Schedule controls
  const [schedulePreset, setSchedulePreset] = useState('');
  const [customCron, setCustomCron] = useState('');
  const [updatingSchedule, setUpdatingSchedule] = useState(false);

  // Auto-sync notification tracking
  const prevLastSyncAtRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const loadSapStatus = useCallback(async () => {
    try {
      const data = await fetchSapStatus();
      setSapStatus(data);
      setSyncing(data.syncing || false);

      if (data.lastSyncAt && data.triggeredBy === 'scheduler') {
        if (isInitialLoadRef.current) {
          prevLastSyncAtRef.current = data.lastSyncAt;
          isInitialLoadRef.current = false;
        } else if (prevLastSyncAtRef.current && prevLastSyncAtRef.current !== data.lastSyncAt) {
          const time = new Date(data.lastSyncAt).toLocaleString('en-IN');
          let summary = '';
          if (data.results) {
            summary = ' — ' + Object.entries(data.results)
              .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val.rows_total || 0}`)
              .join(', ');
          }
          onNotify(`Auto-sync completed at ${time}${summary}`, 'info');
          onSyncComplete();
          prevLastSyncAtRef.current = data.lastSyncAt;
        } else {
          prevLastSyncAtRef.current = data.lastSyncAt;
        }
      } else if (data.lastSyncAt) {
        prevLastSyncAtRef.current = data.lastSyncAt;
        if (isInitialLoadRef.current) isInitialLoadRef.current = false;
      }
    } catch {
      // Silently fail
    }
  }, [onNotify, onSyncComplete]);

  useEffect(() => {
    loadSapStatus();
    const interval = setInterval(loadSapStatus, 10000);
    return () => clearInterval(interval);
  }, [loadSapStatus]);

  useEffect(() => {
    if (sapStatus?.scheduler?.cron && !schedulePreset) {
      const serverCron = sapStatus.scheduler.cron;
      const matchingPreset = SCHEDULE_PRESETS.find(p => p.value === serverCron);
      if (matchingPreset) {
        setSchedulePreset(serverCron);
      } else {
        setSchedulePreset('custom');
        setCustomCron(serverCron);
      }
    }
  }, [sapStatus, schedulePreset]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);

    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 500);

    try {
      await triggerSapSync(reportType || undefined);
      onNotify('SAP sync started successfully', 'success');

      const poll = setInterval(async () => {
        try {
          const data = await fetchSapStatus();
          setSapStatus(data);
          if (!data.syncing) {
            clearInterval(poll);
            clearInterval(progressInterval);
            setSyncProgress(100);
            setTimeout(() => {
              setSyncing(false);
              setSyncProgress(0);
            }, 1000);
            onSyncComplete();
            if (data.lastError) {
              onNotify(`SAP sync completed with errors: ${data.lastError}`, 'error');
            } else {
              onNotify('SAP sync completed successfully', 'success');
            }
          }
        } catch {
          clearInterval(poll);
          clearInterval(progressInterval);
          setSyncing(false);
          setSyncProgress(0);
        }
      }, 3000);
    } catch (err) {
      clearInterval(progressInterval);
      onNotify(err.message || 'SAP sync failed', 'error');
      setSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleUpdateSchedule = async () => {
    const cronExpr = schedulePreset === 'custom' ? customCron.trim() : schedulePreset;
    if (!cronExpr) {
      onNotify('Please select a schedule', 'error');
      return;
    }

    setUpdatingSchedule(true);
    try {
      await updateSapSchedule(cronExpr);
      onNotify(`Schedule updated to: ${cronToLabel(cronExpr)}`, 'success');
      loadSapStatus();
    } catch (err) {
      onNotify(err.message || 'Failed to update schedule', 'error');
    } finally {
      setUpdatingSchedule(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-IN');
  };

  const currentServerCron = sapStatus?.scheduler?.cron;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--color-gray-900)',
          marginBottom: 'var(--spacing-sm)',
          letterSpacing: '-0.025em'
        }}>
          SAP Data Synchronization
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-gray-600)'
        }}>
          Sync data from SAP production environment
        </p>
      </div>

      {/* Manual Sync Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card-header">
          <h2 className="card-title">
            <SyncIcon size={20} />
            Manual Synchronization
          </h2>
          {sapStatus?.mockMode && (
            <span className="badge badge-warning">MOCK MODE</span>
          )}
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--spacing-lg)', alignItems: 'end', marginBottom: syncing ? 'var(--spacing-xl)' : '0' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Report Type</label>
              <select
                className="form-select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                disabled={syncing}
              >
                {REPORT_TYPES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-success btn-lg"
            >
              {syncing ? (
                <>
                  <span className="spinner" />
                  Syncing...
                </>
              ) : (
                <>
                  <SyncIcon size={18} />
                  Sync Now
                </>
              )}
            </button>
          </div>

          {/* Sync Progress */}
          {syncing && (
            <div className="progress-wrapper fade-in">
              <div className="progress-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner spinner-primary" />
                  Synchronizing data from SAP...
                </span>
                <span className="progress-percentage">{syncProgress}%</span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Last Sync Info */}
        {sapStatus?.lastSyncAt && (
          <div className="card-footer">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-lg)',
              fontSize: '13px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ActivityIcon size={16} color="var(--color-gray-500)" />
                <span style={{ color: 'var(--color-gray-600)' }}>
                  Last sync: <strong style={{ color: 'var(--color-gray-900)' }}>{formatTime(sapStatus.lastSyncAt)}</strong>
                </span>
              </div>
              {sapStatus.triggeredBy && (
                <span className={sapStatus.triggeredBy === 'scheduler' ? 'badge badge-primary' : 'badge badge-gray'}>
                  {sapStatus.triggeredBy === 'scheduler' ? 'Automatic' : 'Manual'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Configuration Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <ClockIcon size={20} />
            Auto-Sync Schedule
          </h2>
          {currentServerCron && (
            <span className="badge badge-primary">
              Active: {cronToLabel(currentServerCron)}
            </span>
          )}
        </div>

        <div className="card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: schedulePreset === 'custom' ? '1fr 1fr auto' : '1fr auto',
            gap: 'var(--spacing-lg)',
            alignItems: 'end'
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <SettingsIcon size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Schedule Frequency
              </label>
              <select
                className="form-select"
                value={schedulePreset}
                onChange={(e) => {
                  setSchedulePreset(e.target.value);
                  if (e.target.value !== 'custom') setCustomCron('');
                }}
                disabled={updatingSchedule}
              >
                <option value="" disabled>Select schedule...</option>
                {SCHEDULE_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {schedulePreset === 'custom' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cron Expression</label>
                <input
                  type="text"
                  className="form-input"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="e.g. */10 * * * *"
                  disabled={updatingSchedule}
                />
              </div>
            )}

            <button
              onClick={handleUpdateSchedule}
              disabled={updatingSchedule || (!schedulePreset || (schedulePreset === 'custom' && !customCron.trim()))}
              className="btn btn-primary btn-lg"
            >
              {updatingSchedule ? (
                <>
                  <span className="spinner" />
                  Updating...
                </>
              ) : (
                <>
                  <SettingsIcon size={18} />
                  Update Schedule
                </>
              )}
            </button>
          </div>

          {sapStatus?.scheduler?.running && sapStatus?.nextSyncAt && (
            <div style={{
              marginTop: 'var(--spacing-lg)',
              padding: 'var(--spacing-md)',
              background: 'var(--color-info-light)',
              border: '1px solid var(--color-info)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--color-info)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ClockIcon size={16} />
              Next scheduled sync: {formatTime(sapStatus.nextSyncAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
