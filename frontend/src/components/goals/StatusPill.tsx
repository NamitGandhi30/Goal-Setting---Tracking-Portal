import type { SheetStatus } from "@/lib/goals/types";
import { cn } from "@/lib/utils";

const STYLES: Record<SheetStatus, string> = {
  Draft: "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200",
  Returned: "bg-rose-50 text-rose-700 border-rose-200",
  Approved: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export function StatusPill({ status }: { status: SheetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
        STYLES[status],
      )}
    >
      {status === "Approved" && (
        <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current" strokeWidth={2.5}>
          <path d="M6 10V8a6 6 0 0 1 12 0v2" />
          <rect x="4" y="10" width="16" height="11" rx="2" />
        </svg>
      )}
      {status}
    </span>
  );
}
