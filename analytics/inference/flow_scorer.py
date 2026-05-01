"""
Europe vs Asia pull scoring.

Formula (0-10 each):
EUROPE PULL:
  - Storage deficit vs 5yr avg:  max 3.0 pts  (deficit = more pull)
  - TTF vs JKM spread:           max 3.0 pts  (TTF > JKM = Europe pays more)
  - Recent EU share (30d EIA):   max 2.0 pts
  - Winter demand factor:        max 2.0 pts

ASIA PULL:
  - JKM vs TTF spread:           max 3.0 pts
  - Recent Asia share (30d EIA): max 2.0 pts
  - Pacific routing advantage:   max 2.0 pts  (constant proxy)
  - Asian demand proxy:          max 1.5 pts
  - Spot tightness proxy:        max 1.5 pts
"""
import math
import logging
from datetime import date, datetime

logger = logging.getLogger(__name__)


def seasonal_europe_factor(d: date) -> float:
    """European heating demand is higher in winter (Oct-Mar)."""
    month = d.month
    if month in (12, 1, 2):
        return 2.0   # Peak winter
    if month in (10, 11, 3):
        return 1.5   # Shoulder winter
    if month in (4, 9):
        return 0.8
    return 0.4       # Summer (low demand, storage refill)


def compute_pull_scores(
    storage_pct: float | None,
    storage_5yr_avg: float | None,
    ttf_eur_mwh: float | None,
    jkm_usd_mmbtu: float | None,
    hh_usd_mmbtu: float | None,
    eu_share_30d: float | None,  # 0-1
    asia_share_30d: float | None,
    as_of: date | None = None,
) -> dict:
    """
    Compute Europe and Asia pull scores (0-10 each).
    Returns dict with scores, breakdown, and commentary.
    """
    d = as_of or date.today()
    europe_score = 0.0
    asia_score = 0.0
    europe_breakdown = []
    asia_breakdown = []
    data_quality = []

    # ── Europe: Storage deficit ──────────────────────────────────────────────
    if storage_pct is not None and storage_5yr_avg is not None:
        deficit = storage_5yr_avg - storage_pct  # positive = below avg
        storage_pts = min(3.0, max(0.0, deficit * 0.15))
        europe_score += storage_pts
        europe_breakdown.append(f"Storage deficit {deficit:+.1f}% vs 5yr avg → {storage_pts:.1f}pts")
    else:
        europe_breakdown.append("Storage data unavailable (0 pts)")
        data_quality.append("EU storage data missing")

    # ── Spread: TTF vs JKM ─────────────────────────────────────────────────
    # Normalise: JKM USD/MMBtu → EUR/MWh (approx: × 3.41 / 1.10)
    if ttf_eur_mwh is not None and jkm_usd_mmbtu is not None:
        jkm_eur_mwh = jkm_usd_mmbtu * 3.41 / 1.10  # rough conversion
        spread = ttf_eur_mwh - jkm_eur_mwh  # positive = TTF higher = Europe pull
        europe_spread_pts = min(3.0, max(0.0, spread * 0.12))
        asia_spread_pts = min(3.0, max(0.0, -spread * 0.12))
        europe_score += europe_spread_pts
        asia_score += asia_spread_pts
        europe_breakdown.append(f"TTF-JKM spread {spread:+.1f} EUR/MWh → {europe_spread_pts:.1f}pts")
        asia_breakdown.append(f"JKM-TTF spread {-spread:+.1f} EUR/MWh → {asia_spread_pts:.1f}pts")
    else:
        europe_breakdown.append("Price spread data unavailable (estimated)")
        data_quality.append("TTF/JKM prices estimated")
        # Default: balanced
        europe_score += 1.0
        asia_score += 1.0

    # ── Europe: Recent flow share ───────────────────────────────────────────
    if eu_share_30d is not None:
        eu_flow_pts = eu_share_30d * 2.0
        europe_score += eu_flow_pts
        europe_breakdown.append(f"EU 30d flow share {eu_share_30d:.0%} → {eu_flow_pts:.1f}pts")
    else:
        europe_score += 1.0  # assume balanced
        data_quality.append("30d EU flow share unavailable")

    # ── Asia: Recent flow share ─────────────────────────────────────────────
    if asia_share_30d is not None:
        asia_flow_pts = asia_share_30d * 2.0
        asia_score += asia_flow_pts
        asia_breakdown.append(f"Asia 30d flow share {asia_share_30d:.0%} → {asia_flow_pts:.1f}pts")
    else:
        asia_score += 1.0

    # ── Europe: Seasonal demand ─────────────────────────────────────────────
    season_pts = seasonal_europe_factor(d)
    europe_score += season_pts
    europe_breakdown.append(f"Seasonal factor (month {d.month}) → {season_pts:.1f}pts")

    # ── Asia: Pacific routing advantage ───────────────────────────────────
    # US Gulf to Asia via Panama is ~12,000nm vs to Rotterdam ~5,000nm.
    # Pacific US exports (Sabine, Corpus) have a slight distance advantage to Asia.
    pacific_pts = 1.2  # moderate structural advantage
    asia_score += pacific_pts
    asia_breakdown.append(f"Pacific routing structural factor → {pacific_pts:.1f}pts")

    # ── Asia: Demand proxy ─────────────────────────────────────────────────
    # Proxy: Asian economies have structural LNG demand growth
    asia_demand_pts = 1.0
    asia_score += asia_demand_pts
    asia_breakdown.append(f"Asian structural demand growth proxy → {asia_demand_pts:.1f}pts")

    # ── Clamp to 0-10 ──────────────────────────────────────────────────────
    europe_score = round(min(10.0, max(0.0, europe_score)), 2)
    asia_score = round(min(10.0, max(0.0, asia_score)), 2)

    # ── Determine dominant signal ───────────────────────────────────────────
    diff = europe_score - asia_score
    if diff > 1.5:
        dominant = "europe"
        signal = "Europe is pulling significantly harder"
    elif diff > 0.5:
        dominant = "europe"
        signal = "Europe has a moderate edge"
    elif diff < -1.5:
        dominant = "asia"
        signal = "Asia is pulling significantly harder"
    elif diff < -0.5:
        dominant = "asia"
        signal = "Asia has a moderate edge"
    else:
        dominant = "balanced"
        signal = "Flows are broadly balanced"

    return {
        "europe_score": europe_score,
        "asia_score": asia_score,
        "dominant": dominant,
        "signal": signal,
        "europe_breakdown": europe_breakdown,
        "asia_breakdown": asia_breakdown,
        "data_quality_notes": data_quality,
        "as_of": d.isoformat(),
    }


def generate_commentary(pull_scores: dict, flow_split: dict, storage_pct: float | None) -> str:
    """Generate human-readable commentary from current signals."""
    lines = []
    europe_score = pull_scores["europe_score"]
    asia_score = pull_scores["asia_score"]
    dom = pull_scores["dominant"]

    eu_pct = flow_split.get("europe_pct", 0)
    asia_pct = flow_split.get("asia_pct", 0)

    lines.append(
        f"US LNG flows over the past 30 days: {eu_pct:.0f}% toward Europe, "
        f"{asia_pct:.0f}% toward Asia."
    )

    lines.append(
        f"Pull scores: Europe {europe_score:.1f}/10, Asia {asia_score:.1f}/10. "
        f"{pull_scores['signal']}."
    )

    if storage_pct is not None:
        if storage_pct < 50:
            lines.append(
                f"European gas storage at {storage_pct:.1f}% — below mid-range, "
                "providing a significant storage-driven pull for LNG imports."
            )
        elif storage_pct < 70:
            lines.append(f"European gas storage at {storage_pct:.1f}% — moderate level.")
        else:
            lines.append(
                f"European gas storage at {storage_pct:.1f}% — well-filled, "
                "reducing urgency for European imports."
            )

    if dom == "europe":
        lines.append(
            "Current signals suggest US LNG cargoes are more likely to continue "
            "favoring European destinations in the near term."
        )
    elif dom == "asia":
        lines.append(
            "Current signals suggest Asian markets are offering superior economics, "
            "which may redirect uncommitted US LNG cargoes eastward."
        )
    else:
        lines.append(
            "Economics are broadly balanced between Europe and Asia — "
            "cargo allocation is likely driven by contract obligations and spot availability."
        )

    return " ".join(lines)
