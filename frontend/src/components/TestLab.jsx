import React, { useState } from 'react';
import {
  Play,
  Zap,
  CheckCircle2,
  XCircle,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';

export default function TestLab({
  testReport,
  onGenerateTests,
  onRunTests,
  isLoading,
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PASSED, FAILED
  const [expandedTraces, setExpandedTraces] = useState({});

  const toggleTrace = (testId) => {
    setExpandedTraces((prev) => ({
      ...prev,
      [testId]: !prev[testId],
    }));
  };

  const results = testReport?.results || [];

  const categories = ['ALL', ...new Set(results.map((r) => r.test_case.category))];

  const filteredResults = results.filter((r) => {
    const matchesCat = selectedCategory === 'ALL' || r.test_case.category === selectedCategory;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PASSED' && r.passed) ||
      (statusFilter === 'FAILED' && !r.passed);
    return matchesCat && matchesStatus;
  });

  const total = testReport?.total_tests || 0;
  const passed = testReport?.passed_tests || 0;
  const failed = testReport?.failed_tests || 0;
  const passRate = testReport?.pass_rate_percentage || 0;

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Automated Test Lab</h1>
          <p className="page-subtitle">
            Dynamically generate and execute comprehensive test suites directly derived from active gateway policies
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={onGenerateTests}
            disabled={isLoading}
          >
            <Sparkles size={16} /> Re-Generate Test Cases
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onRunTests()}
            disabled={isLoading}
          >
            <Zap size={16} /> {isLoading ? 'Executing Suite...' : 'Run All Test Cases'}
          </button>
        </div>
      </div>

      {/* Educational Notice */}
      <div className="notice-box notice-info">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
        <div>
          <strong>Dynamic Test Derivation:</strong> Test cases are not hard-coded. They are derived from the active
          policy matrix covering authorized RBAC paths, boundary rate-limits (limit vs limit+1), method enforcement,
          and unmapped routes.
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-header">
            <span>TOTAL TEST CASES</span>
            <Layers size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div className="metric-value">{total}</div>
          <div className="metric-footer">Generated from active policies</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>PASSED TESTS</span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="metric-value" style={{ color: '#10b981' }}>
            {passed}
          </div>
          <div className="metric-footer">Matches specification rules</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>FAILED / REGRESSED</span>
            <XCircle size={18} style={{ color: failed > 0 ? '#f43f5e' : '#10b981' }} />
          </div>
          <div className="metric-value" style={{ color: failed > 0 ? '#f43f5e' : '#10b981' }}>
            {failed}
          </div>
          <div className="metric-footer">Mismatches or shadowed rules</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>SUITE PASS RATE</span>
            <Zap size={18} style={{ color: passRate === 100 ? '#10b981' : '#f59e0b' }} />
          </div>
          <div
            className="metric-value"
            style={{ color: passRate === 100 ? '#10b981' : '#f59e0b' }}
          >
            {passRate.toFixed(1)}%
          </div>
          <div className="metric-footer">
            {testReport?.timestamp ? `Run: ${new Date(testReport.timestamp).toLocaleTimeString()}` : 'Never executed'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Category:</span>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Outcome:</span>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Outcomes</option>
              <option value="PASSED">Passed Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#94a3b8' }}>
            Showing {filteredResults.length} of {total} test cases
          </div>
        </div>
      </div>

      {/* Test Execution List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            Test Execution Results
          </h3>
        </div>

        {filteredResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <Layers size={42} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>No Test Results</div>
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Click "Run All Test Cases" above to execute tests against active policies.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredResults.map((r) => {
              const tc = r.test_case;
              const isExpanded = !!expandedTraces[tc.test_id];

              return (
                <div
                  key={tc.test_id}
                  style={{
                    background: r.passed ? 'rgba(16, 185, 129, 0.04)' : 'rgba(244, 63, 94, 0.06)',
                    border: `1px solid ${
                      r.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.35)'
                    }`,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  {/* Top Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${r.passed ? 'badge-allow' : 'badge-block'}`}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                      <span className="badge badge-info mono" style={{ fontSize: '0.7rem' }}>
                        {tc.category}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: '#fff' }}>{tc.name}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {tc.test_id}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleTrace(tc.test_id)}
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Trace
                      </button>
                    </div>
                  </div>

                  {/* Test Details Grid */}
                  <div
                    className="grid-2"
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.82rem',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.75rem',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#94a3b8' }}>Request Input:</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                        <span className={`badge-method method-${tc.method}`}>{tc.method}</span>
                        <code className="mono" style={{ color: '#38bdf8' }}>
                          {tc.path}
                        </code>
                        <span className={`role-tag role-${tc.simulated_role.toLowerCase()}`}>
                          {tc.simulated_role}
                        </span>
                        <span className="mono" style={{ color: '#94a3b8' }}>
                          ({tc.simulated_request_count} req)
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8' }}>Decision Comparison:</div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '3px' }}>
                        <div>
                          Expected:{' '}
                          <span
                            className={`badge ${
                              tc.expected_decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {tc.expected_decision} ({tc.expected_status_code})
                          </span>
                        </div>
                        <div>
                          Actual:{' '}
                          <span
                            className={`badge ${
                              r.actual_decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {r.actual_decision} ({r.actual_status_code})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Failure reason if failed */}
                  {r.failure_reason && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#fda4af',
                        background: 'rgba(244, 63, 94, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                      }}
                    >
                      <strong>Failure Reason: </strong> {r.failure_reason}
                    </div>
                  )}

                  {/* Rationale */}
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
                    <strong>Expected Specification Rationale: </strong> {tc.rationale}
                  </div>

                  {/* Trace Expansion */}
                  {isExpanded && r.trace && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className="trace-pipeline">
                        {r.trace.map((step) => (
                          <div
                            key={step.step_number}
                            className={`trace-step status-${step.status}`}
                            style={{ padding: '0.6rem 0.8rem' }}
                          >
                            <div className="trace-icon" style={{ width: '22px', height: '22px', fontSize: '0.72rem' }}>
                              {step.step_number}
                            </div>
                            <div style={{ flex: 1, fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 600, color: '#fff' }}>
                                {step.step_name} ({step.status})
                              </div>
                              <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                                {step.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
