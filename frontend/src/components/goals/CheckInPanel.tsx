import { useState } from "react";
import type { CheckIn, CheckInPhase, Goal } from "@/lib/goals/types";
import { CHECKIN_PHASES } from "@/lib/goals/types";
import { cn } from "@/lib/utils";

interface Props {
  goals: Goal[];
  checkIns: CheckIn[];
  mode: "employee" | "manager" | "readonly";
  onSave: (entry: Omit<CheckIn, "id" | "createdAt"> & { id?: string }) => void;
  onRemove?: (id: string) => void;
}

export function CheckInPanel({ goals, checkIns, mode, onSave, onRemove }: Props) {
  const [phase, setPhase] = useState<CheckInPhase>("Q1");

  if (goals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Add objectives to begin logging check-ins.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider">Check-ins</h3>
          <p className="text-[11px] text-muted-foreground">
            {mode === "employee"
              ? "Log your self-assessment for each goal."
              : mode === "manager"
                ? "Calibrate ratings before sign-off."
                : "Phase progress snapshots."}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-black/5 p-1">
          {CHECKIN_PHASES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={cn(
                "rounded-[3px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                phase === p
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {goals.map((g) => {
          const existing = checkIns.find((c) => c.goalId === g.id && c.phase === phase);
          return (
            <CheckInRow
              key={g.id}
              goal={g}
              phase={phase}
              existing={existing}
              mode={mode}
              onSave={onSave}
              onRemove={onRemove}
            />
          );
        })}
      </ul>
    </div>
  );
}

function CheckInRow({
  goal,
  phase,
  existing,
  mode,
  onSave,
  onRemove,
}: {
  goal: Goal;
  phase: CheckInPhase;
  existing?: CheckIn;
  mode: "employee" | "manager" | "readonly";
  onSave: Props["onSave"];
  onRemove?: Props["onRemove"];
}) {
  const [achievement, setAchievement] = useState<string>(
    existing ? String(existing.achievement) : "",
  );
  const [self, setSelf] = useState<string>(
    existing?.selfRating ? String(existing.selfRating) : "",
  );
  const [mgr, setMgr] = useState<string>(
    existing?.managerRating ? String(existing.managerRating) : "",
  );
  const [note, setNote] = useState<string>(existing?.note ?? "");

  const dirty =
    achievement !== (existing ? String(existing.achievement) : "") ||
    self !== (existing?.selfRating ? String(existing.selfRating) : "") ||
    mgr !== (existing?.managerRating ? String(existing.managerRating) : "") ||
    note !== (existing?.note ?? "");

  const save = () => {
    if (achievement === "" && self === "" && mgr === "" && !note) return;
    onSave({
      id: existing?.id,
      goalId: goal.id,
      phase,
      achievement: Number(achievement) || 0,
      selfRating: mode === "employee" ? (self ? Number(self) : undefined) : existing?.selfRating,
      managerRating:
        mode === "manager" ? (mgr ? Number(mgr) : undefined) : existing?.managerRating,
      note: note || undefined,
    });
  };

  const readonly = mode === "readonly";

  return (
    <li className="grid grid-cols-12 items-start gap-3 px-5 py-4">
      <div className="col-span-12 md:col-span-4">
        <p className="text-sm font-bold">{goal.title}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {goal.thrustArea} · {goal.weightage}%
        </p>
      </div>

      <div className="col-span-4 md:col-span-2">
        <Label>Achievement %</Label>
        <input
          type="number"
          min={0}
          max={150}
          disabled={readonly}
          value={achievement}
          onChange={(e) => setAchievement(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-sm disabled:opacity-60"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label>Self</Label>
        <input
          type="number"
          min={1}
          max={5}
          disabled={mode !== "employee"}
          value={self}
          onChange={(e) => setSelf(e.target.value)}
          placeholder="–"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-sm disabled:opacity-60"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label>Mgr</Label>
        <input
          type="number"
          min={1}
          max={5}
          disabled={mode !== "manager"}
          value={mgr}
          onChange={(e) => setMgr(e.target.value)}
          placeholder="–"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-right font-mono text-sm disabled:opacity-60"
        />
      </div>

      <div className="col-span-12 md:col-span-3">
        <Label>Note</Label>
        <input
          type="text"
          disabled={readonly}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional context"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
        />
      </div>

      {!readonly && (
        <div className="col-span-12 md:col-span-1 flex items-end justify-end gap-1 md:flex-col">
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="w-full rounded bg-foreground px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-background disabled:opacity-30"
          >
            {existing ? "Update" : "Log"}
          </button>
          {existing && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(existing.id)}
              className="w-full rounded border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}
