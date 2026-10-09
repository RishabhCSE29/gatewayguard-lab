import React, { useState } from 'react';
import {
  Play,
  Shield,
  Server,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Code,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import ArchitectureFlow from './ArchitectureFlow';

const SAMPLE_PATHS = [
  { path: '/api/admin/system', role: 'Admin', method: 'GET', label: 'Admin System (Authorized)' },
  { path: '/api/admin/system', role: 'Student', method: 'GET', label: 'Admin System (Unauthorized Student 403)' },
  { path: '/api/student/profile', role: 'Student', method: 'GET', label: 'Student Profile (200 OK)' },
  { path: '/api/student/std_101/results', role: 'Student', method: 'GET', count: 1, label: 'Exam Results (Parametric)' },
  { path: '/api/student/std_101/results', role: 'Student', method: 'GET', count: 10, label: 'Exam Results (Rate Limit Exceeded 429)' },
  { path: '/api/public/courses', role: 'Public', method: 'GET', label: 'Public Courses (Open 200)' },
  { path: '/api/nonexistent/service', role: 'Public', method: 'GET', label: 'Unknown Route (404 Not Found)' },
];

export default function RequestSimulator({ policies, onSimulate, simulationResult, isSimulating }) {
  const [formData, setFormData] = useState({
    path: '/api/admin/system',
    method: 'GET',
    simulated_role: 'Admin',
    simulated_request_count: 1,
    time_window_seconds: null,
  });

  const [showRawJson, setShowRawJson] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSimulate(formData);
  };

  const handleApplyPreset = (preset) => {
    const updated = {
      path: preset.path,
      method: preset.method || 'GET',
      simulated_role: preset.role,
      simulated_request_count: preset.count || 1,
      time_window_seconds: null,
    };
    setFormData(updated);
    onSimulate(updated);
  };

  // Find policy matching result
  const matchedPolicy = policies.find((p) => p.id === simulationResult?.selected_policy_id);

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Interactive Request Simulator</h1>
          <p className="page-subtitle">
            Execute real-time request simulations to evaluate route matching, authorization, and rate limits
          </p>
        </div>
      </div>

      {/* Educational Notice */}
      <div className="notice-box notice-info">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
        <div>
          <strong>Role Simulation Semantics:</strong> The selected simulated role instructs the engine to
          evaluate policies as if an authenticated client presented those claims. This simulates gateway RBAC
          segregation without requiring real JWT or OAuth2 cryptographic verification.
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <Sparkles size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
            Quick Scenario Presets:
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SAMPLE_PATHS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyPreset(preset)}
              style={{ fontSize: '0.78rem' }}
            >
              <span className={`role-tag role-${preset.role.toLowerCase()}`} style={{ padding: '1px 5px' }}>
                {preset.role}
              </span>
              <span className="mono">{preset.path}</span>
              <span style={{ color: '#94a3b8' }}>({preset.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Simulator Form + Results Grid */}
      <div className="grid-2">
        {/* Left: Input Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Play size={18} style={{ color: '#38bdf8' }} />
              Simulated Request Parameters
            </h3>
            <span className="badge badge-info">Input Config</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">HTTP Method</label>
                <select
                  className="form-select"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Simulated Role Identity</label>
                <select
                  className="form-select"
                  value={formData.simulated_role}
                  onChange={(e) => setFormData({ ...formData, simulated_role: e.target.value })}
                >
                  <option value="Admin">Admin (Full Administrative Access)</option>
                  <option value="Student">Student (Student Portal Access)</option>
                  <option value="Public">Public (Anonymous / External Access)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Request URL Path</label>
              <input
                type="text"
                className="form-input mono"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/api/student/profile"
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="form-label">Simulated Request Count within Time Window</label>
                <span className="mono" style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {formData.simulated_request_count} req
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={formData.simulated_request_count}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    simulated_request_count: parseInt(e.target.value, 10) || 1,
                  })
                }
                style={{ width: '100%', marginTop: '6px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>1 (Single Request)</span>
                <span>30 (Moderate Load)</span>
                <span>60 (Spike / Burst)</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
                disabled={isSimulating}
              >
                <Play size={18} />
                {isSimulating ? 'Executing Policy Simulation...' : 'Execute Policy Simulation'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Simulation Output & Trace */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={18} style={{ color: '#38bdf8' }} />
              Gateway Decision &amp; Analysis
            </h3>
            {simulationResult && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRawJson(!showRawJson)}
              >
                <Code size={14} /> {showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}
              </button>
            )}
          </div>

          {!simulationResult ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Play size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.4 }} />
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>Ready for Simulation</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                Select parameters or click a scenario preset on the left to evaluate gateway policies.
              </div>
            </div>
          ) : (
            <div>
              {/* Hero Decision Banner */}
              <div
                className={`hero-decision-banner ${
                  simulationResult.decision === 'ALLOW' ? 'decision-allow' : 'decision-block'
                }`}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {simulationResult.decision === 'ALLOW' ? (
                      <CheckCircle size={28} style={{ color: '#10b981' }} />
                    ) : (
                      <XCircle size={28} style={{ color: '#f43f5e' }} />
                    )}
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      {simulationResult.decision}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
                    {simulationResult.summary}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    className={`badge ${
                      simulationResult.decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                    }`}
                    style={{ fontSize: '0.9rem', padding: '4px 10px' }}
                  >
                    HTTP {simulationResult.status_code}
                  </span>
                  {simulationResult.destination_service && (
                    <div className="mono" style={{ fontSize: '0.75rem', marginTop: '6px', color: '#cbd5e1' }}>
                      &rarr; {simulationResult.destination_service}
                    </div>
                  )}
                </div>
              </div>

              {/* Rate Limit Gauge (if applicable) */}
              {simulationResult.rate_limit_info && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Rate Limit Simulation Quota:</span>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {simulationResult.rate_limit_info.simulated_request_count} / {simulationResult.rate_limit_info.configured_limit} req ({simulationResult.rate_limit_info.time_window_seconds}s)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(
                          100,
                          (simulationResult.rate_limit_info.simulated_request_count /
                            simulationResult.rate_limit_info.configured_limit) *
                            100
                        )}%`,
                        background:
                          simulationResult.rate_limit_info.simulated_request_count >
                          simulationResult.rate_limit_info.configured_limit
                            ? '#f43f5e'
                            : '#10b981',
                        transition: 'width 0.3s ease',
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Raw JSON Accordion */}
              {showRawJson && (
                <pre
                  className="mono"
                  style={{
                    background: '#090d16',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                    border: '1px solid var(--border-mid)',
                    marginBottom: '1rem',
                    color: '#38bdf8',
                  }}
                >
                  {JSON.stringify(simulationResult, null, 2)}
                </pre>
              )}

              {/* Ordered Step-by-Step Decision Trace */}
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem', color: '#cbd5e1' }}>
                  Ordered Evaluation Pipeline Trace:
                </div>
                <div className="trace-pipeline">
                  {simulationResult.trace.map((step) => (
                    <div key={step.step_number} className={`trace-step status-${step.status}`}>
                      <div className="trace-icon">{step.step_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                            {step.step_name}
                          </span>
                          <span
                            className={`badge ${
                              step.status === 'PASS' ? 'badge-allow' : 'badge-block'
                            }`}
                            style={{ fontSize: '0.68rem' }}
                          >
                            {step.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '3px' }}>
                          {step.message}
                        </div>
                        {Object.keys(step.details || {}).length > 0 && (
                          <div
                            className="mono"
                            style={{
                              fontSize: '0.72rem',
                              color: '#94a3b8',
                              marginTop: '6px',
                              background: 'rgba(0,0,0,0.25)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {JSON.stringify(step.details)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual Request Pipeline */}
      <ArchitectureFlow
        activePolicy={matchedPolicy}
        isBlocked={simulationResult?.decision === 'BLOCK'}
      />
    </div>
  );
}
