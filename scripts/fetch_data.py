#!/usr/bin/env python3
"""
Hawaii-Wide Wind & Water Report Data Aggregator.
Fetches real-time observations and forecasts for Kauai, Oahu, Maui County, and Big Island:
- NDBC wave buoys (51212, 51213, 51208, 51211, 51201, 51202, 51205, 51206, 51046)
- NOAA CO-OPS Tide API (Kahului, Honolulu, Hilo, Kawaihae, Nawiliwili, Port Allen, Mokuoloe)
- Programmatic Subordinate Tide predictions (Haleiwa, Waianae, Lahaina, Maalaea, Kona, Kaumalapau, Waimea Bay)
- NWS Marine Zone Forecasts (PHZ112, PHZ110, PHZ111, PHZ115, PHZ114, PHZ118, PHZ117, PHZ123, PHZ124, PHZ122)
- NWS Gridded Wind Forecast points
- METAR ASOS observations (PHBK, PHNL, PHNG, PHOG, PHJH, PHNY, PHMK, PHKO, PHTO)
- Weather Underground PWS (Kauai South)

Outputs nested data.json for the web dashboard.
"""
import os
import sys
import json
import urllib.request
import urllib.error
import re
import ssl
import time
from datetime import datetime, timezone, timedelta

WU_API_KEY = "e1f10a1e78da46f5b10a1e78da96f525"

# NOAA Tide prediction offsets for subordinate stations
TIDE_OFFSETS = {
    # subordinate: (reference_id, time_shift_minutes, height_multiplier)
    "1611401": ("1611400", 12, 0.88),  # Waimea Bay from Nawiliwili
    "1612668": ("1612340", -90, 0.80), # Haleiwa from Honolulu
    "1612482": ("1612340", 20, 0.95),  # Waianae from Honolulu
    "TPT2799": ("1615680", 70, 0.85),  # Lahaina from Kahului
    "TPT2797": ("1615680", 95, 0.74),  # Maalaea from Kahului
    "1614465": ("1612340", 3, 1.00),   # Kaumalapau from Honolulu
    "1617846": ("1617760", 38, 0.73),  # Kailua-Kona from Hilo
}

# Hawaii-Wide Operations Configuration
ISLANDS_CONFIG = {
    "kauai": {
        "forecast_zones": ["PHZ112", "PHZ110", "PHZ111"],
        "shores": {
            "south": {
                "primary_buoy": "51212",
                "verify_buoy": "51213",
                "buoy_coords": (21.323, -158.149),
                "coast_coords": (21.877705, -159.485705),
                "tide_stations": ["1611347", "1611400"],
                "model_wind_grid": (86, 169),
                "extra_grids": {
                    "poipu": (86, 170),
                    "port_allen": (82, 171)
                },
                "pws_stations": ["KHIKOLOA25", "KHIKOLOA34", "KHIKOLOA27"]
            },
            "napali": {
                "primary_buoy": "51208",
                "verify_buoy": "51201",
                "buoy_coords": (22.288, -159.986),
                "coast_coords": (22.18, -159.69),
                "tide_stations": ["1611347", "1611401"],
                "model_wind_grid": (75, 187),
                "extra_grids": {
                    "napali_coast": (78, 184),
                    "port_allen": (82, 171)
                },
                "metar_station": "PHBK"
            },
            "niihau": {
                "primary_buoy": "51208",
                "verify_buoy": "51212",
                "buoy_coords": (21.9, -160.2),
                "coast_coords": (21.9, -160.2),
                "tide_stations": ["1611347"],
                "model_wind_grid": (56, 171),
                "extra_grids": {},
                "metar_station": "PHBK"
            }
        }
    },
    "oahu": {
        "forecast_zones": ["PHZ115", "PHZ114"],
        "shores": {
            "south": {
                "primary_buoy": "51211",
                "verify_buoy": "51212",
                "buoy_coords": (21.297, -157.959),
                "coast_coords": (21.28, -157.85),
                "tide_stations": ["1612340"],
                "model_wind_grid": (155, 142),
                "extra_grids": {
                    "honolulu": (155, 143)
                },
                "metar_station": "PHNL"
            },
            "north": {
                "primary_buoy": "51001",
                "verify_buoy": "51201",
                "buoy_coords": (24.475, -162.030),
                "coast_coords": (21.60, -158.11),
                "tide_stations": ["1612668"],
                "model_wind_grid": (144, 161),
                "extra_grids": {
                    "haleiwa": (144, 158)
                }
            },
            "west": {
                "primary_buoy": "51212",
                "verify_buoy": "51211",
                "buoy_coords": (21.323, -158.149),
                "coast_coords": (21.4, -158.20),
                "tide_stations": ["1612482"],
                "model_wind_grid": (138, 149),
                "extra_grids": {
                    "waianae": (140, 149)
                },
                "metar_station": "PHNL"
            },
            "windward": {
                "primary_buoy": "51202",
                "verify_buoy": "51211",
                "buoy_coords": (21.414, -157.681),
                "coast_coords": (21.436, -157.810),
                "tide_stations": ["1612480"],
                "model_wind_grid": (158, 153),
                "extra_grids": {
                    "kailua": (156, 150)
                },
                "metar_station": "PHNG"
            }
        }
    },
    "maui": {
        "forecast_zones": ["PHZ118", "PHZ117"],
        "shores": {
            "leeward": {
                "primary_buoy": "51213",
                "verify_buoy": "51212",
                "buoy_coords": (20.739, -157.014),
                "coast_coords": (20.8, -156.8),
                "tide_stations": ["TPT2799", "TPT2797", "1614465", "1613198"],
                "model_wind_grid": (197, 120),
                "extra_grids": {
                    "lahaina": (198, 122)
                },
                "metar_station": "PHJH"
            },
            "windward": {
                "primary_buoy": "51205",
                "verify_buoy": "51206",
                "buoy_coords": (21.018, -156.421),
                "coast_coords": (20.90, -156.47),
                "tide_stations": ["1615680"],
                "model_wind_grid": (214, 130),
                "extra_grids": {
                    "kahului": (212, 126)
                },
                "metar_station": "PHOG"
            }
        }
    },
    "big_island": {
        "forecast_zones": ["PHZ123", "PHZ124", "PHZ122"],
        "shores": {
            "leeward": {
                "primary_buoy": "51213",
                "verify_buoy": "51212",
                "buoy_coords": (20.739, -157.014),
                "coast_coords": (19.64, -156.02),
                "tide_stations": ["1617846"],
                "model_wind_grid": (229, 70),
                "extra_grids": {
                    "kailua_kona": (231, 70)
                },
                "metar_station": "PHKO"
            },
            "kawaihae": {
                "primary_buoy": "51046",
                "verify_buoy": "51213",
                "buoy_coords": (20.024, -155.828),
                "coast_coords": (20.038, -155.830),
                "tide_stations": ["1617433"],
                "model_wind_grid": (238, 91),
                "extra_grids": {
                    "kawaihae": (239, 88)
                }
            },
            "windward": {
                "primary_buoy": "51206",
                "verify_buoy": "51205",
                "buoy_coords": (19.779, -154.970),
                "coast_coords": (19.729, -155.061),
                "tide_stations": ["1617760"],
                "model_wind_grid": (274, 74),
                "extra_grids": {
                    "hilo": (271, 74)
                },
                "metar_station": "PHTO"
            }
        }
    }
}

def fetch_url(url, timeout=10):
    req = urllib.request.Request(url, headers={'User-Agent': 'HawaiiMarineReport/1.0 (contact@hawaiimarinereport.com)'})
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def fetch_url_cached(url, cache_filename, max_age_seconds=1800):
    # Place cache in a generic folder within workspace
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_path = os.path.join(workspace_dir, ".gemini_cache", cache_filename)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
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

def get_pws_wind_data(station_id):
    url = f"https://api.weather.com/v2/pws/observations/current?apiKey={WU_API_KEY}&units=e&stationId={station_id}&format=json"
    content = fetch_url(url)
    if content:
        try:
            data = json.loads(content)
            obs = data['observations'][0]
            return {
                "id": station_id,
                "speed_mph": obs['imperial']['windSpeed'],
                "direction_deg": obs['winddir'],
                "gust_mph": obs['imperial']['windGust'],
                "temp_f": obs['imperial']['temp'],
                "humidity": obs['humidity'],
                "time_local": obs['obsTimeLocal'],
                "time_utc": obs['obsTimeUtc'],
                "status": "Online"
            }
        except Exception as e:
            print(f"Error parsing WU PWS {station_id}: {e}", file=sys.stderr)
    return None

def ordinal_to_deg(ordinal_str):
    if not ordinal_str or ordinal_str == 'MM': return None
    mapping = {
        'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
        'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
        'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
        'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    }
    return mapping.get(ordinal_str.upper(), None)

def parse_buoy_spec(txt):
    if not txt: return []
    lines = txt.splitlines()
    if len(lines) < 3: return []
    header = lines[0].strip().split()
    if header[0].startswith('#'): header[0] = header[0].lstrip('#')
    
    try:
        idx_yy = header.index("YY")
        idx_mm = header.index("MM")
        idx_dd = header.index("DD")
        idx_hh = header.index("hh")
        idx_mn = header.index("mm")
        idx_wvht = header.index("WVHT")
        idx_swh = header.index("SwH")
        idx_swp = header.index("SwP")
        idx_swd = header.index("SwD")
        idx_wwh = header.index("WWH")
        idx_wwp = header.index("WWP")
        idx_wwd = header.index("WWD")
    except ValueError as e:
        print(f"Error finding buoy columns in spec header: {e}", file=sys.stderr)
        return []
        
    parsed = []
    for line in lines[2:]:
        parts = line.strip().split()
        if len(parts) < len(header) - 2:
            continue
        if parts[idx_wvht] == 'MM':
            continue
            
        try:
            obs_time_utc = datetime(
                int(parts[idx_yy]), int(parts[idx_mm]), int(parts[idx_dd]),
                int(parts[idx_hh]), int(parts[idx_mn]), tzinfo=timezone.utc
            ).replace(tzinfo=None).isoformat()
            
            wvht_m = float(parts[idx_wvht])
            
            # Swell
            swh = float(parts[idx_swh]) if parts[idx_swh] != 'MM' else None
            swp = float(parts[idx_swp]) if parts[idx_swp] != 'MM' else None
            swd = ordinal_to_deg(parts[idx_swd]) if parts[idx_swd] != 'MM' else None
            
            # Wind wave
            wwh = float(parts[idx_wwh]) if parts[idx_wwh] != 'MM' else None
            wwp = float(parts[idx_wwp]) if parts[idx_wwp] != 'MM' else None
            wwd = ordinal_to_deg(parts[idx_wwd]) if parts[idx_wwd] != 'MM' else None
            
            # Fallback for primary physics
            dpd_s = swp if swp else wwp
            mwd_deg = swd if swd is not None else wwd
            
            parsed.append({
                "obs_time_utc": obs_time_utc,
                "wvht_m": wvht_m,
                "dpd_s": dpd_s,
                "mwd_deg": mwd_deg,
                "primary_swell": {"height_m": swh, "period_s": swp, "direction_deg": swd},
                "wind_wave": {"height_m": wwh, "period_s": wwp, "direction_deg": wwd}
            })
        except Exception:
            continue
    return parsed

def parse_buoy_txt(txt):
    if not txt:
        return []
    lines = txt.splitlines()
    if len(lines) < 3:
        return []
    
    header = lines[0].strip().split()
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
    for line in lines[2:]:
        parts = line.strip().split()
        if len(parts) < len(header):
            continue
        
        if parts[idx_wvht] == 'MM':
            continue
            
        try:
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
        except Exception:
            continue
    return parsed

def get_tide_data_for_station(station_id):
    now = datetime.now()
    begin_str = now.strftime("%Y%m%d")
    end_str = (now + timedelta(days=1)).strftime("%Y%m%d")
    
    obs_url = f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station={station_id}&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&application=kauai-south-shore-swell&format=xml"
    pred_url = f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date={begin_str}&end_date={end_str}&station={station_id}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&application=kauai-south-shore-swell&format=xml"
    
    pred_xml = fetch_url(pred_url)
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
            latest_obs = observations[-1]
            matching_preds = [p for p in predictions if p["time"] == latest_obs["time"]]
            if matching_preds:
                tide_surge_ft = round(latest_obs["value_ft"] - matching_preds[0]["value_ft"], 2)
                
    return {
        "predictions": predictions,
        "observations": observations,
        "tide_surge_ft": tide_surge_ft
    }

def get_nws_forecast_zone(zone_id):
    url = "https://tgftp.nws.noaa.gov/data/raw/fz/fzhw50.phfo.cwf.hfo.txt"
    content = fetch_url_cached(url, "nws_forecast_cache.txt", 1800)
    if content:
        match = re.search(rf'({zone_id}-.*?\$\$)', content, re.DOTALL)
        if match:
            raw_text = match.group(1).strip()
            raw_text = raw_text.replace('$$', '').strip()
            return raw_text
    return f"NWS Forecast zone {zone_id} unavailable."

def parse_iso_duration(dur_str):
    hours = 0
    days_match = re.search(r"P(\d+)D", dur_str)
    if days_match:
        hours += int(days_match.group(1)) * 24
    hours_match = re.search(r"PT(\d+)H", dur_str)
    if hours_match:
        hours += int(hours_match.group(1))
    mins_match = re.search(r"PT(\d+)M", dur_str)
    if mins_match:
        hours += int(mins_match.group(1)) / 60.0
    return timedelta(hours=hours)

def get_nws_grid_wind(grid_x, grid_y, label="Coast Grid", cache_file=None):
    if cache_file is None:
        cache_file = f"nws_grid_{grid_x}_{grid_y}.json"
    url = f"https://api.weather.gov/gridpoints/HFO/{grid_x},{grid_y}"
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
        for item in wind_speed_values:
            parts = item['validTime'].split('/')
            start_dt = datetime.fromisoformat(parts[0].replace('Z', '+00:00'))
            dur = parse_iso_duration(parts[1]) if len(parts) > 1 else timedelta(hours=1)
            end_dt = start_dt + dur
            if start_dt <= now < end_dt:
                speed_val = item['value']
                break
        if speed_val is None and wind_speed_values:
            speed_val = wind_speed_values[0]['value']
                
        dir_val = None
        for item in wind_dir_values:
            parts = item['validTime'].split('/')
            start_dt = datetime.fromisoformat(parts[0].replace('Z', '+00:00'))
            dur = parse_iso_duration(parts[1]) if len(parts) > 1 else timedelta(hours=1)
            end_dt = start_dt + dur
            if start_dt <= now < end_dt:
                dir_val = item['value']
                break
        if dir_val is None and wind_dir_values:
            dir_val = wind_dir_values[0]['value']
                
        if speed_val is not None and dir_val is not None:
            speed_mph = round(speed_val * 0.621371, 1)
            speed_knots = round(speed_val * 0.539957, 1)
            direction_deg = round(dir_val, 1)
            
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from average_wind import deg_to_compass
            direction_compass = deg_to_compass(direction_deg)
            
            return {
                "speed_mph": speed_mph,
                "speed_knots": speed_knots,
                "direction_deg": direction_deg,
                "direction_compass": direction_compass,
                "source": f"NWS gridded forecast (HFO/{grid_x},{grid_y})"
            }
    except Exception as e:
        print(f"Error parsing NWS gridded forecast for {label}: {e}", file=sys.stderr)
    return None

def get_open_meteo_wind(lat, lon, label="Coast Open-Meteo", cache_file=None):
    if cache_file is None:
        cache_file = f"open_meteo_{lat}_{lon}.json"
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn"
    content = fetch_url_cached(url, cache_file, 900)
    if not content:
        return None
    try:
        data = json.loads(content)
        current = data.get("current", {})
        speed_knots = current.get("wind_speed_10m")
        dir_deg = current.get("wind_direction_10m")
        if speed_knots is not None and dir_deg is not None:
            speed_mph = round(speed_knots * 1.15078, 1)
            direction_deg = round(dir_deg, 1)
            
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from average_wind import deg_to_compass
            direction_compass = deg_to_compass(direction_deg)
            
            return {
                "speed_mph": speed_mph,
                "speed_knots": speed_knots,
                "direction_deg": direction_deg,
                "direction_compass": direction_compass,
                "source": f"Open-Meteo Marine (1km) - {label}"
            }
    except Exception as e:
        print(f"Error parsing Open-Meteo for {label}: {e}", file=sys.stderr)
    return None

def get_metar_wind(icao):
    url = f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json"
    content = fetch_url(url)
    if not content:
        return None
    try:
        data = json.loads(content)
        if not data:
            return None
        obs = data[0]
        wspd_kt = obs.get('wspd')
        wdir_deg = obs.get('wdir')
        wgst_kt = obs.get('wgst')
        if wspd_kt is None or wdir_deg is None:
            return None
        
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from average_wind import deg_to_compass
        
        speed_mph = round(wspd_kt * 1.15078, 1)
        gust_mph = round(wgst_kt * 1.15078, 1) if wgst_kt else None
        compass = deg_to_compass(wdir_deg) if wdir_deg else "VAR"
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
            "source": f"METAR ASOS {icao}"
        }
    except Exception:
        return None

def check_cdip_health():
    url = "https://erddap.cdip.ucsd.edu/erddap/outOfDateDatasets.html"
    content = fetch_url(url)
    if not content:
        return "Unknown"
    
    if "wave_agg" in content:
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
            except Exception:
                return "Laggard (wave_agg is out of date)"
        return "Laggard"
    return "Healthy"

def compute_vector_average_wind(readings):
    if not readings:
        return None
    import math
    sum_u = 0.0
    sum_v = 0.0
    sum_speed = 0.0
    parsed = []
    
    for r in readings:
        if r is None:
            continue
        speed = float(r["speed_mph"])
        deg = float(r["direction_deg"])
        rad = math.radians(deg)
        u = -speed * math.sin(rad)
        v = -speed * math.cos(rad)
        sum_u += u
        sum_v += v
        sum_speed += speed
        parsed.append(r)
        
    n = len(parsed)
    if n == 0:
        return None
    avg_speed = sum_speed / n
    mean_u = sum_u / n
    mean_v = sum_v / n
    vector_avg_speed = math.hypot(mean_u, mean_v)
    avg_dir_rad = math.atan2(-mean_u, -mean_v)
    avg_dir_deg = math.degrees(avg_dir_rad) % 360
    
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from average_wind import deg_to_compass
    direction_reliable = vector_avg_speed > 0.5
    
    return {
        "average_speed_mph": round(avg_speed, 1),
        "vector_average_speed_mph": round(vector_avg_speed, 1),
        "average_direction_deg": round(avg_dir_deg, 1) if direction_reliable else None,
        "average_direction_compass": deg_to_compass(avg_dir_deg) if direction_reliable else None,
        "direction_reliable": direction_reliable,
        "stations": parsed,
        "num_stations": n
    }

def main():
    print("=== Starting Hawaii-Wide Wind/Water Data Aggregator ===")
    
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(workspace_dir, "data.json")
    
    previous_data = {}
    try:
        if os.path.exists(output_path):
            with open(output_path) as f:
                previous_data = json.load(f)
    except Exception:
        pass
        
    cdip_status = check_cdip_health()
    print(f"CDIP Status: {cdip_status}")
    
    # Pre-gather all wave buoys we need to fetch
    needed_buoys = set()
    for island, iconfig in ISLANDS_CONFIG.items():
        for shore, sconfig in iconfig["shores"].items():
            needed_buoys.add(sconfig["primary_buoy"])
            if sconfig.get("verify_buoy"):
                needed_buoys.add(sconfig["verify_buoy"])
                
    buoy_data_cache = {}
    for bid in sorted(needed_buoys):
        print(f"Fetching Buoy {bid}...")
        
        # Try .spec file first for dual-swell resolution
        url_spec = f"https://www.ndbc.noaa.gov/data/realtime2/{bid}.spec"
        spec_txt = fetch_url(url_spec)
        series = parse_buoy_spec(spec_txt)
        
        if series:
            buoy_data_cache[bid] = series
            print(f"  Parsed {len(series)} readings from .spec.")
        else:
            # Fallback to standard .txt
            print(f"  .spec failed or unavailable for {bid}, falling back to .txt")
            url_txt = f"https://www.ndbc.noaa.gov/data/realtime2/{bid}.txt"
            txt = fetch_url(url_txt)
            series = parse_buoy_txt(txt)
            if series:
                buoy_data_cache[bid] = series
                print(f"  Parsed {len(series)} readings from .txt.")
            else:
                # Fallback to previous data buoy readings if available
                prev_key = f"swell_{bid}"
                if previous_data.get(prev_key):
                    p_swell = previous_data[prev_key]
                    buoy_data_cache[bid] = [{
                        "obs_time_utc": p_swell.get("obs_time_utc"),
                        "wvht_m": p_swell.get("wvht_m") or (p_swell.get("wvht_ft", 0)/3.28084),
                        "dpd_s": p_swell.get("dpd_s"),
                        "mwd_deg": p_swell.get("mwd_deg")
                    }]
                    print(f"  Failed fetch for buoy {bid} -- recovered from previous run.")
                else:
                    print(f"  WARNING: Buoy {bid} series empty.")

    # Pre-gather all reference tide stations
    needed_tides = set()
    for island, iconfig in ISLANDS_CONFIG.items():
        for shore, sconfig in iconfig["shores"].items():
            for tstation in sconfig["tide_stations"]:
                if tstation in TIDE_OFFSETS:
                    needed_tides.add(TIDE_OFFSETS[tstation][0])
                else:
                    needed_tides.add(tstation)
                    
    tide_data_cache = {}
    for tid in sorted(needed_tides):
        print(f"Fetching Tide Station {tid}...")
        tide_data_cache[tid] = get_tide_data_for_station(tid)
        
    # Programmatically populate subordinate tide predictions
    for sub_id, (ref_id, shift_min, mult) in TIDE_OFFSETS.items():
        print(f"Generating subordinate predictions for {sub_id} from {ref_id} (shift={shift_min}m, scale={mult})...")
        sub_preds = []
        ref_data = tide_data_cache.get(ref_id)
        if ref_data and ref_data["predictions"]:
            for p in ref_data["predictions"]:
                try:
                    t_dt = datetime.strptime(p["time"], "%Y-%m-%d %H:%M")
                    sub_dt = t_dt + timedelta(minutes=shift_min)
                    sub_val = round(p["value_ft"] * mult, 3)
                    sub_preds.append({
                        "time": sub_dt.strftime("%Y-%m-%d %H:%M"),
                        "value_ft": sub_val
                    })
                except Exception:
                    pass
        tide_data_cache[sub_id] = {
            "predictions": sub_preds,
            "observations": [],
            "tide_surge_ft": None
        }

    # Fetch NWS zones
    zone_cache = {}
    needed_zones = set()
    for island, iconfig in ISLANDS_CONFIG.items():
        for z in iconfig["forecast_zones"]:
            needed_zones.add(z)
    for z in sorted(needed_zones):
        zone_cache[z] = get_nws_forecast_zone(z)

    # Compile the nested payload
    islands_data = {}
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Import analyze_swell in-process
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from analyze_swell import estimate_current_south_shore, strip_internal, parse_series
    
    for island, iconfig in ISLANDS_CONFIG.items():
        island_zones = [zone_cache.get(z, "") for z in iconfig["forecast_zones"]]
        islands_data[island] = {
            "forecast_text": "\n\n".join([z for z in island_zones if z]),
            "shores": {}
        }
        
        for shore, sconfig in iconfig["shores"].items():
            primary_id = sconfig["primary_buoy"]
            verify_id = sconfig.get("verify_buoy")
            
            raw_primary = buoy_data_cache.get(primary_id, [])
            raw_verify = buoy_data_cache.get(verify_id, []) if verify_id else []
            
            primary_series = parse_series(raw_primary)
            verify_series = parse_series(raw_verify) if raw_verify else []
            
            # Swell calculation
            swell_results = None
            if primary_series:
                first_tide = sconfig["tide_stations"][0]
                tide_surge = tide_data_cache.get(first_tide, {}).get("tide_surge_ft", 0.0) or 0.0
                
                try:
                    current_est, latest_row = estimate_current_south_shore(
                        primary_series, now_utc,
                        buoy_coords=sconfig["buoy_coords"],
                        coast_coords=sconfig["coast_coords"]
                    )
                    latest_row_out = strip_internal(latest_row)
                    
                    verification_estimate = None
                    if verify_series:
                        verification_estimate, _ = estimate_current_south_shore(
                            verify_series, now_utc,
                            buoy_coords=sconfig["buoy_coords"],
                            coast_coords=sconfig["coast_coords"]
                        )
                        
                    agreement = None
                    if (verification_estimate and current_est and 
                        current_est.get("mwd_deg") is not None and 
                        verification_estimate.get("mwd_deg") is not None):
                        diff = abs(current_est["mwd_deg"] - verification_estimate["mwd_deg"])
                        diff = min(diff, 360 - diff)
                        h_diff = abs(current_est.get("wvht_ft", 0) - verification_estimate.get("wvht_ft", 0))
                        agreement = {
                            "direction_diff_deg": round(diff, 0),
                            "height_diff_ft": round(h_diff, 1),
                            "confirmed": diff <= 25 and h_diff <= 1.0,
                        }
                        
                    trend = None
                    if latest_row_out and current_est:
                        delta = latest_row_out.get("wvht_ft", 0) - current_est.get("wvht_ft", 0)
                        if delta >= 0.5:
                            trend = "building"
                        elif delta <= -0.5:
                            trend = "dropping"
                        else:
                            trend = "holding steady"
                            
                    swell_results = {
                        "current_south_shore_estimate": current_est,
                        "verification_estimate": verification_estimate,
                        "agreement": agreement,
                        "latest_barbers_point_reading": latest_row_out,
                        "trend_next_several_hours": trend
                    }
                    if tide_surge is not None:
                        swell_results["tide_surge"] = {"residual_ft": tide_surge, "note": "Computed"}
                except Exception as e:
                    print(f"Error computing swell for {island} {shore}: {e}", file=sys.stderr)
            
            # Wind calculation (PWS or Grid fallback)
            wind_results = None
            if sconfig.get("pws_stations"):
                readings = []
                for p_id in sconfig["pws_stations"]:
                    p_obs = get_pws_wind_data(p_id)
                    if p_obs:
                        readings.append(p_obs)
                if readings:
                    wind_results = compute_vector_average_wind(readings)
                    
            # Model winds (Reverted back to NWS Gridded forecast for high-res NAM-HI/WRF accuracy)
            if "model_wind_grid" in sconfig:
                gx, gy = sconfig["model_wind_grid"]
                model_wind = get_nws_grid_wind(gx, gy, f"{island} {shore} Main")
            else:
                model_wind = None
            
            # Fetch extra winds
            extra_winds = {}
            if sconfig.get("extra_grids"):
                for e_name, e_coords in sconfig["extra_grids"].items():
                    gx, gy = e_coords
                    ew_data = get_nws_grid_wind(gx, gy, f"{island} {shore} {e_name}")
                    if ew_data:
                        extra_winds[e_name] = ew_data
            
            # Metar wind
            metar_wind = None
            if sconfig.get("metar_station"):
                metar_wind = get_metar_wind(sconfig["metar_station"])
                
            # Shores tide structures
            shore_tides = {}
            for tstation in sconfig["tide_stations"]:
                t_dat = tide_data_cache.get(tstation, {"predictions": [], "observations": [], "tide_surge_ft": None})
                shore_tides[tstation] = {
                    "predictions": t_dat["predictions"],
                    "observations": t_dat["observations"][-24:] if t_dat["observations"] else [],
                    "surge_ft": t_dat["tide_surge_ft"]
                }
                
            islands_data[island]["shores"][shore] = {
                "wind": wind_results,
                "model_wind": model_wind,
                "extra_winds": extra_winds,
                "metar_wind": metar_wind,
                "swell": swell_results,
                "tides": shore_tides
            }

    # Generate backwards-compatible legacy root-level keys from Kauai South / Na Pali branches
    legacy_wind = islands_data["kauai"]["shores"]["south"]["wind"]
    legacy_model_wind = islands_data["kauai"]["shores"]["south"]["model_wind"]
    legacy_swell = islands_data["kauai"]["shores"]["south"]["swell"]
    legacy_tides = islands_data["kauai"]["shores"]["south"]["tides"]["1611347"]
    
    primary_51208 = buoy_data_cache.get("51208", [])
    swell_51208 = None
    if primary_51208:
        latest = primary_51208[-1]  # [-1] = most recent; [0] was oldest (parse_buoy_txt sorts chrono)
        from average_wind import deg_to_compass
        swell_51208 = {
            "obs_time_utc": latest["obs_time_utc"],
            "wvht_m": latest["wvht_m"],
            "wvht_ft": round(latest["wvht_m"] * 3.28084, 1),
            "dpd_s": latest["dpd_s"],
            "mwd_deg": latest["mwd_deg"],
            "mwd_compass": deg_to_compass(latest["mwd_deg"]) if latest["mwd_deg"] is not None else "N/A"
        }

    report_data = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "cdip_health": cdip_status,
        "islands": islands_data,
        
        # Backward compatibility layer
        "wind": legacy_wind,
        "model_wind": legacy_model_wind,
        "extra_winds": islands_data["kauai"]["shores"]["south"]["extra_winds"],
        "swell": legacy_swell,
        "tides": legacy_tides,
        "forecast_text": zone_cache.get("PHZ112", ""),
        
        "wind_khiwaime179": islands_data["kauai"]["shores"]["south"]["wind"].get("stations", [None])[0] if legacy_wind else None,
        # wind_khikalah11 removed — was always None, not referenced in app.js or index.html
        "swell_51208": swell_51208,
        "tides_1611347": islands_data["kauai"]["shores"]["south"]["tides"]["1611347"],
        "tides_1611400": islands_data["kauai"]["shores"]["south"]["tides"].get("1611400"),
        "tides_1611401": islands_data["kauai"]["shores"]["napali"]["tides"].get("1611401"),
        "forecast_text_110": zone_cache.get("PHZ110", ""),
        "forecast_text_111": zone_cache.get("PHZ111", ""),
        
        "model_wind_port_allen": islands_data["kauai"]["shores"]["napali"]["extra_winds"].get("port_allen"),
        "model_wind_kikiaola": islands_data["kauai"]["shores"]["napali"]["extra_winds"].get("kikiaola"),
        "metar_phbk": islands_data["kauai"]["shores"]["napali"]["metar_wind"],
        
        "model_wind_napali_exposed": islands_data["kauai"]["shores"]["napali"]["model_wind"],
        "model_wind_napali_mid": islands_data["kauai"]["shores"]["napali"]["extra_winds"].get("mid"),
        "model_wind_napali_north": islands_data["kauai"]["shores"]["napali"]["extra_winds"].get("north")
    }

    try:
        with open(output_path, "w") as f:
            json.dump(report_data, f, indent=2)
        print(f"\nSuccessfully wrote Hawaii-wide marine data to {output_path}")
        
        js_path = os.path.join(os.path.dirname(output_path), "data.js")
        with open(js_path, "w") as f:
            f.write("window.OFFLINE_DATA = " + json.dumps(report_data, indent=2) + ";\n")
        print(f"Successfully wrote Hawaii-wide marine JS data to {js_path}")
    except Exception as e:
        print(f"Error writing output data.json/data.js: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
