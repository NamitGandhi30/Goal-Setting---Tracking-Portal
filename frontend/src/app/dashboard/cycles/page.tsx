'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cycles as cyclesApi } from '@/lib/api';
import type { GoalCycle, GoalCycleCreatePayload } from '@/lib/types';

export default function CyclesPage() {
  const { user } = useAuth();
  const [allCycles, setAllCycles] = useState<GoalCycle[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<GoalCycleCreatePayload>({
    name: '', year: new Date().getFullYear(), start_date: '', end_date: '',
  });

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    cyclesApi.list().then(setAllCycles).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setError('');
    try {
      await cyclesApi.create(form);
      showToast('Goal cycle created');
      setShowModal(false);
      setForm({ name: '', year: new Date().getFullYear(), start_date: '', end_date: '' });
      cyclesApi.list().then(setAllCycles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create cycle');
    }
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
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Goal Cycles</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Cycle
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allCycles.map(cycle => (
              <tr key={cycle.id}>
                <td style={{ fontWeight: 600 }}>{cycle.name}</td>
                <td>{cycle.year}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{cycle.start_date}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{cycle.end_date}</td>
                <td>
                  <span className={`badge ${cycle.is_active ? 'badge-approved' : 'badge-draft'}`}>
                    {cycle.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {allCycles.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No cycles found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create Goal Cycle</h2>
            {error && <div className="login-error">{error}</div>}
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Cycle Name</label>
                <input className="form-input" placeholder="e.g., FY 2026-27" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input className="form-input" type="number" value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create Cycle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
