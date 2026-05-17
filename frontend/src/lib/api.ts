/* API client – handles all HTTP calls to the FastAPI backend */

import type {
  TokenResponse, User, GoalCycle, Goal, GoalWithOwner,
  WeightageSummary, GoalCreatePayload, GoalUpdatePayload,
  SharedGoalCreatePayload, GoalCycleCreatePayload,
  CheckInPayload, CheckInPhase, ChatResponse, GoalCheckIn,
  ManagerCheckInPayload, TeamGoalCheckIn, TrackingSummary, TrackingWindow,
  TrackingWindowCreatePayload,
} from './types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(formatApiError(body.detail) || 'Request failed', res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatApiError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const path = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : '';
          return `${path ? `${path}: ` : ''}${String(item.msg)}`;
        }
        return String(item);
      })
      .join('; ');
  }
  return '';
}

/* ── Auth ──────────────────────────────────────────────── */
export const auth = {
  login: (email: string, password: string) =>
    request<TokenResponse>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>(`${API_BASE}/auth/me`),
};

/* ── Users ─────────────────────────────────────────────── */
export const users = {
  list: () => request<User[]>(`${API_BASE}/users`),
  reports: (userId: string) => request<User[]>(`${API_BASE}/users/${userId}/reports`),
};

/* ── Goal Cycles ───────────────────────────────────────── */
export const cycles = {
  list: () => request<GoalCycle[]>(`${API_BASE}/cycles`),
  active: () => request<GoalCycle>(`${API_BASE}/cycles/active`),
  create: (data: GoalCycleCreatePayload) =>
    request<GoalCycle>(`${API_BASE}/cycles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/* ── Goals ─────────────────────────────────────────────── */
export const goals = {
  list: (cycleId: string) =>
    request<Goal[]>(`${API_BASE}/goals?cycle_id=${cycleId}`),
  weightageSummary: (cycleId: string) =>
    request<WeightageSummary>(`${API_BASE}/goals/weightage-summary?cycle_id=${cycleId}`),
  create: (cycleId: string, data: GoalCreatePayload) =>
    request<Goal>(`${API_BASE}/goals?cycle_id=${cycleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (goalId: string, data: GoalUpdatePayload) =>
    request<Goal>(`${API_BASE}/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (goalId: string) =>
    request<void>(`${API_BASE}/goals/${goalId}`, { method: 'DELETE' }),
  submit: (cycleId: string) =>
    request<Goal[]>(`${API_BASE}/goals/submit?cycle_id=${cycleId}`, { method: 'POST' }),
};

/* ── Approvals ─────────────────────────────────────────── */
export const approvals = {
  pending: () => request<GoalWithOwner[]>(`${API_BASE}/approvals/pending`),
  approve: (goalId: string, comments?: string) =>
    request<Goal>(`${API_BASE}/approvals/${goalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    }),
  returnGoal: (goalId: string, comments?: string) =>
    request<Goal>(`${API_BASE}/approvals/${goalId}/return`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    }),
  editAndApprove: (goalId: string, data: GoalUpdatePayload & { comments?: string }) =>
    request<Goal>(`${API_BASE}/approvals/${goalId}/edit`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

/* ── Shared Goals ──────────────────────────────────────── */
export const sharedGoals = {
  create: (data: SharedGoalCreatePayload, cycleId?: string) =>
    request<Goal[]>(
      `${API_BASE}/shared-goals${cycleId ? `?cycle_id=${cycleId}` : ''}`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

/* Tracking */
export const tracking = {
  checkins: (cycleId: string, phase?: CheckInPhase) =>
    request<GoalCheckIn[]>(
      `${API_BASE}/tracking/checkins?cycle_id=${cycleId}${phase ? `&phase=${phase}` : ''}`,
    ),
  upsertCheckin: (goalId: string, data: CheckInPayload) =>
    request<GoalCheckIn>(`${API_BASE}/tracking/goals/${goalId}/checkins`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  teamCheckins: (phase?: CheckInPhase) =>
    request<TeamGoalCheckIn[]>(`${API_BASE}/tracking/team-checkins${phase ? `?phase=${phase}` : ''}`),
  managerReview: (checkinId: string, data: ManagerCheckInPayload) =>
    request<GoalCheckIn>(`${API_BASE}/tracking/checkins/${checkinId}/manager-review`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  summary: (cycleId: string, phase: CheckInPhase) =>
    request<TrackingSummary>(`${API_BASE}/tracking/summary?cycle_id=${cycleId}&phase=${phase}`),
  windows: (cycleId?: string) =>
    request<TrackingWindow[]>(`${API_BASE}/tracking/windows${cycleId ? `?cycle_id=${cycleId}` : ''}`),
  createWindow: (data: TrackingWindowCreatePayload) =>
    request<TrackingWindow>(`${API_BASE}/tracking/windows`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/* Assistant */
export const assistant = {
  chat: (message: string) =>
    request<ChatResponse>(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
