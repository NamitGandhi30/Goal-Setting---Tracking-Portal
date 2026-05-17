import { useState } from "react";
import type { Goal } from "@/lib/goals/types";
import { cn } from "@/lib/utils";

interface Props {
  goals: Goal[];
  capacity?: number;
  editable: boolean;
  inlineEditable?: boolean; // manager mode: only target + weight
  onUpdate?: (goalId: string, patch: Partial<Goal>) => void;
  onRemove?: (goalId: string) => void;
}

export function GoalTable({
  goals,
  capacity = 8,
  editable,
  inlineEditable,
  onUpdate,
  onRemove,
}: Props) {
  const slots = Math.max(0, capacity - goals.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <Th>Thrust Area</Th>
              <Th>Objective</Th>
              <Th className="text-right">Target</Th>
              <Th className="text-right">Weight</Th>
              <Th className="text-center">UoM</Th>
              {(editable || inlineEditable) && <Th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                editable={editable}
                inlineEditable={inlineEditable}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
            {slots > 0 && (
              <tr className="bg-secondary/20">
                <td colSpan={6} className="px-6 py-4 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    {slots} of {capacity} slot{slots === 1 ? "" : "s"} available
                  </span>
                </td>
              </tr>
            )}
            {goals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No goals yet — add your first objective on the left.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function GoalRow({
  goal,
  editable,
  inlineEditable,
  onUpdate,
  onRemove,
}: {
  goal: Goal;
  editable: boolean;
  inlineEditable?: boolean;
  onUpdate?: (goalId: string, patch: Partial<Goal>) => void;
  onRemove?: (goalId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Goal>(goal);

  const save = () => {
    onUpdate?.(goal.id, {
      title: draft.title,
      description: draft.description,
      target: draft.target,
      weightage: Number(draft.weightage),
    });
    setEditing(false);
  };

  return (
    <tr className="group transition-colors hover:bg-secondary/40">
      <td className="px-6 py-4">
        <span className="inline-block rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/70">
          {goal.thrustArea}
        </span>
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          <>
            <p className="text-sm font-bold">{goal.title}</p>
            {goal.description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{goal.description}</p>
            )}
          </>
        )}
      </td>
      <td className="px-6 py-4 text-right font-mono text-sm font-medium">
        {editing || inlineEditable ? (
          <input
            value={draft.target}
            onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            onBlur={inlineEditable ? () => onUpdate?.(goal.id, { target: draft.target }) : undefined}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          goal.target
        )}
      </td>
      <td className="px-6 py-4 text-right font-mono text-sm font-bold">
        {editing || inlineEditable ? (
          <input
            type="number"
            min={10}
            max={100}
            value={draft.weightage}
            onChange={(e) => setDraft({ ...draft, weightage: Number(e.target.value) })}
            onBlur={
              inlineEditable
                ? () => onUpdate?.(goal.id, { weightage: Number(draft.weightage) })
                : undefined
            }
            className="w-16 rounded border border-border bg-background px-2 py-1 text-right font-mono text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          `${goal.weightage}%`
        )}
      </td>
      <td className="px-6 py-4 text-center">
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{goal.uom}</span>
      </td>
      {(editable || inlineEditable) && (
        <td className="px-3 py-4 text-right">
          {editable && !editing && (
            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setDraft(goal);
                  setEditing(true);
                }}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Edit"
              >
                <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth={2}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onRemove?.(goal.id)}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete"
              >
                <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth={2}>
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              </button>
            </div>
          )}
          {editable && editing && (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={save}
                className="rounded bg-foreground px-2 py-1 text-[10px] font-bold uppercase text-background"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-border px-2 py-1 text-[10px] font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
