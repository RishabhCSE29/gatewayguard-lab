import React from 'react';
import { Shield, LayoutDashboard, Sliders, PlayCircle, AlertTriangle, CheckSquare, GitCompare } from 'lucide-react';

export default function Navbar({ currentTab, setTab, conflictCount = 0, policyCount = 0 }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'policies', label: 'Policy Editor', icon: Sliders, count: policyCount },
    { id: 'simulator', label: 'Request Simulator', icon: PlayCircle },
    { id: 'conflicts', label: 'Conflict Detection', icon: AlertTriangle, count: conflictCount, isWarning: conflictCount > 0 },
    { id: 'tests', label: 'Automated Test Lab', icon: CheckSquare },
    { id: 'comparison', label: 'Before / After Diff', icon: GitCompare },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={22} />
        </div>
        <div>
          <div className="brand-title">GatewayGuard</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span className="brand-badge">Policy Lab</span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>v1.0.0</span>
          </div>
        </div>
      </div>

      <ul className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <li
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className="nav-counter"
                  style={{
                    backgroundColor: item.isWarning ? 'rgba(244, 63, 94, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    color: item.isWarning ? '#f43f5e' : '#38bdf8',
                    border: `1px solid ${item.isWarning ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.3)'}`,
                  }}
                >
                  {item.count}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
          <strong style={{ color: '#94a3b8' }}>Simulator Mode</strong>
          <div>College Mini-Project Edition</div>
          <div style={{ marginTop: '4px', fontSize: '0.7rem' }}>Zero Cloud • Local Engine</div>
        </div>
      </div>
    </aside>
  );
}
