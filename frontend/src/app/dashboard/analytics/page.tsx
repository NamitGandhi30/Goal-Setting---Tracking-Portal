"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bell, Building2, Download, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { cycles, reports, users as usersApi } from "@/lib/api";
import type { CheckInPhase, CompletionDashboard, DepartmentAnalytics, GoalCycle, TeamAnalytics } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES: CheckInPhase[] = ["Q1", "Q2", "Q3", "Q4"];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const isManager = role === "manager" || role === "admin";
  const isAdmin = role === "admin";

  const [teamStats, setTeamStats] = useState<TeamAnalytics[]>([]);
  const [deptStats, setDeptStats] = useState<DepartmentAnalytics[]>([]);
  const [completion, setCompletion] = useState<CompletionDashboard | null>(null);
  const [cycleList, setCycleList] = useState<GoalCycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [phase, setPhase] = useState<CheckInPhase>("Q1");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"team" | "org">(isManager && !isAdmin ? "team" : "org");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cycleData = await cycles.list();
      const selectedCycleId = cycleId || cycleData.find((cycle) => cycle.is_active)?.id || cycleData[0]?.id || "";
      setCycleList(cycleData);
      if (!cycleId && selectedCycleId) setCycleId(selectedCycleId);
      if (isAdmin) {
        const [teamData, deptData, completionData] = await Promise.all([
          usersApi.teamAnalytics(selectedCycleId, phase),
          usersApi.departmentAnalytics(selectedCycleId, phase),
          reports.completionDashboard(selectedCycleId, phase),
        ]);
        setTeamStats(teamData);
        setDeptStats(deptData);
        setCompletion(completionData);
      } else if (isManager) {
        const [teamData, completionData] = await Promise.all([
          usersApi.teamAnalytics(selectedCycleId, phase),
          reports.completionDashboard(selectedCycleId, phase),
        ]);
        setTeamStats(teamData);
        setCompletion(completionData);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [cycleId, phase, isAdmin, isManager]);

  const downloadCsv = async () => {
    if (!cycleId) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(reports.achievementCsvUrl(cycleId, phase), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Could not export report");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `achievement-report-${phase}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export report");
    }
  };

  const sendReminders = async () => {
    if (!cycleId) return;
    try {
      const result = await reports.sendCheckinReminders(cycleId, phase);
      toast.success(`${result.queued} reminder${result.queued === 1 ? "" : "s"} queued`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reminders");
    }
  };

  useEffect(() => {
    if (isManager) {
      const task = window.setTimeout(() => void loadData(), 0);
      return () => window.clearTimeout(task);
    }
  }, [loadData, isManager]);

  if (!isManager) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        You do not have access to the analytics dashboard.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 pb-32">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="size-4" aria-hidden="true" />
            Performance Insights
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Analytics Dashboard</h1>
          <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
            Monitor team progress and organizational alignment metrics.
          </p>
        </div>

        {isAdmin && (
          <ViewToggle tab={tab} setTab={setTab} />
        )}
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={cycleId}
          onChange={(event) => setCycleId(event.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          {cycleList.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {PHASES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPhase(item)}
              className={cn(
                "rounded px-3 py-2 text-xs font-bold",
                phase === item ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-secondary"
        >
          <Download className="size-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => void sendReminders()}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-bold uppercase tracking-wider text-background hover:bg-primary"
        >
          <Bell className="size-4" />
          Remind
        </button>
      </div>

      {completion && (
        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="Check-in Completion"
            value={`${Math.round(completion.organization.completion_rate)}%`}
            accent="text-primary"
          />
          <MetricCard label="Completed Check-ins" value={completion.organization.completed_checkins} />
          <MetricCard label="Missing Employees" value={completion.missing_employees.length} accent="text-amber-600" />
        </section>
      )}

      {/* ── My Team Analytics ───────────────────────────── */}
      {tab === "team" && (
        <section className="animate-in-up">
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <MetricCard label={isAdmin ? "Employees" : "Direct Reports"} value={teamStats.length} />
            <MetricCard label="Approved Goals" value={sum(teamStats, "goal_count")} />
            <MetricCard label="Logged Goals" value={sum(teamStats, "logged_count")} />
            <MetricCard label="Avg Score" value={`${average(teamStats.map((item) => item.weighted_score))}%`} accent="text-primary" />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Employee Performance
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <Th>Employee</Th>
                  <Th className="text-right">Goal Count</Th>
                  <Th className="text-right">Logged</Th>
                  <Th className="text-right">At Risk</Th>
                  <Th className="text-right">Score</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {teamStats.map((emp) => (
                  <tr key={emp.user_id} className="group transition-colors hover:bg-secondary/40">
                    <td className="px-6 py-4">
                      <p className="font-bold">{emp.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {emp.employee_id} / {emp.department ?? "No department"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">{emp.goal_count}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">{emp.logged_count}</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600">{emp.at_risk_count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-mono font-bold">{Math.round(emp.weighted_score)}%</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              emp.weighted_score >= 100 ? "bg-blue-500" :
                              emp.weighted_score >= 70 ? "bg-emerald-500" :
                              emp.weighted_score > 0 ? "bg-amber-500" : "bg-zinc-300"
                            )}
                            style={{ width: `${Math.min(emp.weighted_score, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {teamStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No employee analytics found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {completion && completion.missing_employees.length > 0 && (
            <div className="mt-6 rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Missing Check-ins
                </h2>
              </div>
              <div className="divide-y divide-border">
                {completion.missing_employees.slice(0, 12).map((employee) => (
                  <div key={employee.user_id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <div>
                      <p className="font-bold">{employee.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {employee.employee_id} / {employee.department ?? "No department"}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-600">
                      {employee.missing_goal_count} missing
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Organization Analytics ──────────────────────── */}
      {tab === "org" && isAdmin && (
        <section className="animate-in-up">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard label="Total Departments" value={deptStats.length} />
            <MetricCard
              label="Overall Org Score"
              value={`${average(deptStats.map((item) => item.avg_weighted_score))}%`}
              accent="text-primary"
            />
            <MetricCard
              label="Total Tracked Goals"
              value={deptStats.reduce((acc, curr) => acc + curr.total_goals, 0)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {deptStats.map((dept) => (
              <div key={dept.department || "unassigned"} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{dept.department || "Unassigned"}</h3>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {dept.employee_count} Employees
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold">{Math.round(dept.avg_weighted_score)}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Avg Score
                    </p>
                  </div>
                </div>

                <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      dept.avg_weighted_score >= 100 ? "bg-blue-500" :
                      dept.avg_weighted_score >= 70 ? "bg-emerald-500" :
                      dept.avg_weighted_score > 0 ? "bg-amber-500" : "bg-zinc-300"
                    )}
                    style={{ width: `${Math.min(dept.avg_weighted_score, 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <SmallStat label="With Goals" value={dept.employees_with_goals} />
                  <SmallStat label="Logged" value={dept.total_logged} />
                  <SmallStat label="Completed" value={dept.total_completed} />
                  <SmallStat label="At Risk" value={dept.total_at_risk} accent="text-amber-600" />
                </div>
              </div>
            ))}
            {deptStats.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                No departmental data available yet. Ensure employees are assigned to departments.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <p className={cn("mt-2 font-mono text-3xl font-extrabold", accent)}>{value}</p>
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className={cn("mt-1 font-mono text-lg font-bold", accent)}>{value}</p>
    </div>
  );
}

function ViewToggle({
  tab,
  setTab,
}: {
  tab: "team" | "org";
  setTab: (tab: "team" | "org") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => setTab("org")}
        className={cn(
          "rounded px-3 py-2 text-xs font-bold",
          tab === "org" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Building2 className="mr-1.5 inline-block size-3.5" />
        Organization
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
  );
}

function sum(items: TeamAnalytics[], key: keyof Pick<TeamAnalytics, "goal_count" | "logged_count">) {
  return items.reduce((total, item) => total + item[key], 0);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground", className)}>{children}</th>;
}
