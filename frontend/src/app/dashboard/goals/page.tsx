"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalTable } from "@/components/goals/GoalTable";
import { StatusPill } from "@/components/goals/StatusPill";
import { ValidationBar } from "@/components/goals/ValidationBar";
import { WeightageRing } from "@/components/goals/WeightageRing";
import { useAuth } from "@/context/AuthContext";
import { cycles, goals as goalsApi } from "@/lib/api";
import type { Goal as UiGoal, GoalCadence as UiGoalCadence, SheetStatus, UoM } from "@/lib/goals/types";
import type {
  Goal as ApiGoal,
  GoalCadence,
  GoalCreatePayload,
  GoalCycle,
  GoalStatus,
  GoalUpdatePayload,
  UnitOfMeasure,
  WeightageSummary,
} from "@/lib/types";

export default function GoalsPage() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [apiGoals, setApiGoals] = useState<ApiGoal[]>([]);
  const [summary, setSummary] = useState<WeightageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const cycle = await cycles.active();
      const [goalData, weightage] = await Promise.all([
        goalsApi.list(cycle.id),
        goalsApi.weightageSummary(cycle.id),
      ]);
      setActiveCycle(cycle);
      setApiGoals(goalData);
      setSummary(weightage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load goals");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(task);
    };
  }, [loadData]);

  const uiGoals = useMemo(() => apiGoals.map(toUiGoal), [apiGoals]);
  const totalWeight = summary?.total_weightage ?? uiGoals.reduce((sum, goal) => sum + goal.weightage, 0);
  const remaining = Math.max(0, 100 - totalWeight);
  const status = sheetStatus(apiGoals);
  const editable = apiGoals.every((goal) => goal.status === "draft" || goal.status === "returned");
  const errors = validateGoals(uiGoals, totalWeight);
  const valid = errors.length === 0;

  const addGoal = async (goal: Omit<UiGoal, "id">) => {
    if (!activeCycle) return;
    try {
      await goalsApi.create(activeCycle.id, toCreatePayload(goal));
      toast.success("Goal added");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add goal");
    }
  };

  const updateGoal = async (id: string, patch: Partial<UiGoal>) => {
    try {
      await goalsApi.update(id, toUpdatePayload(patch));
      toast.success("Goal updated");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update goal");
    }
  };

  const removeGoal = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    try {
      await goalsApi.delete(id);
      toast.success("Goal deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete goal");
    }
  };

  const submit = async () => {
    if (!activeCycle) return;
    try {
      await goalsApi.submit(activeCycle.id);
      toast.success("Goal sheet submitted for manager review");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit goals");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Loading your goal sheet...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 pb-32">
      <header className="animate-in-up mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <StatusPill status={status} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {user?.name} / {user?.role}
            </span>
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight">
            Performance Objectives
          </h1>
          <p className="mt-2 max-w-[55ch] text-pretty text-muted-foreground">
            Define thrust areas and measurable targets for {activeCycle?.name ?? "the current cycle"}.
            Maximum 8 goals. Weightage must total 100%.
          </p>
          {error && (
            <p className="mt-4 max-w-xl rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Total Weightage
            </span>
            <span className="font-mono text-3xl font-bold">
              {totalWeight}
              <span className="text-primary">%</span>
            </span>
          </div>
          <WeightageRing value={totalWeight} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="animate-in-up space-y-6 lg:col-span-4" style={{ animationDelay: "100ms" }}>
          <GoalForm
            remaining={remaining}
            goalCount={uiGoals.length}
            disabled={!editable || !(summary?.can_add_more ?? uiGoals.length < 8)}
            onAdd={addGoal}
          />
          <div className="flex items-start gap-4 rounded-xl border border-dashed border-border p-4">
            <div className="text-2xl">!</div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong className="block text-foreground">Why not?</strong>
              Align personal goals with efficiency, quality, and sustainability outcomes for
              maximum cross-team impact.
            </p>
          </div>
        </section>

        <section className="animate-in-up lg:col-span-8" style={{ animationDelay: "200ms" }}>
          <GoalTable
            goals={uiGoals}
            editable={editable}
            onUpdate={updateGoal}
            onRemove={removeGoal}
          />
        </section>
      </div>

      {editable && (
        <ValidationBar
          goalCount={uiGoals.length}
          totalWeight={totalWeight}
          valid={valid}
          errors={errors}
          ctaLabel="Submit Goal Sheet"
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function toUiGoal(goal: ApiGoal): UiGoal {
  return {
    id: goal.id,
    thrustArea: goal.thrust_area,
    title: goal.title,
    description: goal.description ?? "",
    uom: toUiUom(goal.uom),
    target: goal.uom === "timeline" ? numericTargetToDate(goal.target) : String(goal.target),
    deadline: goal.deadline ?? undefined,
    cadence: toUiCadence(goal.cadence),
    weightage: goal.weightage,
    status: toSheetStatus(goal.status),
  };
}

function toCreatePayload(goal: Omit<UiGoal, "id">): GoalCreatePayload {
  return {
    thrust_area: goal.thrustArea,
    title: goal.title,
    description: goal.description,
    uom: toApiUom(goal.uom),
    target: toApiTarget(goal.uom, goal.target),
    deadline: goal.deadline || null,
    cadence: toApiCadence(goal.cadence),
    weightage: goal.weightage,
  };
}

function toUpdatePayload(goal: Partial<UiGoal>): GoalUpdatePayload {
  const payload: GoalUpdatePayload = {};
  if (goal.thrustArea !== undefined) payload.thrust_area = goal.thrustArea;
  if (goal.title !== undefined) payload.title = goal.title;
  if (goal.description !== undefined) payload.description = goal.description;
  if (goal.uom !== undefined) payload.uom = toApiUom(goal.uom);
  if (goal.target !== undefined) payload.target = toApiTarget(goal.uom, goal.target);
  if (goal.deadline !== undefined) payload.deadline = goal.deadline || null;
  if (goal.cadence !== undefined) payload.cadence = toApiCadence(goal.cadence);
  if (goal.weightage !== undefined) payload.weightage = goal.weightage;
  return payload;
}

function toApiTarget(uom: UoM | undefined, target: string): number {
  if (uom === "Yes/No") return 1;
  if (uom === "Timeline") return dateToNumericTarget(target);
  const numericTarget = Number(target);
  return Number.isFinite(numericTarget) && numericTarget > 0 ? numericTarget : 1;
}

function dateToNumericTarget(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(timestamp)) return 1;
  return Math.floor(timestamp / 86_400_000);
}

function numericTargetToDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function toUiUom(uom: UnitOfMeasure): UoM {
  if (uom === "percentage") return "Percent";
  if (uom === "timeline") return "Timeline";
  if (uom === "zero_based") return "Zero-based";
  if (uom === "count") return "Count";
  if (uom === "currency") return "Currency";
  if (uom === "hours") return "Hours";
  if (uom === "rating") return "Rating";
  if (uom === "boolean") return "Yes/No";
  return "Numeric";
}

function toApiUom(uom: UoM): UnitOfMeasure {
  if (uom === "Percent") return "percentage";
  if (uom === "Timeline") return "timeline";
  if (uom === "Zero-based") return "zero_based";
  if (uom === "Count") return "count";
  if (uom === "Currency") return "currency";
  if (uom === "Hours") return "hours";
  if (uom === "Rating") return "rating";
  if (uom === "Yes/No") return "boolean";
  return "numeric";
}

function toUiCadence(cadence: GoalCadence): UiGoalCadence {
  if (cadence === "daily") return "Daily";
  if (cadence === "weekly") return "Weekly";
  if (cadence === "monthly") return "Monthly";
  if (cadence === "quarterly") return "Quarterly";
  return "Annual";
}

function toApiCadence(cadence?: UiGoalCadence): GoalCadence {
  if (cadence === "Daily") return "daily";
  if (cadence === "Weekly") return "weekly";
  if (cadence === "Monthly") return "monthly";
  if (cadence === "Quarterly") return "quarterly";
  return "annual";
}

function toSheetStatus(status: GoalStatus): SheetStatus {
  if (status === "pending_approval") return "Submitted";
  if (status === "approved") return "Approved";
  if (status === "returned") return "Returned";
  return "Draft";
}

function sheetStatus(goals: ApiGoal[]): SheetStatus {
  if (goals.length === 0) return "Draft";
  if (goals.every((goal) => goal.status === "approved")) return "Approved";
  if (goals.some((goal) => goal.status === "returned")) return "Returned";
  if (goals.some((goal) => goal.status === "pending_approval")) return "Submitted";
  return "Draft";
}

function validateGoals(goals: UiGoal[], totalWeight: number) {
  const errors: string[] = [];
  if (goals.length === 0) errors.push("Add at least one goal.");
  if (goals.length > 8) errors.push("Maximum 8 goals allowed.");
  if (totalWeight !== 100) errors.push("Total weightage must equal 100%.");
  return errors;
}
