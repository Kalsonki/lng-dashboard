# Assumptions

## Data & Classification

- **"Europe"** includes: GB, DE, FR, NL, BE, ES, PT, IT, GR, PL, LT, LV, EE, FI, SE, DK, NO, TR, HR, SI, SK, CZ, AT, HU, RO, BG, MT, CY, IE.
- **"Asia"** includes: JP, KR, CN, TW, IN, SG, TH, MY, ID, PH, VN, PK, BD, LK, AE, KW, QAT, OM, BH, IL, JO, EG.
- Countries not in either list are classified **"other"**.

## LNG Vessel Classification

- Ship AIS type 72 = LNG tanker (official AIS spec).
- Vessels with "LNG", "METHANE", "GAS" in name are assumed LNG tankers (heuristic).
- All other tanker types (70–89) are filtered out unless name matches.

## Pull Score Formula

- Formula weights are manually calibrated, not statistically optimised.
- The "Pacific routing advantage" (1.2 pts) reflects that Pacific-side US terminals (Sabine, Corpus) have had historically higher Asia allocation. This is a structural proxy, not real-time data.
- Seasonal factor assumes Northern Hemisphere European heating patterns.

## Prices

- JKM is estimated using a seasonal model (base ~$13/MMBtu). Real JKM requires a paid data subscription.
- TTF is fetched from stooq.com when available; falls back to seasonal estimate.
- Henry Hub is fetched from EIA API (accurate when key is configured).
- Unit conversion: JKM USD/MMBtu → EUR/MWh uses approximate factor 3.41/1.10 (USD→EUR).

## Destination Inference

- AIS destination strings are highly unreliable. Geofence proximity is the most reliable signal.
- Geofence radius of 50nm is chosen to catch vessels approaching terminals, not just those docked.
- Canal routing assumptions: latitude 30°N + heading north in longitude 32–45°E = Suez northbound.

## Shipping Distances

- Route distances are approximations based on common sailing routes.
- US Gulf to Asia via Panama Canal assumed (alternative Suez route exists but is less common for US Gulf exports to East Asia).

## Sample Data

- Sample storage data uses a sinusoidal seasonal model with ±1.5% noise.
- Sample prices use seasonal models with Gaussian noise around recent approximate market levels.
- Sample vessel voyages are fictional but geographically plausible.
- Sample EIA export data uses random allocation within realistic range (40–60% Europe, 25–45% Asia).
