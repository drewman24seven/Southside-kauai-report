#!/usr/bin/env python3
"""
Average wind speed + direction across multiple station readings.
 
Direction is circular (0=N, 90=E, 180=S, 270=W), so it can't be averaged with
plain arithmetic (e.g. 350 and 10 should average to 0, not 180). This script
does a speed-weighted vector average, which is the standard meteorological
approach: each reading becomes a vector (speed, direction), the vectors are
summed component-wise, and the resulting vector's magnitude/angle give the
average speed and direction.
 
Usage:
    python3 average_wind.py '<json>'
 
Input JSON: a list of station readings, e.g.
[
  {"id": "KHIKOLOA25", "speed_mph": 3, "direction_deg": 0},
  {"id": "KHIKOLOA34", "speed_mph": 5, "direction_deg": 22.5},
  {"id": "KHIKOLOA27", "speed_mph": 4, "direction_deg": 45}
]
 
Each reading needs either "direction_deg" (0-360) or "direction_compass"
(e.g. "N", "ENE") - compass will be converted to degrees automatically.
 
Prints a JSON result with:
  - average_speed_mph: simple arithmetic mean of speeds
  - vector_average_speed_mph: magnitude of the averaged vector (accounts for
    directional cancellation - will be lower than average_speed_mph if the
    stations disagree on direction)
  - average_direction_deg / average_direction_compass: speed-weighted
    circular mean direction
  - stations: the parsed input, echoed back for traceability
"""
import sys
import json
import math
 
COMPASS_POINTS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]
 
 
def compass_to_deg(compass: str) -> float:
    compass = compass.strip().upper()
    if compass not in COMPASS_POINTS:
        raise ValueError(f"Unrecognized compass direction: {compass!r}")
    return COMPASS_POINTS.index(compass) * 22.5
 
 
def deg_to_compass(deg: float) -> str:
    deg = deg % 360
    idx = round(deg / 22.5) % 16
    return COMPASS_POINTS[idx]
 
 
def main():
    if len(sys.argv) != 2:
        print("Usage: python3 average_wind.py '<json_readings>'", file=sys.stderr)
        sys.exit(1)
 
    readings = json.loads(sys.argv[1])
    if not readings:
        print("Error: no readings provided", file=sys.stderr)
        sys.exit(1)
 
    parsed = []
    sum_u = 0.0  # east-west component
    sum_v = 0.0  # north-south component
    sum_speed = 0.0
 
    for r in readings:
        speed = float(r["speed_mph"])
        if "direction_deg" in r and r["direction_deg"] is not None:
            deg = float(r["direction_deg"])
        elif "direction_compass" in r and r["direction_compass"]:
            deg = compass_to_deg(r["direction_compass"])
        else:
            raise ValueError(f"Reading for {r.get('id')} has no direction info")
 
        rad = math.radians(deg)
        # Meteorological convention: direction = where wind comes FROM.
        # Vector components point in the direction the wind is blowing TOWARD,
        # then we convert back to "from" at the end for reporting.
        u = -speed * math.sin(rad)
        v = -speed * math.cos(rad)
        sum_u += u
        sum_v += v
        sum_speed += speed
 
        p_row = {
            "id": r.get("id"),
            "speed_mph": speed,
            "direction_deg": round(deg, 1),
            "direction_compass": deg_to_compass(deg),
        }
        for k, v in r.items():
            if k not in p_row:
                p_row[k] = v
        parsed.append(p_row)
 
    n = len(readings)
    avg_speed = sum_speed / n
 
    mean_u = sum_u / n
    mean_v = sum_v / n
    vector_avg_speed = math.hypot(mean_u, mean_v)
    # Convert averaged "toward" vector back to a "from" bearing.
    avg_dir_rad = math.atan2(-mean_u, -mean_v)
    avg_dir_deg = math.degrees(avg_dir_rad) % 360
 
    avg_dir_deg = round(avg_dir_deg, 1) % 360
    # If the vectors nearly cancel out (opposing winds of similar strength),
    # the resulting direction is numerically meaningless noise - flag it.
    direction_reliable = vector_avg_speed > 0.5
 
    result = {
        "stations": parsed,
        "num_stations": n,
        "average_speed_mph": round(avg_speed, 1),
        "vector_average_speed_mph": round(vector_avg_speed, 1),
        "average_direction_deg": avg_dir_deg if direction_reliable else None,
        "average_direction_compass": deg_to_compass(avg_dir_deg) if direction_reliable else None,
        "direction_reliable": direction_reliable,
        "method": "speed-weighted vector average for direction; arithmetic mean for average_speed_mph",
    }
    if not direction_reliable:
        result["note"] = (
            "Station wind directions largely cancel out (opposing winds of similar "
            "strength) - average direction is not meaningful here."
        )
 
    print(json.dumps(result, indent=2))
 
 
if __name__ == "__main__":
    main()
