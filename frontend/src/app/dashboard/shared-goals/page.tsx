"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cycles, sharedGoals as sharedApi, users as usersApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { GoalCadence, GoalCycle, SharedGoalCreatePayload, UnitOfMeasure, User } from "@/lib/types";

const UOM_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: "numeric", label: "Numeric" },
  { value: "percentage", label: "Percentage" },
  { value: "timeline", label: "Timeline" },
  { value: "zero_based", label: "Zero Based" },
  { value: "count", label: "Count" },
  { value: "currency", label: "Currency" },
  { value: "hours", label: "Hours" },
  { value: "rating", label: "Rating" },
  { value: "boolean", label: "Yes / No" },
];

const CADENCE_OPTIONS: { value: GoalCadence; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "quarterly", label: "Quarterly" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
];

export default function SharedGoalsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<User[]>([]);
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Omit<SharedGoalCreatePayload, "assigned_to_user_ids">>({
    thrust_area: "",
    title: "",
    description: "",
    uom: "numeric",
    target: 0,
    deadline: null,
    cadence: "annual",
    weightage: 10,
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [cycle, people] = await Promise.all([
        cycles.active().catch(() => null),
        user.role === "admin"
          ? usersApi.list().then((all) => all.filter((person) => person.role === "employee"))
          : usersApi.reports(user.id),
      ]);
      setActiveCycle(cycle);
      setReports(people);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load employees");
    }
  }, [user]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(task);
  }, [loadData]);

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      setError("Select at least one employee");
      return;
    }
    setError("");
    try {
      await sharedApi.create({ ...form, assigned_to_user_ids: selectedUsers }, activeCycle?.id);
      toast.success(`Shared goal pushed to ${selectedUsers.length} employees`);
      setSelectedUsers([]);
      setForm({ thrust_area: "", title: "", description: "", uom: "numeric", target: 0, deadline: null, cadence: "annual", weightage: 10 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shared goal");
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((current) =>
      current.includes(id) ? current.filter((userId) => userId !== id) : [...current, id],
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="animate-in-up mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Manager / Admin
          </span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Shared Goals</h1>
          <p className="mt-2 max-w-[55ch] text-muted-foreground">
            Push departmental KPIs to multiple employees. Each employee receives an editable copy
            in the current cycle.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Active cycle
          </span>
          <p className="mt-1 text-sm font-bold">{activeCycle?.name ?? "No active cycle"}</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Create shared KPI
          </h2>
          {error && <p className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Field label="Thrust area">
            <input className="field" placeholder="Department KPI" value={form.thrust_area} onChange={(event) => setForm((current) => ({ ...current, thrust_area: event.target.value }))} />
          </Field>
          <Field label="Goal title">
            <input className="field" placeholder="Achieve 99.9% uptime" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className="field min-h-20 resize-none" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="UoM">
              <select className="field" value={form.uom} onChange={(event) => setForm((current) => ({ ...current, uom: event.target.value as UnitOfMeasure }))}>
                {UOM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Cadence">
              <select className="field" value={form.cadence} onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value as GoalCadence }))}>
                {CADENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <input className="field" type="date" value={form.deadline ?? ""} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value || null }))} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Target">
              <input className="field" type="number" value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Weight">
              <input className="field" type="number" min={10} max={100} value={form.weightage} onChange={(event) => setForm((current) => ({ ...current, weightage: Number(event.target.value) || 0 }))} />
            </Field>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="w-full rounded-md bg-foreground py-3 text-xs font-bold uppercase tracking-widest text-background transition-colors hover:bg-primary disabled:opacity-40"
          >
            Push to {selectedUsers.length} employee{selectedUsers.length === 1 ? "" : "s"}
          </button>
        </section>

        <section className="lg:col-span-7">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Assign to
            </h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
              {selectedUsers.length} / {reports.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {reports.map((person) => {
              const selected = selectedUsers.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggleUser(person.id)}
                  className={`rounded-xl border p-4 text-left shadow-sm transition-all ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/20"
                  }`}
                >
                  <p className="text-sm font-bold">{person.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {person.employee_id} / {person.department ?? "No department"}
                  </p>
                </button>
              );
            })}
            {reports.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2">
                No employees found.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1 [&_.field]:w-full [&_.field]:rounded [&_.field]:border [&_.field]:border-border [&_.field]:bg-background [&_.field]:px-3 [&_.field]:py-2 [&_.field]:text-sm [&_.field]:outline-none [&_.field]:focus:ring-2 [&_.field]:focus:ring-primary/30">
        {children}
      </div>
    </label>
  );
}
