import React from 'react';
import { Shield, Server, Filter, Activity, Users, ArrowRight } from 'lucide-react';

export default function ArchitectureFlow({ activePolicy = null, isBlocked = false }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <Activity size={18} className="text-cyan-primary" />
          API Gateway Request Pipeline & Architecture
        </h3>
        <span className="badge badge-info">Deterministic Core</span>
      </div>

      <div className="flow-diagram">
        {/* Node 1: Client Request */}
        <div className="flow-node">
          <div style={{ color: '#38bdf8', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
            <Users size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Client Request</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Simulated Role</div>
        </div>

        <div className="flow-arrow"><ArrowRight size={20} /></div>

        {/* Node 2: Route Matching */}
        <div className={`flow-node ${activePolicy ? 'active-hub' : ''}`}>
          <div style={{ color: '#a855f7', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
            <Filter size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>1. Precedence Engine</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Exact &gt; Param &gt; Wildcard</div>
        </div>

        <div className="flow-arrow"><ArrowRight size={20} /></div>

        {/* Node 3: RBAC Auth */}
        <div className="flow-node">
          <div style={{ color: '#10b981', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
            <Shield size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>2. Role Check</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Admin / Student / Public</div>
        </div>

        <div className="flow-arrow"><ArrowRight size={20} /></div>

        {/* Node 4: Rate Limiting */}
        <div className="flow-node">
          <div style={{ color: '#f59e0b', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
            <Activity size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>3. Rate Limiting</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quota &amp; Time Window</div>
        </div>

        <div className="flow-arrow"><ArrowRight size={20} /></div>

        {/* Node 5: Destination Microservice */}
        <div className={`flow-node ${!isBlocked && activePolicy ? 'active-hub' : ''}`}>
          <div style={{ color: '#38bdf8', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
            <Server size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {activePolicy && !isBlocked ? activePolicy.destination_service : 'Target Microservice'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Internal Microservice</div>
        </div>
      </div>
    </div>
  );
}
