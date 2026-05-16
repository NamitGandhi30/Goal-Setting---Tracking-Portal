'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { goals, cycles, approvals } from '@/lib/api';
import type { Goal, GoalCycle, GoalWithOwner, WeightageSummary } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [myGoals, setMyGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<WeightageSummary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    cycles.active()
      .then(cycle => {
        setActiveCycle(cycle);
        return Promise.all([
          goals.list(cycle.id),
          goals.weightageSummary(cycle.id),
          user.role !== 'employee' ? approvals.pending() : Promise.resolve([]),
        ]);
      })
      .then(([g, s, p]) => {
        setMyGoals(g);
        setSummary(s);
        setPendingCount((p as GoalWithOwner[]).length);
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const statusCounts = {
    draft: myGoals.filter(g => g.status === 'draft').length,
    pending: myGoals.filter(g => g.status === 'pending_approval').length,
    approved: myGoals.filter(g => g.status === 'approved').length,
    returned: myGoals.filter(g => g.status === 'returned').length,
  };

  const weightPct = summary ? Math.min(100, (summary.total_weightage / 100) * 100) : 0;
  const weightClass = !summary ? 'ok' : summary.total_weightage === 100 ? 'ok' : summary.total_weightage > 100 ? 'over' : 'warn';

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>
          Welcome back, {user.name.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          {activeCycle ? `Active cycle: ${activeCycle.name}` : 'No active goal cycle'}
        </p>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="glass-card metric-card">
          <div className="metric-label">Total Goals</div>
          <div className="metric-value">{myGoals.length}</div>
          <div className="metric-sub">of {8} max per cycle</div>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-label">Weightage Used</div>
          <div className="metric-value">{summary?.total_weightage ?? 0}%</div>
          <div style={{ marginTop: '8px' }}>
            <div className="progress-bar">
              <div className={`progress-fill ${weightClass}`} style={{ width: `${weightPct}%` }} />
            </div>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-label">Approved</div>
          <div className="metric-value" style={{ color: 'var(--accent-success)' }}>
            {statusCounts.approved}
          </div>
          <div className="metric-sub">{statusCounts.pending} pending review</div>
        </div>
        {user.role !== 'employee' && (
          <div className="glass-card metric-card">
            <div className="metric-label">Pending Reviews</div>
            <div className="metric-value" style={{ color: 'var(--accent-warning)' }}>
              {pendingCount}
            </div>
            <div className="metric-sub">from your team</div>
          </div>
        )}
      </div>

      {/* Goals Summary Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>My Goals Overview</h3>
          {statusCounts.returned > 0 && (
            <span className="badge badge-returned">⚠ {statusCounts.returned} returned</span>
          )}
        </div>
        {myGoals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No goals yet</h3>
            <p>Create your first goal to get started with this cycle.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Thrust Area</th>
                <th>UoM</th>
                <th>Target</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myGoals.map(goal => (
                <tr key={goal.id}>
                  <td style={{ fontWeight: 500 }}>{goal.title}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{goal.thrust_area}</td>
                  <td>
                    <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>
                      {goal.uom.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{goal.target}</td>
                  <td style={{ fontWeight: 600 }}>{goal.weightage}%</td>
                  <td>
                    <span className={`badge badge-${goal.status === 'pending_approval' ? 'pending' : goal.status}`}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
