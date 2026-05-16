'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sharedGoals as sharedApi, users as usersApi, cycles } from '@/lib/api';
import type { User, GoalCycle, SharedGoalCreatePayload, UnitOfMeasure } from '@/lib/types';

const UOM_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'numeric', label: 'Numeric' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'zero_based', label: 'Zero Based' },
];

export default function SharedGoalsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<User[]>([]);
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState<Omit<SharedGoalCreatePayload, 'assigned_to_user_ids'>>({
    thrust_area: '',
    title: '',
    description: '',
    uom: 'numeric',
    target: 0,
    weightage: 10,
  });

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!user) return;
    cycles.active().then(setActiveCycle).catch(() => {});
    if (user.role === 'admin') {
      usersApi.list().then(all => setReports(all.filter(u => u.role === 'employee'))).catch(() => {});
    } else {
      usersApi.reports(user.id).then(setReports).catch(() => {});
    }
  }, [user]);

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      setError('Select at least one employee');
      return;
    }
    setError('');
    try {
      await sharedApi.create(
        { ...form, assigned_to_user_ids: selectedUsers },
        activeCycle?.id
      );
      showToast(`Shared goal pushed to ${selectedUsers.length} employees`);
      setShowModal(false);
      setSelectedUsers([]);
      setForm({ thrust_area: '', title: '', description: '', uom: 'numeric', target: 0, weightage: 10 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shared goal');
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  if (!user) return null;

  return (
    <div>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Shared Goals (KPIs)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Push departmental KPIs to multiple employees at once
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Shared Goal
        </button>
      </div>

      <div className="glass-card" style={{ padding: '32px' }}>
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <h3>Push KPIs to your team</h3>
          <p>
            Create a shared goal and assign it to multiple employees.
            Each employee will receive a copy in their goals list.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>
            + Create Shared Goal
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 className="modal-title">Create Shared Goal</h2>
            {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Thrust Area</label>
                <input className="form-input" placeholder="e.g., Department KPI" value={form.thrust_area}
                  onChange={e => setForm(f => ({ ...f, thrust_area: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Goal Title</label>
                <input className="form-input" placeholder="e.g., Achieve 99.9% uptime" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea className="form-textarea" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">UoM</label>
                  <select className="form-select" value={form.uom}
                    onChange={e => setForm(f => ({ ...f, uom: e.target.value as UnitOfMeasure }))}>
                    {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input className="form-input" type="number" value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Weightage (%)</label>
                  <input className="form-input" type="number" min={10} max={100} value={form.weightage}
                    onChange={e => setForm(f => ({ ...f, weightage: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Employee Selection */}
              <div className="form-group">
                <label className="form-label">Assign To ({selectedUsers.length} selected)</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
                  {reports.map(emp => (
                    <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s', background: selectedUsers.includes(emp.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                      <input type="checkbox" checked={selectedUsers.includes(emp.id)}
                        onChange={() => toggleUser(emp.id)}
                        style={{ accentColor: 'var(--accent-primary)' }} />
                      <span style={{ fontSize: '14px' }}>{emp.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{emp.employee_id}</span>
                    </label>
                  ))}
                  {reports.length === 0 && (
                    <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No employees found
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Push to {selectedUsers.length} Employee{selectedUsers.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
