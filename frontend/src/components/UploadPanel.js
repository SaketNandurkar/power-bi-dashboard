import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';
import Stepper from './Stepper';
import { UploadIcon, FileIcon, CheckCircleIcon } from './Icons';

const REPORT_TYPES = [
  { value: 'accounts_payable', label: 'Accounts Payable' },
  { value: 'bank_report', label: 'Bank Report' },
  { value: 'budget_report', label: 'Budget Report' },
  { value: 'sales_register', label: 'Sales Register' }
];

export default function UploadPanel({ onNotify, onUploadComplete }) {
  const [reportType, setReportType] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const fileInputRef = useRef(null);

  const steps = ['Select Report', 'Choose File', 'Upload', 'Complete'];

  const handleReportTypeChange = (e) => {
    setReportType(e.target.value);
    if (e.target.value) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile && reportType) {
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reportType) {
      onNotify('Please select a report type', 'error');
      return;
    }
    if (!file) {
      onNotify('Please select a file', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const result = await uploadFile(file, reportType);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setCurrentStep(4);

      const reportLabel = REPORT_TYPES.find(r => r.value === reportType)?.label;
      onNotify(
        `${reportLabel} uploaded successfully. ${result.result?.rows_processed || ''} rows processed.`,
        'success'
      );

      setTimeout(() => {
        setFile(null);
        setReportType('');
        setUploadProgress(0);
        setCurrentStep(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onUploadComplete();
      }, 2000);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setCurrentStep(3);
      onNotify(err.message || 'Upload failed', 'error');
    } finally {
      setTimeout(() => setUploading(false), 1000);
    }
  };

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
          Upload Data
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-gray-600)'
        }}>
          Upload CSV or Excel files to update your reports
        </p>
      </div>

      {/* Upload Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <UploadIcon size={20} />
            File Upload
          </h2>
        </div>

        <div className="card-body">
          {/* Stepper */}
          <Stepper steps={steps} currentStep={currentStep} />

          {/* Upload Form */}
          <form onSubmit={handleSubmit} style={{ marginTop: 'var(--spacing-xl)' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--spacing-lg)',
              marginBottom: uploading ? 'var(--spacing-xl)' : '0'
            }}>
              {/* Report Type */}
              <div className="form-group">
                <label className="form-label">
                  <FileIcon size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Report Type
                </label>
                <select
                  className="form-select"
                  value={reportType}
                  onChange={handleReportTypeChange}
                  disabled={uploading}
                >
                  <option value="">Select report type...</option>
                  {REPORT_TYPES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* File Input */}
              <div className="form-group">
                <label className="form-label">
                  <UploadIcon size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Data File (CSV, XLSX)
                </label>
                <input
                  ref={fileInputRef}
                  className="form-input"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  disabled={uploading || !reportType}
                />
                {file && (
                  <div style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: '13px',
                    color: 'var(--color-gray-600)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <CheckCircleIcon size={14} color="var(--color-success)" />
                    <span>Selected: <strong>{file.name}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="progress-wrapper fade-in">
                <div className="progress-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="spinner spinner-primary" />
                    Processing file...
                  </span>
                  <span className="progress-percentage">{uploadProgress}%</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 'var(--spacing-xl)',
              paddingTop: 'var(--spacing-xl)',
              borderTop: '1px solid var(--color-gray-200)'
            }}>
              <button
                type="submit"
                disabled={uploading || !reportType || !file}
                className="btn btn-primary btn-lg"
              >
                {uploading ? (
                  <>
                    <span className="spinner" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon size={18} />
                    Upload File
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
