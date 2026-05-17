import { cn } from "@/lib/utils";

interface Props {
  goalCount: number;
  totalWeight: number;
  valid: boolean;
  errors: string[];
  ctaLabel: string;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ValidationBar({
  goalCount,
  totalWeight,
  valid,
  errors,
  ctaLabel,
  onSubmit,
  disabled,
}: Props) {
  const balance = 100 - totalWeight;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-6 rounded-full border border-white/10 bg-foreground px-6 py-3 text-background shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase text-zinc-500">Count</span>
          <span className="font-mono text-sm font-bold">
            {goalCount} <span className="text-zinc-500">/ 8</span>
          </span>
        </div>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase text-zinc-500">Balance</span>
          <span
            className={cn(
              "font-mono text-sm font-bold",
              balance === 0 && "text-[var(--success)]",
              balance < 0 && "text-destructive",
            )}
          >
            {balance >= 0 ? `${balance}%` : `+${Math.abs(balance)}% over`}
          </span>
        </div>
        {errors.length > 0 && (
          <>
            <div className="hidden h-6 w-px bg-white/10 sm:block" />
            <span
              className="hidden max-w-[28ch] truncate text-[11px] text-zinc-300 sm:inline"
              title={errors.join(" · ")}
            >
              {errors[0]}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!valid || disabled}
        className="rounded-full bg-primary px-6 py-2 text-[11px] font-extrabold uppercase tracking-tighter text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
