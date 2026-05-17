"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  MessageSquare,
  Save,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { cycles, goals as goalsApi, tracking } from "@/lib/api";
import type {
  CheckInPhase,
  Goal,
  GoalCheckIn,
  GoalCycle,
  TeamTrackingGoal,
  TrackingSummary,
  TrackingWindow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES: CheckInPhase[] = ["Q1", "Q2", "Q3", "Q4"];

const CADENCE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "border-zinc-300 bg-zinc-50 text-zinc-600",
  on_track: "border-emerald-300 bg-emerald-50 text-emerald-700",
  at_risk: "border-amber-300 bg-amber-50 text-amber-700",
  completed: "border-blue-300 bg-blue-50 text-blue-700",
};

export default function TrackingPage() {
  const { user } = useAuth();
  const role = user?.role;
  const [cycle, setCycle] = useState<GoalCycle | null>(null);
  const [phase, setPhase] = useState<CheckInPhase>("Q1");
  const [myGoals, setMyGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<GoalCheckIn[]>([]);
  const [teamGoals, setTeamGoals] = useState<TeamTrackingGoal[]>([]);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [windows, setWindows] = useState<TrackingWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"my" | "team">("my");

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
        isManager ? tracking.teamGoals(activeCycle.id, phase) : Promise.resolve([]),
      ]);
      setCycle(activeCycle);
      setMyGoals(goalData.filter((goal) => goal.status === "approved"));
      setCheckins(checkinData);
      setSummary(summaryData);
      setWindows(windowData);
      setTeamGoals(teamData);
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

  const isManager = role === "manager" || role === "admin";

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

        <div className="flex items-center gap-3">
          {isManager && (
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setTab("my")}
                className={cn(
                  "rounded px-3 py-2 text-xs font-bold",
                  tab === "my" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                My Goals
              </button>
              <button
                type="button"
                onClick={() => setTab("team")}
                className={cn(
                  "rounded px-3 py-2 text-xs font-bold",
                  tab === "team" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="mr-1.5 inline-block size-3.5" />
                Team
              </button>
            </div>
          )}
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
        </div>
      </header>

      {/* ── Summary Metrics ───────────────────────────────── */}
      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <Metric icon={Gauge} label="Weighted Score" value={`${summary?.weighted_score ?? 0}%`}
          accent={
            (summary?.weighted_score ?? 0) >= 80 ? "text-emerald-600" :
            (summary?.weighted_score ?? 0) >= 50 ? "text-amber-600" : "text-rose-600"
          }
        />
        <Metric icon={CheckCircle2} label="Logged" value={`${summary?.logged_count ?? 0}/${summary?.goal_count ?? 0}`} />
        <Metric icon={AlertTriangle} label="At Risk" value={String(summary?.at_risk_count ?? 0)}
          accent={(summary?.at_risk_count ?? 0) > 0 ? "text-amber-600" : undefined}
        />
        <Metric icon={CalendarDays} label="Window" value={summary?.window_open ? "Open" : "Closed"}
          accent={summary?.window_open ? "text-emerald-600" : "text-rose-600"}
        />
      </section>

      {/* ── My Goals Tab ──────────────────────────────────── */}
      {tab === "my" && (
        <div className="grid gap-8 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-8">
            {myGoals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Approved goals will appear here for quarterly tracking.
              </div>
            ) : (
              <>
                {/* Group by cadence */}
                {Object.entries(groupByCadence(myGoals)).map(([cadence, cadenceGoals]) => (
                  <div key={cadence}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        cadence === "daily" ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200" :
                        cadence === "weekly" ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200" :
                        cadence === "monthly" ? "bg-teal-100 text-teal-700 ring-1 ring-teal-200" :
                        cadence === "quarterly" ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200" :
                        "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                      )}>
                        <Clock className="mr-1 inline-block size-2.5" />
                        {CADENCE_LABEL[cadence] ?? cadence}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {cadenceGoals.length} goal{cadenceGoals.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {cadenceGoals.map((goal) => {
                        const ci = checkinsByGoal.get(goal.id);
                        return (
                          <CheckInCard
                            key={`${goal.id}-${ci?.updated_at ?? "new"}-${phase}`}
                            goal={goal}
                            checkin={ci}
                            windowOpen={summary?.window_open ?? false}
                            onSave={saveCheckin}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
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
                      <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
                        {window.window_type.replace("_", " ")} {window.phase ? `· ${window.phase}` : ""}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {window.start_date} to {window.end_date}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Progress breakdown */}
            {myGoals.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider">Progress Breakdown</h2>
                <div className="mt-4 space-y-2">
                  {myGoals.map((goal) => {
                    const ci = checkinsByGoal.get(goal.id);
                    const score = ci?.progress_score ?? 0;
                    return (
                      <div key={goal.id}>
                        <div className="flex items-center justify-between">
                          <p className="max-w-[18ch] truncate text-xs font-bold">{goal.title}</p>
                          <span className="font-mono text-[10px] font-bold">{score}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              score >= 100 ? "bg-blue-500" :
                              score >= 70 ? "bg-emerald-500" :
                              score > 0 ? "bg-amber-500" : "bg-zinc-300"
                            )}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ── Team Tab ──────────────────────────────────────── */}
      {tab === "team" && isManager && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Team Check-ins
            </h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
              {teamGoals.length}
            </span>
          </div>

          {/* Team summary stats */}
          {teamGoals.length > 0 && (
            <div className="mb-6 grid gap-3 md:grid-cols-4">
              <MiniStat label="Tracked Goals" value={teamGoals.length} />
              <MiniStat
                label="Completed"
                value={teamGoals.filter((c) => c.progress_status === "completed").length}
                accent="text-blue-600"
              />
              <MiniStat
                label="On Track"
                value={teamGoals.filter((c) => c.progress_status === "on_track").length}
                accent="text-emerald-600"
              />
              <MiniStat
                label="At Risk"
                value={teamGoals.filter((c) => c.progress_status === "at_risk").length}
                accent="text-amber-600"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {teamGoals.map((row) => (
              <TeamCheckInCard key={`${row.goal_id}-${row.updated_at ?? "empty"}-${phase}`} item={row} onReview={reviewCheckin} />
            ))}
            {teamGoals.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2">
                Approved team goals will appear here after the goal sheet is approved.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Helper components ────────────────────────────────── */

function groupByCadence(goals: Goal[]): Record<string, Goal[]> {
  const order = ["daily", "weekly", "monthly", "quarterly", "annual"];
  const groups: Record<string, Goal[]> = {};
  for (const goal of goals) {
    const key = goal.cadence || "annual";
    if (!groups[key]) groups[key] = [];
    groups[key].push(goal);
  }
  // Sort by cadence order
  const sorted: Record<string, Goal[]> = {};
  for (const c of order) {
    if (groups[c]) sorted[c] = groups[c];
  }
  return sorted;
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className={cn("mt-3 font-mono text-3xl font-bold", accent)}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className={cn("mt-1 font-mono text-2xl font-bold", accent)}>{value}</p>
    </div>
  );
}

function TeamCheckInCard({
  item,
  onReview,
}: {
  item: TeamTrackingGoal;
  onReview: (checkinId: string, comment: string, rating?: number) => Promise<void>;
}) {
  const [comment, setComment] = useState(item.manager_comment ?? "");
  const [rating, setRating] = useState(item.manager_rating ? String(item.manager_rating) : "");

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{item.owner_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.goal_title}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {item.owner_employee_id} / {item.owner_department ?? "No department"} / {item.thrust_area}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {CADENCE_LABEL[item.cadence]} / target {item.target} / {item.weightage}%{item.deadline ? ` / due ${item.deadline}` : ""}
          </p>
        </div>
        <span className={cn(
          "rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
          STATUS_COLORS[item.progress_status] ?? "bg-muted text-muted-foreground",
        )}>
          {item.progress_status.replace("_", " ")}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual</span>
          <p className="mt-1 font-mono text-lg font-bold">{item.actual_value ?? "-"}</p>
        </div>
        <div className="md:col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
          <p className="mt-1 font-mono text-lg font-bold">{item.progress_score}%</p>
        </div>
        <label className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rating</span>
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            disabled={!item.checkin_id}
            onChange={(event) => setRating(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm disabled:opacity-50"
          />
        </label>
        <label className="md:col-span-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manager Comment</span>
          <input
            value={comment}
            disabled={!item.checkin_id}
            onChange={(event) => setComment(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
      </div>
      {item.employee_comment && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
          <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-bold">Employee:</span> {item.employee_comment}
          </p>
        </div>
      )}
      {item.self_rating && (
        <p className="mt-2 text-[10px] font-bold text-muted-foreground">
          Self rating: {item.self_rating}/5
        </p>
      )}
      {!item.checkin_id && (
        <p className="mt-3 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Employee has not logged this phase yet.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!item.checkin_id}
          onClick={() => item.checkin_id && void onReview(item.checkin_id, comment, rating ? Number(rating) : undefined)}
          className="rounded-md bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-background disabled:opacity-40"
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{goal.title}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {goal.thrust_area} / target {goal.target} / {goal.weightage}%
            {goal.deadline && ` / due ${goal.deadline}`}
          </p>
        </div>
        <span className={cn(
          "shrink-0 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
          STATUS_COLORS[checkin?.progress_status ?? "not_started"] ?? STATUS_COLORS.not_started
        )}>
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
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Score
              </span>
              <span className="ml-2 font-mono font-bold">{checkin.progress_score}%</span>
            </div>
            {checkin.self_rating && (
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Self
                </span>
                <span className="ml-2 font-mono font-bold">{checkin.self_rating}/5</span>
              </div>
            )}
            {checkin.manager_rating && (
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manager
                </span>
                <span className="ml-2 font-mono font-bold">{checkin.manager_rating}/5</span>
              </div>
            )}
          </div>
          {checkin.manager_comment && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2">
              <MessageSquare className="mt-0.5 size-3 shrink-0 text-blue-600" />
              <p className="text-xs text-blue-800">
                <span className="font-bold">Manager:</span> {checkin.manager_comment}
              </p>
            </div>
          )}
          {checkin.employee_comment && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
              <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                <span className="font-bold">Your note:</span> {checkin.employee_comment}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
