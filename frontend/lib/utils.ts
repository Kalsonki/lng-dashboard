import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmt(n: number | null | undefined, decimals = 1, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(decimals)}${suffix}`;
}

export function fmtPct(n: number | null | undefined): string {
  return fmt(n, 1, "%");
}

export function confidenceColor(conf: number): string {
  if (conf >= 0.8) return "text-green-400";
  if (conf >= 0.6) return "text-yellow-400";
  return "text-orange-400";
}

export function destinationColor(region: string): string {
  switch (region) {
    case "europe": return "#3b82f6";
    case "asia": return "#f59e0b";
    case "other": return "#a855f7";
    default: return "#6b7280";
  }
}

export function destinationBg(region: string): string {
  switch (region) {
    case "europe": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "asia": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "other": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
  }
}

export function scoreBar(score: number, max = 10): string {
  return `${Math.round((score / max) * 100)}%`;
}
