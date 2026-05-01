export interface FlowSplit {
  europe: number;
  asia: number;
  other: number;
  total: number;
  europe_pct: number;
  asia_pct: number;
  other_pct: number;
}

export interface PullScores {
  europe_score: number;
  asia_score: number;
  dominant: "europe" | "asia" | "balanced";
  signal: string;
  europe_breakdown: string[];
  asia_breakdown: string[];
  data_quality_notes: string[];
  as_of: string;
}

export interface Nowcast {
  direction: "Europe-Favored" | "Asia-Favored" | "Balanced";
  confidence: "high" | "medium" | "low";
  europe_score: number;
  asia_score: number;
  top_reasons: string[];
  commentary: string;
  data_quality_notes: string[];
  as_of: string;
}

export interface DashboardSummary {
  flow_split_30d: FlowSplit;
  active_us_voyages: number;
  storage: StorageObservation | null;
  prices: {
    ttf_eur_mwh: number | null;
    jkm_usd_mmbtu: number | null;
    henry_hub_usd_mmbtu: number | null;
  };
  nowcast: Nowcast;
  as_of: string;
}

export interface StorageObservation {
  date: string;
  region: string;
  storage_pct_full: number;
  storage_twh: number;
  five_year_avg_pct: number;
  yoy_change_pct: number | null;
}

export interface StorageSeries {
  date: string;
  storage_pct_full: number;
  storage_twh: number;
  five_year_avg_pct: number;
}

export interface PriceObservation {
  date: string;
  price_type: string;
  price_value: number;
  unit: string;
  confidence: string;
}

export interface SpreadData {
  date: string;
  ttf: number | null;
  jkm: number | null;
  henry_hub: number | null;
  ttf_minus_hh_eur_mwh?: number;
  jkm_minus_hh_usd_mmbtu?: number;
  ttf_minus_jkm_eur_mwh?: number;
}

export interface Voyage {
  id: number;
  vessel_id: number;
  vessel_name: string;
  mmsi: string;
  flag: string;
  cargo_capacity_m3: number | null;
  origin_terminal_name: string;
  origin_region: string;
  departure_time: string;
  inferred_destination_region: string;
  inferred_destination_name: string | null;
  destination_confidence: number;
  destination_explanation: string;
  status: string;
  basin: string;
  is_us_origin: boolean;
  lat: number | null;
  lon: number | null;
  speed: number | null;
  heading: number | null;
  ais_destination: string | null;
  last_position_time: string | null;
  data_source?: "voyage" | "ais_only";
}

export interface Terminal {
  id: number;
  name: string;
  short_code: string;
  country: string;
  region: string;
  basin: string;
  terminal_type: string;
  lat: number;
  lon: number;
  capacity_mtpa: number | null;
  is_us_export: boolean;
}

export interface FlowTrend {
  period: string;
  europe: number;
  asia: number;
  other: number;
  europe_pct: number;
  asia_pct: number;
  other_pct: number;
}

export interface RouteDistance {
  from: string;
  to: string;
  nm: number;
  days: number;
}
