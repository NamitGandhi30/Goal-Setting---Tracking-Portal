'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['employee', 'manager', 'admin'] },
  { href: '/dashboard/goals', label: 'My Goals', icon: '🎯', roles: ['employee', 'manager', 'admin'] },
  { href: '/dashboard/approvals', label: 'Team Reviews', icon: '✅', roles: ['manager', 'admin'] },
  { href: '/dashboard/shared-goals', label: 'Shared Goals', icon: '🔗', roles: ['manager', 'admin'] },
  { href: '/dashboard/cycles', label: 'Goal Cycles', icon: '📅', roles: ['admin'] },
  { href: '/dashboard/users', label: 'User Management', icon: '👥', roles: ['admin'] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>🎯</div>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  const getPageTitle = () => {
    const match = filteredNav.find(item => pathname === item.href);
    return match?.label || 'Dashboard';
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>GoalForge</h1>
          <p>Performance Portal</p>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="user-info">
              <div className="name">{user.name}</div>
              <div className="role">{user.role}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-area">
        <header className="topbar">
          <h2>{getPageTitle()}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {user.department}
            </span>
            <span className="badge badge-approved" style={{ fontSize: '11px' }}>
              {user.role}
            </span>
          </div>
        </header>
        <main className="content-area animate-in">
          {children}
        </main>
      </div>
    </div>
  );
}
