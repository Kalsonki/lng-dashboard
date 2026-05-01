import { api } from "@/lib/api";
import MetricCard from "@/components/shared/MetricCard";
import { fmt, fmtPct, scoreBar } from "@/lib/utils";
import FlowTrendChart from "@/components/dashboard/FlowTrendChart";
import SignalCards from "@/components/dashboard/SignalCards";

export const revalidate = 60;

export default async function DashboardPage() {
  const [summary, trend] = await Promise.all([
    api.dashboard.summary(),
    api.dashboard.trend(90),
  ]);

  const flow = summary?.flow_split_30d;
  const nowcast = summary?.nowcast;
  const storage = summary?.storage;
  const prices = summary?.prices;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboard</h2>
          <p className="text-sm text-text-muted mt-0.5">
            US LNG export routing — Europe vs Asia
          </p>
        </div>
        {nowcast && (
          <div className={`px-4 py-2 rounded-lg border font-medium text-sm ${
            nowcast.direction === "Europe-Favored"
              ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
              : nowcast.direction === "Asia-Favored"
              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
              : "bg-gray-500/15 border-gray-500/30 text-gray-300"
          }`}>
            Nowcast: {nowcast.direction} · {nowcast.confidence} confidence
          </div>
        )}
      </div>

      {/* Flow split cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="US LNG → Europe (30d)"
          value={flow ? `${flow.europe} ` : "—"}
          unit="voyages"
          subtitle={flow ? `${fmtPct(flow.europe_pct)} of US exports` : "No data"}
          accent="blue"
        />
        <MetricCard
          title="US LNG → Asia (30d)"
          value={flow ? `${flow.asia}` : "—"}
          unit="voyages"
          subtitle={flow ? `${fmtPct(flow.asia_pct)} of US exports` : "No data"}
          accent="amber"
        />
        <MetricCard
          title="Active US Laden Voyages"
          value={summary?.active_us_voyages ?? "—"}
          unit="vessels"
          subtitle="Currently at sea"
          accent="gray"
        />
      </div>

      {/* Pull scores */}
      {nowcast && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Pull Score Analysis</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-300 font-medium">Europe Pull</span>
                <span className="text-lg font-bold text-white">{nowcast.europe_score.toFixed(1)}/10</span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: scoreBar(nowcast.europe_score) }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-300 font-medium">Asia Pull</span>
                <span className="text-lg font-bold text-white">{nowcast.asia_score.toFixed(1)}/10</span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: scoreBar(nowcast.asia_score) }}
                />
              </div>
            </div>
          </div>
          {nowcast.top_reasons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-muted mb-2 font-medium">KEY SIGNALS</p>
              <ul className="space-y-1">
                {nowcast.top_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-text-muted mt-0.5">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Commentary */}
      {nowcast?.commentary && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted uppercase tracking-wide font-medium mb-3">
            What is happening now
          </p>
          <p className="text-sm text-slate-200 leading-relaxed">{nowcast.commentary}</p>
          {nowcast.data_quality_notes.length > 0 && (
            <p className="text-xs text-amber-400 mt-3">
              ⚠ Data note: {nowcast.data_quality_notes.join("; ")}
            </p>
          )}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">
          US LNG Export Destination Share (90d)
        </h3>
        {trend && trend.length > 0 ? (
          <FlowTrendChart data={trend} />
        ) : (
          <p className="text-sm text-text-muted py-8 text-center">No trend data available</p>
        )}
      </div>

      {/* Signal cards */}
      <SignalCards storage={storage} prices={prices} />
    </div>
  );
}
