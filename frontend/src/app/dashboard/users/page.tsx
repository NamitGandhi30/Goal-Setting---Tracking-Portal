'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { users as usersApi } from '@/lib/api';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    usersApi.list().then(setAllUsers).catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>User Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          {allUsers.length} users in the system
        </p>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Email</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '11px' }}>
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{u.employee_id}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                <td>{u.department || '—'}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-approved' : u.role === 'manager' ? 'badge-pending' : 'badge-draft'}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-approved' : 'badge-returned'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
