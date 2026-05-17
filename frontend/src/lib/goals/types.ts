export type Role = "Employee" | "Manager" | "Admin";
export type SheetStatus = "Draft" | "Submitted" | "Returned" | "Approved";
export type UoM =
  | "Numeric"
  | "Percent"
  | "Timeline"
  | "Zero-based"
  | "Count"
  | "Currency"
  | "Hours"
  | "Rating"
  | "Yes/No";
export type GoalCadence = "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annual";
export type CheckInPhase = "Q1" | "Q2" | "Q3" | "Q4";

export interface Goal {
  id: string;
  thrustArea: string;
  title: string;
  description?: string;
  uom: UoM;
  target: string;
  deadline?: string;
  cadence?: GoalCadence;
  weightage: number;
  status?: SheetStatus;
}

export interface CheckIn {
  id: string;
  goalId: string;
  phase: CheckInPhase;
  achievement: number;
  selfRating?: number;
  managerRating?: number;
  note?: string;
  createdAt: string;
}

export const THRUST_AREAS = [
  "Business Growth",
  "Customer Experience",
  "Operational Excellence",
  "People Development",
  "Innovation",
] as const;

export const CHECKIN_PHASES: CheckInPhase[] = ["Q1", "Q2", "Q3", "Q4"];

export const CYCLE = "2026";
