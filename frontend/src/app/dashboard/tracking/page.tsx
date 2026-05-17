"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, Gauge, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { cycles, goals as goalsApi, tracking } from "@/lib/api";
import type {
  CheckInPhase,
  Goal,
  GoalCheckIn,
  GoalCycle,
  TeamGoalCheckIn,
  TrackingSummary,
  TrackingWindow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES: CheckInPhase[] = ["Q1", "Q2", "Q3", "Q4"];

export default function TrackingPage() {
  const { user } = useAuth();
  const role = user?.role;
  const [cycle, setCycle] = useState<GoalCycle | null>(null);
  const [phase, setPhase] = useState<CheckInPhase>("Q1");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<GoalCheckIn[]>([]);
  const [teamCheckins, setTeamCheckins] = useState<TeamGoalCheckIn[]>([]);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [windows, setWindows] = useState<TrackingWindow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const activeCycle = await cycles.active();
      const isManager = role === "manager" || role === "admin";
      const [goalData, checkinData, summaryData, windowData, teamData] = await Promise.all([
        goalsApi.list(activeCycle.id),
        tracking.checkins(activeCycle.id, phase),
        tracking.summary(activeCycle.id, phase),
        tracking.windows(activeCycle.id),
        isManager ? tracking.teamCheckins(phase) : Promise.resolve([]),
      ]);
      setCycle(activeCycle);
      setGoals(goalData.filter((goal) => goal.status === "approved"));
      setCheckins(checkinData);
      setSummary(summaryData);
      setWindows(windowData);
      setTeamCheckins(teamData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load tracking data");
    } finally {
      setLoading(false);
    }
  }, [phase, role]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(task);
    };
  }, [loadData]);

  const checkinsByGoal = useMemo(
    () => new Map(checkins.map((checkin) => [checkin.goal_id, checkin])),
    [checkins],
  );

  const saveCheckin = async (goalId: string, actualValue: number, note: string, rating?: number) => {
    try {
      await tracking.upsertCheckin(goalId, {
        phase,
        actual_value: actualValue,
        employee_comment: note || undefined,
        self_rating: rating,
      });
      toast.success("Check-in saved");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save check-in");
    }
  };

  const reviewCheckin = async (checkinId: string, comment: string, rating?: number) => {
    try {
      await tracking.managerReview(checkinId, {
        manager_comment: comment || undefined,
        manager_rating: rating,
      });
      toast.success("Manager review saved");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save manager review");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Loading tracking workspace...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 pb-32">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Activity className="size-4" aria-hidden="true" />
            Phase 2 Governance
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Quarterly Tracking</h1>
          <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
            Log actual achievements, view formula scores, and keep manager check-ins tied to
            {cycle ? ` ${cycle.name}` : " the active cycle"}.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {PHASES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPhase(item)}
              className={cn(
                "rounded px-4 py-2 text-xs font-bold",
                phase === item ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <Metric icon={Gauge} label="Weighted Score" value={`${summary?.weighted_score ?? 0}%`} />
        <Metric icon={CheckCircle2} label="Logged" value={`${summary?.logged_count ?? 0}/${summary?.goal_count ?? 0}`} />
        <Metric icon={Activity} label="At Risk" value={String(summary?.at_risk_count ?? 0)} />
        <Metric icon={CalendarDays} label="Window" value={summary?.window_open ? "Open" : "Closed"} />
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8">
          {goals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Approved goals will appear here for quarterly tracking.
            </div>
          ) : (
            goals.map((goal) => (
              <CheckInCard
                key={`${goal.id}-${checkinsByGoal.get(goal.id)?.updated_at ?? "new"}`}
                goal={goal}
                checkin={checkinsByGoal.get(goal.id)}
                windowOpen={summary?.window_open ?? false}
                onSave={saveCheckin}
              />
            ))
          )}
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider">Governance Windows</h2>
            <div className="mt-4 space-y-3">
              {windows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom windows configured. The active cycle dates are used as fallback.
                </p>
              ) : (
                windows.map((window) => (
                  <div key={window.id} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{window.name}</p>
                      <span
                        className={cn(
                          "rounded px-2 py-1 text-[10px] font-bold uppercase",
                          window.is_open ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {window.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {window.start_date} to {window.end_date}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {(role === "manager" || role === "admin") && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Team check-ins
            </h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
              {teamCheckins.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {teamCheckins.map((checkin) => (
              <TeamCheckInCard key={checkin.id} checkin={checkin} onReview={reviewCheckin} />
            ))}
            {teamCheckins.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2">
                Team check-ins will appear here after employees log progress.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-3 font-mono text-3xl font-bold">{value}</p>
    </div>
  );
}

function TeamCheckInCard({
  checkin,
  onReview,
}: {
  checkin: TeamGoalCheckIn;
  onReview: (checkinId: string, comment: string, rating?: number) => Promise<void>;
}) {
  const [comment, setComment] = useState(checkin.manager_comment ?? "");
  const [rating, setRating] = useState(checkin.manager_rating ? String(checkin.manager_rating) : "");

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{checkin.owner_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{checkin.goal_title}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {checkin.owner_employee_id} / {checkin.thrust_area}
          </p>
        </div>
        <span className="rounded bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {checkin.progress_status.replace("_", " ")}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual</span>
          <p className="mt-1 font-mono text-lg font-bold">{checkin.actual_value}</p>
        </div>
        <div className="md:col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
          <p className="mt-1 font-mono text-lg font-bold">{checkin.progress_score}%</p>
        </div>
        <label className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rating</span>
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="md:col-span-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manager Comment</span>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      {checkin.employee_comment && (
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Employee: {checkin.employee_comment}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void onReview(checkin.id, comment, rating ? Number(rating) : undefined)}
          className="rounded-md bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-background"
        >
          Save Review
        </button>
      </div>
    </article>
  );
}

function CheckInCard({
  goal,
  checkin,
  windowOpen,
  onSave,
}: {
  goal: Goal;
  checkin?: GoalCheckIn;
  windowOpen: boolean;
  onSave: (goalId: string, actualValue: number, note: string, rating?: number) => Promise<void>;
}) {
  const [actual, setActual] = useState(checkin ? String(checkin.actual_value) : "");
  const [note, setNote] = useState(checkin?.employee_comment ?? "");
  const [rating, setRating] = useState(checkin?.self_rating ? String(checkin.self_rating) : "");

  const submit = () => {
    const actualValue = Number(actual);
    if (!Number.isFinite(actualValue)) {
      toast.error("Enter a valid actual value");
      return;
    }
    void onSave(goal.id, actualValue, note, rating ? Number(rating) : undefined);
  };

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-bold">{goal.title}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {goal.thrust_area} / target {goal.target} / {goal.weightage}%
          </p>
        </div>
        <span className="rounded bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {checkin?.progress_status?.replace("_", " ") ?? "Not logged"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-12">
        <label className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual</span>
          <input
            type="number"
            value={actual}
            disabled={!windowOpen}
            onChange={(event) => setActual(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm disabled:opacity-60"
          />
        </label>
        <label className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Self Rating</span>
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            disabled={!windowOpen}
            onChange={(event) => setRating(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm disabled:opacity-60"
          />
        </label>
        <label className="md:col-span-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comment</span>
          <input
            value={note}
            disabled={!windowOpen}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </label>
        <div className="flex items-end md:col-span-2">
          <button
            type="button"
            onClick={submit}
            disabled={!windowOpen}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-bold uppercase tracking-wider text-background disabled:opacity-40"
          >
            <Save className="size-4" aria-hidden="true" />
            Save
          </button>
        </div>
      </div>

      {checkin && (
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Score
          </span>
          <span className="ml-2 font-mono font-bold">{checkin.progress_score}%</span>
          {checkin.manager_comment && (
            <p className="mt-2 text-muted-foreground">Manager: {checkin.manager_comment}</p>
          )}
        </div>
      )}
    </article>
  );
}
