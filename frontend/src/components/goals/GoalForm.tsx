import { useState } from "react";
import { THRUST_AREAS, type Goal, type UoM } from "@/lib/goals/types";

interface Props {
  remaining: number;
  goalCount: number;
  onAdd: (goal: Omit<Goal, "id">) => void;
  disabled?: boolean;
}

const UOM_OPTIONS: UoM[] = ["Numeric", "Percent", "Timeline", "Zero-based"];

export function GoalForm({ remaining, goalCount, onAdd, disabled }: Props) {
  const [thrustArea, setThrustArea] = useState<(typeof THRUST_AREAS)[number]>(THRUST_AREAS[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState<UoM>("Numeric");
  const [target, setTarget] = useState("");
  const [weightage, setWeightage] = useState<number>(Math.max(10, Math.min(remaining, 20)));
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setTarget("");
    setWeightage(Math.max(10, Math.min(remaining, 20)));
    setErr(null);
  };

  const submit = () => {
    if (disabled) return;
    if (!title.trim()) return setErr("Title is required");
    if (uom === "Zero-based" ? false : !target.trim()) return setErr("Target is required");
    if (weightage < 10) return setErr("Minimum weightage is 10%");
    if (goalCount >= 8) return setErr("Maximum 8 goals reached");
    onAdd({
      thrustArea,
      title: title.trim(),
      description: description.trim(),
      uom,
      target: uom === "Zero-based" ? "0" : target.trim(),
      weightage: Number(weightage),
    });
    reset();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        Add New Objective
      </h2>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
            Thrust Area
          </label>
          <select
            value={thrustArea}
            onChange={(e) => setThrustArea(e.target.value as (typeof THRUST_AREAS)[number])}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            {THRUST_AREAS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
            Goal Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reduce motor noise by 15%"
            disabled={disabled}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional context"
            disabled={disabled}
            className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
              UoM
            </label>
            <select
              value={uom}
              onChange={(e) => setUom(e.target.value as UoM)}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {UOM_OPTIONS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
              Weightage
            </label>
            <div className="relative">
              <input
                type="number"
                min={10}
                max={100}
                value={weightage}
                onChange={(e) => setWeightage(Number(e.target.value))}
                disabled={disabled}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
            Target
          </label>
          {uom === "Timeline" ? (
            <input
              type="date"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          ) : uom === "Zero-based" ? (
            <input
              type="text"
              value="0"
              readOnly
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm font-bold text-muted-foreground"
            />
          ) : (
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={uom === "Percent" ? "e.g. 98.5" : "e.g. 12"}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          )}
        </div>

        {err && (
          <p className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-semibold text-destructive">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={disabled || goalCount >= 8}
          className="w-full rounded-md bg-foreground py-3 text-xs font-bold uppercase tracking-widest text-background transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add to Goal Sheet
        </button>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {goalCount} / 8 used · {remaining}% remaining
        </p>
      </div>
    </div>
  );
}
