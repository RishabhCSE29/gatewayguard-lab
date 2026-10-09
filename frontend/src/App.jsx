import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import PolicyEditor from './components/PolicyEditor';
import RequestSimulator from './components/RequestSimulator';
import ConflictLab from './components/ConflictLab';
import TestLab from './components/TestLab';
import ComparisonLab from './components/ComparisonLab';
import { api, DOCS_URL, API_BASE_URL } from './api';
import { AlertCircle, RefreshCw, Server, ExternalLink } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('overview');
  const [policies, setPolicies] = useState([]);
  const [conflicts, setConflicts] = useState(null);
  const [testReport, setTestReport] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [comparisonReport, setComparisonReport] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Initial Data Fetch
  const fetchAllData = async () => {
    setIsLoading(true);
    setConnectionError(null);
    try {
      const [policiesData, conflictsData, snapshotsData] = await Promise.all([
        api.getPolicies(),
        api.getConflicts(),
        api.getSnapshots(),
      ]);
      setPolicies(policiesData);
      setConflicts(conflictsData);
      setSnapshots(snapshotsData);

      // Run initial test suite to populate pass rates
      try {
        const initialReport = await api.runTests();
        setTestReport(initialReport);
      } catch (e) {
        console.warn('Initial test run deferred:', e);
      }
    } catch (err) {
      console.error('API connection failed:', err);
      setConnectionError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handlers
  const handleSavePolicies = async (updatedPolicies) => {
    setIsLoading(true);
    try {
      const saved = await api.updatePolicies(updatedPolicies);
      setPolicies(saved);
      const [updatedConflicts, updatedReport] = await Promise.all([
        api.getConflicts(),
        api.runTests(),
      ]);
      setConflicts(updatedConflicts);
      setTestReport(updatedReport);
    } catch (err) {
      alert(err.message || 'Failed to update policies');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPolicies = async (mode = 'safe') => {
    setIsLoading(true);
    try {
      const resetList = await api.resetPolicies(mode);
      setPolicies(resetList);
      const [updatedConflicts, updatedReport] = await Promise.all([
        api.getConflicts(),
        api.runTests(),
      ]);
      setConflicts(updatedConflicts);
      setTestReport(updatedReport);
      setSimulationResult(null);
    } catch (err) {
      alert(err.message || 'Failed to reset policies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulate = async (simInput) => {
    setIsSimulating(true);
    try {
      const res = await api.simulateRequest(simInput);
      setSimulationResult(res);
    } catch (err) {
      alert(err.message || 'Simulation execution failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleGenerateTests = async () => {
    setIsLoading(true);
    try {
      const generated = await api.generateTests();
      const report = await api.runTests(generated);
      setTestReport(report);
    } catch (err) {
      alert(err.message || 'Failed to generate and run test suite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunTests = async () => {
    setIsLoading(true);
    try {
      const report = await api.runTests();
      setTestReport(report);
    } catch (err) {
      alert(err.message || 'Failed to run test suite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSnapshot = async (name, description) => {
    setIsLoading(true);
    try {
      const newSnapshot = await api.createSnapshot(name, description);
      setSnapshots((prev) => [...prev, newSnapshot]);
      return newSnapshot;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    setIsLoading(true);
    try {
      await api.deleteSnapshot(snapshotId);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      if (comparisonReport?.baseline_snapshot_id === snapshotId) {
        setComparisonReport(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete snapshot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareWithBaseline = async (snapshotId) => {
    setIsLoading(true);
    try {
      const rep = await api.compareWithBaseline(snapshotId);
      setComparisonReport(rep);
    } catch (err) {
      alert(err.message || 'Regression comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Navbar
        currentTab={currentTab}
        setTab={setCurrentTab}
        conflictCount={conflicts?.total_conflicts || 0}
        policyCount={policies.length}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top App Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: connectionError ? '#f43f5e' : '#10b981',
                boxShadow: connectionError ? '0 0 8px #f43f5e' : '0 0 8px #10b981',
              }}
            ></span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
              {connectionError ? 'Backend Disconnected' : 'FastAPI Gateway Engine: Online'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              title="Open FastAPI Swagger Documentation"
            >
              API Docs <ExternalLink size={14} />
            </a>
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={fetchAllData}
              disabled={isLoading}
              title="Refresh Data"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* Global Connection Error Banner */}
        {connectionError && (
          <div style={{ margin: '1.5rem 2rem 0 2rem' }}>
            <div className="notice-box notice-danger">
              <AlertCircle size={22} style={{ flexShrink: 0 }} />
              <div>
                <strong>Backend Connection Error:</strong> {connectionError}
                <div style={{ marginTop: '6px', fontSize: '0.82rem' }}>
                  Ensure the FastAPI backend service is accessible at{' '}
                  <code
                    className="mono"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {API_BASE_URL}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Views */}
        {currentTab === 'overview' && (
          <Overview
            policies={policies}
            conflicts={conflicts}
            testReport={testReport}
            onNavigate={setCurrentTab}
            onRunQuickSim={handleSimulate}
            quickSimResult={simulationResult}
            isSimulating={isSimulating}
          />
        )}

        {currentTab === 'policies' && (
          <PolicyEditor
            policies={policies}
            onSavePolicies={handleSavePolicies}
            onResetPolicies={handleResetPolicies}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'simulator' && (
          <RequestSimulator
            policies={policies}
            onSimulate={handleSimulate}
            simulationResult={simulationResult}
            isSimulating={isSimulating}
          />
        )}

        {currentTab === 'conflicts' && (
          <ConflictLab
            conflicts={conflicts}
            onResetPolicies={handleResetPolicies}
            onNavigate={setCurrentTab}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'tests' && (
          <TestLab
            testReport={testReport}
            onGenerateTests={handleGenerateTests}
            onRunTests={handleRunTests}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'comparison' && (
          <ComparisonLab
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onCompare={handleCompareWithBaseline}
            comparisonReport={comparisonReport}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
