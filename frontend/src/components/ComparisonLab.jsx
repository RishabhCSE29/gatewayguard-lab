import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  BookmarkPlus,
  Trash2,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  Info,
  RotateCcw,
  Zap,
  X
} from 'lucide-react';

export default function ComparisonLab({
  snapshots,
  onSaveSnapshot,
  onDeleteSnapshot,
  onCompare,
  comparisonReport,
  isLoading,
}) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (snapshots && snapshots.length > 0 && !selectedSnapshotId) {
      setSelectedSnapshotId(snapshots[0].id);
    }
  }, [snapshots, selectedSnapshotId]);

  const handleOpenSaveModal = () => {
    setSnapshotName(`Baseline ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setSnapshotDesc('Active policy configuration snapshot before changes');
    setErrorMsg('');
    setIsSnapshotModalOpen(true);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!snapshotName.trim()) {
      setErrorMsg('Baseline snapshot name is required.');
      return;
    }
    try {
      await onSaveSnapshot(snapshotName, snapshotDesc);
      setIsSnapshotModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save baseline snapshot.');
    }
  };

  const handleRunComparison = () => {
    if (!selectedSnapshotId) return;
    onCompare(selectedSnapshotId);
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Before / After Regression Lab</h1>
          <p className="page-subtitle">
            Save baseline snapshots, apply policy changes, and run automated regression diffs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleOpenSaveModal}
            disabled={isLoading}
          >
            <BookmarkPlus size={16} /> Save Current as Baseline
          </button>
        </div>
      </div>

      {/* Educational Notice */}
      <div className="notice-box notice-info">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
        <div>
          <strong>Regression Verification:</strong> Compare how policy modifications affect existing client routes.
          The engine re-executes baseline test matrices against the current configuration to catch breaking authorization
          changes, route shadowing, and rate limit drops.
        </div>
      </div>

      {/* Snapshot Selector Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <GitCompare size={18} style={{ color: '#38bdf8' }} />
            Select Baseline Snapshot for Regression Diff
          </h3>
          <span className="badge badge-info">Stored Snapshots ({snapshots.length})</span>
        </div>

        {snapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
            <Layers size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>No Saved Baselines Found</div>
            <div style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: '1rem' }}>
              Save your current stable policy configuration to establish a baseline.
            </div>
            <button className="btn btn-primary" onClick={handleOpenSaveModal}>
              <BookmarkPlus size={16} /> Save First Baseline Snapshot
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <select
                className="form-select"
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
              >
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({new Date(s.timestamp).toLocaleString()}) — {s.policies.length} policies
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunComparison}
              disabled={isLoading || !selectedSnapshotId}
            >
              <Zap size={16} /> {isLoading ? 'Running Diff...' : 'Run Regression Comparison'}
            </button>

            <button
              className="btn btn-danger btn-icon"
              onClick={() => onDeleteSnapshot(selectedSnapshotId)}
              disabled={isLoading || !selectedSnapshotId}
              title="Delete Selected Baseline"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Comparison Report Section */}
      {comparisonReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Banner */}
          <div
            className={`hero-decision-banner ${
              comparisonReport.new_failures.length > 0 ? 'decision-block' : 'decision-allow'
            }`}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {comparisonReport.new_failures.length > 0 ? (
                  <AlertOctagon size={28} style={{ color: '#f43f5e' }} />
                ) : (
                  <CheckCircle2 size={28} style={{ color: '#10b981' }} />
                )}
                <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {comparisonReport.summary_message}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
                Baseline: <strong>{comparisonReport.baseline_snapshot_name}</strong> vs Current Configuration
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>Pass Rate Delta:</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {comparisonReport.baseline_pass_rate.toFixed(1)}% &rarr;{' '}
                <span
                  style={{
                    color:
                      comparisonReport.current_pass_rate >= comparisonReport.baseline_pass_rate
                        ? '#10b981'
                        : '#f43f5e',
                  }}
                >
                  {comparisonReport.current_pass_rate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* 4 Delta Metric Cards */}
          <div className="grid-4">
            <div className="metric-card">
              <div className="metric-header">
                <span>NEW REGRESSIONS</span>
                <XCircle
                  size={18}
                  style={{
                    color: comparisonReport.new_failures.length > 0 ? '#f43f5e' : '#10b981',
                  }}
                />
              </div>
              <div
                className="metric-value"
                style={{
                  color: comparisonReport.new_failures.length > 0 ? '#f43f5e' : '#10b981',
                }}
              >
                {comparisonReport.new_failures.length}
              </div>
              <div className="metric-footer">Passed on baseline, now failing</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>RESOLVED FAILURES</span>
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
              </div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                {comparisonReport.resolved_failures.length}
              </div>
              <div className="metric-footer">Failed on baseline, now fixed</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>DECISION CHANGES</span>
                <GitCompare size={18} style={{ color: '#38bdf8' }} />
              </div>
              <div className="metric-value" style={{ color: '#38bdf8' }}>
                {comparisonReport.decision_changes.length}
              </div>
              <div className="metric-footer">Status or ALLOW/BLOCK changed</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>POLICY DIFF</span>
                <Layers size={18} style={{ color: '#a855f7' }} />
              </div>
              <div className="metric-value" style={{ fontSize: '1.2rem', color: '#a855f7' }}>
                +{comparisonReport.policy_diff.added_count} / ~{comparisonReport.policy_diff.modified_count} / -{comparisonReport.policy_diff.removed_count}
              </div>
              <div className="metric-footer">Added / Modified / Removed</div>
            </div>
          </div>

          {/* Regressions Section */}
          {comparisonReport.new_failures.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.4)' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ color: '#f43f5e' }}>
                  <AlertOctagon size={18} />
                  Breaking Regressions ({comparisonReport.new_failures.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comparisonReport.new_failures.map((f, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
                        {f.test_case.name}
                      </strong>
                      <span className="badge badge-block">Regression</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px' }}>
                      Path: <code className="mono">{f.test_case.path}</code> [{f.test_case.method}] • Role: {f.test_case.simulated_role}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#fda4af', marginTop: '6px' }}>
                      <strong>Failure Reason: </strong> {f.failure_reason || `Returned ${f.actual_decision} ${f.actual_status_code}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Changes Table */}
          {comparisonReport.decision_changes.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <GitCompare size={18} style={{ color: '#38bdf8' }} />
                  Routing &amp; Decision Delta Matrix ({comparisonReport.decision_changes.length})
                </h3>
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Test Case Name</th>
                      <th>Method &amp; Path</th>
                      <th>Role</th>
                      <th>Baseline Decision</th>
                      <th>Current Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonReport.decision_changes.map((dc, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{dc.test_name}</td>
                        <td>
                          <span className={`badge-method method-${dc.method}`}>{dc.method}</span>{' '}
                          <code className="mono">{dc.path}</code>
                        </td>
                        <td>
                          <span className={`role-tag role-${dc.role.toLowerCase()}`}>{dc.role}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              dc.baseline_decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                            }`}
                          >
                            {dc.baseline_decision} ({dc.baseline_status})
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              dc.current_decision === 'ALLOW' ? 'badge-allow' : 'badge-block'
                            }`}
                          >
                            {dc.current_decision} ({dc.current_status})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Baseline Modal */}
      {isSnapshotModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="card-title">
                <BookmarkPlus size={18} style={{ color: '#38bdf8' }} />
                Save Baseline Policy Snapshot
              </h3>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setIsSnapshotModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="notice-box notice-danger" style={{ marginBottom: '1rem' }}>
                    <AlertOctagon size={18} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Baseline Snapshot Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Note</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={snapshotDesc}
                    onChange={(e) => setSnapshotDesc(e.target.value)}
                    placeholder="e.g. Clean production-ready baseline before student RBAC overhaul"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSnapshotModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  Save Baseline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
