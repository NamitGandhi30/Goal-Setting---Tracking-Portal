import { cn } from "@/lib/utils";

interface Props {
  value: number;
  size?: number;
  stroke?: number;
}

export function WeightageRing({ value, size = 64, stroke = 6 }: Props) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const complete = clamped === 100;
  const over = clamped > 100;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            complete ? "stroke-[var(--success)]" : "stroke-primary",
            over && "stroke-destructive",
          )}
        />
      </svg>
      <span
        className={cn(
          "absolute font-mono text-[10px] font-bold uppercase",
          complete ? "text-[var(--success)]" : "text-primary",
          over && "text-destructive",
        )}
      >
        {over ? "OVER" : complete ? "OK" : `${100 - clamped}%`}
      </span>
    </div>
  );
}
