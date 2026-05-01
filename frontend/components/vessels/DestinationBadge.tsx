import { destinationBg } from "@/lib/utils";

export default function DestinationBadge({
  region, confidence
}: { region: string; confidence?: number }) {
  const label = region === "europe" ? "Europe"
    : region === "asia" ? "Asia"
    : region === "other" ? "Other"
    : "Uncertain";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${destinationBg(region)}`}>
      {label}
      {confidence !== undefined && (
        <span className="opacity-70 text-[10px]">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
