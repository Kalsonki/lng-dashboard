"use client";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export default function TimeRangeSelector({
  value, onChange
}: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1 bg-surface-2 rounded-md p-1">
      {OPTIONS.map(({ label, days }) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className={cn(
            "px-3 py-1 text-xs rounded font-medium transition-colors",
            value === days
              ? "bg-blue-600 text-white"
              : "text-text-muted hover:text-slate-200"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
