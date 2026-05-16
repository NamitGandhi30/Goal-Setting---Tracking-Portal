'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { goals as goalsApi, cycles } from '@/lib/api';
import type { Goal, GoalCycle, WeightageSummary, GoalCreatePayload, UnitOfMeasure } from '@/lib/types';

const UOM_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'numeric', label: 'Numeric' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'zero_based', label: 'Zero Based' },
];

export default function GoalsPage() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [myGoals, setMyGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<WeightageSummary | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const cycle = await cycles.active();
      setActiveCycle(cycle);
      const [g, s] = await Promise.all([
        goalsApi.list(cycle.id),
        goalsApi.weightageSummary(cycle.id),
      ]);
      setMyGoals(g);
      setSummary(s);
    } catch { /* no active cycle */ }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Form State ──────────────────────────────────────── */
  const [form, setForm] = useState<GoalCreatePayload>({
    thrust_area: '',
    title: '',
    description: '',
    uom: 'numeric',
    target: 0,
    weightage: 10,
  });

  const resetForm = () => {
    setForm({ thrust_area: '', title: '', description: '', uom: 'numeric', target: 0, weightage: 10 });
    setEditingGoal(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      thrust_area: goal.thrust_area,
      title: goal.title,
      description: goal.description || '',
      uom: goal.uom,
      target: goal.target,
      weightage: goal.weightage,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!activeCycle) return;
    setError('');
    try {
      if (editingGoal) {
        await goalsApi.update(editingGoal.id, form);
        showToast('Goal updated successfully');
      } else {
        await goalsApi.create(activeCycle.id, form);
        showToast('Goal created successfully');
      }
      setShowModal(false);
      resetForm();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await goalsApi.delete(goalId);
      showToast('Goal deleted');
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const handleSubmitAll = async () => {
    if (!activeCycle) return;
    try {
      await goalsApi.submit(activeCycle.id);
      showToast('Goals submitted for approval! 🎉');
      setShowSubmitConfirm(false);
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Submit failed', 'error');
      setShowSubmitConfirm(false);
    }
  };

  if (!user) return null;

  const draftGoals = myGoals.filter(g => g.status === 'draft' || g.status === 'returned');
  const canSubmit = summary?.total_weightage === 100 && draftGoals.length > 0;
  const weightPct = summary ? Math.min(100, summary.total_weightage) : 0;
  const weightClass = !summary ? 'ok' : summary.total_weightage === 100 ? 'ok' : summary.total_weightage > 100 ? 'over' : 'warn';

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>My Goals</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            {activeCycle?.name || 'No active cycle'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canSubmit && (
            <button className="btn btn-success" onClick={() => setShowSubmitConfirm(true)}>
              🚀 Submit for Approval
            </button>
          )}
          {summary?.can_add_more && (
            <button className="btn btn-primary" onClick={openCreate}>
              + Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Weightage Bar */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Weightage Allocation
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: weightClass === 'ok' && summary?.total_weightage === 100 ? 'var(--accent-success)' : weightClass === 'over' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
            {summary?.total_weightage ?? 0}% / 100%
          </span>
        </div>
        <div className="progress-bar" style={{ height: '12px' }}>
          <div className={`progress-fill ${weightClass}`} style={{ width: `${weightPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{summary?.goal_count ?? 0} of 8 goals used</span>
          <span>{summary?.remaining_weightage ?? 100}% remaining</span>
        </div>
      </div>

      {/* Goals List */}
      {myGoals.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No goals created yet</h3>
          <p>Click &ldquo;Add Goal&rdquo; to start building your performance objectives for this cycle.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openCreate}>
            + Create First Goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {myGoals.map(goal => (
            <div key={goal.id} className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{goal.title}</h3>
                    <span className={`badge badge-${goal.status === 'pending_approval' ? 'pending' : goal.status}`}>
                      {goal.status.replace('_', ' ')}
                    </span>
                    {goal.is_shared && <span className="badge badge-draft">🔗 Shared</span>}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {goal.thrust_area}
                  </p>
                  {goal.description && (
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {goal.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong>UoM:</strong> {goal.uom.replace('_', ' ')}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong>Target:</strong> {goal.target}
                    </span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                      <strong>Weight:</strong> {goal.weightage}%
                    </span>
                  </div>
                </div>
                {(goal.status === 'draft' || goal.status === 'returned') && (
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(goal)}>
                      ✏️ Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDelete(goal.id)}>
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editingGoal ? 'Edit Goal' : 'Create Goal'}</h2>

            {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Thrust Area</label>
                <input
                  className="form-input"
                  placeholder="e.g., Delivery Excellence"
                  value={form.thrust_area}
                  onChange={e => setForm(f => ({ ...f, thrust_area: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Goal Title</label>
                <input
                  className="form-input"
                  placeholder="e.g., Achieve 95% on-time delivery"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Additional details about this goal..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select
                    className="form-select"
                    value={form.uom}
                    onChange={e => setForm(f => ({ ...f, uom: e.target.value as UnitOfMeasure }))}
                  >
                    {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="any"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Weightage (%) — Min 10%, Remaining: {summary?.remaining_weightage ?? 100}%
                </label>
                <input
                  className="form-input"
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={form.weightage}
                  onChange={e => setForm(f => ({ ...f, weightage: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 className="modal-title">Submit Goals for Approval?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              This will send all <strong>{draftGoals.length} draft goals</strong> to your manager for review.
              You won&apos;t be able to edit them until they&apos;re returned.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSubmitConfirm(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleSubmitAll}>🚀 Confirm Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
