import type {
  DashboardSummary, FlowSplit, FlowTrend, PullScores,
  StorageSeries, StorageObservation, PriceObservation,
  SpreadData, Voyage, Terminal, RouteDistance,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T | null> {
  try {
    const url = new URL(BASE + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const api = {
  dashboard: {
    summary: () => get<DashboardSummary>("/api/dashboard/summary"),
    trend: (days: number) => get<FlowTrend[]>("/api/dashboard/trend", { days }),
    signals: () => get<PullScores>("/api/dashboard/signals"),
  },
  vessels: {
    list: (params?: { us_origin?: boolean; destination?: string; basin?: string }) =>
      get<Voyage[]>("/api/vessels/", params as Record<string, string>),
    detail: (mmsi: string) => get<Voyage>(`/api/vessels/${mmsi}`),
    positions: (mmsi: string, hours?: number) =>
      get<{ lat: number; lon: number; timestamp: string; speed: number }[]>(
        `/api/vessels/${mmsi}/positions`, hours ? { hours } : undefined
      ),
  },
  flows: {
    byRegion: (days?: number) =>
      get<FlowSplit>("/api/flows/by-region", days ? { days } : undefined),
    activeVoyages: () =>
      get<{ all_active: number; us_origin_active: number; voyages: Voyage[] }>(
        "/api/flows/active-voyages"
      ),
  },
  storage: {
    europe: (days?: number) =>
      get<StorageSeries[]>("/api/storage/europe", days ? { days } : undefined),
    latest: () => get<StorageObservation>("/api/storage/latest"),
  },
  market: {
    prices: (days?: number) =>
      get<PriceObservation[]>("/api/market/prices", days ? { days } : undefined),
    spreads: (days?: number) =>
      get<SpreadData[]>("/api/market/spreads", days ? { days } : undefined),
    arbitrage: () => get<PullScores & { route_distances: RouteDistance[] }>("/api/market/arbitrage-score"),
    routes: () => get<RouteDistance[]>("/api/market/routes"),
  },
  terminals: () => get<Terminal[]>("/api/terminals"),
};
