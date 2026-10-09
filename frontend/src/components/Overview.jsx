import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Play,
  ArrowUpRight,
  Info,
  Server,
  Zap
} from 'lucide-react';
import ArchitectureFlow from './ArchitectureFlow';

export default function Overview({
  policies,
  conflicts,
  testReport,
  onNavigate,
  onRunQuickSim,
  quickSimResult,
  isSimulating,
}) {
  const [quickPath, setQuickPath] = useState('/api/admin/system');
  const [quickRole, setQuickRole] = useState('Admin');
  const [quickCount, setQuickCount] = useState(1);

  const totalPolicies = policies.length;
  const enabledCount = policies.filter((p) => p.enabled).length;
  const disabledCount = totalPolicies - enabledCount;
  const totalConflicts = conflicts ? conflicts.total_conflicts : 0;
  const passRate = testReport ? testReport.pass_rate_percentage : 100.0;

  const handleSimSubmit = (e) => {
    e.preventDefault();
    onRunQuickSim({
      path: quickPath,
      method: 'GET',
      simulated_role: quickRole,
      simulated_request_count: parseInt(quickCount, 10) || 1,
    });
  };

  return (
    <div className="page-body">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview Dashboard</h1>
          <p className="page-subtitle">
            Local Educational API Gateway Policy Testing Simulator &amp; Conflict Analyzer
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('simulator')}>
            <Play size={16} /> Open Request Simulator
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('tests')}>
            <Zap size={16} /> Run Full Test Suite
          </button>
        </div>
      </div>

      {/* Educational Notice Banner */}
      <div className="notice-box notice-info">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
        <div>
          <strong>Educational Policy Simulator Notice:</strong> This environment simulates API Gateway
          request routing, RBAC authorization matrices, and rate limits in a local deterministic engine.
          Simulated roles (Admin, Student, Public) represent test assertions, not cryptographic credentials.
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-header">
            <span>ACTIVE POLICIES</span>
            <FileCode size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div className="metric-value">{totalPolicies}</div>
          <div className="metric-footer">
            {enabledCount} enabled • {disabledCount} disabled
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>CONFLICT FINDINGS</span>
            <AlertTriangle size={18} style={{ color: totalConflicts > 0 ? '#f43f5e' : '#10b981' }} />
          </div>
          <div
            className="metric-value"
            style={{ color: totalConflicts > 0 ? '#f43f5e' : '#10b981' }}
          >
            {totalConflicts}
          </div>
          <div className="metric-footer">
            {conflicts?.error_count || 0} critical errors • {conflicts?.warning_count || 0} warnings
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>AUTOMATED TEST PASS RATE</span>
            <CheckCircle2 size={18} style={{ color: passRate === 100 ? '#10b981' : '#f59e0b' }} />
          </div>
          <div
            className="metric-value"
            style={{ color: passRate === 100 ? '#10b981' : '#f59e0b' }}
          >
            {passRate.toFixed(1)}%
          </div>
          <div className="metric-footer">
            {testReport ? `${testReport.passed_tests} passed of ${testReport.total_tests} tests` : 'Ready to execute'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>ENGINE STATUS</span>
            <Server size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem', color: '#10b981' }}>
            ONLINE
          </div>
          <div className="metric-footer">FastAPI Deterministic Engine</div>
        </div>
      </div>

      {/* Architecture Flow Diagram */}
      <ArchitectureFlow />

      {/* Two Column Section: Quick Simulator + Conflict Overview */}
      <div className="grid-2">
        {/* Quick Simulator Widget */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Play size={18} style={{ color: '#38bdf8' }} /> Quick Request Simulator
            </h3>
            <span className="badge badge-info">Live Evaluation</span>
          </div>

          <form onSubmit={handleSimSubmit}>
            <div className="grid-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Path</label>
                <input
                  type="text"
                  className="form-input mono"
                  value={quickPath}
                  onChange={(e) => setQuickPath(e.target.value)}
                  placeholder="/api/admin/system"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Simulated Role</label>
                <select
                  className="form-select"
                  value={quickRole}
                  onChange={(e) => setQuickRole(e.target.value)}
                >
                  <option value="Admin">Admin</option>
                  <option value="Student">Student</option>
                  <option value="Public">Public</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">
                Simulated Request Count (within window): <strong>{quickCount}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={quickCount}
                onChange={(e) => setQuickCount(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSimulating}>
              <Play size={16} /> {isSimulating ? 'Simulating...' : 'Simulate Request Now'}
            </button>
          </form>

          {quickSimResult && (
            <div style={{ marginTop: '1.25rem' }}>
              <div
                className={`hero-decision-banner ${
                  quickSimResult.decision === 'ALLOW' ? 'decision-allow' : 'decision-block'
                }`}
                style={{ padding: '1rem', marginBottom: '0.75rem' }}
              >
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    {quickSimResult.decision} ({quickSimResult.status_code})
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    {quickSimResult.selected_policy_name
                      ? `Policy: ${quickSimResult.selected_policy_name}`
                      : 'No Matching Policy'}
                  </div>
                </div>
                <span
                  className={`badge ${
                    quickSimResult.decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                  }`}
                >
                  HTTP {quickSimResult.status_code}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {quickSimResult.summary}
              </div>
            </div>
          )}
        </div>

        {/* Conflicts Summary Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <AlertTriangle size={18} style={{ color: totalConflicts > 0 ? '#f43f5e' : '#10b981' }} />
              Active Policy Conflict Findings
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('conflicts')}>
              View All <ArrowUpRight size={14} />
            </button>
          </div>

          {totalConflicts === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#10b981' }}>
              <CheckCircle2 size={42} style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>No Policy Conflicts Detected</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                All routes have deterministic precedence and safe authorization segregation.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {conflicts.findings.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: '0.85rem',
                    background: 'rgba(244, 63, 94, 0.06)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-block" style={{ fontSize: '0.7rem' }}>
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{f.conflict_type}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: '6px', color: '#fff' }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '4px' }}>
                    {f.suggested_fix}
                  </div>
                </div>
              ))}
              {conflicts.findings.length > 3 && (
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                  + {conflicts.findings.length - 3} more finding(s) in Conflict Detection Lab
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
