import React, { useState, useEffect, useCallback } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser } from '../services/api';
import { UsersIcon, XIcon } from './Icons';

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SALES_MANAGER', label: 'Sales Manager' },
  { value: 'ACCOUNTS_MANAGER', label: 'Accounts Manager' },
  { value: 'BANK_MANAGER', label: 'Bank Manager' },
  { value: 'CEO_CFO', label: 'CEO / CFO' }
];

const ROLE_DESCRIPTIONS = {
  ADMIN: 'Full access to all features',
  SALES_MANAGER: 'Sales dashboard only',
  ACCOUNTS_MANAGER: 'Accounts dashboard only',
  BANK_MANAGER: 'Bank dashboard only',
  CEO_CFO: 'All dashboards (no admin features)'
};

function formatRole(role) {
  const r = ROLES.find(r => r.value === role);
  return r ? r.label : role;
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', full_name: '', role: 'SALES_MANAGER', password: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const resetForm = () => {
    setFormData({ username: '', full_name: '', role: 'SALES_MANAGER', password: '' });
    setFormError('');
    setEditingUser(null);
    setShowForm(false);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (user) => {
    setFormData({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      password: ''
    });
    setEditingUser(user);
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingUser) {
        // Update
        const updates = { full_name: formData.full_name, role: formData.role };
        if (formData.password.trim()) updates.password = formData.password;
        await updateUser(editingUser.id, updates);
      } else {
        // Create
        if (!formData.username.trim() || !formData.full_name.trim() || !formData.password.trim()) {
          setFormError('All fields are required for new users');
          setFormLoading(false);
          return;
        }
        await createUser(formData);
      }
      resetForm();
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser.id) return;

    try {
      if (user.is_active) {
        await deleteUser(user.id);
      } else {
        await updateUser(user.id, { is_active: true });
      }
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="user-mgmt">
      <div className="user-mgmt-header">
        <div>
          <h1 className="user-mgmt-title">User Management</h1>
          <p className="user-mgmt-subtitle">Create and manage user accounts with role-based access</p>
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

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <div className="user-form-card">
          <div className="user-form-header">
            <h3>{editingUser ? `Edit: ${editingUser.username}` : 'Add New User'}</h3>
            <button
              onClick={resetForm}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 4 }}
            >
              <XIcon size={18} />
            </button>
          </div>
          <div className="user-form-body">
            {formError && <div className="user-form-error">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="user-form-grid">
                <div className="user-form-group">
                  <label className="user-form-label">Username</label>
                  <input
                    className="user-form-input"
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter username"
                    disabled={!!editingUser}
                    autoComplete="off"
                  />
                </div>
                <div className="user-form-group">
                  <label className="user-form-label">Full Name</label>
                  <input
                    className="user-form-input"
                    type="text"
                    value={formData.full_name}
                    onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name"
                    autoComplete="off"
                  />
                </div>
                <div className="user-form-group">
                  <label className="user-form-label">Role</label>
                  <select
                    className="user-form-select"
                    value={formData.role}
                    onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--color-gray-400)', marginTop: 3 }}>
                    {ROLE_DESCRIPTIONS[formData.role]}
                  </span>
                </div>
                <div className="user-form-group">
                  <label className="user-form-label">
                    Password {editingUser && <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave blank to keep current)</span>}
                  </label>
                  <input
                    className="user-form-input"
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="user-form-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={formLoading}>
                  {formLoading ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Users Table ── */}
      <div className="user-table-card">
        <div className="user-table-toolbar">
          <h3>
            <UsersIcon size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            All Users ({users.length})
          </h3>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={handleAddNew}>
              + Add User
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-gray-400)' }}>
            Loading users...
          </div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.username}</td>
                  <td>{user.full_name}</td>
                  <td>
                    <span className={`user-role-badge role-${user.role}`}>
                      {formatRole(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={user.is_active ? 'user-status-active' : 'user-status-inactive'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    }) : '-'}
                  </td>
                  <td>
                    <div className="user-actions">
                      <button
                        className="btn-sm-action"
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          className={`btn-sm-action ${user.is_active ? 'btn-sm-danger' : 'btn-sm-success'}`}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-gray-400)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
