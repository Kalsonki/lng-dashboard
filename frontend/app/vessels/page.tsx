import { api } from "@/lib/api";
import DestinationBadge from "@/components/vessels/DestinationBadge";
import { fmt } from "@/lib/utils";
import { Ship } from "lucide-react";

export const revalidate = 60;

export default async function VesselsPage() {
  const data = await api.flows.activeVoyages();
  const voyages = data?.voyages ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Vessel Flows</h2>
        <p className="text-sm text-text-muted mt-0.5">
          US-origin LNG laden voyages — {voyages.length} active
        </p>
      </div>

      {/* Summary row */}
      <div className="flex gap-4">
        {["europe", "asia", "uncertain"].map(r => {
          const count = voyages.filter(v => v.inferred_destination_region === r).length;
          return (
            <div key={r} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <DestinationBadge region={r} />
              <span className="text-xl font-bold text-white">{count}</span>
              <span className="text-xs text-text-muted">voyages</span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Vessel", "Origin", "Destination", "Confidence", "Speed (kn)", "Last Position", "Status"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-text-muted uppercase tracking-wide font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {voyages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  No active voyages — check API connection
                </td>
              </tr>
            ) : (
              voyages.map(v => (
                <tr key={v.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ship className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <div>
                        <p className="font-medium text-white text-xs">{v.vessel_name}</p>
                        <p className="text-[10px] text-text-muted">{v.flag} · {v.mmsi}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{v.origin_terminal_name}</td>
                  <td className="px-4 py-3">
                    <DestinationBadge
                      region={v.inferred_destination_region}
                      confidence={v.destination_confidence}
                    />
                    {v.inferred_destination_name && (
                      <p className="text-[10px] text-text-muted mt-1">{v.inferred_destination_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-16 h-1.5 bg-surface-2 rounded-full">
                      <div
                        className={`h-full rounded-full ${v.destination_confidence >= 0.8 ? "bg-green-500" : v.destination_confidence >= 0.6 ? "bg-yellow-500" : "bg-orange-500"}`}
                        style={{ width: `${v.destination_confidence * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">{Math.round(v.destination_confidence * 100)}%</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {v.speed ? fmt(v.speed, 1) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {v.lat && v.lon ? `${v.lat.toFixed(2)}°N ${v.lon.toFixed(2)}°E` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === "laden"
                        ? "bg-green-500/15 text-green-300"
                        : "bg-gray-500/15 text-gray-300"
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-text-muted bg-surface border border-border rounded p-3">
        <strong className="text-amber-400">Data note:</strong> Destinations are inferred from AIS strings, heading, and position relative to known import terminals.
        Confidence reflects signal strength. Connect AISstream API for live vessel tracking.
      </div>
    </div>
  );
}
