import { api } from "@/lib/api";
import PriceChart from "@/components/market/PriceChart";
import SpreadChart from "@/components/market/SpreadChart";
import MetricCard from "@/components/shared/MetricCard";
import { fmt } from "@/lib/utils";

export const revalidate = 60;

export default async function MarketPage() {
  const [prices, spreads, arbitrage] = await Promise.all([
    api.market.prices(90),
    api.market.spreads(90),
    api.market.arbitrage(),
  ]);

  const latestSpread = spreads?.[spreads.length - 1];
  const routes = arbitrage?.route_distances ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Market Drivers</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Price signals and route economics explaining cargo direction
        </p>
      </div>

      {/* Pull scores */}
      {arbitrage && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Current Arbitrage Signal</h3>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-xs text-text-muted mb-2">Europe Pull ({arbitrage.europe_score}/10)</p>
              <div className="h-2 bg-surface-2 rounded-full">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${arbitrage.europe_score * 10}%` }} />
              </div>
              <ul className="mt-3 space-y-1">
                {arbitrage.europe_breakdown?.map((b, i) => (
                  <li key={i} className="text-xs text-text-muted">· {b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-2">Asia Pull ({arbitrage.asia_score}/10)</p>
              <div className="h-2 bg-surface-2 rounded-full">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${arbitrage.asia_score * 10}%` }} />
              </div>
              <ul className="mt-3 space-y-1">
                {arbitrage.asia_breakdown?.map((b, i) => (
                  <li key={i} className="text-xs text-text-muted">· {b}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-slate-200 border-t border-border pt-3">
            {arbitrage.signal}
          </p>
        </div>
      )}

      {/* Current spreads */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="TTF-HH Spread"
          value={latestSpread?.ttf_minus_hh_eur_mwh !== undefined ? fmt(latestSpread.ttf_minus_hh_eur_mwh, 1) : "—"}
          unit="EUR/MWh"
          subtitle="Europe premium over Henry Hub"
          accent="blue"
        />
        <MetricCard
          title="JKM-HH Spread"
          value={latestSpread?.jkm_minus_hh_usd_mmbtu !== undefined ? fmt(latestSpread.jkm_minus_hh_usd_mmbtu, 2) : "—"}
          unit="USD/MMBtu"
          subtitle="Asia premium over Henry Hub"
          accent="amber"
        />
        <MetricCard
          title="TTF vs JKM"
          value={latestSpread?.ttf_minus_jkm_eur_mwh !== undefined ? fmt(latestSpread.ttf_minus_jkm_eur_mwh, 1) : "—"}
          unit="EUR/MWh"
          subtitle={latestSpread?.ttf_minus_jkm_eur_mwh !== undefined
            ? (latestSpread.ttf_minus_jkm_eur_mwh > 0 ? "Europe paying more" : "Asia paying more")
            : ""}
          accent={latestSpread?.ttf_minus_jkm_eur_mwh !== undefined
            ? (latestSpread.ttf_minus_jkm_eur_mwh > 0 ? "blue" : "amber")
            : "gray"}
        />
      </div>

      {/* Price chart */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Benchmark Price History (90d)</h3>
        {prices && prices.length > 0 ? <PriceChart data={prices} /> : (
          <p className="text-text-muted text-sm text-center py-8">No price data</p>
        )}
      </div>

      {/* Spread chart */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">TTF vs JKM Spread (EUR/MWh equivalent)</h3>
        {spreads && spreads.length > 0 ? <SpreadChart data={spreads} /> : (
          <p className="text-text-muted text-sm text-center py-8">No spread data</p>
        )}
      </div>

      {/* Route distances */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Shipping Route Context</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-text-muted">From</th>
              <th className="px-3 py-2 text-left text-text-muted">To</th>
              <th className="px-3 py-2 text-right text-text-muted">Distance (nm)</th>
              <th className="px-3 py-2 text-right text-text-muted">Est. Transit</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="px-3 py-2 text-slate-300">{r.from}</td>
                <td className="px-3 py-2 text-slate-300">{r.to}</td>
                <td className="px-3 py-2 text-right">{r.nm.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-text-muted">{r.days} days</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-text-muted mt-3">
          At 16 knots average laden speed. Asia routes via Panama Canal.
        </p>
      </div>
    </div>
  );
}
