// ─── Constants ────────────────────────────────────────────────────────────────
const BUOY_PRIMARY   = "51212"; // Barbers Point, Oahu
const BUOY_VERIFY    = "51213"; // Lanai Southwest
const TIDE_STATION   = "1611347"; // Port Allen
const NWS_ZONE       = "PHZ112"; // Kauai Leeward Waters

// Swell physics reference points (matches analyze_swell.py exactly)
const BARBERS_POINT   = [21.323,  -158.149];
const SOUTH_SHORE_MID = [21.877705, -159.485705];
const _LAT0 = (BARBERS_POINT[0] + SOUTH_SHORE_MID[0]) / 2;
const _KM_PER_DEG_LAT = 111.32;
const _KM_PER_DEG_LON = 111.32 * Math.cos(_LAT0 * Math.PI / 180);
const _D_EAST_KM  = (SOUTH_SHORE_MID[1] - BARBERS_POINT[1]) * _KM_PER_DEG_LON;
const _D_NORTH_KM = (SOUTH_SHORE_MID[0] - BARBERS_POINT[0]) * _KM_PER_DEG_LAT;
const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    fetchAll();
    initMobileTabs();
    setInterval(fetchAll, 300000); // auto-refresh every 5 minutes if page is open
});

function initMobileTabs() {
    const tabMarine = document.getElementById("tab-marine");
    const tabWind = document.getElementById("tab-wind");
    const tabDive = document.getElementById("tab-dive");
    const tabForecast = document.getElementById("tab-forecast");

    const wMarine = document.getElementById("marine-widget");
    const wWind = document.getElementById("wind-widget");
    const wDive = document.getElementById("dive-widget");
    const wForecast = document.getElementById("forecast-widget");

    const tabs = [tabMarine, tabWind, tabDive, tabForecast];
    const widgets = [wMarine, wWind, wDive, wForecast];
    const indicator = document.getElementById("tab-indicator-bar");

    function updateIndicator(activeTab) {
        if (!indicator || !activeTab) return;
        // Slide to active tab item bounds
        indicator.style.left = `${activeTab.offsetLeft}px`;
        indicator.style.width = `${activeTab.offsetWidth}px`;
    }

    tabs.forEach((tab, index) => {
        if (!tab) return;
        tab.addEventListener("click", () => {
            tabs.forEach(t => { if (t) t.classList.remove("active"); });
            tab.classList.add("active");
            updateIndicator(tab);

            widgets.forEach((w, wIndex) => {
                if (!w) return;
                if (wIndex === index) {
                    w.classList.add("mobile-show");
                    w.classList.remove("mobile-hide");
                } else {
                    w.classList.add("mobile-hide");
                    w.classList.remove("mobile-show");
                }
            });
        });
    });

    // Set initial active tab
    if (tabMarine) {
        tabMarine.click();
        // Delay slightly to ensure layout has computed offsets on load
        setTimeout(() => updateIndicator(tabMarine), 150);
    }

    // Keep indicator aligned on window resize/orientation change
    window.addEventListener("resize", () => {
        const activeTab = tabs.find(t => t && t.classList.contains("active"));
        if (activeTab) updateIndicator(activeTab);
    });

    // Touch swipe gestures to switch tabs on mobile
    const grid = document.querySelector(".dashboard-grid");
    if (grid) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        grid.addEventListener("touchstart", (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        grid.addEventListener("touchend", (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Only trigger if horizontal movement is distinct and vertical movement is minor
            // (prevents switching tabs when user is scrolling vertically)
            if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
                const activeIndex = tabs.findIndex(t => t && t.classList.contains("active"));
                if (activeIndex === -1) return;

                if (diffX < 0) {
                    // Swiped Left -> Next tab
                    const nextIndex = (activeIndex + 1) % tabs.length;
                    if (tabs[nextIndex]) tabs[nextIndex].click();
                } else {
                    // Swiped Right -> Previous tab
                    const prevIndex = (activeIndex - 1 + tabs.length) % tabs.length;
                    if (tabs[prevIndex]) tabs[prevIndex].click();
                }
            }
        }
    }
}

// ─── Swell Physics (ported from analyze_swell.py) ────────────────────────────
function degToCompass(deg) {
    if (deg == null) return null;
    return COMPASS_16[Math.round((deg % 360) / 22.5) % 16];
}

function groupVelocityKmh(period_s) {
    if (!period_s) return null;
    return 0.78 * period_s * 3.6;
}

function computeLagHours(mwd_deg, dpd_s) {
    if (mwd_deg == null || dpd_s == null) return { lag: null, confidence: "unknown" };
    const bearing = (mwd_deg + 180) % 360;
    const tx = Math.sin(bearing * Math.PI / 180);
    const ty = Math.cos(bearing * Math.PI / 180);
    const projected_km = _D_EAST_KM * tx + _D_NORTH_KM * ty;
    const v = groupVelocityKmh(dpd_s);
    if (!v) return { lag: null, confidence: "unknown" };
    const lag = projected_km / v;
    const confidence = dpd_s >= 14 ? "high" : dpd_s >= 12 ? "medium" : "low";
    return { lag: Math.round(lag * 100) / 100, confidence };
}

function parseBuoySeries(rawTxt) {
    if (!rawTxt) return [];
    const allLines = rawTxt.split("\n");

    // Dynamically find WVHT/DPD/MWD column indices from the NDBC header row.
    // Guards against NDBC adding/removing columns in future format updates.
    const headerLine = allLines.find(l => l.startsWith('#') && l.includes('WVHT') && l.includes('MWD'));
    let idxWvht = 8, idxDpd = 9, idxMwd = 11; // safe defaults matching current NDBC layout
    if (headerLine) {
        const hCols = headerLine.replace(/^#+/, '').trim().split(/\s+/);
        const h = name => hCols.indexOf(name);
        if (h('WVHT') !== -1) idxWvht = h('WVHT');
        if (h('DPD')  !== -1) idxDpd  = h('DPD');
        if (h('MWD')  !== -1) idxMwd  = h('MWD');
    }

    const dataLines = allLines.filter(l => l && !l.startsWith('#'));
    const series = [];
    for (const line of dataLines) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 9) continue;
        const [yr, mo, dy, hr, mn] = cols.slice(0, 5).map(Number);
        if (isNaN(yr)) continue;
        const obs_time_utc = new Date(Date.UTC(yr, mo - 1, dy, hr, mn)).toISOString();
        const wvht_m = parseFloat(cols[idxWvht]);
        const dpd_s  = parseFloat(cols[idxDpd]);
        const mwd_deg = parseFloat(cols[idxMwd]);
        if (isNaN(wvht_m) || wvht_m >= 99) continue;
        series.push({
            obs_time_utc,
            _dt: new Date(Date.UTC(yr, mo - 1, dy, hr, mn)),
            wvht_m,
            wvht_ft: Math.round(wvht_m * 3.28084 * 10) / 10,
            dpd_s: isNaN(dpd_s) || dpd_s >= 99 ? null : dpd_s,
            mwd_deg: isNaN(mwd_deg) || mwd_deg >= 999 ? null : mwd_deg,
            mwd_compass: degToCompass(isNaN(mwd_deg) || mwd_deg >= 999 ? null : mwd_deg)
        });
    }
    return series.sort((a, b) => a._dt - b._dt);
}

function closestRow(series, targetDt) {
    if (!series.length) return null;
    return series.reduce((best, row) =>
        Math.abs(row._dt - targetDt) < Math.abs(best._dt - targetDt) ? row : best
    );
}

function estimateCurrentSouthShore(series) {
    if (!series.length) return null;
    const nowDt = new Date();
    const latest = series[series.length - 1];

    // First pass: use most recent row's lag as initial guess
    let { lag: guessLag } = computeLagHours(latest.mwd_deg, latest.dpd_s);
    if (guessLag == null) guessLag = 1.5;
    const target1 = new Date(nowDt - guessLag * 3600000);
    const candidate = closestRow(series, target1);

    // Second pass: refine with candidate's own direction/period
    let { lag, confidence } = computeLagHours(candidate.mwd_deg, candidate.dpd_s);
    if (lag == null) { lag = guessLag; confidence = "unknown"; }
    const target2 = new Date(nowDt - lag * 3600000);
    const refined = closestRow(series, target2);

    const final = computeLagHours(refined.mwd_deg, refined.dpd_s);

    return {
        wvht_ft:       refined.wvht_ft,
        wvht_m:        refined.wvht_m,
        dpd_s:         refined.dpd_s,
        mwd_deg:       refined.mwd_deg,
        mwd_compass:   refined.mwd_compass,
        lag_hours:     final.lag,
        lag_confidence: final.confidence,
        source_obs_time_utc: refined.obs_time_utc
    };
}

function analyzeSwell(primaryTxt, verifyTxt) {
    const primary = parseBuoySeries(primaryTxt);
    const verify  = parseBuoySeries(verifyTxt);
    if (!primary.length) return null;

    const currentEst = estimateCurrentSouthShore(primary);
    const verifyEst  = verify.length ? estimateCurrentSouthShore(verify) : null;
    const latest     = primary[primary.length - 1];

    let agreement = null;
    if (verifyEst && currentEst?.mwd_deg != null && verifyEst?.mwd_deg != null) {
        const diff = Math.min(
            Math.abs(currentEst.mwd_deg - verifyEst.mwd_deg),
            360 - Math.abs(currentEst.mwd_deg - verifyEst.mwd_deg)
        );
        const hDiff = Math.abs((currentEst.wvht_ft || 0) - (verifyEst.wvht_ft || 0));
        agreement = { direction_diff_deg: diff, height_diff_ft: hDiff, confirmed: diff <= 25 && hDiff <= 1.0 };
    }

    let trend = "holding steady";
    if (currentEst) {
        const delta = (latest.wvht_ft || 0) - (currentEst.wvht_ft || 0);
        if (delta >= 0.5) trend = "building";
        else if (delta <= -0.5) trend = "dropping";
    }

    return {
        current_south_shore_estimate: currentEst,
        verification_estimate: verifyEst,
        agreement,
        latest_barbers_point_reading: latest,
        trend_next_several_hours: trend
    };
}

// ─── Live API Fetchers ────────────────────────────────────────────────────────
async function fetchBuoyLive() {
    try {
        const [r1, r2] = await Promise.all([
            fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.ndbc.noaa.gov/data/realtime2/${BUOY_PRIMARY}.txt`)}`),
            fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.ndbc.noaa.gov/data/realtime2/${BUOY_VERIFY}.txt`)}`)
        ]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        return analyzeSwell(j1.contents, j2.contents);
    } catch (e) {
        console.warn("Buoy fetch failed:", e);
        return null;
    }
}

async function fetchTideLive() {
    const base = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
    const common = `&station=${TIDE_STATION}&datum=MLLW&time_zone=lst_ldt&units=english&application=kauai-south-shore&format=json`;
    
    // Construct today and tomorrow date strings (YYYYMMDD) in local time
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    };

    const begin = formatDate(today);
    const end = formatDate(tomorrow);

    try {
        const [predRes, obsRes] = await Promise.all([
            fetch(`${base}?begin_date=${begin}&end_date=${end}&product=predictions${common}`),
            fetch(`${base}?date=today&product=water_level${common}`)
        ]);
        const [predJson, obsJson] = await Promise.all([predRes.json(), obsRes.json()]);

        const predictions = (predJson.predictions || []).map(p => ({
            time: p.t, value_ft: parseFloat(p.v)
        }));
        const observations = (obsJson.data || []).map(o => ({
            time: o.t, value_ft: parseFloat(o.v)
        }));

        let surge_ft = null;
        if (observations.length && predictions.length) {
            const latestObs = observations[observations.length - 1];
            const match = predictions.find(p => p.time === latestObs.time);
            if (match) surge_ft = Math.round((latestObs.value_ft - match.value_ft) * 100) / 100;
        }

        return { predictions, observations, surge_ft };
    } catch (e) {
        console.warn("Tide fetch failed:", e);
        return null;
    }
}

async function fetchNWSLive() {
    try {
        // api.weather.gov is CORS-enabled — fetch zone forecast directly
        const res = await fetch(`https://api.weather.gov/zones/forecast/${NWS_ZONE}/forecast`, {
            headers: { "Accept": "application/geo+json" }
        });
        const json = await res.json();
        const periods = json.properties?.periods || [];
        // Combine all periods into a single readable block matching the old format
        const text = periods.map(p => `.${p.name.toUpperCase()}...\n${p.detailedForecast}`).join("\n\n");
        return text || null;
    } catch (e) {
        console.warn("NWS forecast fetch failed:", e);
        return null;
    }
}

async function fetchModelWindLive() {
    try {
        const res = await fetch("https://api.weather.gov/gridpoints/HFO/88,169", {
            headers: { "Accept": "application/geo+json" }
        });
        const data = await res.json();
        const props = data.properties;
        const windSpeedValues = props?.windSpeed?.values || [];
        const windDirValues = props?.windDirection?.values || [];
        
        const now = new Date();
        
        let speedVal = null;
        for (const item of [...windSpeedValues].sort((a, b) => a.validTime.localeCompare(b.validTime))) {
            const startStr = item.validTime.split('/')[0];
            const startDt = new Date(startStr);
            if (startDt <= now) {
                speedVal = item.value;
            } else {
                break;
            }
        }
        
        let dirVal = null;
        for (const item of [...windDirValues].sort((a, b) => a.validTime.localeCompare(b.validTime))) {
            const startStr = item.validTime.split('/')[0];
            const startDt = new Date(startStr);
            if (startDt <= now) {
                dirVal = item.value;
            } else {
                break;
            }
        }
        
        if (speedVal !== null && dirVal !== null) {
            const speed_mph = Math.round(speedVal * 0.621371 * 10) / 10;
            const speed_knots = Math.round(speedVal * 0.539957 * 10) / 10;
            const direction_deg = Math.round(dirVal * 10) / 10;
            const direction_compass = degToCompass(direction_deg);
            
            return {
                speed_mph,
                speed_knots,
                direction_deg,
                direction_compass,
                source: "NWS gridded forecast (Honolulu WFO)"
            };
        }
    } catch (e) {
        console.warn("Exposed wind fetch failed:", e);
    }
    return null;
}

// ─── Main Fetch Orchestrator ──────────────────────────────────────────────────
async function fetchAll() {
    try {
        document.getElementById("last-updated").textContent = "Updating…";

        // Fetch wind from data.json (Weather Underground blocks browser CORS)
        // and live data from NOAA/NWS simultaneously
        const [cachedData, swellLive, tideLive, forecastLive, modelWindLive] = await Promise.all([
            fetch("data.json?_t=" + Date.now()).then(r => r.json()).catch(() => ({})),
            fetchBuoyLive(),
            fetchTideLive(),
            fetchNWSLive(),
            fetchModelWindLive()
        ]);

        // Merge: live data overrides cached wherever available
        const data = {
            ...cachedData,
            swell:         swellLive  || cachedData.swell  || null,
            tides:         tideLive   || cachedData.tides  || null,
            forecast_text: forecastLive || cachedData.forecast_text || null,
            model_wind:    modelWindLive || cachedData.model_wind || null,
            last_updated:  new Date().toISOString()
        };

        updateDashboard(data);
    } catch (e) {
        console.error("Critical error in fetchAll:", e);
        document.getElementById("last-updated").textContent = "Error loading data";
        document.getElementById("last-updated").style.color = "var(--accent-sunset)";
    }
}


function formatHST(isoString) {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    // Format to HST (Pacific/Honolulu)
    return date.toLocaleTimeString("en-US", {
        timeZone: "Pacific/Honolulu",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }) + " HST";
}

// ─── Hawaii Time Helpers ──────────────────────────────────────────────────────
// NOAA tide predictions are always in Hawaii Standard Time (UTC-10, no DST).
// Appending -10:00 ensures correct epoch parsing regardless of browser timezone.
function parsePredictionTime(timeStr) {
    return new Date(timeStr.replace(' ', 'T') + '-10:00');
}
function getHSTDateStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
}
function getHSTMinutes() {
    const t = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Pacific/Honolulu', hour12: false,
        hour: '2-digit', minute: '2-digit'
    });
    const parts = t.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// ─── Wind Shadow Decay (single source of truth) ───────────────────────────────
// Estimates Koloa Landing cove wind from offshore NWS model wind.
// Direction-dependent decay accounts for Makahuena Point's lee shadow.
function estimateCoveWindFromModel(modelWind) {
    if (!modelWind || modelWind.speed_mph === undefined) return null;
    const mwDir = modelWind.direction_deg !== undefined ? modelWind.direction_deg : 90;
    let decayCoeff = 0.6;
    if (mwDir >= 45 && mwDir <= 110)       decayCoeff = 0.3; // ENE trades — strong shadow
    else if (mwDir >= 135 && mwDir <= 225) decayCoeff = 0.9; // South — direct onshore
    return modelWind.speed_mph * decayCoeff;
}

// ─── 3-State Tidal Model ──────────────────────────────────────────────────────
// Returns { isFlooding, isEbbing, isSlack, available }.
// Slack is detected via rate-of-change of water level: tidal current ∝ dh/dt,
// so near-zero slope at high/low tide = near-zero current = slack water.
// This prevents false standing-wave alerts at the top and bottom of each cycle.
function computeTideState(preds) {
    if (!preds || preds.length === 0) {
        return { isFlooding: false, isEbbing: false, isSlack: false, available: false };
    }
    const nowEpoch = Date.now();
    let closestIdx = 0, minDiff = Infinity;
    for (let i = 0; i < preds.length; i++) {
        const diff = Math.abs(parsePredictionTime(preds[i].time).getTime() - nowEpoch);
        if (diff < minDiff) { minDiff = diff; closestIdx = i; }
    }
    // Rate of change over ±30 min (5 × 6-min NOAA intervals each side)
    const ahead  = Math.min(closestIdx + 5, preds.length - 1);
    const behind = Math.max(closestIdx - 5, 0);
    const rateOfChange = Math.abs(preds[ahead].value_ft - preds[behind].value_ft);
    const isSlack = rateOfChange < 0.15; // < ~0.3 ft/hr ≈ slack water
    const isEbbing = (closestIdx < preds.length - 1)
        ? preds[closestIdx + 1].value_ft < preds[closestIdx].value_ft
        : false;
    return { isFlooding: !isEbbing, isEbbing, isSlack, available: true };
}

function updateDashboard(data) {
    // 1. Last Updated and Small Craft Advisory (SCA)
    const lastUpdatedDt = data.last_updated;
    document.getElementById("last-updated").textContent = formatHST(lastUpdatedDt);
    
    const scaBadge = document.getElementById("sca-badge");
    const forecastText = data.forecast_text ? data.forecast_text.toUpperCase() : "";
    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windSpeedKnots = data.model_wind ? data.model_wind.speed_knots : null; // used for NWS SCA threshold (21 KT)

    let scaActive = forecastText.includes("SMALL CRAFT ADVISORY");
    if (windSpeedKnots !== null && windSpeedKnots >= 21) scaActive = true; // NWS SCA threshold: 21 KT
    if (swellHeight !== null && swellHeight >= 10.0) scaActive = true;

    if (scaActive) {
        scaBadge.innerHTML = `<span class="pulse-indicator warning"></span> ACTIVE`;
        scaBadge.style.color = "var(--accent-sunset)";
        scaBadge.title = "NWS Small Craft Advisory active or high wind/seas detected.";
    } else {
        scaBadge.innerHTML = `<span class="pulse-indicator"></span> NONE`;
        scaBadge.style.color = "var(--text-secondary)";
        scaBadge.title = "No active Small Craft Advisories.";
    }

    // 2. Swell Card
    if (data.swell && data.swell.current_south_shore_estimate) {
        const est = data.swell.current_south_shore_estimate;
        
        document.getElementById("swell-height").textContent = est.wvht_ft ? est.wvht_ft.toFixed(1) : "--.-";
        document.getElementById("swell-period").textContent = est.dpd_s ? `${Math.round(est.dpd_s)}s` : "--s";
        
        const compassDir = est.mwd_compass || "N/A";
        const degDir = est.mwd_deg !== undefined ? `${Math.round(est.mwd_deg)}°` : "---°";
        document.getElementById("swell-dir").textContent = `${degDir} ${compassDir}`;
        
        document.getElementById("swell-lag").textContent = est.lag_hours !== undefined ? `${est.lag_hours.toFixed(2)}h` : "-.--h";
        
        const confBadge = document.getElementById("swell-conf");
        const confVal = (est.lag_confidence || "low").toLowerCase();
        let profileText = "Windswell";
        if (confVal === "high") profileText = "Groundswell";
        else if (confVal === "medium") profileText = "Mixed Swell";
        
        confBadge.textContent = profileText;
        confBadge.className = `sub-val confidence-${confVal}`;
        
        // Swell direction text display
        if (est.mwd_deg !== undefined && est.mwd_compass) {
            const abbrEl = document.getElementById("swell-dir-abbr");
            const degEl  = document.getElementById("swell-dir-deg");
            if (abbrEl) abbrEl.textContent = est.mwd_compass;
            if (degEl)  degEl.textContent  = `${Math.round(est.mwd_deg)}°`;
        }

        // Swell agreement
        const verifyLabel = document.getElementById("swell-verify");
        if (data.swell.agreement) {
            const agr = data.swell.agreement;
            if (agr.confirmed) {
                verifyLabel.innerHTML = `✓ Swell confirmed by Lanai buoy (Dir diff: ${agr.direction_diff_deg}°, Ht diff: ${agr.height_diff_ft} ft)`;
                verifyLabel.style.color = "var(--accent-teal)";
            } else {
                verifyLabel.innerHTML = `ℹ Local Variance: Buoy delta reflects localized wave profiles (Dir diff: ${agr.direction_diff_deg}°, Ht diff: ${agr.height_diff_ft} ft)`;
                verifyLabel.style.color = "var(--accent-gold)";
            }
        } else {
            verifyLabel.textContent = "Lanai verification buoy unreachable this run.";
            verifyLabel.style.color = "var(--text-muted)";
        }

        // Trend
        const trendBadge = document.getElementById("swell-trend");
        const trendText = data.swell.trend_next_several_hours || "";
        if (trendText.includes("building")) {
            trendBadge.textContent = "Building";
            trendBadge.className = "trend-badge building";
        } else if (trendText.includes("dropping")) {
            trendBadge.textContent = "Dropping";
            trendBadge.className = "trend-badge dropping";
        } else {
            trendBadge.textContent = "Holding";
            trendBadge.className = "trend-badge holding";
        }
        trendBadge.title = trendText;
    } else {
        document.getElementById("swell-height").textContent = "--.-";
        document.getElementById("swell-verify").textContent = "Swell buoy data unavailable.";
    }

    // 3. Wind Card (Wind Report)
    if (data.wind) {
        const w = data.wind;
        const stationsOnline = w.stations_online !== undefined ? w.stations_online : (w.stations ? w.stations.length : 0);
        
        let windSpeedCove = w.average_speed_mph;
        let windDirCove = w.average_direction_deg;
        let windCompassCove = w.average_direction_compass || "VAR";
        let isFallback = false;

        if (stationsOnline === 0 || windSpeedCove === null || windSpeedCove === 0) {
            // Apply wind shadow decay fallback if all stations are offline (single source of truth)
            const decayedSpeed = estimateCoveWindFromModel(data.model_wind);
            if (decayedSpeed !== null) {
                windSpeedCove = decayedSpeed;
                windDirCove   = data.model_wind.direction_deg;
                windCompassCove = data.model_wind.direction_compass || degToCompass(windDirCove);
                isFallback = true;
            }
        }

        // PWS (Cove) Wind Speed
        document.getElementById("wind-speed").textContent = windSpeedCove ? windSpeedCove.toFixed(1) : "--.-";
        
        // PWS (Cove) Details
        const compassDir = windCompassCove;
        const degDir = windDirCove !== undefined ? `${Math.round(windDirCove)}°` : "---°";
        document.getElementById("wind-dir").textContent = (w.direction_reliable || isFallback) ? degDir : "Variable";

        // Landing direction text display
        const windAbbrEl = document.getElementById("wind-dir-abbr");
        if (windAbbrEl) windAbbrEl.textContent = (w.direction_reliable || isFallback) ? compassDir : "VAR";
        
        let sumGusts = 0;
        let countGusts = 0;
        (w.stations || []).forEach(s => {
            if (s.gust_mph !== undefined) {
                sumGusts += s.gust_mph;
                countGusts++;
            }
        });
        const avgGusts = countGusts > 0 ? Math.round(sumGusts / countGusts) : 0;
        document.getElementById("wind-gusts").textContent = `${avgGusts} mph`;

        // PWS Wind reliability badge
        const relBadge = document.getElementById("wind-reliability");
        if (isFallback) {
            relBadge.textContent = "Estimated (Shadow Model)";
            relBadge.style.background = "rgba(244, 208, 104, 0.12)";
            relBadge.style.color = "var(--accent-gold)";
            relBadge.style.borderColor = "rgba(244, 208, 104, 0.2)";
        } else if (w.direction_reliable) {
            relBadge.textContent = "Reliable";
            relBadge.style.background = "rgba(6, 214, 160, 0.12)";
            relBadge.style.color = "var(--accent-teal)";
            relBadge.style.borderColor = "rgba(6, 214, 160, 0.2)";
        } else {
            relBadge.textContent = "Variable";
            relBadge.style.background = "rgba(244, 208, 104, 0.12)";
            relBadge.style.color = "var(--accent-gold)";
            relBadge.style.borderColor = "rgba(244, 208, 104, 0.2)";
        }
        if (w.note) relBadge.title = w.note;

        // Wind arrow removed — direction shown as text abbreviation

        // No station pills rendered — removed per UI update

    } else {
        document.getElementById("wind-speed").textContent = "--.-";
    }

    // NAM Model (Exposed) Wind
    const modelRelBadge = document.getElementById("model-wind-reliability");
    if (data.model_wind) {
        const mw = data.model_wind;

        // Model Speed in Knots (KT)
        document.getElementById("model-wind-speed").textContent = mw.speed_knots !== undefined ? mw.speed_knots.toFixed(1) : "--.-";

        // Model Speed in MPH
        document.getElementById("model-wind-mph").textContent = mw.speed_mph !== undefined ? `${mw.speed_mph.toFixed(1)} mph` : "--.- mph";

        // Model Direction — sub-stat degrees only, abbreviation inline next to speed
        const mwDeg = mw.direction_deg !== undefined ? `${Math.round(mw.direction_deg)}°` : "---°";
        document.getElementById("model-wind-dir").textContent = mwDeg;

        // Exposed Points direction text display
        const mwAbbrEl = document.getElementById("model-wind-dir-abbr");
        if (mwAbbrEl) mwAbbrEl.textContent = mw.direction_compass || "--";

        // Exposed Points reliability badge
        if (modelRelBadge) {
            modelRelBadge.textContent = "Reliable";
            modelRelBadge.style.background = "rgba(6, 214, 160, 0.12)";
            modelRelBadge.style.color = "var(--accent-teal)";
            modelRelBadge.style.borderColor = "rgba(6, 214, 160, 0.2)";
        }
    } else {
        document.getElementById("model-wind-speed").textContent = "--.-";
        document.getElementById("model-wind-mph").textContent = "--.- mph";
        document.getElementById("model-wind-dir").textContent = "---°";
        const mwAbbrEl = document.getElementById("model-wind-dir-abbr");
        if (mwAbbrEl) mwAbbrEl.textContent = "--";
        if (modelRelBadge) {
            modelRelBadge.textContent = "Unavailable";
            modelRelBadge.style.background = "rgba(255,255,255,0.05)";
            modelRelBadge.style.color = "var(--text-muted)";
            modelRelBadge.style.borderColor = "transparent";
        }
    }

    // 4. Tide Card
    if (data.tides) {
        const t = data.tides;
        const surgeBadge = document.getElementById("tide-surge-badge");
        if (t.surge_ft !== null && t.surge_ft !== undefined) {
            surgeBadge.textContent = `Surge: ${t.surge_ft > 0 ? '+' : ''}${t.surge_ft.toFixed(2)} ft`;
            if (Math.abs(t.surge_ft) >= 0.5) {
                surgeBadge.style.background = "rgba(255, 107, 107, 0.12)";
                surgeBadge.style.color = "var(--accent-sunset)";
            } else if (Math.abs(t.surge_ft) >= 0.25) {
                surgeBadge.style.background = "rgba(244, 208, 104, 0.12)";
                surgeBadge.style.color = "var(--accent-gold)";
            } else {
                surgeBadge.style.background = "rgba(6, 214, 160, 0.12)";
                surgeBadge.style.color = "var(--accent-teal)";
            }
        } else {
            // Apply Swell-driven Wave Setup offset if observed levels sensor is offline
            const est = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate : null;
            if (est && est.wvht_ft && est.dpd_s) {
                const setupSurge = Math.min(0.05 * est.wvht_ft * Math.sqrt(est.dpd_s), 1.2);
                surgeBadge.textContent = `Surge: +${setupSurge.toFixed(2)} ft (Setup Est)`;
                surgeBadge.style.background = "rgba(244, 208, 104, 0.12)";
                surgeBadge.style.color = "var(--accent-gold)";
            } else {
                surgeBadge.textContent = "Surge: Offline";
                surgeBadge.style.background = "rgba(255, 255, 255, 0.05)";
                surgeBadge.style.color = "var(--text-secondary)";
            }
        }

        // Render tide curve SVG
        if (t.predictions && t.predictions.length > 0) {
            renderTideSVG(t.predictions, t.observations);
            findAndRenderExtremes(t.predictions);
        }
    }

    // 5. NWS Forecast Text
    if (data.forecast_text) {
        const rawForecast = data.forecast_text;
        // Basic parser to format periods starting with dots (e.g. .TONIGHT... or .THURSDAY...)
        const lines = rawForecast.split('\n');
        let formattedHTML = "";
        
        lines.forEach(line => {
            let cleanLine = line.trim();
            if (cleanLine.startsWith('.')) {
                // Find index of first three dots ...
                const dotIndex = cleanLine.indexOf('...');
                if (dotIndex !== -1) {
                    const period = cleanLine.substring(1, dotIndex);
                    const rest = cleanLine.substring(dotIndex + 3);
                    formattedHTML += `<p style="margin-bottom: 0.8rem;"><strong style="color: var(--accent-cyan); font-family: var(--font-heading); text-transform: uppercase;">${period}</strong>: ${rest}</p>`;
                } else {
                    formattedHTML += `<p style="margin-bottom: 0.8rem;">${cleanLine}</p>`;
                }
            } else if (cleanLine) {
                formattedHTML += `<p style="margin-bottom: 0.6rem; color: var(--text-muted); font-size: 0.85rem;">${cleanLine}</p>`;
            }
        });
        
        document.getElementById("forecast-text").innerHTML = formattedHTML;
    } else {
        document.getElementById("forecast-text").textContent = "NWS Marine Forecast details unavailable.";
    }

    // 6. Dive Sites Card
    updateDiveSites(data);

    // 7. Kukuiula Harbor Dock & Ramp Alerts
    updateHarborAlerts(data);

    // 8. Transit Comfort Levels (West vs. East of Makahuena)
    updateTransitComfort(data);
}

function renderTideSVG(predictions, observations) {
    const svg = document.getElementById("tide-svg");
    
    // Map values to coordinates
    const heights = predictions.map(p => p.value_ft);
    const minH = Math.min(...heights) - 0.2;
    const maxH = Math.max(...heights) + 0.2;
    const rangeH = maxH - minH;
    
    const width = 240;
    const height = 80;
    
    // Generate polyline path
    let points = [];
    const count = predictions.length;
    
    predictions.forEach((p, idx) => {
        const x = 10 + (idx / (count - 1)) * 220; // x in [10, 230]
        const y = 70 - ((p.value_ft - minH) / rangeH) * 60; // y in [10, 70]
        points.push({x, y});
    });
    
    // Create tide line path string (using bezier curves or line segments)
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
    }
    
    svg.querySelector(".tide-line-path").setAttribute("d", d);
    
    // Fill area below curve
    let dArea = `${d} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    svg.querySelector(".tide-area-path").setAttribute("d", dArea);

    // Locate "Current Time" dot — use full epoch via parsePredictionTime (HST-aware)
    // so this works correctly for any browser timezone and across day boundaries.
    const nowEpoch = Date.now();
    let minDiff = Infinity;
    let closestIdx = 0;
    predictions.forEach((p, idx) => {
        const diff = Math.abs(parsePredictionTime(p.time).getTime() - nowEpoch);
        if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
    });
    
    // Position dot & current time line
    const currentPoint = points[closestIdx];
    svg.querySelector(".current-time-line").setAttribute("x1", currentPoint.x);
    svg.querySelector(".current-time-line").setAttribute("x2", currentPoint.x);
    
    const dot = svg.querySelector(".current-time-dot");
    dot.setAttribute("cx", currentPoint.x);
    dot.setAttribute("cy", currentPoint.y);
    
    // Render boat-loading windows as highlighted vertical bands
    const group = svg.querySelector(".loading-windows-group");
    if (group) {
        group.innerHTML = "";
        
        const shifts = [
            { start: 7.0, end: 8.75, label: "Morning" },
            { start: 10.5, end: 11.75, label: "Mid-Morning" },
            { start: 14.0, end: 14.5, label: "Afternoon" },
            { start: 15.0, end: 16.0, label: "Afternoon" },
            { start: 18.0, end: 18.5, label: "Evening" }
        ];
        
        shifts.forEach(shift => {
            const x1 = 10 + shift.start * (220 / 23);
            const x2 = 10 + shift.end * (220 / 23);
            const w = x2 - x1;
            
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x1);
            rect.setAttribute("y", 0);
            rect.setAttribute("width", w);
            rect.setAttribute("height", 80);
            rect.setAttribute("fill", "rgba(224, 169, 109, 0.06)");
            rect.setAttribute("stroke", "rgba(224, 169, 109, 0.15)");
            rect.setAttribute("stroke-width", "0.5");
            rect.setAttribute("stroke-dasharray", "1,1");
            
            const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = `${shift.label} Loading Window (${shift.start.toFixed(1)} - ${shift.end.toFixed(1)} hrs)`;
            rect.appendChild(title);
            
            group.appendChild(rect);
        });
    }
}

function findAndRenderExtremes(predictions) {
    // Filter to today's date in HST — predictions span 48 hours, show today's tides only
    const todayHST = getHSTDateStr();
    predictions = predictions.filter(p => p.time.split(' ')[0] === todayHST);

    // Find local maxima and minima to show high and low tides
    const extremes = [];

    for (let i = 1; i < predictions.length - 1; i++) {
        const prev = predictions[i-1].value_ft;
        const curr = predictions[i].value_ft;
        const next = predictions[i+1].value_ft;
        
        if (curr > prev && curr > next) {
            extremes.push({ type: "high", time: predictions[i].time, value: curr });
        } else if (curr < prev && curr < next) {
            extremes.push({ type: "low", time: predictions[i].time, value: curr });
        }
    }
    
    // Render extremes to div
    const container = document.getElementById("tide-extremes");
    container.innerHTML = "";
    
    // Format the times to readable AM/PM
    extremes.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extreme-stat-item";
        
        // Extract time hh:mm
        const timePart = ext.time.split(' ')[1];
        const parts = timePart.split(':');
        let h = parseInt(parts[0]);
        const m = parts[1];
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        h = h ? h : 12; // 0 becomes 12
        const formattedTime = `${h}:${m} ${ampm}`;
        
        item.innerHTML = `
            <span class="extreme-icon ${ext.type}">${ext.type === 'high' ? '▲' : '▼'}</span>
            <div class="extreme-details">
                <span class="extreme-time">${formattedTime}</span>
                <span class="extreme-height">${ext.type.toUpperCase()}: ${ext.value.toFixed(2)} ft</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function updateDiveSites(data) {
    const container = document.getElementById("dive-sites-container");
    if (!container) return;

    // Get current swell and wind stats from calculated payload
    const rawSwellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const swellPeriod = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.dpd_s : null;
    const swellDir = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.mwd_deg : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed = data.model_wind ? data.model_wind.direction_deg : null;
    
    let windSpeedCove = data.wind ? data.wind.average_speed_mph : null;
    const stationsOnline = data.wind && data.wind.stations_online !== undefined ? data.wind.stations_online : (data.wind && data.wind.stations ? data.wind.stations.length : 0);
    
    if (stationsOnline === 0 || windSpeedCove === null || windSpeedCove === 0) {
        const decayedSpeed = estimateCoveWindFromModel(data.model_wind);
        if (decayedSpeed !== null) windSpeedCove = decayedSpeed;
    }

    // Determine wind alignment relative to the South Shore (facing 180°)
    let windExposure = "cross-shore";
    if (windDirExposed !== null) {
        if (windDirExposed >= 315 || windDirExposed <= 65) {
            windExposure = "offshore";
        } else if (windDirExposed >= 135 && windDirExposed <= 225) {
            windExposure = "onshore";
        }
    }

    // Set Swell Energy thresholds based on wind grooming/sheltering
    let energyDangerLimit = 220;
    let energyCautionLimit = 110;
    if (windExposure === "offshore") {
        energyDangerLimit = 280;  // clean groomed swell allows more energy
        energyCautionLimit = 130;
    } else if (windExposure === "onshore") {
        energyDangerLimit = 180;  // messy onshore wind reduces limits
        energyCautionLimit = 90;
    }

    // Set Wind Speed thresholds for Boat sites based on wind direction
    let windDangerLimitBoat = 18;
    let windCautionLimitBoat = 12;
    if (windExposure === "offshore") {
        windDangerLimitBoat = 23; // land-sheltered transit allows more wind
        windCautionLimitBoat = 16;
    } else if (windExposure === "onshore") {
        windDangerLimitBoat = 15; // messy onshore chop requires lower limits
        windCautionLimitBoat = 10;
    }

    // Set Wind Speed thresholds for Shore sites (Koloa Landing) based on cove exposure (facing 200° SW)
    let windDangerLimitShore = 18;
    let windCautionLimitShore = 14;
    let isCoveOnshore = false;
    if (windDirExposed !== null && windDirExposed >= 120 && windDirExposed <= 240) {
        isCoveOnshore = true;
        windDangerLimitShore = 14; // onshore wind chop creates bay surge
        windCautionLimitShore = 10;
    }

    // Helper to compute and format uniform conditions
    function getFormattedConditions(type, name, rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed) {
        if (rawSwellHeight === null || swellPeriod === null || swellDir === null) {
            return { status: "caution", text: "Sensor data offline. Conditions unassessed." };
        }

        // Swell Shadowing & Refraction adjustments
        let swellHeight = rawSwellHeight;
        let shadowed = false;
        if (name === "Koloa Landing" && swellDir >= 110 && swellDir <= 145) {
            swellHeight = rawSwellHeight * 0.6; // 40% height reduction
            shadowed = true;
        } else if (name === "Brennecke's Ledge" && swellDir >= 230 && swellDir <= 260) {
            swellHeight = rawSwellHeight * 0.75; // 25% height reduction
            shadowed = true;
        }

        // Calculate Swell Energy
        const energy = swellHeight * swellHeight * swellPeriod;

        // Scale thresholds for Brennecke's (15% more exposed near the point)
        let thresholdScale = 1.0;
        if (name === "Brennecke's Ledge") {
            thresholdScale = 0.85;
        }

        // Determine Swell & Wind Danger levels
        let swellStatus = "safe";
        if (energy >= energyDangerLimit * thresholdScale) {
            swellStatus = "danger";
        } else if (energy >= energyCautionLimit * thresholdScale) {
            swellStatus = "caution";
        }

        let windStatus = "safe";
        if (type === "Shore") {
            if (windSpeedCove !== null) {
                if (windSpeedCove >= windDangerLimitShore) windStatus = "danger";
                else if (windSpeedCove >= windCautionLimitShore) windStatus = "caution";
            }
        } else {
            if (windSpeedExposed !== null) {
                let dangerLimit = windDangerLimitBoat;
                let cautionLimit = windCautionLimitBoat;
                if (name === "Brennecke's Ledge" && windExposure === "offshore") {
                    dangerLimit = 18;  // Revert to strict unprotected limits
                    cautionLimit = 12;
                }
                if (windSpeedExposed >= dangerLimit) windStatus = "danger";
                else if (windSpeedExposed >= cautionLimit) windStatus = "caution";
            }
        }

        const finalStatus = (swellStatus === "danger" || windStatus === "danger") ? "danger" :
                            (swellStatus === "caution" || windStatus === "caution") ? "caution" : "safe";

        // Construct Uniform Output Text
        // 1. Surface Condition
        let surface = "Calm";
        if (type === "Shore") {
            if (windSpeedCove !== null) {
                let limitRough = 16;
                let limitLight = 10;
                if (isCoveOnshore) {
                    limitRough = 13; // Onshore wind turns cove choppy quickly
                    limitLight = 8;
                } else {
                    limitRough = 18; // Sheltered/offshore wind keeps cove calmer
                    limitLight = 12;
                }

                if (windSpeedCove >= limitRough) surface = "Rough Chop";
                else if (windSpeedCove >= limitLight) surface = "Light Chop";
            }
        } else {
            if (windSpeedExposed !== null) {
                let limitRough = 18;
                let limitLight = 12;
                if (windExposure === "offshore") {
                    limitRough = 22; // Groomed water stays calmer at higher speeds
                    limitLight = 15;
                } else if (windExposure === "onshore") {
                    limitRough = 15; // Onshore wind chop piles up quickly
                    limitLight = 10;
                }

                if (windSpeedExposed >= limitRough) surface = "Rough Chop";
                else if (windSpeedExposed >= limitLight) surface = "Choppy";
            }
        }

        // 2. Current
        let current = "Low";
        if (name === "Koloa Landing") {
            if (energy >= energyDangerLimit) current = "Strong Surge";
            else if (energy >= energyCautionLimit) current = "Moderate Surge";
        } else if (name === "Brennecke's Ledge") {
            if (energy >= energyDangerLimit * thresholdScale) current = "Strong Drift";
            else if (energy >= energyCautionLimit * thresholdScale) current = "Moderate Drift";
        } else {
            if (energy >= energyDangerLimit) current = "Strong Drift";
            else if (energy >= energyCautionLimit) current = "Moderate Drift";
        }

        // 3. Transit Condition — period-aware model
        // Wave steepness ∝ H/T²: longer period = gentler organized rollers = smoother crossing.
        // Short-period windswell is steep and chaotic even at moderate heights.
        let transit = "Smooth Transit";
        if (type === "Shore") {
            transit = "N/A (Shore Entry)";
        } else {
            let pFactor = 1.0;
            if (swellPeriod !== null) {
                if (swellPeriod >= 16)      pFactor = 0.50; // Classic groundswell — long organized rollers
                else if (swellPeriod >= 14) pFactor = 0.65; // Good groundswell
                else if (swellPeriod >= 12) pFactor = 0.80; // Mixed swell
                else if (swellPeriod <= 8)  pFactor = 1.30; // Windswell — steep and disorganized
            }
            const effH = (swellHeight || 0) * pFactor;
            if ((windSpeedExposed !== null && windSpeedExposed >= 20) || effH >= 6.0) {
                transit = "Rough Ride";
            } else if ((windSpeedExposed !== null && windSpeedExposed >= 12) || effH >= 3.5) {
                transit = "Bumpy Ride";
            }
        }

        // 4. Cavern-specific Surge warning
        let surgeWarning = "";
        if (name === "Sheraton Caverns") {
            if (energy >= energyDangerLimit) {
                surgeWarning = " | ⚠ SURGE WARNING: High surge inside lava tubes!";
            } else if (energy >= energyCautionLimit) {
                surgeWarning = " | ⚠ SURGE CAUTION: Moderate surge in caverns.";
            }
        }

        const shadowNote = shadowed ? ` (Refraction shadow active: ${swellHeight.toFixed(1)}ft effective swell)` : "";
        const text = `Surface: ${surface} | Current: ${current} | Transit: ${transit}${surgeWarning}${shadowNote}`;

        return { status: finalStatus, text: text };
    }

    // Define dive sites
    const sites = [
        {
            name: "Koloa Landing",
            type: "Shore",
            getConditions: () => getFormattedConditions("Shore", "Koloa Landing", rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed)
        },
        {
            name: "Sheraton Caverns",
            type: "Boat",
            getConditions: () => getFormattedConditions("Boat", "Sheraton Caverns", rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed)
        },
        {
            name: "Brennecke's Ledge",
            type: "Boat",
            getConditions: () => getFormattedConditions("Boat", "Brennecke's Ledge", rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed)
        },
        {
            name: "The Buoy",
            type: "Boat",
            getConditions: () => getFormattedConditions("Boat", "The Buoy", rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed)
        }
    ];

    container.innerHTML = "";
    let dangerCount = 0;
    let cautionCount = 0;

    sites.forEach(site => {
        const cond = site.getConditions();
        if (cond.status === "danger") dangerCount++;
        else if (cond.status === "caution") cautionCount++;

        const item = document.createElement("div");
        item.className = "dive-site-item";
        item.innerHTML = `
            <div class="dive-site-header">
                <span class="dive-site-name">${site.name}</span>
                <div class="dive-site-meta">
                    <span class="dive-site-type-badge">${site.type}</span>
                    <span class="dive-site-status ${cond.status}">${cond.status.toUpperCase()}</span>
                </div>
            </div>
            <p class="dive-site-conditions">${cond.text}</p>
        `;
        container.appendChild(item);
    });

    const overallBadge = document.getElementById("dive-overall-status");
    if (overallBadge) {
        if (dangerCount > 0) {
            overallBadge.textContent = "Caution / Restricted";
            overallBadge.style.background = "rgba(255, 107, 107, 0.12)";
            overallBadge.style.color = "var(--accent-sunset)";
            overallBadge.style.borderColor = "rgba(255, 107, 107, 0.2)";
        } else if (cautionCount > 0) {
            overallBadge.textContent = "Moderate Conditions";
            overallBadge.style.background = "rgba(244, 208, 104, 0.12)";
            overallBadge.style.color = "var(--accent-gold)";
            overallBadge.style.borderColor = "rgba(244, 208, 104, 0.2)";
        } else {
            overallBadge.textContent = "Excellent Diving";
            overallBadge.style.background = "rgba(6, 214, 160, 0.12)";
            overallBadge.style.color = "var(--accent-teal)";
            overallBadge.style.borderColor = "rgba(6, 214, 160, 0.2)";
        }
    }
}

function updateHarborAlerts(data) {
    const container = document.getElementById("harbor-alerts-container");
    if (!container) return;

    const alerts = [];
    
    // Whale season check — use HST date (predictions are in Hawaii Standard Time)
    const nowHST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' }));
    const m = nowHST.getMonth(); // 0 = Jan, 11 = Dec
    const d = nowHST.getDate();
    const isWhaleSeason = (m === 11) || (m === 0) || (m === 1) || (m === 2) || (m === 3 && d === 1);

    // Dynamic range finder for high water conditions
    function findHighWaterRanges(preds, threshold, surgeVal) {
        const ranges = [];
        let activeRange = null;

        preds.forEach(p => {
            const totalHeight = p.value_ft + surgeVal;
            // p.time is "YYYY-MM-DD HH:MM"
            const parts = p.time.split(' ');
            const datePart = parts[0];
            const timePart = parts[1];
            if (!timePart) return;

            const isAbove = totalHeight >= threshold;

            if (isAbove) {
                if (!activeRange) {
                    activeRange = {
                        date: datePart,
                        startTime: timePart,
                        endTime: timePart,
                        maxVal: totalHeight
                    };
                } else {
                    activeRange.endTime = timePart;
                    if (totalHeight > activeRange.maxVal) {
                        activeRange.maxVal = totalHeight;
                    }
                }
            } else {
                if (activeRange) {
                    ranges.push(activeRange);
                    activeRange = null;
                }
            }
        });

        if (activeRange) {
            ranges.push(activeRange);
        }

        return ranges;
    }

    // Use HST-aware date strings — predictions are always in Hawaii Standard Time
    const todayStr = getHSTDateStr();

    // Filter past ranges — compare end times in HST minutes
    const currentMins = getHSTMinutes();
    const filterPastRanges = r => {
        if (r.date === todayStr) {
            const endParts = r.endTime.split(':');
            const endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            return currentMins <= endMins;
        }
        return true;
    };

    // 1. Check Tide Flooding in daily windows
    if (data.tides && data.tides.predictions && data.tides.predictions.length > 0) {
        const predictions = data.tides.predictions;
        let surge = data.tides.surge_ft !== null ? data.tides.surge_ft : 0;
        let isWaveSetupFallback = false;
        if (data.tides.surge_ft === null || data.tides.surge_ft === undefined) {
            const est = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate : null;
            if (est && est.wvht_ft && est.dpd_s) {
                surge = Math.min(0.05 * est.wvht_ft * Math.sqrt(est.dpd_s), 1.2);
                isWaveSetupFallback = true;
            }
        }
        
        const suffix = isWaveSetupFallback ? " (includes swell setup)" : "";

        // Find continuous periods above thresholds (field-calibrated 2026-07-10)
        const floodingRanges  = findHighWaterRanges(predictions, 3.2, surge).filter(filterPastRanges);
        const highWaterRanges = findHighWaterRanges(predictions, 2.85, surge).filter(filterPastRanges);

        // Format a range for output
        const formatRange = r => `${r.startTime} - ${r.endTime} (max +${r.maxVal.toFixed(2)} ft)`;

        // Today Grouping
        const todayFloodingText = floodingRanges.filter(r => r.date === todayStr).map(formatRange);
        const todayHighWaterText = highWaterRanges.filter(r => r.date === todayStr).map(formatRange);

        if (todayFloodingText.length > 0) {
            alerts.push({
                status: "danger",
                icon: "🌊",
                text: `TODAY DOCK FLOODING: Kukuiula dock will flood from: ${todayFloodingText.join(", ")}${suffix}.`
            });
        } else if (todayHighWaterText.length > 0) {
            alerts.push({
                status: "caution",
                icon: "⚠",
                text: `TODAY HIGH WATER: High tide wash-over risk from: ${todayHighWaterText.join(", ")}${suffix}.`
            });
        }
    }

    // 2. Swell Wrap & harbor surge on Westerly Boat Ramp
    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const swellDir = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.mwd_deg : null;
    if (swellHeight !== null && swellDir !== null) {
        // South/Southwest swell entering harbor mouth directly (170° to 240°)
        if (swellDir >= 170 && swellDir <= 240) {
            if (swellHeight >= 4.0) {
                alerts.push({
                    status: "danger",
                    icon: "⚠",
                    text: `HARBOR SURGE: Active ${swellHeight.toFixed(1)}ft South/Southwest swell wrapping into Kukuiula Harbor. Sideway surge expected at the westerly boat ramp.`
                });
            } else if (swellHeight >= 2.8) {
                alerts.push({
                    status: "caution",
                    icon: "⚠",
                    text: `MODERATE SURGE: South/Southwest swell wrapping around breakwater. Expect boat movement during dock loading.`
                });
            }
        }
    }

    // 3. Reverse Current: active flood tide (West-to-East) opposing ENE trades → standing waves.
    // 3-state model: slack suppresses alert (near-zero current at tide peaks).
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed = data.model_wind ? data.model_wind.direction_deg : null;
    const tideState = computeTideState(data.tides?.predictions);

    if (tideState.available && tideState.isFlooding && !tideState.isSlack &&
        windSpeedExposed !== null && windSpeedExposed > 12 &&
        windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110) {
        alerts.push({
            status: "caution",
            icon: "🌊",
            text: `HARSH SEAS: Active flood tide generating West-to-East current against ENE trades. Expect steep standing waves and a rough boat ride.`
        });
    }

    // Render alerts
    container.innerHTML = "";
    
    if (alerts.length === 0) {
        const safeItem = document.createElement("div");
        safeItem.className = "harbor-alert-item safe";
        safeItem.innerHTML = `
            <span class="harbor-alert-icon">✓</span>
            <span class="harbor-alert-text">Kukuiula Harbor loading dock and boat ramp are clear. Normal tides and currents.</span>
        `;
        container.appendChild(safeItem);
    } else {
        alerts.forEach(alert => {
            const item = document.createElement("div");
            item.className = `harbor-alert-item ${alert.status}`;
            item.innerHTML = `
                <span class="harbor-alert-icon">${alert.icon}</span>
                <span class="harbor-alert-text">${alert.text}</span>
            `;
            container.appendChild(item);
        });
    }

    // Add season note helper
    const note = document.createElement("div");
    note.className = "harbor-alert-season-note";
    if (isWhaleSeason) {
        note.textContent = "Whale season dock alerts active (Dec 1 - Apr 1).";
    } else {
        note.textContent = "Dock flooding alerts active year-round. Whale season: Dec 1 – Apr 1.";
    }
    container.appendChild(note);
}

function updateTransitComfort(data) {
    const westBadge = document.getElementById("comfort-west");
    const eastBadge = document.getElementById("comfort-east");
    if (!westBadge || !eastBadge) return;

    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const swellPeriod = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.dpd_s : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed   = data.model_wind ? data.model_wind.direction_deg : null;

    // Period comfort factor — wave steepness ∝ H/T²:
    //   Long period  → gentle organized rollers → easier transit (factor < 1.0)
    //   Short period → steep chaotic windswell  → harder transit (factor > 1.0)
    let periodFactor = 1.0;
    if (swellPeriod !== null) {
        if      (swellPeriod >= 16) periodFactor = 0.50; // Classic groundswell
        else if (swellPeriod >= 14) periodFactor = 0.65; // Good groundswell
        else if (swellPeriod >= 12) periodFactor = 0.80; // Mixed swell
        else if (swellPeriod <=  8) periodFactor = 1.30; // Windswell — steep and disorganized
    }
    const effectiveSwellHeight = (swellHeight || 0) * periodFactor;

    // 3-state tidal model: active flooding / slack / active ebbing
    const tideState = computeTideState(data.tides?.predictions);

    // Reverse current: active flood tide pushes West-to-East against ENE trades → standing waves.
    // Gated on !isSlack: near-zero current at high/low water does not create standing waves.
    const hasReverseCurrent = tideState.available && tideState.isFlooding && !tideState.isSlack &&
        windSpeedExposed !== null && windSpeedExposed > 12 &&
        windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110;

    // Ebb improvement: ebb runs East-to-West WITH ENE trades → reduces apparent wave steepness.
    // Effect is modest (~3-5% of wave phase speed) — modeled as 15% threshold relief.
    const hasEbbImprovement = tideState.available && tideState.isEbbing && !tideState.isSlack &&
        windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110;

    // A. West of Makahuena (Poipu / Kukuiula) — sheltered from trades by the point
    let westStatus = "smooth";
    if (hasReverseCurrent) {
        westStatus = "harsh"; // Active flood current opposing ENE trades → standing waves
    } else {
        const ebFactor = hasEbbImprovement ? 1.15 : 1.0; // mild threshold relief on ebb
        if ((windSpeedExposed !== null && windSpeedExposed > 20) || effectiveSwellHeight >= 5.5 / ebFactor) {
            westStatus = "rough";
        } else if ((windSpeedExposed !== null && windSpeedExposed > 12) || effectiveSwellHeight >= 3.0 / ebFactor) {
            westStatus = "choppy";
        } else {
            westStatus = "smooth";
        }
    }

    const westText = westStatus === "harsh"  ? "Standing Waves"
        : (westStatus === "smooth" && tideState.available && tideState.isSlack) ? "Smooth (Slack)"
        : westStatus.charAt(0).toUpperCase() + westStatus.slice(1);
    westBadge.className  = `comfort-badge ${westStatus}`;
    westBadge.textContent = westText;

    // B. East of Makahuena (Makahuena to Kipu Kai) — fully exposed, no tidal current shelter
    let eastStatus = "smooth";
    if ((windSpeedExposed !== null && windSpeedExposed > 20) || effectiveSwellHeight >= 5.5) {
        eastStatus = "harsh";
    } else if ((windSpeedExposed !== null && windSpeedExposed > 14) || effectiveSwellHeight >= 3.5) {
        eastStatus = "rough";
    } else if ((windSpeedExposed !== null && windSpeedExposed > 10) || effectiveSwellHeight >= 2.0) {
        eastStatus = "choppy";
    } else {
        eastStatus = "smooth";
    }

    eastBadge.className  = `comfort-badge ${eastStatus}`;
    eastBadge.textContent = eastStatus === "harsh" ? "Very Rough"
        : eastStatus.charAt(0).toUpperCase() + eastStatus.slice(1);
}

