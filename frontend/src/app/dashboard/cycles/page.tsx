"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cycles as cyclesApi } from "@/lib/api";
import type { GoalCycle, GoalCycleCreatePayload } from "@/lib/types";

export default function CyclesPage() {
  const [allCycles, setAllCycles] = useState<GoalCycle[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<GoalCycleCreatePayload>({
    name: "",
    year: new Date().getFullYear(),
    start_date: "",
    end_date: "",
  });

  const loadCycles = useCallback(async () => {
    try {
      setAllCycles(await cyclesApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load cycles");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadCycles(), 0);
    return () => window.clearTimeout(task);
  }, [loadCycles]);

  const handleCreate = async () => {
    setError("");
    try {
      await cyclesApi.create(form);
      toast.success("Goal cycle created");
      setShowModal(false);
      setForm({ name: "", year: new Date().getFullYear(), start_date: "", end_date: "" });
      await loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cycle");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="animate-in-up mb-10 flex items-end justify-between gap-6">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Admin / HR
          </span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Goal Cycles</h1>
          <p className="mt-2 max-w-[55ch] text-muted-foreground">
            Create and monitor review windows used by the goal setting workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-md bg-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-background hover:bg-primary"
        >
          New cycle
        </button>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <Th>Name</Th>
              <Th>Year</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {allCycles.map((cycle) => (
              <tr key={cycle.id}>
                <td className="px-6 py-4 font-bold">{cycle.name}</td>
                <td className="px-6 py-4 font-mono">{cycle.year}</td>
                <td className="px-6 py-4 text-muted-foreground">{cycle.start_date}</td>
                <td className="px-6 py-4 text-muted-foreground">{cycle.end_date}</td>
                <td className="px-6 py-4">
                  <span className={cycle.is_active ? activeBadge : neutralBadge}>
                    {cycle.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {allCycles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No cycles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-extrabold tracking-tight">Create Goal Cycle</h2>
            {error && <p className="mt-4 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="mt-5 grid gap-4">
              <Field label="Cycle name">
                <input className="field" placeholder="FY 2026-27" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Year">
                <input className="field" type="number" value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: Number(event.target.value) }))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Start date">
                  <input className="field" type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                </Field>
                <Field label="End date">
                  <input className="field" type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
                </Field>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const activeBadge = "inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700";
const neutralBadge = "inline-flex rounded border border-border bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</th>;
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
