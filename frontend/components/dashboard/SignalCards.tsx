import MetricCard from "@/components/shared/MetricCard";
import { fmt, fmtPct } from "@/lib/utils";
import type { StorageObservation } from "@/lib/types";

interface Props {
  storage: StorageObservation | null | undefined;
  prices: { ttf_eur_mwh: number | null; jkm_usd_mmbtu: number | null; henry_hub_usd_mmbtu: number | null } | undefined;
}

export default function SignalCards({ storage, prices }: Props) {
  const storageDeficit = storage
    ? storage.five_year_avg_pct - storage.storage_pct_full
    : null;

  const ttfJkmSpread = prices?.ttf_eur_mwh && prices?.jkm_usd_mmbtu
    ? prices.ttf_eur_mwh - prices.jkm_usd_mmbtu * 3.41 / 1.10
    : null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-3">Market Signals</h3>
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="EU Storage Fill"
          value={storage ? fmtPct(storage.storage_pct_full) : "—"}
          subtitle={storageDeficit !== null
            ? `${storageDeficit > 0 ? "" : "+"}${fmt(-storageDeficit, 1)}% vs 5yr avg`
            : "No data"}
          accent={storage ? (storage.storage_pct_full < 50 ? "red" : storage.storage_pct_full < 70 ? "amber" : "green") : "gray"}
        />
        <MetricCard
          title="TTF (EUR/MWh)"
          value={prices?.ttf_eur_mwh ? fmt(prices.ttf_eur_mwh, 1) : "—"}
          subtitle={prices?.ttf_eur_mwh ? "European gas benchmark" : "Estimated"}
          accent="blue"
        />
        <MetricCard
          title="JKM (USD/MMBtu)"
          value={prices?.jkm_usd_mmbtu ? fmt(prices.jkm_usd_mmbtu, 2) : "—"}
          subtitle={prices?.jkm_usd_mmbtu ? "Asian LNG benchmark" : "Estimated"}
          accent="amber"
        />
        <MetricCard
          title="TTF vs JKM Spread"
          value={ttfJkmSpread !== null ? fmt(ttfJkmSpread, 1) : "—"}
          unit="EUR/MWh"
          subtitle={ttfJkmSpread !== null
            ? (ttfJkmSpread > 0 ? "Europe paying premium" : "Asia paying premium")
            : "Prices estimated"}
          accent={ttfJkmSpread !== null ? (ttfJkmSpread > 2 ? "blue" : "amber") : "gray"}
        />
      </div>
    </div>
  );
}
