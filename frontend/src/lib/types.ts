/* TypeScript interfaces matching backend Pydantic schemas */

export type UserRole = 'employee' | 'manager' | 'admin';
export type GoalStatus = 'draft' | 'pending_approval' | 'approved' | 'returned';
export type UnitOfMeasure =
  | 'numeric'
  | 'percentage'
  | 'timeline'
  | 'zero_based'
  | 'count'
  | 'currency'
  | 'hours'
  | 'rating'
  | 'boolean';
export type GoalCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type ApprovalAction = 'approved' | 'returned' | 'edited';
export type CheckInPhase = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type ProgressStatus = 'not_started' | 'on_track' | 'at_risk' | 'completed';
export type TrackingWindowType = 'goal_setting' | 'check_in' | 'review';
export type GoalAuditAction = 'admin_unlock' | 'locked_goal_change';

export interface User {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: UserRole;
  manager_id: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface OnboardingPayload {
  employee_id: string;
  name: string;
  email: string;
  department?: string | null;
  password: string;
}

export interface GoalCycle {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  cycle_id: string;
  thrust_area: string;
  title: string;
  description: string | null;
  uom: UnitOfMeasure;
  target: number;
  deadline: string | null;
  cadence: GoalCadence;
  weightage: number;
  status: GoalStatus;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  return_comment?: string | null;
}

export interface GoalWithOwner extends Goal {
  owner_name?: string;
  owner_employee_id?: string;
}

export interface WeightageSummary {
  total_weightage: number;
  goal_count: number;
  remaining_weightage: number;
  can_add_more: boolean;
}

export interface GoalApproval {
  id: string;
  goal_id: string;
  reviewer_id: string;
  action: ApprovalAction;
  comments: string | null;
  created_at: string;
}

export interface GoalAudit {
  id: string;
  goal_id: string;
  actor_id: string;
  action: GoalAuditAction;
  reason: string;
  before_values: Record<string, unknown>;
  after_values: Record<string, unknown>;
  created_at: string;
}

export interface GoalCreatePayload {
  thrust_area: string;
  title: string;
  description?: string;
  uom: UnitOfMeasure;
  target: number;
  deadline?: string | null;
  cadence?: GoalCadence;
  weightage: number;
}

export interface GoalUpdatePayload {
  thrust_area?: string;
  title?: string;
  description?: string;
  uom?: UnitOfMeasure;
  target?: number;
  deadline?: string | null;
  cadence?: GoalCadence;
  weightage?: number;
}

export interface SharedGoalCreatePayload {
  thrust_area: string;
  title: string;
  description?: string;
  uom: UnitOfMeasure;
  target: number;
  deadline?: string | null;
  cadence?: GoalCadence;
  weightage: number;
  assigned_to_user_ids: string[];
}

export interface GoalCycleCreatePayload {
  name: string;
  year: number;
  start_date: string;
  end_date: string;
}

export interface GoalCheckIn {
  id: string;
  goal_id: string;
  phase: CheckInPhase;
  actual_value: number;
  progress_score: number;
  progress_status: ProgressStatus;
  employee_comment: string | null;
  manager_comment: string | null;
  self_rating: number | null;
  manager_rating: number | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamGoalCheckIn extends GoalCheckIn {
  goal_title: string;
  owner_name: string;
  owner_employee_id: string;
  thrust_area: string;
}

export interface TeamTrackingGoal {
  goal_id: string;
  cycle_id: string;
  goal_title: string;
  owner_id: string;
  owner_name: string;
  owner_employee_id: string;
  owner_department: string | null;
  thrust_area: string;
  target: number;
  weightage: number;
  cadence: GoalCadence;
  deadline: string | null;
  phase: CheckInPhase;
  checkin_id: string | null;
  actual_value: number | null;
  progress_score: number;
  progress_status: ProgressStatus;
  employee_comment: string | null;
  manager_comment: string | null;
  self_rating: number | null;
  manager_rating: number | null;
  updated_at: string | null;
}

export interface CheckInPayload {
  phase: CheckInPhase;
  actual_value: number;
  employee_comment?: string;
  self_rating?: number;
}

export interface ManagerCheckInPayload {
  manager_comment?: string;
  manager_rating?: number;
}

export interface TrackingSummary {
  cycle_id: string;
  phase: CheckInPhase;
  goal_count: number;
  logged_count: number;
  weighted_score: number;
  completed_count: number;
  at_risk_count: number;
  window_open: boolean;
}

export interface TrackingWindow {
  id: string;
  cycle_id: string;
  window_type: TrackingWindowType;
  phase: CheckInPhase | null;
  name: string;
  start_date: string;
  end_date: string;
  is_open: boolean;
  created_at: string;
}

export interface TrackingWindowCreatePayload {
  cycle_id: string;
  window_type: TrackingWindowType;
  phase?: CheckInPhase | null;
  name: string;
  start_date: string;
  end_date: string;
}

export interface ChatSuggestion {
  label: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  intent: string;
  action_taken: boolean;
  suggestions: ChatSuggestion[];
}

/* ── Admin Console Types ─────────────────────────────────── */

export interface UserCreatePayload {
  employee_id: string;
  name: string;
  email: string;
  role: UserRole;
  manager_id?: string | null;
  department?: string | null;
  password?: string;
}

export interface UserUpdatePayload {
  role?: UserRole;
  manager_id?: string | null;
  department?: string | null;
  is_active?: boolean;
}

export interface BulkAssignmentPayload {
  department: string;
  manager_id: string;
  member_user_ids: string[];
}

export interface BulkAssignmentResult {
  department: string;
  manager_id: string;
  updated_user_ids: string[];
  updated_count: number;
}

/* ── Analytics Types ─────────────────────────────────────── */

export interface TeamAnalytics {
  user_id: string;
  name: string;
  employee_id: string;
  department: string | null;
  goal_count: number;
  logged_count: number;
  weighted_score: number;
  completed_count: number;
  at_risk_count: number;
  on_track_count: number;
  not_started_count: number;
}

export interface DepartmentAnalytics {
  department: string;
  employee_count: number;
  employees_with_goals: number;
  total_goals: number;
  total_logged: number;
  total_completed: number;
  total_at_risk: number;
  avg_weighted_score: number;
}

export interface CompletionMetric {
  scope: string;
  label: string;
  total_goals: number;
  completed_checkins: number;
  completion_rate: number;
}

export interface MissingCheckInEmployee {
  user_id: string;
  name: string;
  employee_id: string;
  department: string | null;
  manager_id: string | null;
  missing_goal_count: number;
}

export interface CompletionDashboard {
  cycle_id: string;
  phase: CheckInPhase;
  organization: CompletionMetric;
  departments: CompletionMetric[];
  managers: CompletionMetric[];
  missing_employees: MissingCheckInEmployee[];
}
