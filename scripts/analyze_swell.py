#!/usr/bin/env python3
"""
Analyze proxy buoy readings for the Kauai South Shore (Nomilo Fish Pond to
Makahuena Point) and produce a structured "what's happening on the South
Shore right now" estimate for downstream skills.
 
CORE MODEL: Barbers Point (51212) sees the same open-ocean south swell
before or after it reaches Kauai's South Shore, depending on swell
DIRECTION -- not a fixed number of hours. This script computes the lag
from real wave physics and real coordinates instead of assuming a
constant lag, because testing (see SKILL.md) showed a flat "4-5 hour"
rule does not hold up:
 
  - Barbers Point (21.323N, 158.149W) and the Nomilo-Makahuena stretch
    (~21.878N, 159.486W) are barely half a degree of latitude apart, so
    for a due-south swell the lag between them is under 2 hours, not 4-5.
  - For more southwest-leaning swell (~200-220 deg, common in Hawaii),
    Kauai's South Shore -- being west of Oahu -- can receive the swell
    BEFORE Barbers Point does. The lag can be negative.
  - The lag only gets into the 3-4+ hour range for swell arriving from
    a more southeasterly angle (~165-170 deg), which is less common for
    Hawaii south swells.
 
So: always compute the lag from the buoy's own reported MWD (direction)
and DPD (period) for that specific reading. Never assume a fixed lag.
 
Usage:
  python3 analyze_swell.py '{
    "now_utc": "2026-07-02T18:30:00",
    "primary_series": [
      {"obs_time_utc": "2026-07-02T18:00:00", "wvht_m": 1.2, "dpd_s": 15, "mwd_deg": 195},
      {"obs_time_utc": "2026-07-02T17:30:00", "wvht_m": 1.15, "dpd_s": 15, "mwd_deg": 194},
      {"obs_time_utc": "2026-07-02T14:00:00", "wvht_m": 1.0, "dpd_s": 14, "mwd_deg": 194},
      {"obs_time_utc": "2026-07-02T13:30:00", "wvht_m": 0.95, "dpd_s": 14, "mwd_deg": 193}
    ],
    "verification_series": [ ... same shape, optional ... ],
    "tide_surge_ft": 0.3
  }'
 
"primary_series" should be several hours of Barbers Point (51212) rows
pulled straight from the NDBC realtime2 file. Include AT LEAST the last
6 hours of rows (more if swell period is short/direction is southeasterly,
since the lag can run several hours in that case) -- the lookback needs
real history to search through. "now_utc" defaults to the system clock if
omitted, but pass it explicitly using the most recent *reliable*
timestamp you have (see SKILL.md's staleness-check step). "verification_series"
and "tide_surge_ft" are optional -- omit entirely (don't pass nulls/empty
lists) if that source was unreachable.
"""
import sys
import json
import math
from datetime import datetime, timedelta, timezone
 
M_TO_FT = 3.28084
 
COMPASS_16 = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]
 
# Fixed real-world reference points (see SKILL.md for sourcing)
BARBERS_POINT = (21.323, -158.149)          # NOAA buoy 51212
SOUTH_SHORE_MID = (21.877705, -159.485705)  # midpoint of Nomilo Fishpond / Makahuena Pt
 
_LAT0 = (BARBERS_POINT[0] + SOUTH_SHORE_MID[0]) / 2
_KM_PER_DEG_LAT = 111.32
_KM_PER_DEG_LON = 111.32 * math.cos(math.radians(_LAT0))
_D_EAST_KM = (SOUTH_SHORE_MID[1] - BARBERS_POINT[1]) * _KM_PER_DEG_LON
_D_NORTH_KM = (SOUTH_SHORE_MID[0] - BARBERS_POINT[0]) * _KM_PER_DEG_LAT
 
 
def deg_to_compass(deg):
    if deg is None:
        return None
    idx = int((deg % 360) / 22.5 + 0.5) % 16
    return COMPASS_16[idx]
 
 
def group_velocity_kmh(period_s):
    """Deep-water group velocity: Cg = 0.5 * Cp = 0.5 * 1.56 * T (m/s)."""
    if not period_s:
        return None
    return 0.78 * period_s * 3.6
 
 
def compute_lag_hours(mwd_deg, dpd_s):
    """
    Physics-based lag (hours) between Barbers Point and the South Shore
    for a swell with the given direction (MWD, degrees FROM which it
    comes) and dominant period. Positive = Barbers Point sees it first
    (South Shore lags behind). Negative = South Shore actually gets it
    first (common for more southwesterly swell, since Kauai sits west
    of Oahu).
    Returns (lag_hours, confidence) or (None, "unknown") if inputs missing.
    """
    if mwd_deg is None or dpd_s is None:
        return None, "unknown"
 
    travel_bearing = (mwd_deg + 180) % 360
    tx = math.sin(math.radians(travel_bearing))
    ty = math.cos(math.radians(travel_bearing))
    projected_km = _D_EAST_KM * tx + _D_NORTH_KM * ty
 
    v = group_velocity_kmh(dpd_s)
    if not v:
        return None, "unknown"
    lag = projected_km / v
 
    # Confidence: longer, cleaner groundswell periods track this simple
    # plane-wave model much better than short-period wind swell, which
    # is locally generated/choppy and doesn't propagate as a clean packet.
    if dpd_s >= 14:
        confidence = "high"
    elif dpd_s >= 12:
        confidence = "medium"
    else:
        confidence = "low"
 
    # Near-zero-or-negative lag is a real physical result for SW-leaning
    # swell, not an error -- but it does mean Barbers Point isn't a
    # meaningful "hours-ahead" lead indicator for that specific swell.
    return round(lag, 2), confidence
 
 
def parse_series(series):
    out = []
    for row in series or []:
        try:
            dt = datetime.fromisoformat(row["obs_time_utc"])
        except (KeyError, TypeError, ValueError):
            continue
        if row.get("wvht_m") is None:
            # A row with no wave height is useless for this skill --
            # drop it here rather than letting a partial row (e.g. one
            # with direction but no height) reach the agreement/trend
            # calculations downstream and crash on a missing key.
            continue
        r = dict(row)
        r["_dt"] = dt
        r["wvht_ft"] = round(r["wvht_m"] * M_TO_FT, 1)
        if r.get("mwd_deg") is not None:
            r["mwd_compass"] = deg_to_compass(r["mwd_deg"])
        out.append(r)
    out.sort(key=lambda r: r["_dt"])
    return out
 
 
def closest_row(series, target_dt):
    if not series:
        return None
    return min(series, key=lambda r: abs((r["_dt"] - target_dt).total_seconds()))
 
 
def strip_internal(row):
    if row is None:
        return None
    return {k: v for k, v in row.items() if k != "_dt"}
 
 
def estimate_current_south_shore(series, now_dt):
    """Look BACKWARD (or forward, if lag is negative) in the buoy history
    to estimate what's hitting the South Shore right now. Iterates once
    since the lag depends on the period/direction of the row we land on."""
    if not series:
        return None, None
 
    # First pass: use the most recent row's own lag as an initial guess.
    latest = series[-1]
    guess_lag, _ = compute_lag_hours(latest.get("mwd_deg"), latest.get("dpd_s"))
    if guess_lag is None:
        guess_lag = 1.5
    target_dt = now_dt - timedelta(hours=guess_lag)
    candidate = closest_row(series, target_dt)
 
    # Second pass: refine using that candidate's own direction/period.
    lag, confidence = compute_lag_hours(candidate.get("mwd_deg"), candidate.get("dpd_s"))
    if lag is None:
        lag = guess_lag
        confidence = "unknown"
    refined_target = now_dt - timedelta(hours=lag)
    refined = closest_row(series, refined_target)
 
    lag, confidence = compute_lag_hours(refined.get("mwd_deg"), refined.get("dpd_s"))
    gap_hours = abs((now_dt - refined["_dt"]).total_seconds()) / 3600.0
 
    estimate = strip_internal(refined)
    estimate["lag_hours"] = lag
    estimate["lag_confidence"] = confidence
    estimate["source_obs_time_utc"] = refined["obs_time_utc"]
    estimate["as_of_now_utc"] = now_dt.isoformat()
 
    # Sanity flag: if the row we landed on isn't actually near the target
    # lookback time (e.g. series doesn't cover that window, or lag is
    # large and history is short), say so rather than silently presenting
    # a bad match as "current."
    stale_gap = abs(gap_hours - abs(lag if lag is not None else 0))
    estimate["lookback_match_quality"] = (
        "good" if stale_gap <= 1.0 else "poor -- series didn't cover the needed lookback window"
    )
 
    return estimate, latest
 
 
def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Expected one JSON string argument"}))
        sys.exit(1)
 
    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
 
    now_str = payload.get("now_utc")
    try:
        now_dt = datetime.fromisoformat(now_str) if now_str else datetime.now(timezone.utc).replace(tzinfo=None)
    except ValueError:
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
 
    primary_series = parse_series(payload.get("primary_series"))
    verification_series = parse_series(payload.get("verification_series"))
    tide_surge_ft = payload.get("tide_surge_ft")
 
    if not primary_series:
        print(json.dumps({"error": "primary_series with at least one valid row is required"}))
        sys.exit(1)
 
    current_estimate, latest_row = estimate_current_south_shore(primary_series, now_dt)
    latest_row_out = strip_internal(latest_row)
 
    verification_estimate = None
    if verification_series:
        verification_estimate, _ = estimate_current_south_shore(verification_series, now_dt)
 
    agreement = None
    if verification_estimate and current_estimate.get("mwd_deg") is not None and verification_estimate.get("mwd_deg") is not None:
        diff = abs(current_estimate["mwd_deg"] - verification_estimate["mwd_deg"])
        diff = min(diff, 360 - diff)
        height_diff_ft = abs(current_estimate.get("wvht_ft", 0) - verification_estimate.get("wvht_ft", 0))
        agreement = {
            "direction_diff_deg": round(diff, 0),
            "height_diff_ft": round(height_diff_ft, 1),
            "confirmed": diff <= 25 and height_diff_ft <= 1.0,
        }
 
    trend = None
    if latest_row_out and current_estimate:
        height_delta = latest_row_out.get("wvht_ft", 0) - current_estimate.get("wvht_ft", 0)
        if height_delta >= 0.5:
            trend = "building -- Barbers Point's more recent readings are larger than what's currently estimated to be hitting the coast"
        elif height_delta <= -0.5:
            trend = "dropping -- Barbers Point's more recent readings are smaller than what's currently estimated to be hitting the coast"
        else:
            trend = "holding steady"
 
    result = {
        "current_south_shore_estimate": current_estimate,
        "verification_estimate": verification_estimate,
        "agreement": agreement,
        "latest_barbers_point_reading": latest_row_out,
        "trend_next_several_hours": trend,
    }
 
    if tide_surge_ft is not None:
        if abs(tide_surge_ft) >= 0.5:
            surge_note = "significant residual bounce -- consistent with an active groundswell surging the south coast right now"
        elif abs(tide_surge_ft) >= 0.25:
            surge_note = "moderate residual bounce -- some swell energy may already be reaching the coast"
        else:
            surge_note = "minimal residual bounce -- no strong sign of swell energy hitting the coast yet"
        result["tide_surge"] = {"residual_ft": tide_surge_ft, "note": surge_note}
 
    print(json.dumps(result, indent=2))
 
 
if __name__ == "__main__":
    main()
