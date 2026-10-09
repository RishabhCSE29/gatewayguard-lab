import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
  Wrench,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function ConflictLab({
  conflicts,
  onResetPolicies,
  onNavigate,
  isLoading,
}) {
  const totalFindings = conflicts?.total_conflicts || 0;
  const errorCount = conflicts?.error_count || 0;
  const warningCount = conflicts?.warning_count || 0;
  const verifiedCount = conflicts?.findings?.filter((f) => f.is_verified_issue).length || 0;

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Policy Conflict Detection Lab</h1>
          <p className="page-subtitle">
            Static analysis engine identifying shadowed routes, ambiguous precedence, and public exposure risks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-warning"
            onClick={() => onResetPolicies('misconfigured')}
            disabled={isLoading}
          >
            <AlertTriangle size={16} /> Load Misconfigured Demo Scenario
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onResetPolicies('safe')}
            disabled={isLoading}
          >
            <RotateCcw size={16} /> Apply Corrected Safe Defaults
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-header">
            <span>TOTAL FINDINGS</span>
            <AlertTriangle size={18} style={{ color: totalFindings > 0 ? '#f43f5e' : '#10b981' }} />
          </div>
          <div
            className="metric-value"
            style={{ color: totalFindings > 0 ? '#f43f5e' : '#10b981' }}
          >
            {totalFindings}
          </div>
          <div className="metric-footer">Analyzed across all active rules</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>CRITICAL ERRORS</span>
            <ShieldAlert size={18} style={{ color: errorCount > 0 ? '#f43f5e' : '#10b981' }} />
          </div>
          <div className="metric-value" style={{ color: errorCount > 0 ? '#f43f5e' : '#10b981' }}>
            {errorCount}
          </div>
          <div className="metric-footer">Shadowed routes &amp; duplicate ambiguity</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>POTENTIAL WARNINGS</span>
            <HelpCircle size={18} style={{ color: warningCount > 0 ? '#f59e0b' : '#10b981' }} />
          </div>
          <div className="metric-value" style={{ color: warningCount > 0 ? '#f59e0b' : '#10b981' }}>
            {warningCount}
          </div>
          <div className="metric-footer">Wildcard overlaps &amp; broad public scopes</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>VERIFIED ISSUES</span>
            <Wrench size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div className="metric-value" style={{ color: '#38bdf8' }}>
            {verifiedCount}
          </div>
          <div className="metric-footer">Confirmed configuration conflicts</div>
        </div>
      </div>

      {/* Findings List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <AlertTriangle size={18} style={{ color: totalFindings > 0 ? '#f43f5e' : '#10b981' }} />
            Static Analysis Conflict Findings
          </h3>
          <span className="badge badge-info">Deterministic Analyzer</span>
        </div>

        {totalFindings === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <ShieldCheck size={56} style={{ margin: '0 auto 1rem auto', color: '#10b981' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              Zero Configuration Conflicts Detected
            </div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '550px', margin: '8px auto 1.5rem auto' }}>
              All registered routes have distinct precedence, unambiguous tie-breaking, and proper role segregation.
            </div>
            <button
              className="btn btn-warning"
              onClick={() => onResetPolicies('misconfigured')}
              disabled={isLoading}
            >
              <Zap size={16} /> Load Misconfigured Demo Scenario to See Conflicts
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {conflicts.findings.map((f, idx) => (
              <div
                key={f.id || idx}
                style={{
                  background:
                    f.severity === 'ERROR'
                      ? 'linear-gradient(145deg, rgba(244, 63, 94, 0.08), rgba(244, 63, 94, 0.02))'
                      : 'linear-gradient(145deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))',
                  border: `1px solid ${
                    f.severity === 'ERROR' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'
                  }`,
                  borderRadius: '10px',
                  padding: '1.25rem',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className={`badge ${
                        f.severity === 'ERROR' ? 'badge-block' : 'badge-warn'
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="badge badge-info mono" style={{ fontSize: '0.72rem' }}>
                      {f.conflict_type}
                    </span>
                    {f.is_verified_issue ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(244,63,94,0.15)',
                          color: '#fda4af',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(244,63,94,0.3)',
                          fontWeight: 600,
                        }}
                      >
                        Verified Issue
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(245,158,11,0.15)',
                          color: '#fde68a',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(245,158,11,0.3)',
                          fontWeight: 600,
                        }}
                      >
                        Potential Warning
                      </span>
                    )}
                  </div>

                  <span className="mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ID: {f.id}
                  </span>
                </div>

                {/* Finding Title */}
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                  {f.title}
                </div>

                {/* Affected Policies */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Affected Policies:</span>
                  {f.affected_policy_names.map((name, i) => (
                    <span
                      key={i}
                      className="mono"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#cbd5e1',
                      }}
                    >
                      {name} ({f.affected_policy_ids[i]})
                    </span>
                  ))}
                </div>

                {/* Explanation */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    lineHeight: 1.45,
                    marginBottom: '0.85rem',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <strong style={{ color: '#fff' }}>Root Cause: </strong>
                  {f.explanation}
                </div>

                {/* Suggested Fix */}
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#bae6fd',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <Wrench size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
                  <div>
                    <strong style={{ color: '#fff' }}>Suggested Remediation: </strong>
                    {f.suggested_fix}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
