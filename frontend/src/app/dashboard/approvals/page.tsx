"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReturnDialog } from "@/components/goals/ReturnDialog";
import { StatusPill } from "@/components/goals/StatusPill";
import { useAuth } from "@/context/AuthContext";
import { approvals as approvalsApi } from "@/lib/api";
import type { GoalWithOwner } from "@/lib/types";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<GoalWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      setPending(await approvalsApi.pending());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load approval queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadPending();
    }, 0);
    return () => {
      window.clearTimeout(task);
    };
  }, [loadPending]);

  const groups = useMemo(() => {
    return Object.entries(
      pending.reduce<Record<string, GoalWithOwner[]>>((acc, goal) => {
        const key = goal.owner_name || goal.user_id;
        acc[key] = [...(acc[key] ?? []), goal];
        return acc;
      }, {}),
    );
  }, [pending]);

  const approve = async (goal: GoalWithOwner) => {
    try {
      await approvalsApi.approve(goal.id);
      toast.success(`Approved: ${goal.title}`);
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve goal");
    }
  };

  const returnGoal = async (goal: GoalWithOwner, comment: string) => {
    try {
      await approvalsApi.returnGoal(goal.id, comment);
      toast.info(`Returned: ${goal.title}`);
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not return goal");
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="animate-in-up mb-10">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Manager view
        </span>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Approval Queue</h1>
        <p className="mt-2 max-w-[55ch] text-muted-foreground">
          Review submitted goals, then approve or return them with context for rework.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Pending action
          </h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary ring-1 ring-primary/20">
            {pending.length}
          </span>
        </div>

        {loading ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Loading approvals...
          </p>
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No goals awaiting approval.
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map(([employeeName, goals]) => (
              <div key={employeeName}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{employeeName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {goals[0]?.owner_employee_id ?? "Employee"} / {goals.length} goals /{" "}
                      {goals.reduce((sum, goal) => sum + goal.weightage, 0)}% weight
                    </p>
                  </div>
                  <StatusPill status="Submitted" />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {goals.map((goal) => (
                    <GoalReviewCard
                      key={goal.id}
                      goal={goal}
                      onApprove={() => approve(goal)}
                      onReturn={(comment) => returnGoal(goal, comment)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GoalReviewCard({
  goal,
  onApprove,
  onReturn,
}: {
  goal: GoalWithOwner;
  onApprove: () => void;
  onReturn: (comment: string) => void;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{goal.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{goal.thrust_area}</p>
          {goal.description && (
            <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{goal.description}</p>
          )}
        </div>
        <span className="rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/70">
          {goal.weightage}%
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <div className="flex gap-6">
          <Stat label="Target" value={String(goal.target)} />
          <Stat label="UoM" value={goal.uom.replace("_", " ")} />
        </div>
        <div className="flex gap-2">
          <ReturnDialog
            title="Return goal"
            description={`Add a comment for ${goal.owner_name ?? "the employee"}.`}
            onConfirm={onReturn}
            trigger={
              <button
                type="button"
                className="rounded border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-secondary"
              >
                Return
              </button>
            }
          />
          <button
            type="button"
            onClick={onApprove}
            className="rounded bg-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-background hover:bg-primary"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm font-bold capitalize">{value}</span>
    </div>
  );
}
