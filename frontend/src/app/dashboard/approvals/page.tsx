'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { approvals as approvalsApi } from '@/lib/api';
import type { GoalWithOwner } from '@/lib/types';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<GoalWithOwner[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<GoalWithOwner | null>(null);
  const [comments, setComments] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'return' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPending = useCallback(async () => {
    try {
      const data = await approvalsApi.pending();
      setPending(data);
    } catch { /* */ }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleAction = async () => {
    if (!selectedGoal || !actionType) return;
    try {
      if (actionType === 'approve') {
        await approvalsApi.approve(selectedGoal.id, comments || undefined);
        showToast(`Goal approved: ${selectedGoal.title}`);
      } else {
        await approvalsApi.returnGoal(selectedGoal.id, comments || undefined);
        showToast(`Goal returned: ${selectedGoal.title}`, 'info');
      }
      setSelectedGoal(null);
      setComments('');
      setActionType(null);
      await loadPending();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  };

  if (!user) return null;

  // Group by employee
  const grouped = pending.reduce<Record<string, GoalWithOwner[]>>((acc, goal) => {
    const key = goal.owner_name || goal.user_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(goal);
    return acc;
  }, {});

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Team Goal Reviews</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          {pending.length} goals pending your review
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon">✅</div>
          <h3>All caught up!</h3>
          <p>No goals are waiting for your review.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([name, empGoals]) => (
          <div key={name} style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {empGoals[0]?.owner_employee_id} · {empGoals.length} goals ·
                  Total weight: {empGoals.reduce((s, g) => s + g.weightage, 0)}%
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {empGoals.map(goal => (
                <div key={goal.id} className="glass-card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{goal.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        {goal.thrust_area}
                      </p>
                      <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>UoM: {goal.uom.replace('_', ' ')}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>Target: {goal.target}</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Weight: {goal.weightage}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => { setSelectedGoal(goal); setActionType('approve'); }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => { setSelectedGoal(goal); setActionType('return'); }}
                      >
                        ↩ Return
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Action Modal */}
      {selectedGoal && actionType && (
        <div className="modal-overlay" onClick={() => { setSelectedGoal(null); setActionType(null); }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 className="modal-title">
              {actionType === 'approve' ? '✅ Approve Goal' : '↩ Return Goal'}
            </h2>
            <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{selectedGoal.title}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {selectedGoal.thrust_area} · {selectedGoal.weightage}%
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Comments {actionType === 'return' ? '(Recommended)' : '(Optional)'}</label>
              <textarea
                className="form-textarea"
                placeholder={actionType === 'return' ? 'Explain what needs to be revised...' : 'Any feedback...'}
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setSelectedGoal(null); setActionType(null); setComments(''); }}>
                Cancel
              </button>
              <button
                className={`btn ${actionType === 'approve' ? 'btn-success' : 'btn-warning'}`}
                onClick={handleAction}
              >
                {actionType === 'approve' ? 'Confirm Approve' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
