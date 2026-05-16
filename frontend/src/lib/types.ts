/* TypeScript interfaces matching backend Pydantic schemas */

export type UserRole = 'employee' | 'manager' | 'admin';
export type GoalStatus = 'draft' | 'pending_approval' | 'approved' | 'returned';
export type UnitOfMeasure = 'numeric' | 'percentage' | 'timeline' | 'zero_based';
export type ApprovalAction = 'approved' | 'returned' | 'edited';

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
