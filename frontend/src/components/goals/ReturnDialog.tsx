import { useState, type ReactNode } from "react";

interface Props {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (comment: string) => void;
}

export function ReturnDialog({ trigger, title, description, confirmLabel = "Return", onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Add a comment for the employee…"
              className="mt-4 w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!comment.trim()) return;
                  onConfirm(comment.trim());
                  setOpen(false);
                  setComment("");
                }}
                disabled={!comment.trim()}
                className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
