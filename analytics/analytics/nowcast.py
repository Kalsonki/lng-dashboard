"""Simple directional nowcast for US LNG flow direction."""
from datetime import date
from inference.flow_scorer import compute_pull_scores, generate_commentary


def compute_nowcast(
    storage_pct: float | None,
    storage_5yr_avg: float | None,
    ttf_eur_mwh: float | None,
    jkm_usd_mmbtu: float | None,
    hh_usd_mmbtu: float | None,
    eu_share_30d: float | None,
    asia_share_30d: float | None,
    flow_split: dict | None = None,
) -> dict:
    """
    Compute a directional nowcast for US LNG routing.
    Returns direction label, confidence, scores, and top reasons.
    """
    scores = compute_pull_scores(
        storage_pct, storage_5yr_avg, ttf_eur_mwh, jkm_usd_mmbtu,
        hh_usd_mmbtu, eu_share_30d, asia_share_30d,
    )

    europe_score = scores["europe_score"]
    asia_score = scores["asia_score"]
    diff = abs(europe_score - asia_score)
    dominant = scores["dominant"]

    if dominant == "europe":
        direction = "Europe-Favored"
    elif dominant == "asia":
        direction = "Asia-Favored"
    else:
        direction = "Balanced"

    if diff >= 2.5:
        confidence = "high"
    elif diff >= 1.0:
        confidence = "medium"
    else:
        confidence = "low"

    # Top reasons (first 3 breakdown items from dominant side)
    if dominant == "europe":
        top_reasons = scores["europe_breakdown"][:3]
    elif dominant == "asia":
        top_reasons = scores["asia_breakdown"][:3]
    else:
        top_reasons = scores["europe_breakdown"][:2] + scores["asia_breakdown"][:1]

    commentary = generate_commentary(scores, flow_split or {}, storage_pct)

    return {
        "direction": direction,
        "confidence": confidence,
        "europe_score": europe_score,
        "asia_score": asia_score,
        "top_reasons": top_reasons,
        "commentary": commentary,
        "data_quality_notes": scores["data_quality_notes"],
        "as_of": date.today().isoformat(),
    }
