import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  accent?: "blue" | "amber" | "gray" | "green" | "red";
  className?: string;
}

const accents: Record<string, string> = {
  blue: "border-l-blue-500",
  amber: "border-l-amber-500",
  gray: "border-l-gray-500",
  green: "border-l-green-500",
  red: "border-l-red-500",
};

export default function MetricCard({
  title, value, unit, subtitle, accent = "gray", className
}: MetricCardProps) {
  return (
    <div className={cn(
      "bg-surface border border-border rounded-lg p-4 border-l-2",
      accents[accent], className
    )}>
      <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{title}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </div>
  );
}
