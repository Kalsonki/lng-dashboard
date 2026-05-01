"""
Destination inference engine for LNG vessels.

Signals used (highest to lowest weight):
1. AIS destination string — parsed against terminal/port name lists
2. Geofence proximity — within 50nm of known import terminal
3. Canal routing — position in Red Sea/Suez or near Panama → infer basin
4. Route heading — great circle bearing toward candidate destinations
5. Last US export terminal — confirms US origin
6. Speed/status — anchored near terminal suggests arrival
"""
import math
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Known terminal name fragments → (region, terminal_name)
TERMINAL_NAME_MAP: dict[str, tuple[str, str]] = {
    # European
    "ROTTERDAM": ("europe", "Gate Terminal Rotterdam"),
    "GATE": ("europe", "Gate Terminal Rotterdam"),
    "MILFORD": ("europe", "South Hook LNG"),
    "SOUTH HOOK": ("europe", "South Hook LNG"),
    "DRAGON": ("europe", "Dragon LNG"),
    "GRAIN": ("europe", "Isle of Grain LNG"),
    "MONTOIR": ("europe", "Montoir LNG"),
    "FOS": ("europe", "Fos Cavaou"),
    "BARCELONA": ("europe", "Barcelona LNG"),
    "HUELVA": ("europe", "Huelva LNG"),
    "CARTAGENA": ("europe", "Cartagena LNG"),
    "SINES": ("europe", "Sines LNG"),
    "REVITHOUSSA": ("europe", "Revithoussa LNG"),
    "ADRIATIC": ("europe", "Adriatic LNG"),
    "KLAIPEDA": ("europe", "Klaipeda FSRU"),
    "EEMSHAVEN": ("europe", "Eemshaven FSRU"),
    "LUBMIN": ("europe", "Deutsche ReGas Lubmin"),
    "BRUNSBUTTEL": ("europe", "Brunsbuttel FSRU"),
    "WILHELMSHAVEN": ("europe", "Wilhelmshaven FSRU"),
    "LIVORNO": ("europe", "Livorno LNG"),
    "PANIGAGLIA": ("europe", "Panigaglia LNG"),
    "MUGARDOS": ("europe", "Mugardos LNG"),
    # Asian
    "FUTTSU": ("asia", "Futtsu LNG"),
    "SODEGAURA": ("asia", "Sodegaura LNG"),
    "TOKYO": ("asia", "Tokyo Bay LNG"),
    "SENBOKU": ("asia", "Senboku LNG"),
    "INCHEON": ("asia", "Incheon LNG"),
    "PYEONGTAEK": ("asia", "Pyeongtaek LNG"),
    "TONGYEONG": ("asia", "Tongyeong LNG"),
    "DAPENG": ("asia", "Guangdong Dapeng LNG"),
    "ZHUHAI": ("asia", "CNOOC Zhuhai LNG"),
    "TIANJIN": ("asia", "Tianjin LNG"),
    "DAHEJ": ("asia", "Dahej LNG"),
    "HAZIRA": ("asia", "Hazira LNG"),
    "KOCHI": ("asia", "Kochi LNG"),
    "SINGAPORE": ("asia", "Singapore LNG"),
    # Country codes (common AIS destination entries)
    "GB": ("europe", None), "DE": ("europe", None), "FR": ("europe", None),
    "NL": ("europe", None), "ES": ("europe", None), "PT": ("europe", None),
    "IT": ("europe", None), "GR": ("europe", None), "TR": ("europe", None),
    "BE": ("europe", None), "PL": ("europe", None), "LT": ("europe", None),
    "JP": ("asia", None), "KR": ("asia", None), "CN": ("asia", None),
    "TW": ("asia", None), "IN": ("asia", None), "SG": ("asia", None),
    "MY": ("asia", None), "TH": ("asia", None), "ID": ("asia", None),
}

# US LNG export terminal coordinates (lat, lon)
US_EXPORT_TERMINALS = [
    (29.7355, -93.8774, "Sabine Pass LNG"),
    (27.8169, -97.3964, "Corpus Christi LNG"),
    (28.9453, -95.3500, "Freeport LNG"),
    (29.8077, -93.3247, "Cameron LNG"),
    (38.4039, -76.3900, "Cove Point LNG"),
    (31.9696, -81.0091, "Elba Island LNG"),
    (29.8, -93.3, "Calcasieu Pass LNG"),
]

# Key geographic waypoints
SUEZ_CANAL = (30.0, 32.5)   # Northern Suez entrance
PANAMA_CANAL = (9.1, -79.7)  # Panama Canal Pacific entrance

# Import terminal geofences (lat, lon, radius_nm, region, name)
IMPORT_TERMINAL_GEOFENCES = [
    (51.95, 4.12, 30, "europe", "Rotterdam area"),
    (51.70, -5.10, 25, "europe", "Milford Haven"),
    (51.45, 0.70, 25, "europe", "Isle of Grain"),
    (47.28, -2.14, 25, "europe", "Montoir"),
    (43.40, 4.88, 25, "europe", "Fos Cavaou"),
    (41.33, 2.15, 25, "europe", "Barcelona"),
    (37.26, -6.95, 25, "europe", "Huelva"),
    (37.94, 23.34, 25, "europe", "Revithoussa"),
    (35.31, 139.87, 30, "asia", "Tokyo/Futtsu area"),
    (35.47, 139.97, 25, "asia", "Sodegaura"),
    (34.60, 135.38, 25, "asia", "Senboku"),
    (37.46, 126.60, 30, "asia", "Incheon"),
    (37.00, 126.99, 25, "asia", "Pyeongtaek"),
    (22.58, 114.35, 30, "asia", "Dapeng/HK area"),
    (38.85, 117.80, 25, "asia", "Tianjin"),
    (21.70, 72.60, 30, "asia", "Dahej/India west"),
    (1.26, 103.74, 25, "asia", "Singapore"),
]


@dataclass
class InferenceResult:
    destination_region: str  # 'europe', 'asia', 'other', 'uncertain'
    destination_name: Optional[str]
    confidence: float         # 0.0 – 1.0
    explanation: str
    basin: str                # 'atlantic', 'pacific', 'unknown'
    signals_used: list[str] = field(default_factory=list)


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in nautical miles between two lat/lon points."""
    R = 3440.065  # Earth radius in nm
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2 in degrees (0=N, 90=E)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def parse_ais_destination(dest_raw: str) -> tuple[Optional[str], Optional[str], float]:
    """
    Parse AIS destination string. Returns (region, terminal_name, confidence).
    """
    if not dest_raw:
        return None, None, 0.0
    dest = dest_raw.upper().strip()
    if dest in ("", "N/A", "NONE", ".", "????", "NULL"):
        return None, None, 0.0

    # Direct terminal name match
    for key, (region, terminal) in TERMINAL_NAME_MAP.items():
        if key in dest:
            return region, terminal, 0.85

    return None, None, 0.0


def check_geofence(lat: float, lon: float) -> Optional[tuple[str, str, float]]:
    """Check if position is within known import terminal geofence."""
    for t_lat, t_lon, radius_nm, region, name in IMPORT_TERMINAL_GEOFENCES:
        dist = haversine_nm(lat, lon, t_lat, t_lon)
        if dist <= radius_nm:
            conf = 0.95 if dist <= radius_nm * 0.5 else 0.85
            return region, name, conf
    return None


def infer_basin_from_position(lat: float, lon: float, heading: Optional[float]) -> tuple[Optional[str], float, str]:
    """
    Infer atlantic/pacific basin from current position and heading.
    Returns (basin, confidence, explanation).
    """
    # Near Suez Canal northbound → Europe
    dist_suez = haversine_nm(lat, lon, *SUEZ_CANAL)
    if dist_suez < 200:
        if heading is not None and 270 <= heading <= 360 or (heading is not None and 0 <= heading <= 90):
            return "atlantic", 0.80, "Near Suez Canal, northbound heading → Europe"
        return "atlantic", 0.65, "Near Suez Canal area"

    # In Red Sea heading north → likely Europe via Suez
    if 12 <= lat <= 30 and 32 <= lon <= 45:
        if heading is not None and 330 <= heading <= 360 or (heading is not None and 0 <= heading <= 30):
            return "atlantic", 0.75, "Red Sea northbound → Europe via Suez"
        elif heading is not None and 150 <= heading <= 210:
            return "pacific", 0.70, "Red Sea southbound → Asia"

    # Near Panama Canal
    dist_panama = haversine_nm(lat, lon, *PANAMA_CANAL)
    if dist_panama < 300:
        return "pacific", 0.75, "Near Panama Canal → Pacific/Asia routing"

    # Atlantic ocean (west of Europe/Africa)
    if -70 <= lon <= 10 and lat >= 0:
        return "atlantic", 0.70, "Atlantic Ocean position → Europe-bound likely"

    # Pacific / Indian Ocean east of Suez
    if lon >= 50 and lat <= 35:
        return "pacific", 0.65, "East of Suez → Asia routing likely"

    return None, 0.3, "Position ambiguous"


def infer_us_origin(last_port_lat: Optional[float], last_port_lon: Optional[float]) -> tuple[bool, str]:
    """Check if last port was a US LNG export terminal."""
    if last_port_lat is None or last_port_lon is None:
        return False, ""
    for t_lat, t_lon, name in US_EXPORT_TERMINALS:
        dist = haversine_nm(last_port_lat, last_port_lon, t_lat, t_lon)
        if dist < 50:
            return True, name
    return False, ""


def run_inference(
    ais_destination: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
    heading: Optional[float],
    speed: Optional[float],
    last_port_lat: Optional[float] = None,
    last_port_lon: Optional[float] = None,
) -> InferenceResult:
    """
    Main inference function. Combines all signals to produce destination estimate.
    """
    signals = []
    region_votes: dict[str, float] = {}
    terminal_name = None

    if lat is None or lon is None:
        return InferenceResult("uncertain", None, 0.1, "No position data", "unknown")

    # Signal 1: AIS destination string
    ais_region, ais_terminal, ais_conf = parse_ais_destination(ais_destination or "")
    if ais_region and ais_conf > 0:
        region_votes[ais_region] = region_votes.get(ais_region, 0) + ais_conf * 2.0
        terminal_name = ais_terminal
        signals.append(f"AIS destination '{ais_destination}' → {ais_region} (conf {ais_conf:.0%})")

    # Signal 2: Geofence proximity
    geo_result = check_geofence(lat, lon)
    if geo_result:
        geo_region, geo_name, geo_conf = geo_result
        region_votes[geo_region] = region_votes.get(geo_region, 0) + geo_conf * 3.0
        terminal_name = geo_name
        signals.append(f"Within geofence of {geo_name} → {geo_region} (conf {geo_conf:.0%})")

    # Signal 3: Basin from position
    basin, basin_conf, basin_exp = infer_basin_from_position(lat, lon, heading)
    if basin == "atlantic":
        region_votes["europe"] = region_votes.get("europe", 0) + basin_conf * 1.5
    elif basin == "pacific":
        region_votes["asia"] = region_votes.get("asia", 0) + basin_conf * 1.5
    if basin_conf > 0.4:
        signals.append(basin_exp)

    # Determine winner
    if not region_votes:
        return InferenceResult("uncertain", None, 0.2, "Insufficient signals — " + "; ".join(signals) if signals else "No signals", basin or "unknown", signals)

    best_region = max(region_votes, key=region_votes.get)
    total_weight = sum(region_votes.values())
    confidence = min(0.95, region_votes[best_region] / total_weight * 0.9 + 0.1)

    # Determine basin from region
    inferred_basin = "atlantic" if best_region == "europe" else ("pacific" if best_region == "asia" else basin or "unknown")

    explanation = "; ".join(signals) if signals else "Inferred from position"

    return InferenceResult(
        destination_region=best_region,
        destination_name=terminal_name,
        confidence=round(confidence, 2),
        explanation=explanation,
        basin=inferred_basin,
        signals_used=signals,
    )
