#!/usr/bin/env python3
"""
Central aggregator script for the Kauai South Side Wind & Water Report App.
Fetches data from:
- Weather Underground JSON API (3 Koloa stations)
- NOAA buoy feeds (51212, 51213)
- NOAA CO-OPS Tide API (Port Allen 1611347)
- NWS Marine Forecast (Kauai Leeward PHZ112)
- CDIP ERDDAP Pipeline Health
 
Processes observations through scripts/average_wind.py and scripts/analyze_swell.py.
Outputs data.json for the web dashboard.
"""
import os
import sys
import json
import urllib.request
import urllib.error
import re
import subprocess
from datetime import datetime, timezone, timedelta
import time

WU_API_KEY = "e1f10a1e78da46f5b10a1e78da96f525"
WIND_STATIONS = {
    "KHIKOLOA25": "Primary/Anchor",
    "KHIKOLOA34": "Verification 1",
    # "KHIKOLOA27": "Verification 2"  # Commented out due to physical wind shadow / Southerly direction bias
}

BUOY_PRIMARY = "51212"    # Barbers Point, Oahu
BUOY_VERIFY = "51213"     # Lanai Southwest

TIDE_STATION = "1611347"  # Port Allen

NWS_ZONE = "PHZ112"       # Kauai Leeward Waters

import ssl

def fetch_url(url, timeout=10):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def fetch_url_cached(url, cache_filename, max_age_seconds=1800):
    cache_path = os.path.join(os.path.dirname(__file__), "..", cache_filename)
    if os.path.exists(cache_path):
        mtime = os.path.getmtime(cache_path)
        age = time.time() - mtime
        if age < max_age_seconds:
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    print(f"Reading cached response for {url} ({int(age)}s old)...")
                    return f.read()
            except Exception as e:
                print(f"Error reading cache {cache_filename}: {e}", file=sys.stderr)
                
    content = fetch_url(url)
    if content:
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            print(f"Error writing cache {cache_filename}: {e}", file=sys.stderr)
    return content

def get_wind_data():
    readings = []
    for station_id, role in WIND_STATIONS.items():
        url = f"https://api.weather.com/v2/pws/observations/current?apiKey={WU_API_KEY}&units=e&stationId={station_id}&format=json"
        content = fetch_url(url)
        if content:
            try:
                data = json.loads(content)
                obs = data['observations'][0]
                readings.append({
                    "id": station_id,
                    "role": role,
                    "speed_mph": obs['imperial']['windSpeed'],
                    "direction_deg": obs['winddir'],
                    "gust_mph": obs['imperial']['windGust'],
                    "temp_f": obs['imperial']['temp'],
                    "humidity": obs['humidity'],
                    "time_local": obs['obsTimeLocal'],
                    "time_utc": obs['obsTimeUtc'],
                    "status": "Online"
                })
                print(f"Wind PWS {station_id} ({role}): Speed {obs['imperial']['windSpeed']} mph, Dir {obs['winddir']}°")
            except Exception as e:
                print(f"Error parsing WU data for {station_id}: {e}", file=sys.stderr)
        else:
            print(f"Station {station_id} ({role}) is offline or unreachable.")
    return readings

def parse_buoy_txt(txt):
    if not txt:
        return []
    lines = txt.splitlines()
    if len(lines) < 3:
        return []
    
    # Identify indices from header:
    # #YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
    header = lines[0].strip().split()
    # Skip any starting '#' from first column
    if header[0].startswith('#'):
        header[0] = header[0].lstrip('#')
    
    try:
        idx_yy = header.index("YY")
        idx_mm = header.index("MM")
        idx_dd = header.index("DD")
        idx_hh = header.index("hh")
        idx_mn = header.index("mm")
        idx_wvht = header.index("WVHT")
        idx_dpd = header.index("DPD")
        idx_mwd = header.index("MWD")
    except ValueError as e:
        print(f"Error finding buoy columns in header: {e}", file=sys.stderr)
        return []
    
    parsed = []
    # Row 0 is header, Row 1 is units, data starts at Row 2
    for line in lines[2:]:
        parts = line.strip().split()
        if len(parts) < len(header):
            continue
        
        # Check for missing values 'MM'
        if parts[idx_wvht] == 'MM':
            continue
            
        try:
            # Build UTC ISO Timestamp
            yy = int(parts[idx_yy])
            mm = int(parts[idx_mm])
            dd = int(parts[idx_dd])
            hh = int(parts[idx_hh])
            mn = int(parts[idx_mn])
            obs_dt = datetime(yy, mm, dd, hh, mn, tzinfo=timezone.utc)
            obs_time_utc = obs_dt.replace(tzinfo=None).isoformat()
            
            wvht_m = float(parts[idx_wvht])
            dpd_s = float(parts[idx_dpd]) if parts[idx_dpd] != 'MM' else None
            mwd_deg = float(parts[idx_mwd]) if parts[idx_mwd] != 'MM' else None
            
            parsed.append({
                "obs_time_utc": obs_time_utc,
                "wvht_m": wvht_m,
                "dpd_s": dpd_s,
                "mwd_deg": mwd_deg
            })
        except Exception as e:
            continue
    return parsed

def get_buoy_data():
    primary_url = f"https://www.ndbc.noaa.gov/data/realtime2/{BUOY_PRIMARY}.txt"
    verify_url = f"https://www.ndbc.noaa.gov/data/realtime2/{BUOY_VERIFY}.txt"
    
    print(f"Fetching primary Buoy {BUOY_PRIMARY}...")
    primary_txt = fetch_url(primary_url)
    primary_series = parse_buoy_txt(primary_txt)
    print(f"  Parsed {len(primary_series)} readings.")
    
    print(f"Fetching verification Buoy {BUOY_VERIFY}...")
    verify_txt = fetch_url(verify_url)
    verify_series = parse_buoy_txt(verify_txt)
    print(f"  Parsed {len(verify_series)} readings.")
    
    return primary_series, verify_series

def get_tide_data_for_station(station_id):
    # Fetch today's observations and 48-hour predictions (today and tomorrow)
    now = datetime.now()
    begin_str = now.strftime("%Y%m%d")
    end_str = (now + timedelta(days=1)).strftime("%Y%m%d")
    
    obs_url = f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station={station_id}&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&application=kauai-south-shore-swell&format=xml"
    pred_url = f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date={begin_str}&end_date={end_str}&station={station_id}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&application=kauai-south-shore-swell&format=xml"
    
    print(f"Fetching tide predictions for station {station_id}...")
    pred_xml = fetch_url(pred_url)
    print(f"Fetching tide observations for station {station_id}...")
    obs_xml = fetch_url(obs_url)
    
    predictions = []
    observations = []
    
    if pred_xml and '<pr ' in pred_xml:
        predictions = re.findall(r'<pr t="([^"]+)"\s+v="([^"]+)"', pred_xml)
        predictions = [{"time": p[0], "value_ft": float(p[1])} for p in predictions]
        
    tide_surge_ft = None
    if obs_xml and f'metadata id="{station_id}"' in obs_xml:
        obs_list = re.findall(r'<o t="([^"]+)"\s+v="([^"]+)"', obs_xml)
        if obs_list:
            observations = [{"time": o[0], "value_ft": float(o[1])} for o in obs_list]
            # Match latest observation to prediction for surge calculation
            latest_obs = observations[-1]
            # Find closest prediction
            matching_preds = [p for p in predictions if p["time"] == latest_obs["time"]]
            if matching_preds:
                tide_surge_ft = round(latest_obs["value_ft"] - matching_preds[0]["value_ft"], 2)
                print(f"Calculated Tide Surge for {station_id}: {tide_surge_ft} ft")
    else:
        print(f"Tide observed water level data is unavailable for {station_id} (offline/no sensor).")
        
    return {
        "predictions": predictions,
        "observations": observations,
        "tide_surge_ft": tide_surge_ft
    }

def get_tide_data():
    return get_tide_data_for_station(TIDE_STATION)

def get_nws_forecast_zone(zone_id):
    url = "https://tgftp.nws.noaa.gov/data/raw/fz/fzhw50.phfo.cwf.hfo.txt"
    print(f"Fetching NWS Marine Forecast zone {zone_id}...")
    content = fetch_url_cached(url, "nws_forecast_cache.txt", 1800)
    if content:
        match = re.search(rf'({zone_id}-.*?\$\$)', content, re.DOTALL)
        if match:
            raw_text = match.group(1).strip()
            # Clean up double dollars and extra whitespace
            raw_text = raw_text.replace('$$', '').strip()
            print(f"NWS Forecast section {zone_id} found.")
            return raw_text
    print(f"NWS Forecast section {zone_id} not found.", file=sys.stderr)
    return f"NWS Forecast zone {zone_id} unavailable."

def get_nws_forecast():
    return get_nws_forecast_zone(NWS_ZONE)

def get_nws_grid_wind(grid_x=88, grid_y=169, label="South Shore (Koloa)", cache_file="nws_grid_wind_cache.txt"):
    url = f"https://api.weather.gov/gridpoints/HFO/{grid_x},{grid_y}"
    print(f"Fetching NWS Gridded Model wind forecast for {label} ({grid_x},{grid_y})...")
    content = fetch_url_cached(url, cache_file, 1800)
    if not content:
        return None
    
    try:
        data = json.loads(content)
        props = data['properties']
        
        wind_speed_values = props.get('windSpeed', {}).get('values', [])
        wind_dir_values = props.get('windDirection', {}).get('values', [])
        
        now = datetime.now(timezone.utc)
        
        speed_val = None
        for item in sorted(wind_speed_values, key=lambda x: x['validTime']):
            start_str = item['validTime'].split('/')[0]
            start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            if start_dt <= now:
                speed_val = item['value']
            else:
                break
                
        dir_val = None
        for item in sorted(wind_dir_values, key=lambda x: x['validTime']):
            start_str = item['validTime'].split('/')[0]
            start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            if start_dt <= now:
                dir_val = item['value']
            else:
                break
                
        if speed_val is not None and dir_val is not None:
            speed_mph = round(speed_val * 0.621371, 1)
            speed_knots = round(speed_val * 0.539957, 1)
            direction_deg = round(dir_val, 1)
            
            # Local import
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from average_wind import deg_to_compass
            direction_compass = deg_to_compass(direction_deg)
            
            print(f"  {label} grid wind: {speed_mph} mph ({speed_knots} KT) from {direction_compass} ({direction_deg}°)")
            return {
                "speed_mph": speed_mph,
                "speed_knots": speed_knots,
                "direction_deg": direction_deg,
                "direction_compass": direction_compass,
                "source": f"NWS gridded forecast (Honolulu WFO HFO/{grid_x},{grid_y})"
            }
    except Exception as e:
        print(f"Error parsing gridded forecast for {label}: {e}", file=sys.stderr)
        
    return None


def get_metar_wind(icao):
    """Fetch latest METAR wind observation from aviationweather.gov for a given ICAO station ID.
    Returns dict with speed_knots, speed_mph, direction_deg, direction_compass, gust_knots, raw_metar.
    PHBK = PMRF Barking Sands, Kekaha — the only active ASOS on the west Kauai coast.
    """
    url = f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json"
    print(f"Fetching METAR wind for {icao}...")
    content = fetch_url(url)
    if not content:
        return None
    try:
        data = json.loads(content)
        if not data:
            print(f"  METAR {icao}: no observations returned.", file=sys.stderr)
            return None
        obs = data[0]
        wspd_kt = obs.get('wspd')   # knots
        wdir_deg = obs.get('wdir')  # degrees
        wgst_kt = obs.get('wgst')   # knots, may be None
        if wspd_kt is None or wdir_deg is None:
            print(f"  METAR {icao}: wind data missing from response.", file=sys.stderr)
            return None
        
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from average_wind import deg_to_compass
        
        speed_mph = round(wspd_kt * 1.15078, 1)
        gust_mph = round(wgst_kt * 1.15078, 1) if wgst_kt else None
        compass = deg_to_compass(wdir_deg) if wdir_deg else "VAR"
        print(f"  METAR {icao}: {wspd_kt} kt from {wdir_deg}° ({compass}), gust={wgst_kt} kt")
        return {
            "station": icao,
            "speed_knots": float(wspd_kt),
            "speed_mph": speed_mph,
            "direction_deg": float(wdir_deg) if wdir_deg else None,
            "direction_compass": compass,
            "gust_knots": float(wgst_kt) if wgst_kt else None,
            "gust_mph": gust_mph,
            "raw_metar": obs.get('rawOb', ''),
            "obs_time_utc": obs.get('obsTime', ''),
            "source": f"METAR ASOS {icao} (aviationweather.gov)"
        }
    except Exception as e:
        print(f"Error parsing METAR for {icao}: {e}", file=sys.stderr)
        return None


def check_cdip_health():
    url = "https://erddap.cdip.ucsd.edu/erddap/outOfDateDatasets.html"
    print("Checking CDIP pipeline health...")
    content = fetch_url(url)
    if not content:
        return "Unknown"
    
    if "wave_agg" in content:
        # Pull generated time and dataset maxTime
        # e.g., This web page was generated at 2026-07-03T18:20:11Z .
        gen_match = re.search(r'generated at ([0-9T:\-Z]+)', content)
        max_match = re.search(r'([0-9T:\-Z]+)\s+wave_agg', content)
        if gen_match and max_match:
            try:
                gen_dt = datetime.fromisoformat(gen_match.group(1).replace('Z', '+00:00'))
                max_dt = datetime.fromisoformat(max_match.group(1).replace('Z', '+00:00'))
                delay_hours = (gen_dt - max_dt).total_seconds() / 3600.0
                if delay_hours > 6:
                    return f"Laggard (Buoy pipeline delayed by {round(delay_hours, 1)} hours)"
                else:
                    return "Healthy"
            except Exception as e:
                return "Laggard (wave_agg is out of date)"
        return "Laggard"
    return "Healthy"

def main():
    print(f"=== Starting Kauai South Shore Wind/Water Data Aggregator ===")
    
    # Load previous data.json so we can fall back to stale-but-valid values
    # if any live fetch fails this run (prevents blanking swell/tide on transient API errors)
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(workspace_dir, "data.json")
    previous_data = {}
    try:
        if os.path.exists(output_path):
            with open(output_path) as f:
                previous_data = json.load(f)
    except Exception:
        pass
    
    # 1. Fetch Wind PWS readings
    wind_readings = get_wind_data()
    wind_results = None
    if wind_readings:
        # Run average_wind.py via subprocess
        try:
            scripts_dir = os.path.dirname(os.path.abspath(__file__))
            avg_wind_path = os.path.join(scripts_dir, "average_wind.py")
            res = subprocess.run(
                ["python3", avg_wind_path, json.dumps(wind_readings)],
                capture_output=True, text=True, check=True
            )
            wind_results = json.loads(res.stdout)
        except Exception as e:
            print(f"Error running average_wind.py: {e}", file=sys.stderr)

    # 1b. Fetch Waimea-Kekaha PWS wind (KHIWAIME179)
    print("Fetching Waimea PWS KHIWAIME179...")
    wind_179 = None
    url_179 = f"https://api.weather.com/v2/pws/observations/current?apiKey={WU_API_KEY}&units=e&stationId=KHIWAIME179&format=json"
    content_179 = fetch_url(url_179)
    if content_179:
        try:
            data_179 = json.loads(content_179)
            obs_179 = data_179['observations'][0]
            wind_179 = {
                "speed_mph": obs_179['imperial']['windSpeed'],
                "direction_deg": obs_179['winddir'],
                "gust_mph": obs_179['imperial']['windGust'],
                "temp_f": obs_179['imperial']['temp'],
                "humidity": obs_179['humidity'],
                "time_local": obs_179['obsTimeLocal'],
                "time_utc": obs_179['obsTimeUtc'],
                "status": "Online"
            }
            print(f"Waimea Wind: Speed {wind_179['speed_mph']} mph, Dir {wind_179['direction_deg']}°")
        except Exception as e:
            print(f"Error parsing Waimea PWS: {e}", file=sys.stderr)
            
    # 1c. Fetch Kalaheo PWS wind (KHIKALAH11) for Port Allen
    print("Fetching Kalaheo PWS KHIKALAH11...")
    wind_11 = None
    url_11 = f"https://api.weather.com/v2/pws/observations/current?apiKey={WU_API_KEY}&units=e&stationId=KHIKALAH11&format=json"
    content_11 = fetch_url(url_11)
    if content_11:
        try:
            data_11 = json.loads(content_11)
            obs_11 = data_11['observations'][0]
            wind_11 = {
                "speed_mph": obs_11['imperial']['windSpeed'],
                "direction_deg": obs_11['winddir'],
                "gust_mph": obs_11['imperial']['windGust'],
                "temp_f": obs_11['imperial']['temp'],
                "humidity": obs_11['humidity'],
                "time_local": obs_11['obsTimeLocal'],
                "time_utc": obs_11['obsTimeUtc'],
                "status": "Online"
            }
            print(f"Kalaheo Wind: Speed {wind_11['speed_mph']} mph, Dir {wind_11['direction_deg']}°")
        except Exception as e:
            print(f"Error parsing Kalaheo PWS: {e}", file=sys.stderr)
            
    # 2. Fetch South Shore Buoys
    primary_series, verify_series = get_buoy_data()

    # 2b. Fetch Buoy 51208 (Na Pali Swell)
    print("Fetching Buoy 51208...")
    buoy_51208_url = "https://www.ndbc.noaa.gov/data/realtime2/51208.txt"
    buoy_51208_txt = fetch_url(buoy_51208_url)
    buoy_51208_series = parse_buoy_txt(buoy_51208_txt)
    swell_51208 = None
    if buoy_51208_series:
        latest = buoy_51208_series[0]
        # local import
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from average_wind import deg_to_compass
        swell_51208 = {
            "obs_time_utc": latest["obs_time_utc"],
            "wvht_m": latest["wvht_m"],
            "wvht_ft": round(latest["wvht_m"] * 3.28084, 1),
            "dpd_s": latest["dpd_s"],
            "mwd_deg": latest["mwd_deg"],
            "mwd_compass": deg_to_compass(latest["mwd_deg"]) if latest["mwd_deg"] is not None else "N/A"
        }
        print(f"Buoy 51208 parsed: {swell_51208['wvht_ft']} ft @ {swell_51208['dpd_s']}s from {swell_51208['mwd_compass']}")
    
    # 3. Fetch Tides (Port Allen 1611347, Nawiliwili 1611400, Waimea Bay 1611401)
    tide_1611347 = get_tide_data_for_station("1611347") # Port Allen
    tide_1611400 = get_tide_data_for_station("1611400") # Nawiliwili
    tide_1611401 = get_tide_data_for_station("1611401") # Waimea Bay
    
    # Generate subordinate predictions for Waimea Bay (1611401) from Nawiliwili (1611400)
    if not tide_1611401["predictions"] and tide_1611400["predictions"]:
        print("Generating subordinate predictions for Waimea Bay (1611401) from Nawiliwili (1611400)...")
        waimea_preds = []
        for p in tide_1611400["predictions"]:
            try:
                t_dt = datetime.strptime(p["time"], "%Y-%m-%d %H:%M")
                waimea_dt = t_dt + timedelta(minutes=12)
                waimea_val = round(p["value_ft"] * 0.88, 3)
                waimea_preds.append({
                    "time": waimea_dt.strftime("%Y-%m-%d %H:%M"),
                    "value_ft": waimea_val
                })
            except Exception as e:
                pass
        tide_1611401["predictions"] = waimea_preds
    
    # 4. Fetch NWS Forecasts
    nws_forecast = get_nws_forecast_zone("PHZ112")
    nws_forecast_110 = get_nws_forecast_zone("PHZ110")
    nws_forecast_111 = get_nws_forecast_zone("PHZ111")
    
    # 4b. Fetch NWS Gridded Wind Forecast — South Shore (Koloa/Poipu area, HFO/88,169)
    model_wind = get_nws_grid_wind(
        grid_x=88, grid_y=169,
        label="South Shore (Koloa/Poipu)",
        cache_file="nws_grid_wind_cache.txt"
    )
    
    # 4c. Fetch NWS Gridded Wind Forecast — Port Allen (HFO/82,171)
    model_wind_port_allen = get_nws_grid_wind(
        grid_x=82, grid_y=171,
        label="Port Allen Harbor",
        cache_file="nws_grid_port_allen_cache.txt"
    )
    
    # 4d. Fetch NWS Gridded Wind Forecast — Kikiaola/Kekaha (HFO/75,174)
    model_wind_kikiaola = get_nws_grid_wind(
        grid_x=75, grid_y=174,
        label="Kikiaola Harbor",
        cache_file="nws_grid_kikiaola_cache.txt"
    )
    
    # 4e. Fetch PHBK METAR (PMRF Barking Sands, Kekaha) — only active ASOS on west Kauai coast
    # Reliable, hourly-reporting official ASOS station 2 nm from Kikiaola Harbor.
    metar_phbk = get_metar_wind("PHBK")
    
    
    # 5. Fetch CDIP Health
    cdip_status = check_cdip_health()
    print(f"CDIP pipeline status: {cdip_status}")
    
    # 6. Run swell analysis (South Shore)
    swell_results = None
    if primary_series:
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        swell_payload = {
            "now_utc": now_utc,
            "primary_series": primary_series,
            "verification_series": verify_series,
            "tide_surge_ft": tide_1611347["tide_surge_ft"]
        }
        
        try:
            scripts_dir = os.path.dirname(os.path.abspath(__file__))
            analyze_swell_path = os.path.join(scripts_dir, "analyze_swell.py")
            res = subprocess.run(
                ["python3", analyze_swell_path, json.dumps(swell_payload)],
                capture_output=True, text=True, check=True
            )
            swell_results = json.loads(res.stdout)
        except Exception as e:
            print(f"Error running analyze_swell.py: {e}", file=sys.stderr)
            
    # 7. Compile final JSON payload
    # Fall back to previous good values if any critical section came back null
    if swell_results is None and previous_data.get("swell"):
        print("WARNING: Swell analysis returned null — preserving previous swell data.", file=sys.stderr)
        swell_results = previous_data["swell"]
    
    tide_predictions_1611347 = tide_1611347["predictions"]
    if not tide_predictions_1611347 and previous_data.get("tides", {}).get("predictions"):
        print("WARNING: Tide predictions empty — preserving previous tide data.", file=sys.stderr)
        tide_predictions_1611347 = previous_data["tides"]["predictions"]
        tide_1611347["observations"] = previous_data["tides"]["observations"]
        tide_1611347["tide_surge_ft"] = previous_data["tides"]["surge_ft"]
    
    report_data = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "cdip_health": cdip_status,
        "wind": wind_results,
        "model_wind": model_wind,
        "swell": swell_results,
        "tides": {
            "predictions": tide_predictions_1611347,
            "observations": tide_1611347["observations"][-24:],
            "surge_ft": tide_1611347["tide_surge_ft"]
        },
        "forecast_text": nws_forecast,
        
        # Na Pali / Region Expansion Additions (Section 2)
        "wind_khiwaime179": wind_179,
        "wind_khikalah11": wind_11,
        "swell_51208": swell_51208,
        "tides_1611347": tide_1611347,
        "tides_1611400": tide_1611400,
        "tides_1611401": tide_1611401,
        "forecast_text_110": nws_forecast_110,
        "forecast_text_111": nws_forecast_111,
        # Na Pali harbor-specific wind sources
        "model_wind_port_allen": model_wind_port_allen,  # NWS HFO/82,171 — directly over Port Allen
        "model_wind_kikiaola": model_wind_kikiaola,       # NWS HFO/75,174 — directly over Kikiaola/Kekaha
        "metar_phbk": metar_phbk                          # PMRF Barking Sands ASOS — 2nm from Kikiaola Harbor
    }
    
    # Write to data.json
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(workspace_dir, "data.json")
    try:
        with open(output_path, "w") as f:
            json.dump(report_data, f, indent=2)
        print(f"\nSuccessfully wrote aggregated data to {output_path}")
    except Exception as e:
        print(f"Error writing output data.json: {e}", file=sys.stderr)
        
    # Print the text summary report (Slack/text style)
    print("\n" + "="*40)
    print("SUMMARY REPORT FOR KAUAI SOUTH SHORE")
    print("="*40)
    
    if wind_results:
        ws = wind_results
        if ws.get("direction_reliable"):
            wind_str = f"{ws['vector_average_speed_mph']} mph from {ws['average_direction_compass']} ({ws['average_direction_deg']}°)"
        else:
            wind_str = f"Average speed {ws['average_speed_mph']} mph, direction variable (cancelling vectors)"
        stations_str = ", ".join([s['id'] for s in ws['stations']])
        print(f"Cove Wind (PWS): {wind_str} [PWS: {stations_str}]")
    else:
        print("Cove Wind (PWS): No station data available.")

    if model_wind:
        print(f"Exposed Wind (NAM): {model_wind['speed_mph']} mph ({model_wind['speed_knots']} KT) from {model_wind['direction_compass']} ({model_wind['direction_deg']}°)")
    else:
        print("Exposed Wind (NAM): No model data available.")
        
    if swell_results:
        ss = swell_results["current_south_shore_estimate"]
        if ss:
            agreement_str = "Swell confirmed by Lanai buoy." if swell_results.get("agreement", {}).get("confirmed") else "Swell verification buoy unconfirmed."
            print(f"Swell: {ss['wvht_ft']} ft @ {ss['dpd_s']}s from {ss.get('mwd_compass')} ({ss.get('mwd_deg')}°) [Lag: {ss['lag_hours']} hrs, Conf: {ss['lag_confidence']}]")
            print(f"Trend: {swell_results.get('trend_next_several_hours', 'Holding')}")
            print(f"Verification: {agreement_str}")
        else:
            print("Swell: No current estimate could be computed.")
    else:
        print("Swell: No buoy data available.")
        
    if tide_1611347["tide_surge_ft"] is not None:
        print(f"Tide Surge: {tide_1611347['tide_surge_ft']} ft residual surge at Port Allen.")
    else:
        print("Tide Surge: Port Allen observed water level offline.")
        
    print("="*40 + "\n")

if __name__ == "__main__":
    main()
