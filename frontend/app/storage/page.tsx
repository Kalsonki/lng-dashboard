import { api } from "@/lib/api";
import MetricCard from "@/components/shared/MetricCard";
import StorageChart from "@/components/storage/StorageChart";
import { fmt, fmtPct } from "@/lib/utils";

export const revalidate = 60;

export default async function StoragePage() {
  const [latest, series] = await Promise.all([
    api.storage.latest(),
    api.storage.europe(365),
  ]);

  const deficit = latest
    ? latest.five_year_avg_pct - latest.storage_pct_full
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Storage & Terminals</h2>
        <p className="text-sm text-text-muted mt-0.5">European gas storage and US export terminal context</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="EU Storage Fill"
          value={latest ? fmtPct(latest.storage_pct_full) : "—"}
          subtitle={latest ? `${latest.date}` : "No data"}
          accent={latest ? (latest.storage_pct_full < 50 ? "red" : latest.storage_pct_full < 70 ? "amber" : "green") : "gray"}
        />
        <MetricCard
          title="vs 5-Year Average"
          value={deficit !== null ? `${deficit > 0 ? "-" : "+"}${fmt(Math.abs(deficit), 1)}` : "—"}
          unit="pp"
          subtitle={deficit !== null ? (deficit > 5 ? "Below 5yr avg — storage pull" : deficit < -5 ? "Above 5yr avg — well-filled" : "Near 5yr average") : ""}
          accent={deficit !== null ? (deficit > 5 ? "red" : deficit < -5 ? "green" : "amber") : "gray"}
        />
        <MetricCard
          title="Storage Volume"
          value={latest ? fmt(latest.storage_twh, 0) : "—"}
          unit="TWh"
          subtitle="EU aggregate"
          accent="blue"
        />
        <MetricCard
          title="Data Source"
          value={latest ? "GIE AGSI+" : "Sample"}
          subtitle={latest ? "Daily updates" : "Connect GIE_API_KEY for live data"}
          accent="gray"
        />
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">EU Gas Storage — 12 Months</h3>
        {series && series.length > 0 ? (
          <StorageChart data={series} />
        ) : (
          <p className="text-sm text-text-muted py-8 text-center">No storage data</p>
        )}
      </div>

      {/* US Export terminal context */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">US LNG Export Terminals</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Terminal", "Location", "Capacity (MTPA)", "Status"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Sabine Pass LNG", "Louisiana", "30.0", "Operational"],
              ["Corpus Christi LNG", "Texas", "15.0", "Operational"],
              ["Freeport LNG", "Texas", "15.0", "Operational"],
              ["Cameron LNG", "Louisiana", "13.5", "Operational"],
              ["Cove Point LNG", "Maryland", "5.25", "Operational"],
              ["Calcasieu Pass LNG", "Louisiana", "10.0", "Operational (Ramp-up)"],
              ["Elba Island LNG", "Georgia", "2.5", "Operational"],
            ].map(([name, loc, cap, status]) => (
              <tr key={name} className="border-b border-border/50 text-xs">
                <td className="px-3 py-2 font-medium text-white">{name}</td>
                <td className="px-3 py-2 text-text-muted">{loc}</td>
                <td className="px-3 py-2 text-slate-300">{cap}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 text-[11px]">{status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-text-muted mt-3">
          Status is illustrative. Connect to premium data sources (Kpler, ICIS) for real-time outage monitoring.
        </p>
      </div>
    </div>
  );
}
