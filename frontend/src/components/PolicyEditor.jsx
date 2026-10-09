import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Search,
  Sliders,
  Shield,
  Layers,
  X
} from 'lucide-react';

const ALL_ROLES = ['Admin', 'Student', 'Public'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'];

export default function PolicyEditor({
  policies,
  onSavePolicies,
  onResetPolicies,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterMethod, setFilterMethod] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    path_pattern: '',
    method: 'GET',
    allowed_roles: ['Admin'],
    destination_service: '',
    request_limit: 10,
    time_window_seconds: 60,
    enabled: true,
    priority: 20,
    description: '',
  });
  const [formError, setFormError] = useState('');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.path_pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.destination_service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      filterRole === 'ALL' || p.allowed_roles.includes(filterRole);

    const matchesMethod =
      filterMethod === 'ALL' || p.method === filterMethod || p.method === 'ANY';

    return matchesSearch && matchesRole && matchesMethod;
  });

  const handleOpenAdd = () => {
    setEditingPolicy(null);
    setFormData({
      id: `pol_custom_${Date.now().toString().slice(-4)}`,
      name: '',
      path_pattern: '/api/',
      method: 'GET',
      allowed_roles: ['Student', 'Admin'],
      destination_service: 'custom-service',
      request_limit: 15,
      time_window_seconds: 60,
      enabled: true,
      priority: 25,
      description: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData({ ...policy });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleToggleEnable = async (policyId) => {
    const updated = policies.map((p) =>
      p.id === policyId ? { ...p, enabled: !p.enabled } : p
    );
    await onSavePolicies(updated);
  };

  const handleToggleRole = (role) => {
    const current = [...formData.allowed_roles];
    if (current.includes(role)) {
      if (current.length === 1) {
        setFormError('At least one role must be allowed for the policy.');
        return;
      }
      setFormData({ ...formData, allowed_roles: current.filter((r) => r !== role) });
    } else {
      setFormData({ ...formData, allowed_roles: [...current, role] });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!formData.id.trim()) {
      setFormError('Policy ID is required.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('Policy Name is required.');
      return;
    }
    if (!formData.path_pattern.trim().startsWith('/')) {
      setFormError('Path pattern must begin with a forward slash (e.g. /api/users).');
      return;
    }
    if (formData.path_pattern.includes(' ')) {
      setFormError('Path pattern cannot contain spaces.');
      return;
    }
    if (formData.allowed_roles.length === 0) {
      setFormError('Select at least one allowed role.');
      return;
    }
    if (!formData.destination_service.trim()) {
      setFormError('Destination microservice name is required.');
      return;
    }
    if (formData.request_limit <= 0) {
      setFormError('Request limit must be a positive integer.');
      return;
    }
    if (formData.time_window_seconds <= 0) {
      setFormError('Time window must be a positive integer.');
      return;
    }

    let updatedList;
    if (editingPolicy) {
      updatedList = policies.map((p) => (p.id === editingPolicy.id ? formData : p));
    } else {
      // Check duplicate ID
      if (policies.some((p) => p.id === formData.id)) {
        setFormError(`Policy ID '${formData.id}' already exists. Please choose a unique ID.`);
        return;
      }
      updatedList = [...policies, formData];
    }

    try {
      await onSavePolicies(updatedList);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save policy.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const updated = policies.filter((p) => p.id !== deleteTarget.id);
    await onSavePolicies(updated);
    setDeleteTarget(null);
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">API Gateway Policy Editor</h1>
          <p className="page-subtitle">
            Define deterministic routing rules, RBAC role permissions, and rate-limiting thresholds
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-warning"
            onClick={() => onResetPolicies('misconfigured')}
            disabled={isLoading}
            title="Loads scenario with shadowing and ambiguous conflicts for demo"
          >
            <AlertTriangle size={16} /> Load Misconfigured Demo Scenario
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onResetPolicies('safe')}
            disabled={isLoading}
            title="Restores standard verified zero-conflict policies"
          >
            <RotateCcw size={16} /> Reset to Safe Defaults
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add New Policy
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search policies by name, path pattern, ID or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Role:</span>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Student">Student</option>
              <option value="Public">Public</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Method:</span>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
            >
              <option value="ALL">All Methods</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Policies Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Sliders size={18} style={{ color: '#38bdf8' }} />
            Configured Policies ({filteredPolicies.length} of {policies.length})
          </h3>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Precedence Order: Exact &gt; Parametric &gt; Wildcard &gt; Priority (Ascending)
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Active</th>
                <th>Priority</th>
                <th>Method</th>
                <th>Path Pattern</th>
                <th>Policy Name / ID</th>
                <th>Allowed Roles</th>
                <th>Target Microservice</th>
                <th>Rate Limit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No policies found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((p) => (
                  <tr key={p.id} style={{ opacity: p.enabled ? 1 : 0.6 }}>
                    {/* Active Toggle */}
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={() => handleToggleEnable(p.id)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>

                    {/* Priority */}
                    <td>
                      <span className="badge badge-info mono" style={{ fontSize: '0.78rem' }}>
                        Prio {p.priority}
                      </span>
                    </td>

                    {/* Method */}
                    <td>
                      <span className={`badge-method method-${p.method}`}>{p.method}</span>
                    </td>

                    {/* Path Pattern */}
                    <td>
                      <code className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                        {p.path_pattern}
                      </code>
                    </td>

                    {/* Name & ID */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {p.id}
                      </div>
                    </td>

                    {/* Roles */}
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {p.allowed_roles.map((r) => (
                          <span key={r} className={`role-tag role-${r.toLowerCase()}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Destination Service */}
                    <td>
                      <span
                        className="mono"
                        style={{ fontSize: '0.8rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}
                      >
                        {p.destination_service}
                      </span>
                    </td>

                    {/* Rate Limit */}
                    <td>
                      <span className="mono" style={{ fontSize: '0.82rem' }}>
                        {p.request_limit} req / {p.time_window_seconds}s
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Policy"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon"
                          onClick={() => setDeleteTarget(p)}
                          title="Delete Policy"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Policy Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="card-title">
                <Sliders size={18} style={{ color: '#38bdf8' }} />
                {editingPolicy ? `Edit Policy: ${editingPolicy.name}` : 'Create New Policy'}
              </h3>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="notice-box notice-danger" style={{ marginBottom: '1rem' }}>
                    <AlertTriangle size={18} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Policy ID (Unique)</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      disabled={!!editingPolicy}
                      placeholder="pol_admin_custom"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Policy Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Admin Billing Service"
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Path Pattern</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={formData.path_pattern}
                      onChange={(e) => setFormData({ ...formData, path_pattern: e.target.value })}
                      placeholder="/api/admin/billing/*"
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Exact (/api/test), Parametric (/api/{'{id}'}), or Wildcard (/api/*)
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">HTTP Method</label>
                    <select
                      className="form-select"
                      value={formData.method}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Allowed Roles (RBAC Matrix)</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '4px' }}>
                    {ALL_ROLES.map((role) => (
                      <label
                        key={role}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: formData.allowed_roles.includes(role)
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${
                            formData.allowed_roles.includes(role) ? '#38bdf8' : '#334155'
                          }`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.allowed_roles.includes(role)}
                          onChange={() => handleToggleRole(role)}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Destination Microservice</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={formData.destination_service}
                      onChange={(e) => setFormData({ ...formData, destination_service: e.target.value })}
                      placeholder="billing-service"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority (Lower number = Higher precedence)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      min="1"
                      max="1000"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 10 })}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Request Limit (Max per window)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      min="1"
                      value={formData.request_limit}
                      onChange={(e) => setFormData({ ...formData, request_limit: parseInt(e.target.value, 10) || 1 })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Time Window (Seconds)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      min="1"
                      value={formData.time_window_seconds}
                      onChange={(e) => setFormData({ ...formData, time_window_seconds: parseInt(e.target.value, 10) || 1 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description &amp; Purpose</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide documentation about this policy's purpose..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {editingPolicy ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="card-title" style={{ color: '#f43f5e' }}>
                <Trash2 size={18} /> Confirm Policy Deletion
              </h3>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                Are you sure you want to permanently delete policy{' '}
                <strong>'{deleteTarget.name}'</strong> (<code>{deleteTarget.id}</code>)?
              </p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>
                Requests matching this route pattern will no longer be routed to{' '}
                <code>{deleteTarget.destination_service}</code>.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
