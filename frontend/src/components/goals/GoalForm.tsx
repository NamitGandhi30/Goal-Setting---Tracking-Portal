import { useState } from "react";
import { THRUST_AREAS, type Goal, type GoalCadence, type UoM } from "@/lib/goals/types";

interface Props {
  remaining: number;
  goalCount: number;
  onAdd: (goal: Omit<Goal, "id">) => void;
  disabled?: boolean;
}

const UOM_OPTIONS: UoM[] = [
  "Numeric",
  "Percent",
  "Timeline",
  "Zero-based",
  "Count",
  "Currency",
  "Hours",
  "Rating",
  "Yes/No",
];
const CADENCE_OPTIONS: GoalCadence[] = ["Annual", "Quarterly", "Monthly", "Weekly", "Daily"];
const CUSTOM_THRUST = "Custom";

export function GoalForm({ remaining, goalCount, onAdd, disabled }: Props) {
  const [thrustArea, setThrustArea] = useState<string>(THRUST_AREAS[0]);
  const [customThrustArea, setCustomThrustArea] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState<UoM>("Numeric");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [cadence, setCadence] = useState<GoalCadence>("Annual");
  const [weightage, setWeightage] = useState<number>(Math.max(10, Math.min(remaining, 20)));
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setTarget("");
    setDeadline("");
    setCadence("Annual");
    setWeightage(Math.max(10, Math.min(remaining, 20)));
    setErr(null);
  };

  const submit = () => {
    if (disabled) return;
    const finalThrustArea = thrustArea === CUSTOM_THRUST ? customThrustArea.trim() : thrustArea;
    if (!finalThrustArea) return setErr("Thrust area is required");
    if (!title.trim()) return setErr("Title is required");
    if (uom === "Zero-based" ? false : !target.trim()) return setErr("Target is required");
    if (weightage < 10) return setErr("Minimum weightage is 10%");
    if (goalCount >= 8) return setErr("Maximum 8 goals reached");
    onAdd({
      thrustArea: finalThrustArea,
      title: title.trim(),
      description: description.trim(),
      uom,
      target: uom === "Zero-based" || uom === "Yes/No" ? "1" : target.trim(),
      deadline: deadline || undefined,
      cadence,
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
            onChange={(e) => setThrustArea(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            {THRUST_AREAS.map((t) => (
              <option key={t}>{t}</option>
            ))}
            <option>{CUSTOM_THRUST}</option>
          </select>
          {thrustArea === CUSTOM_THRUST && (
            <input
              type="text"
              value={customThrustArea}
              onChange={(e) => setCustomThrustArea(e.target.value)}
              placeholder="Enter a new thrust area"
              disabled={disabled}
              className="mt-2 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          )}
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
              Cadence
            </label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as GoalCadence)}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {CADENCE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
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
          ) : uom === "Zero-based" || uom === "Yes/No" ? (
            <input
              type="text"
              value="1"
              readOnly
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm font-bold text-muted-foreground"
            />
          ) : (
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={targetPlaceholder(uom)}
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

function targetPlaceholder(uom: UoM) {
  if (uom === "Percent") return "e.g. 98.5";
  if (uom === "Currency") return "e.g. 500000";
  if (uom === "Hours") return "e.g. 40";
  if (uom === "Rating") return "e.g. 4.5";
  if (uom === "Count") return "e.g. 12";
  return "e.g. 12";
}
