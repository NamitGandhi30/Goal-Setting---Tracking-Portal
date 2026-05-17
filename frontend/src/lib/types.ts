/* TypeScript interfaces matching backend Pydantic schemas */

export type UserRole = 'employee' | 'manager' | 'admin';
export type GoalStatus = 'draft' | 'pending_approval' | 'approved' | 'returned';
export type UnitOfMeasure = 'numeric' | 'percentage' | 'timeline' | 'zero_based';
export type ApprovalAction = 'approved' | 'returned' | 'edited';
export type CheckInPhase = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type ProgressStatus = 'not_started' | 'on_track' | 'at_risk' | 'completed';
export type TrackingWindowType = 'goal_setting' | 'check_in' | 'review';

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
  weightage: number;
  status: GoalStatus;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export interface GoalCreatePayload {
  thrust_area: string;
  title: string;
  description?: string;
  uom: UnitOfMeasure;
  target: number;
  weightage: number;
}

export interface GoalUpdatePayload {
  thrust_area?: string;
  title?: string;
  description?: string;
  uom?: UnitOfMeasure;
  target?: number;
  weightage?: number;
}

export interface SharedGoalCreatePayload {
  thrust_area: string;
  title: string;
  description?: string;
  uom: UnitOfMeasure;
  target: number;
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
