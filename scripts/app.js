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

// ─── Region & Site Configuration (Section 1) ──────────────────────────────────
const REGIONS = {
  kauai: {
    label: "Kauai",
    shores: {
      south: {
        label: "South Shore",
        launchPoints: {
          kukuiula: {
            label: "Kukuiula Harbor",
            entranceFacing: "west",
            tideStation: "1611400"
          }
        },
        sites: {
          sheratonCaverns:  { label: "Sheraton Caverns", type: "boat" },
          theBuoy:          { label: "The Buoy", type: "boat" },
          brenneckesLedge:  { label: "Brennecke's Ledge", type: "boat" },
          zacsPocket:       { label: "Zac's Pocket", type: "boat" },
          kipuKai:          { label: "Kipu Kai", type: "boat" },
          koloaLanding:     { label: "Koloa Landing", type: "shore" },
          camp1:            { label: "Camp 1 (Port Allen)", type: "boat" },
          ladders:          { label: "Ladders (Port Allen)", type: "boat" }
        }
      },
      napali: {
        label: "Na Pali Coast",
        launchPoints: {
          portAllen: {
            label: "Port Allen",
            entranceFacing: null,
            tideStation: "1611347"
          },
          kekaha: {
            label: "Kekaha (Kikiaola Small Boat Harbor)",
            entranceFacing: null,
            tideStation: "1611401"
          }
        },
        sites: {
          hoolulu: {
            label: "Hoʻolulu Sea Cave",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Tight, narrow sea cave. Nesting ground for native Hawaiian seabirds. Cave entry is a swell-driven surge/confined-space go-no-go decision."
            }
          },
          waiahuakua: {
            label: "Waiahuakua Sea Cave (Double Door Cave)",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Separate entrance and exit (Double Door). Features a massive freshwater waterfall plunging through a ceiling hole. Entry is a swell-driven surge decision."
            }
          },
          pukalani: {
            label: "Pukalani (Open Ceiling Cave)",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Hollowed-out cave with a completely collapsed ceiling. Midday summer sun creates a glowing neon-blue light on the sandy floor."
            }
          },
          honololo: {
            label: "Honololo Sea Cave (Pirate's Cave)",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Requires driving directly through a waterfall at the entrance. Cavern houses Zebra Cave, Godzilla Egg Cave, and Skull Cave."
            }
          },
          hanakoa: {
            label: "Nā Pali Sea Arch (Hanakoa Arch)",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Open archway below Hanakoa Valley. Raft transit requires low tide and extremely calm conditions."
            }
          },
          honopu: {
            label: "Honopū Sea Cave",
            type: "cave",
            entryLogic: {
              status: "PENDING - awaiting operator input",
              swellHeightThreshold: null,
              swellPeriodThreshold: null,
              swellDirectionSensitive: null,
              notes: "Located near Honopū Arch. Features rich marine life, blood-red and pink corals lining the underwater lava rocks."
            }
          },
          nualoloKai: { label: "Nualolo Kai", type: "snorkel" },
          makuaReef:  { label: "Makua Reef", type: "snorkel" }
        }
      }
    }
  }
};

const DEFAULT_THRESHOLDS = {
  koloaLanding:     { windDanger: 18, windCaution: 14, swellDanger: 220, swellCaution: 110 },
  sheratonCaverns:  { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  theBuoy:          { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  brenneckesLedge:  { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  zacsPocket:       { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  kipuKai:          { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  camp1:            { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  ladders:          { windDanger: 22, windCaution: 18, swellDanger: 220, swellCaution: 110 },
  nualoloKai:       { windDanger: 20, windCaution: 16, swellDanger: 180, swellCaution: 90 },
  makuaReef:        { windDanger: 20, windCaution: 16, swellDanger: 180, swellCaution: 90 }
};

// State Variables (Section 5)
let activeIsland = localStorage.getItem("selectedIsland") || "kauai";
let activeShore = localStorage.getItem("selectedShore") || "south";
let activeLaunch = localStorage.getItem("selectedLaunch") || "";

// Ensure defaults match available config structures
if (activeShore === "south" && !activeLaunch) {
    activeLaunch = "kukuiula";
} else if (activeShore === "napali" && !activeLaunch) {
    activeLaunch = "portAllen";
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    fetchAll();
    initMobileTabs();
    initSettingsDrawer(); // Initialize settings drawer UI and events (Section 5)
    setInterval(fetchAll, 300000); // auto-refresh every 5 minutes if page is open
});

function toggleSwellWidgetsVisibility() {
    const southSwellCard = document.getElementById("marine-widget");
    const napaliSwellWidgets = document.getElementById("napali-swell-widgets");
    
    // Find the active tab index
    const tabMarine = document.getElementById("tab-marine");
    const isMarineTabActive = tabMarine ? tabMarine.classList.contains("active") : false;
    
    // We are on mobile if window width <= 768
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        if (isMarineTabActive) {
            if (activeShore === "south") {
                if (southSwellCard) {
                    southSwellCard.classList.add("mobile-show");
                    southSwellCard.classList.remove("mobile-hide");
                }
                if (napaliSwellWidgets) {
                    napaliSwellWidgets.classList.add("mobile-hide");
                    napaliSwellWidgets.classList.remove("mobile-show");
                }
            } else {
                if (southSwellCard) {
                    southSwellCard.classList.add("mobile-hide");
                    southSwellCard.classList.remove("mobile-show");
                }
                if (napaliSwellWidgets) {
                    napaliSwellWidgets.classList.add("mobile-show");
                    napaliSwellWidgets.classList.remove("mobile-hide");
                }
            }
        } else {
            // Hide both on other tabs
            if (southSwellCard) {
                southSwellCard.classList.add("mobile-hide");
                southSwellCard.classList.remove("mobile-show");
            }
            if (napaliSwellWidgets) {
                napaliSwellWidgets.classList.add("mobile-hide");
                napaliSwellWidgets.classList.remove("mobile-show");
            }
        }
    } else {
        // Desktop: clear mobile classes and set style.display directly
        if (southSwellCard) {
            southSwellCard.classList.remove("mobile-show", "mobile-hide");
            southSwellCard.style.display = (activeShore === "south") ? "block" : "none";
        }
        if (napaliSwellWidgets) {
            napaliSwellWidgets.classList.remove("mobile-show", "mobile-hide");
            napaliSwellWidgets.style.display = (activeShore === "napali") ? "flex" : "none";
        }
    }
}

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
            toggleSwellWidgetsVisibility();
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
        toggleSwellWidgetsVisibility();
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

function getCurrentTideHeight(tideData) {
    if (!tideData || !tideData.predictions || tideData.predictions.length === 0) return null;
    const nowEpoch = Date.now();
    let minDiff = Infinity;
    let closestVal = null;
    tideData.predictions.forEach(p => {
        const diff = Math.abs(parsePredictionTime(p.time).getTime() - nowEpoch);
        if (diff < minDiff) {
            minDiff = diff;
            closestVal = p.value_ft;
        }
    });
    return closestVal;
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

function updateDashboard(rawData) {
    latestData = rawData;

    // Update Dynamic Header & Meta labels (Section 5a)
    const headerTitle = document.querySelector(".header-logo h1");
    const locationVal = document.querySelector(".header-meta .meta-item .meta-val");
    const zoneBadge = document.querySelector(".forecast-card .zone-badge");
    const forecastFooter = document.querySelector(".forecast-card .card-footer .footer-note");

    if (activeShore === "south") {
        if (headerTitle) headerTitle.innerHTML = 'South Shore <span class="accent-text">Marine Report</span>';
        if (locationVal) locationVal.textContent = 'Nomilo to Makahuena';
        if (zoneBadge) zoneBadge.textContent = "PHZ112";
        if (forecastFooter) forecastFooter.textContent = "Kauai Leeward Waters (PHZ112) Forecast Text";
    } else if (activeShore === "napali") {
        const harborLabel = activeLaunch === "kekaha" ? "Kikiaola" : "Port Allen";
        if (headerTitle) {
            headerTitle.innerHTML = `Na Pali Coast <span class="accent-text">Marine Report</span> <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: normal; margin-left: 0.5rem; display: inline-block; vertical-align: middle;">— ${harborLabel}</span>`;
        }
        if (locationVal) locationVal.textContent = 'Kekaha to Haena';
        if (zoneBadge) zoneBadge.textContent = "PHZ110 / PHZ111";
        if (forecastFooter) forecastFooter.textContent = "Kauai Northwest & Windward Waters Forecast Text";
    }

    const data = projectActiveData(rawData);

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

    // 2. Swell & Tides Widget Regional Toggle
    const southSwellCard = document.getElementById("marine-widget");
    const napaliSwellWidgets = document.getElementById("napali-swell-widgets");
    
    if (activeShore === "south") {
        toggleSwellWidgetsVisibility();
        
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
    } else {
        toggleSwellWidgetsVisibility();
        updateNapaliSwellWidgets(data, rawData);
    }

    // 3. Wind Card (Wind Report)
    const pwsWindTitle = document.getElementById("pws-wind-title");
    const modelWindTitle = document.getElementById("model-wind-title");
    if (pwsWindTitle) {
        if (activeShore === "south") {
            pwsWindTitle.textContent = "Landing";
        } else {
            pwsWindTitle.textContent = activeLaunch === "kekaha" ? "Kikiaola Harbor" : "Port Allen";
        }
    }
    // Update model-column title based on active shore
    if (modelWindTitle) {
        if (activeShore === "napali") {
            modelWindTitle.textContent = "Na Pali Coastline";
        } else {
            modelWindTitle.textContent = "Exposed Points";
        }
    }

    if (data.wind) {
        const w = data.wind;
        const stationsOnline = w.stations_online !== undefined ? w.stations_online : (w.stations ? w.stations.length : 0);
        
        let windSpeedCove = w.average_speed_mph;
        let windDirCove = w.average_direction_deg;
        let windCompassCove = w.average_direction_compass || "VAR";
        let isFallback = false;

        // South shore only: apply cove shadow decay fallback when PWS stations are offline.
        // Na Pali: projectActiveData already injected the correct harbor-specific source into data.wind.
        if (activeShore === "south" && (stationsOnline === 0 || windSpeedCove === null || windSpeedCove === 0)) {
            const decayedSpeed = estimateCoveWindFromModel(data.model_wind);
            if (decayedSpeed !== null) {
                windSpeedCove = decayedSpeed;
                windDirCove   = data.model_wind.direction_deg;
                windCompassCove = data.model_wind.direction_compass || degToCompass(windDirCove);
                isFallback = true;
            }
        }

        // Wind Speed
        document.getElementById("wind-speed").textContent = windSpeedCove ? windSpeedCove.toFixed(1) : "--.-";
        
        // Wind Direction
        const compassDir = windCompassCove;
        const degDir = windDirCove !== undefined ? `${Math.round(windDirCove)}°` : "---°";
        document.getElementById("wind-dir").textContent = (w.direction_reliable || isFallback) ? degDir : "Variable";

        const windAbbrEl = document.getElementById("wind-dir-abbr");
        if (windAbbrEl) windAbbrEl.textContent = (w.direction_reliable || isFallback) ? compassDir : "VAR";
        
        let sumGusts = 0;
        let countGusts = 0;
        (w.stations || []).forEach(s => {
            if (s.gust_mph !== undefined && s.gust_mph !== null) {
                sumGusts += s.gust_mph;
                countGusts++;
            }
        });
        const avgGusts = countGusts > 0 ? Math.round(sumGusts / countGusts) : 0;
        document.getElementById("wind-gusts").textContent = `${avgGusts} mph`;

        // Wind reliability badge
        const relBadge = document.getElementById("wind-reliability");
        if (activeShore === "napali") {
            // Na Pali: show actual source station ID (PHBK, NWS-HFO/82,171, etc.)
            const srcStation = w.stations && w.stations[0] ? w.stations[0].id : "NWS Grid";
            relBadge.textContent = srcStation;
            relBadge.style.background = "rgba(6, 214, 160, 0.12)";
            relBadge.style.color = "var(--accent-teal)";
            relBadge.style.borderColor = "rgba(6, 214, 160, 0.2)";
        } else if (isFallback) {
            // South shore fallback only
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

    // 4. Tide Card (South Shore)
    if (activeShore === "south" && data.tides) {
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
    if (activeShore === "south") {
        updateHarborAlerts(data);
    }

    // 8. Transit Comfort Levels (West vs. East of Makahuena)
    updateTransitComfort(data);
}

function renderTideSVG(predictions, observations, svgId = "tide-svg") {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    
    if (!predictions || predictions.length === 0) {
        const line = svg.querySelector(".tide-line-path");
        if (line) line.setAttribute("d", "");
        const area = svg.querySelector(".tide-area-path");
        if (area) area.setAttribute("d", "");
        return;
    }
    
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

function findAndRenderExtremes(predictions, containerId = "tide-extremes") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    if (!predictions || predictions.length === 0) return;

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

    // Calculate wind-swell angle alignment factor
    // Perpendicular wind-swell angles (around 90°) do not compound or build chop as aggressively,
    // resulting in significantly milder transit and dive conditions.
    let alignmentFactor = 1.0;
    if (windDirExposed !== null && swellDir !== null) {
        let angleDiff = Math.abs(windDirExposed - swellDir) % 360;
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        // Sinusoidal scaling: drops to 0.75 when perpendicular (90° difference)
        alignmentFactor = 1.0 - 0.25 * Math.abs(Math.sin(angleDiff * Math.PI / 180));
    }
    const effWindSpeedExposed = windSpeedExposed !== null ? windSpeedExposed * alignmentFactor : null;

    // Determine wind alignment relative to coastline orientation
    let windExposure = "cross-shore";
    if (windDirExposed !== null) {
        if (activeShore === "napali") {
            // Na Pali Coast faces NW (~315°), blocked by land from South to East-Northeast
            if (windDirExposed >= 45 && windDirExposed <= 180) {
                windExposure = "offshore"; // Blocked/groomed by high cliffs
            } else if (windDirExposed >= 270 && windDirExposed <= 360) {
                windExposure = "onshore";  // Blowing directly onto the coast/caves
            }
        } else {
            // South Shore faces South (180°)
            if (windDirExposed >= 315 || windDirExposed <= 65) {
                windExposure = "offshore";
            } else if (windDirExposed >= 135 && windDirExposed <= 225) {
                windExposure = "onshore";
            }
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

    // Set Wind Speed thresholds for Boat sites based on wind direction (calibrated 2026-07-15)
    let windDangerLimitBoat = 22;
    let windCautionLimitBoat = 18;
    if (windExposure === "offshore") {
        windDangerLimitBoat = 25; // land-sheltered transit allows more wind
        windCautionLimitBoat = 20;
    } else if (windExposure === "onshore") {
        windDangerLimitBoat = 18; // messy onshore chop requires lower limits
        windCautionLimitBoat = 14;
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
    function getFormattedConditions(type, name, rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed, siteKey) {
        if (rawSwellHeight === null || swellPeriod === null || swellDir === null) {
            return { status: { snorkel: "caution", dive: "caution" }, text: "Sensor data offline. Conditions unassessed." };
        }

        // Swell Shadowing & Refraction adjustments
        let swellHeight = rawSwellHeight;
        let shadowed = false;
        if (name === "Koloa Landing" && swellDir >= 110 && swellDir <= 145) {
            swellHeight = rawSwellHeight * 0.6; // 40% height reduction (ESE shadow)
            shadowed = true;
        } else if (name === "Koloa Landing" && swellDir >= 230 && swellDir <= 260) {
            swellHeight = rawSwellHeight * 0.70; // 30% height reduction (WSW shelter shadow)
            shadowed = true;
        } else if (name === "Brennecke's Ledge" && swellDir >= 230 && swellDir <= 260) {
            swellHeight = rawSwellHeight * 0.75; // 25% height reduction (WSW shelter shadow)
            shadowed = true;
        } else if (activeShore === "south" && swellDir >= 230 && swellDir <= 260) {
            // General South Shore sites benefit from 25% Niihau/Southwest point sheltering under WSW swells
            swellHeight = rawSwellHeight * 0.75;
            shadowed = true;
        }

        // Apply Period Comfort Factor to wave height for energy calculation
        let periodFactor = 1.0;
        if (swellPeriod !== null) {
            if      (swellPeriod >= 16) periodFactor = 0.50; // Classic groundswell
            else if (swellPeriod >= 14) periodFactor = 0.65; // Good groundswell
            else if (swellPeriod >= 12) periodFactor = 0.80; // Mixed swell
            else if (swellPeriod <=  8) periodFactor = 1.30; // Windswell — steep and disorganized
        }
        const effectiveSwellHeight = swellHeight * periodFactor;

        // Calculate Swell Energy (use period-adjusted height for wave steepness/orbital velocity scaling)
        const energy = effectiveSwellHeight * effectiveSwellHeight * swellPeriod;

        // Scale thresholds for Brennecke's (15% more exposed near the point)
        let thresholdScale = 1.0;
        if (name === "Brennecke's Ledge") {
            thresholdScale = 0.85;
        }

        // Load overrides (Section 5)
        const overSwellDanger = siteKey ? getEffectiveThreshold(siteKey, "swellDanger") : null;
        const overSwellCaution = siteKey ? getEffectiveThreshold(siteKey, "swellCaution") : null;
        const overWindDanger = siteKey ? getEffectiveThreshold(siteKey, "windDanger") : null;
        const overWindCaution = siteKey ? getEffectiveThreshold(siteKey, "windCaution") : null;

        // Overrides for compounding limits (e.g. Koloa Landing South swell + South wind)
        let siteDangerLimit = (overSwellDanger !== null) ? overSwellDanger : energyDangerLimit;
        let siteCautionLimit = (overSwellCaution !== null) ? overSwellCaution : energyCautionLimit;
        let isCompoundingKoloaSurge = false;

        if (name === "Koloa Landing" && isCoveOnshore && swellDir !== null && swellDir >= 160 && swellDir <= 220) {
            if (overSwellDanger === null) siteDangerLimit = 135;
            if (overSwellCaution === null) siteCautionLimit = 65;
            isCompoundingKoloaSurge = true;
        }

        // ─── DIVE (SCUBA) STATUS ───
        let diveSwellStatus = "safe";
        if (energy >= siteDangerLimit * thresholdScale) {
            diveSwellStatus = "danger";
        } else if (energy >= siteCautionLimit * thresholdScale) {
            diveSwellStatus = "caution";
        }

        let diveWindStatus = "safe";
        if (type === "Shore") {
            if (windSpeedCove !== null) {
                const dangerLimit = (overWindDanger !== null) ? overWindDanger : windDangerLimitShore;
                const cautionLimit = (overWindCaution !== null) ? overWindCaution : windCautionLimitShore;
                if (windSpeedCove >= dangerLimit) diveWindStatus = "danger";
                else if (windSpeedCove >= cautionLimit) diveWindStatus = "caution";
            }
        } else {
            if (windSpeedExposed !== null) {
                let dangerLimit = (overWindDanger !== null) ? overWindDanger : windDangerLimitBoat;
                let cautionLimit = (overWindCaution !== null) ? overWindCaution : windCautionLimitBoat;
                if (name === "Brennecke's Ledge" && windExposure === "offshore" && overWindDanger === null) {
                    dangerLimit = 18;  // Revert to strict unprotected limits
                    cautionLimit = 12;
                }
                if (windSpeedExposed >= dangerLimit) diveWindStatus = "danger";
                else if (windSpeedExposed >= cautionLimit) diveWindStatus = "caution";
            }
        }

        let diveStatus = "safe";
        if (diveSwellStatus === "danger") {
            diveStatus = "danger";
        } else if (diveWindStatus === "danger") {
            const extremeWindLimit = (type === "Shore") ? 22 : 26;
            const currentWind = (type === "Shore") ? windSpeedCove : windSpeedExposed;
            if (currentWind !== null && currentWind >= extremeWindLimit) {
                diveStatus = "danger";
            } else {
                diveStatus = "caution"; // Downgrade wind-only danger to caution for diving
            }
        } else if (diveSwellStatus === "caution" || diveWindStatus === "caution") {
            diveStatus = "caution";
        }

        // ─── SNORKEL STATUS ───
        let snorkelDangerLimit = 130;
        let snorkelCautionLimit = 65;
        if (windExposure === "offshore") {
            snorkelDangerLimit = 170;
            snorkelCautionLimit = 80;
        } else if (windExposure === "onshore") {
            snorkelDangerLimit = 110;
            snorkelCautionLimit = 55;
        }

        if (name === "Koloa Landing" && isCoveOnshore && swellDir !== null && swellDir >= 160 && swellDir <= 220) {
            snorkelDangerLimit = 80;
            snorkelCautionLimit = 40;
        }

        // Apply proportional scaling to snorkel swell limits if overrides exist
        const defaults = siteKey ? DEFAULT_THRESHOLDS[siteKey] : null;
        if (defaults) {
            if (overSwellDanger !== null) {
                snorkelDangerLimit = Math.round(overSwellDanger * (snorkelDangerLimit / defaults.swellDanger));
            }
            if (overSwellCaution !== null) {
                snorkelCautionLimit = Math.round(overSwellCaution * (snorkelCautionLimit / defaults.swellCaution));
            }
        }

        let snorkelSwellStatus = "safe";
        if (energy >= snorkelDangerLimit * thresholdScale) {
            snorkelSwellStatus = "danger";
        } else if (energy >= snorkelCautionLimit * thresholdScale) {
            snorkelSwellStatus = "caution";
        }

        let snorkelWindDangerLimit = (type === "Shore") ? (isCoveOnshore ? 12 : 16) : ((windExposure === "offshore") ? 23 : ((windExposure === "onshore") ? 16 : 20));
        let snorkelWindCautionLimit = (type === "Shore") ? (isCoveOnshore ? 8 : 11) : ((windExposure === "offshore") ? 18 : ((windExposure === "onshore") ? 12 : 16));
        if (name === "Brennecke's Ledge" && windExposure === "offshore") {
            snorkelWindDangerLimit = 18;
            snorkelWindCautionLimit = 14;
        }

        if (defaults) {
            if (overWindDanger !== null) {
                snorkelWindDangerLimit = Math.round(overWindDanger * (snorkelWindDangerLimit / defaults.windDanger));
            }
            if (overWindCaution !== null) {
                snorkelWindCautionLimit = Math.round(overWindCaution * (snorkelWindCautionLimit / defaults.windCaution));
            }
        }

        let snorkelWindStatus = "safe";
        if (type === "Shore") {
            if (windSpeedCove !== null) {
                if (windSpeedCove >= snorkelWindDangerLimit) snorkelWindStatus = "danger";
                else if (windSpeedCove >= snorkelWindCautionLimit) snorkelWindStatus = "caution";
            }
        } else {
            if (windSpeedExposed !== null) {
                if (windSpeedExposed >= snorkelWindDangerLimit) snorkelWindStatus = "danger";
                else if (windSpeedExposed >= snorkelWindCautionLimit) snorkelWindStatus = "caution";
            }
        }

        // Snorkel status calculation - wind is decoupled and caps overall status at Caution
        // unless the wind is truly extreme (e.g. >= 20 mph shore, >= 24 mph boat)
        let snorkelStatus = "safe";
        if (snorkelSwellStatus === "danger") {
            snorkelStatus = "danger";
        } else if (snorkelWindStatus === "danger") {
            const extremeWindLimit = (type === "Shore") ? 20 : 24;
            const currentWind = (type === "Shore") ? windSpeedCove : windSpeedExposed;
            if (currentWind !== null && currentWind >= extremeWindLimit) {
                snorkelStatus = "danger";
            } else {
                snorkelStatus = "caution"; // Downgrade wind-only danger to caution for snorkel
            }
        } else if (snorkelSwellStatus === "caution" || snorkelWindStatus === "caution") {
            snorkelStatus = "caution";
        }

        // Combined final status object
        const finalStatus = { snorkel: snorkelStatus, dive: diveStatus };

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
        const compoundingNote = isCompoundingKoloaSurge ? " | ⚠ COMPOUNDING BAY SURGE: Direct South swell and onshore wind colliding in landing channel." : "";
        const text = `Surface: ${surface} | Current: ${current} | Transit: ${transit}${surgeWarning}${shadowNote}${compoundingNote}`;

        return { status: finalStatus, text: text };
    }

    // Define dive sites dynamically (Section 1 / 5a)
    const activeRegionSites = REGIONS[activeIsland]?.shores?.[activeShore]?.sites || {};
    const sites = Object.entries(activeRegionSites).map(([siteKey, site]) => {
        const typeProper = site.type.charAt(0).toUpperCase() + site.type.slice(1);
        return {
            name: site.label,
            type: typeProper,
            getConditions: () => {
                if (site.type === "cave") {
                    const energy = (rawSwellHeight !== null && swellPeriod !== null) ? rawSwellHeight * rawSwellHeight * swellPeriod : 0;
                    const currentTide = getCurrentTideHeight(data.tides);
                    
                    let entryStatus = "safe";
                    let notesText = site.entryLogic.notes;
                    
                    // Precise surge energy evaluation for confined spaces
                    if (siteKey === "hoolulu") {
                        if (energy >= 60) entryStatus = "danger";
                        else if (energy >= 35) entryStatus = "caution";
                    } else if (siteKey === "waiahuakua") {
                        if (energy >= 70) entryStatus = "danger";
                        else if (energy >= 40) entryStatus = "caution";
                    } else if (siteKey === "pukalani") {
                        if (energy >= 75) entryStatus = "danger";
                        else if (energy >= 45) entryStatus = "caution";
                    } else if (siteKey === "honololo") {
                        if (energy >= 65) entryStatus = "danger";
                        else if (energy >= 40) entryStatus = "caution";
                    } else if (siteKey === "hanakoa") { // Hanakoa Arch - tide dependent!
                        const tideLimitDanger = 1.8;
                        const tideLimitCaution = 1.0;
                        
                        if (energy >= 60 || (currentTide !== null && currentTide >= tideLimitDanger)) {
                            entryStatus = "danger";
                        } else if (energy >= 35 || (currentTide !== null && currentTide >= tideLimitCaution)) {
                            entryStatus = "caution";
                        }
                        
                        const tideStr = currentTide !== null ? ` | Current Tide: ${currentTide.toFixed(1)}ft` : "";
                        notesText += ` (Requires low tide and calm swell${tideStr})`;
                    } else if (siteKey === "honopu") {
                        if (energy >= 60) entryStatus = "danger";
                        else if (energy >= 35) entryStatus = "caution";
                    }
                    
                    const statusDesc = entryStatus === "danger" ? "DANGEROUS SURGE" : (entryStatus === "caution" ? "HEAVY SURGE" : "SAFE FOR ENTRY");
                    const energyText = `Swell Energy: ${Math.round(energy)} | Status: ${statusDesc} | ${notesText}`;

                    return {
                        status: { snorkel: "na", dive: "na", entry: entryStatus },
                        text: energyText
                    };
                }
                
                if (site.type === "snorkel" && activeShore === "napali") {
                    return getFormattedConditions(
                        "Boat",
                        site.label,
                        rawSwellHeight,
                        swellPeriod,
                        swellDir,
                        windSpeedCove,
                        effWindSpeedExposed,
                        siteKey
                    );
                }
                
                return getFormattedConditions(
                    typeProper,
                    site.label,
                    rawSwellHeight,
                    swellPeriod,
                    swellDir,
                    windSpeedCove,
                    effWindSpeedExposed,
                    siteKey
                );
            }
        };
    });

    container.innerHTML = "";
    let dangerCount = 0;
    let cautionCount = 0;

    sites.forEach(site => {
        const cond = site.getConditions();
        if (cond.status.snorkel === "danger" || cond.status.dive === "danger" || cond.status.entry === "danger") dangerCount++;
        else if (cond.status.snorkel === "caution" || cond.status.dive === "caution" || cond.status.entry === "caution") cautionCount++;

        let badgesHtml = "";
        if (site.type.toLowerCase() === "cave") {
            // remove all indication of snorkel or scuba from caves, display Entry/Transit status badge
            const labelText = site.name.includes("Arch") ? "Arch Transit" : "Cave Entry";
            badgesHtml = `
                <div class="op-badge-group" style="display: flex; gap: 0.35rem; align-items: center; background: rgba(0, 0, 0, 0.12); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.03);">
                    <span class="op-label" style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">${labelText}</span>
                    <span class="dive-site-status ${cond.status.entry}" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${cond.status.entry.toUpperCase()}</span>
                </div>
            `;
        } else if (activeShore === "napali") {
            // remove scuba from all on the na pali sites page
            badgesHtml = `
                <div class="op-badge-group" style="display: flex; gap: 0.35rem; align-items: center; background: rgba(0, 0, 0, 0.12); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.03);">
                    <span class="op-label" style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Snorkel</span>
                    <span class="dive-site-status ${cond.status.snorkel}" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${cond.status.snorkel === "na" ? "N/A" : cond.status.snorkel.toUpperCase()}</span>
                </div>
            `;
        } else {
            // South Shore
            badgesHtml = `
                <div class="op-badge-group" style="display: flex; gap: 0.35rem; align-items: center; background: rgba(0, 0, 0, 0.12); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.03);">
                    <span class="op-label" style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Snorkel</span>
                    <span class="dive-site-status ${cond.status.snorkel}" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${cond.status.snorkel === "na" ? "N/A" : cond.status.snorkel.toUpperCase()}</span>
                </div>
                <div class="op-badge-group" style="display: flex; gap: 0.35rem; align-items: center; background: rgba(0, 0, 0, 0.12); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.03);">
                    <span class="op-label" style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">SCUBA</span>
                    <span class="dive-site-status ${cond.status.dive}" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${cond.status.dive === "na" ? "N/A" : cond.status.dive.toUpperCase()}</span>
                </div>
            `;
        }

        const badgesWrapper = badgesHtml ? `
            <div class="site-badges-row" style="display: flex; gap: 0.75rem; margin-top: 0.25rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                ${badgesHtml}
            </div>
        ` : "";

        const item = document.createElement("div");
        item.className = "dive-site-item";
        item.innerHTML = `
            <div class="dive-site-header">
                <span class="dive-site-name">${site.name}</span>
                <span class="dive-site-type-badge">${site.type}</span>
            </div>
            ${badgesWrapper}
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
            overallBadge.textContent = "Excellent Conditions";
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

        // Find continuous periods above thresholds (field-calibrated 2026-07-12)
        const floodingRanges  = findHighWaterRanges(predictions, 3.0, surge).filter(filterPastRanges);
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
    const container = document.getElementById("transit-comfort-container");
    if (!container) return;

    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const swellPeriod = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.dpd_s : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed   = data.model_wind ? data.model_wind.direction_deg : null;
    const windCompass      = data.model_wind ? data.model_wind.direction_compass : "N/A";

    // Period comfort factor — wave steepness ∝ H/T²:
    let periodFactor = 1.0;
    if (swellPeriod !== null) {
        if      (swellPeriod >= 16) periodFactor = 0.50; // Classic groundswell
        else if (swellPeriod >= 14) periodFactor = 0.65; // Good groundswell
        else if (swellPeriod >= 12) periodFactor = 0.80; // Mixed swell
        else if (swellPeriod <=  8) periodFactor = 1.30; // Windswell — steep and disorganized
    }
    const effectiveSwellHeight = (swellHeight || 0) * periodFactor;

    // A. Na Pali Coast dynamic comfort mapping - Southern, Middle, Northern
    if (activeShore === "napali") {
        const nwSwell = latestData.swell_51208 ? latestData.swell_51208.wvht_ft : (swellHeight || 0);
        const sSwell = (latestData.swell && latestData.swell.current_south_shore_estimate) ? latestData.swell.current_south_shore_estimate.wvht_ft : 0;

        // Dynamic southern section label based on launch harbor
        const southernLabel = activeLaunch === "kekaha" ? "Kikiaola to Polihale" : "Port Allen to Polihale";
        // Source note: wind data comes from the harbor-specific NWS grid (projectActiveData resolves this)
        const windSrcLabel = activeLaunch === "kekaha"
            ? "PHBK / NWS HFO/75,174"
            : "NWS HFO/82,171";

        // 1. Southern Section — harbor to Polihale
        // Both harbors sit in deep ENE trade lee, sheltered by the Waimea Canyon ridgeline to the NE.
        // Kikiaola is slightly closer to Polihale and has more complete trade wind shadow.
        const tradeLeeDecay = activeLaunch === "kekaha" ? 0.15 : 0.20; // Kikiaola = deeper lee
        let sWind = windSpeedExposed || 0;
        if (windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110) {
            sWind = sWind * tradeLeeDecay; // Deep trade wind shadow in southern section
        } else if (windDirExposed !== null && (windDirExposed >= 315 || windDirExposed <= 45)) {
            sWind = sWind * 0.70; // 30% reduction on Northerlies
        }
        // Swell: NW swell is wrapped/decayed by 50% reaching this section. South swell is direct.
        const sSwellH = Math.max(nwSwell * 0.50, sSwell);
        const sEffSwellH = sSwellH * periodFactor;
        let sStatus = "smooth";
        if (sEffSwellH >= 4.5 || sWind >= 15) sStatus = "monitor";
        else if (sEffSwellH >= 3.0 || sWind >= 10) sStatus = "choppy";

        // 2. Middle Section (Milolii to Honopu/Kalalau)
        // Wind: Transitional lee (50% speed on trades)
        let mWind = windSpeedExposed || 0;
        if (windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110) {
            mWind = mWind * 0.50; // 50% reduction
        }
        // Swell: NW swell is 100%. South swell is 30% wrapped.
        const mSwellH = Math.max(nwSwell, sSwell * 0.30);
        const mEffSwellH = mSwellH * periodFactor;
        let mStatus = "smooth";
        if (mEffSwellH >= 4.5 || mWind >= 15) mStatus = "monitor";
        else if (mEffSwellH >= 3.0 || mWind >= 10) mStatus = "choppy";

        // 3. Northern Section (Kalalau to Haena)
        // Wind: Fully exposed to wrap-around trades (100% speed)
        let nWind = windSpeedExposed || 0;
        if (windDirExposed !== null && windDirExposed >= 120 && windDirExposed <= 240) {
            nWind = nWind * 0.60; // 40% reduction on Kona winds due to mountain shadow
        }
        // Swell: NW swell is 100%. South swell is 0% blocked.
        const nSwellH = nwSwell;
        const nEffSwellH = nSwellH * periodFactor;
        let nStatus = "smooth";
        if (nEffSwellH >= 4.5 || nWind >= 15) nStatus = "monitor";
        else if (nEffSwellH >= 3.0 || nWind >= 10) nStatus = "choppy";

        // Render HTML for the three sections
        container.innerHTML = `
            <div class="transit-row" style="margin-bottom: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                    <span class="transit-label" style="font-weight: 600;">Southern Section <small style="color: var(--text-muted); font-size: 0.72rem;">(${southernLabel})</small></span>
                    <span style="font-size: 0.68rem; color: var(--text-secondary);">${sWind.toFixed(1)} mph ${windCompass} | ${sSwellH.toFixed(1)} ft Swell <span style="color: var(--text-muted); font-size: 0.62rem;">[${windSrcLabel}]</span></span>
                </div>
                <span class="comfort-badge ${sStatus}">${sStatus === "monitor" ? "Monitor" : sStatus.charAt(0).toUpperCase() + sStatus.slice(1)}</span>
            </div>
            <div class="transit-row" style="margin-bottom: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                    <span class="transit-label" style="font-weight: 600;">Middle Section <small style="color: var(--text-muted); font-size: 0.72rem;">(Milolii to Honopu)</small></span>
                    <span style="font-size: 0.68rem; color: var(--text-secondary);">${mWind.toFixed(1)} mph ${windCompass} | ${mSwellH.toFixed(1)} ft Swell</span>
                </div>
                <span class="comfort-badge ${mStatus}">${mStatus === "monitor" ? "Monitor" : mStatus.charAt(0).toUpperCase() + mStatus.slice(1)}</span>
            </div>
            <div class="transit-row">
                <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                    <span class="transit-label" style="font-weight: 600;">Northern Section <small style="color: var(--text-muted); font-size: 0.72rem;">(Kalalau to Haena)</small></span>
                    <span style="font-size: 0.68rem; color: var(--text-secondary);">${nWind.toFixed(1)} mph ${windCompass} | ${nSwellH.toFixed(1)} ft Swell</span>
                </div>
                <span class="comfort-badge ${nStatus}">${nStatus === "monitor" ? "Monitor" : nStatus.charAt(0).toUpperCase() + nStatus.slice(1)}</span>
            </div>
        `;
        return;
    }

    // B. South Shore calculations (sheltered vs exposed)
    // 3-state tidal model: active flooding / slack / active ebbing
    const tideState = computeTideState(data.tides?.predictions);

    // Reverse current: active flood tide pushes West-to-East against ENE trades → standing waves.
    const hasReverseCurrent = tideState.available && tideState.isFlooding && !tideState.isSlack &&
        windSpeedExposed !== null && windSpeedExposed > 12 &&
        windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110;

    // Ebb improvement: ebb runs East-to-West WITH ENE trades → reduces apparent wave steepness.
    const hasEbbImprovement = tideState.available && tideState.isEbbing && !tideState.isSlack &&
        windDirExposed !== null && windDirExposed >= 45 && windDirExposed <= 110;

    // Calculate wind-swell angle difference for transit alignment factor
    let alignmentFactor = 1.0;
    const swellDir = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.mwd_deg : null;
    if (windDirExposed !== null && swellDir !== null) {
        let angleDiff = Math.abs(windDirExposed - swellDir) % 360;
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        alignmentFactor = 1.0 - 0.25 * Math.abs(Math.sin(angleDiff * Math.PI / 180));
    }
    const effWindSpeedExposed = windSpeedExposed !== null ? windSpeedExposed * alignmentFactor : null;

    // West of Makahuena (Poipu / Kukuiula) — sheltered from trades by the point
    let westStatus = "smooth";
    if (hasReverseCurrent) {
        westStatus = "harsh"; // Active flood current opposing ENE trades → standing waves
    } else {
        const ebFactor = hasEbbImprovement ? 1.15 : 1.0; // mild threshold relief on ebb
        if ((effWindSpeedExposed !== null && effWindSpeedExposed > 20) || effectiveSwellHeight >= 5.5 / ebFactor) {
            westStatus = "rough";
        } else if ((effWindSpeedExposed !== null && effWindSpeedExposed > 12) || effectiveSwellHeight >= 3.0 / ebFactor) {
            westStatus = "choppy";
        } else {
            westStatus = "smooth";
        }
    }

    const westText = westStatus === "harsh"  ? "Standing Waves"
        : (westStatus === "smooth" && tideState.available && tideState.isSlack) ? "Smooth (Slack)"
        : westStatus.charAt(0).toUpperCase() + westStatus.slice(1);

    // East of Makahuena (Makahuena to Kipu Kai) — fully exposed, no tidal current shelter
    let eastStatus = "smooth";
    if ((effWindSpeedExposed !== null && effWindSpeedExposed > 20) || effectiveSwellHeight >= 5.5) {
        eastStatus = "harsh";
    } else if ((effWindSpeedExposed !== null && effWindSpeedExposed > 14) || effectiveSwellHeight >= 3.5) {
        eastStatus = "rough";
    } else if ((effWindSpeedExposed !== null && effWindSpeedExposed > 10) || effectiveSwellHeight >= 2.0) {
        eastStatus = "choppy";
    } else {
        eastStatus = "smooth";
    }

    const eastText = eastStatus === "harsh" ? "Very Rough"
        : eastStatus.charAt(0).toUpperCase() + eastStatus.slice(1);

    container.innerHTML = `
        <div class="transit-row" style="margin-bottom: 0.8rem;">
            <span class="transit-label">West of Makahuena <small style="color: var(--text-muted); font-size: 0.72rem;">(Poipu / Kukuiula)</small></span>
            <span class="comfort-badge ${westStatus}">${westText}</span>
        </div>
        <div class="transit-row">
            <span class="transit-label">East of Makahuena <small style="color: var(--text-muted); font-size: 0.72rem;">(Kipu Kai / Lihue)</small></span>
            <span class="comfort-badge ${eastStatus}">${eastText}</span>
        </div>
    `;
}

// ─── Settings Drawer & Region Selector (Section 5) ─────────────────────────────
let latestData = null; // Store latest aggregated payload globally for drawer recalculations

function getThresholdOverrides() {
    return JSON.parse(localStorage.getItem("siteThresholdOverrides") || "{}");
}

function getSiteToleranceAdjustment(siteKey) {
    const overrides = getThresholdOverrides();
    return overrides[siteKey]?.adjustment ?? 0;
}

function getEffectiveThreshold(siteKey, field) {
    const defaults = DEFAULT_THRESHOLDS[siteKey];
    if (!defaults) return null;
    const adjustment = getSiteToleranceAdjustment(siteKey);
    const multiplier = 1.0 + (adjustment / 100);
    return defaults[field] * multiplier;
}

function initSettingsDrawer() {
    const openBtn = document.getElementById("open-settings-btn");
    const closeBtn = document.getElementById("close-settings-btn");
    const overlay = document.getElementById("drawer-overlay");
    const drawer = document.getElementById("settings-drawer");

    const selectIsland = document.getElementById("select-island");
    const selectShore = document.getElementById("select-shore");
    const selectLaunch = document.getElementById("select-launch");
    const launchGroup = document.getElementById("launch-point-group");

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            drawer.classList.add("open");
            overlay.classList.add("open");
            buildToleranceEditor(activeIsland, activeShore);
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            drawer.classList.remove("open");
            overlay.classList.remove("open");
        });
    }
    if (overlay) {
        overlay.addEventListener("click", () => {
            drawer.classList.remove("open");
            overlay.classList.remove("open");
        });
    }

    function populateSelectors() {
        if (!selectIsland || !selectShore) return;
        
        // Island
        selectIsland.innerHTML = "";
        Object.keys(REGIONS).forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = REGIONS[key].label;
            selectIsland.appendChild(opt);
        });
        selectIsland.value = activeIsland;

        // Shore
        populateShores();
        selectShore.value = activeShore;

        // Launch
        populateLaunches();
        if (selectLaunch) selectLaunch.value = activeLaunch;
    }

    function populateShores() {
        const island = selectIsland.value;
        selectShore.innerHTML = "";
        const shores = REGIONS[island]?.shores || {};
        Object.keys(shores).forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = shores[key].label;
            selectShore.appendChild(opt);
        });
    }

    function populateLaunches() {
        const island = selectIsland.value;
        const shore = selectShore.value;
        const lp = REGIONS[island]?.shores?.[shore]?.launchPoints || {};
        const keys = Object.keys(lp);
        if (keys.length > 1) {
            launchGroup.style.display = "block";
            selectLaunch.innerHTML = "";
            keys.forEach(key => {
                const opt = document.createElement("option");
                opt.value = key;
                opt.textContent = lp[key].label;
                selectLaunch.appendChild(opt);
            });
            if (!keys.includes(activeLaunch)) {
                activeLaunch = keys[0];
                localStorage.setItem("selectedLaunch", activeLaunch);
            }
        } else {
            launchGroup.style.display = "none";
            activeLaunch = keys[0] || "";
            localStorage.setItem("selectedLaunch", activeLaunch);
        }
    }

    if (selectIsland) {
        selectIsland.addEventListener("change", () => {
            activeIsland = selectIsland.value;
            localStorage.setItem("selectedIsland", activeIsland);
            populateShores();
            activeShore = selectShore.value;
            localStorage.setItem("selectedShore", activeShore);
            populateLaunches();
            if (selectLaunch) activeLaunch = selectLaunch.value;
            buildToleranceEditor(activeIsland, activeShore);
            if (latestData) updateDashboard(latestData);
        });
    }

    if (selectShore) {
        selectShore.addEventListener("change", () => {
            activeShore = selectShore.value;
            localStorage.setItem("selectedShore", activeShore);
            populateLaunches();
            if (selectLaunch) activeLaunch = selectLaunch.value;
            buildToleranceEditor(activeIsland, activeShore);
            if (latestData) updateDashboard(latestData);
        });
    }

    if (selectLaunch) {
        selectLaunch.addEventListener("change", () => {
            activeLaunch = selectLaunch.value;
            localStorage.setItem("selectedLaunch", activeLaunch);
            if (latestData) updateDashboard(latestData);
        });
    }

    populateSelectors();
    buildToleranceEditor(activeIsland, activeShore);
}

const NUMERIC_TOLERANCE_TYPES = new Set(['boat', 'shore', 'snorkel']);

function buildToleranceEditor(islandKey, shoreKey) {
    const toleranceList = document.getElementById("tolerance-list");
    if (!toleranceList) return;
    toleranceList.innerHTML = '';
    
    const sites = REGIONS[islandKey]?.shores?.[shoreKey]?.sites || {};
    Object.entries(sites).forEach(([siteKey, site]) => {
        if (!NUMERIC_TOLERANCE_TYPES.has(site.type) || !DEFAULT_THRESHOLDS[siteKey]) {
            renderPendingCard(toleranceList, siteKey, site);
            return;
        }
        renderEditableCard(toleranceList, siteKey, site);
    });
}

function renderPendingCard(container, siteKey, site) {
    const card = document.createElement("div");
    card.className = "tolerance-card";
    card.innerHTML = `
        <div class="tolerance-card-header">
            <span class="tolerance-card-title">${site.label}</span>
            <span class="dive-site-type-badge" style="font-size: 0.6rem;">${site.type.toUpperCase()}</span>
        </div>
        <div class="tolerance-pending-text">
            Pending operator tolerance input.
        </div>
    `;
    container.appendChild(card);
}

function renderEditableCard(container, siteKey, site) {
    const adjustment = getSiteToleranceAdjustment(siteKey);

    const card = document.createElement("div");
    card.className = "tolerance-card";
    card.innerHTML = `
        <div class="tolerance-card-header">
            <span class="tolerance-card-title">${site.label}</span>
            <button class="tolerance-reset-btn" data-site="${siteKey}">Reset</button>
        </div>
        <div class="tolerance-slider-container">
            <div class="tolerance-slider-header">
                <span>Threshold Sensitivity</span>
                <span class="tolerance-slider-value" id="val-${siteKey}">${adjustment > 0 ? '+' : ''}${adjustment}%${adjustment === 0 ? ' (Default)' : ''}</span>
            </div>
            <input type="range" class="tolerance-slider" data-site="${siteKey}" min="-20" max="20" step="10" value="${adjustment}">
            <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--text-muted); margin-top: 0.25rem;">
                <span>More Sensitive (-20%)</span>
                <span>Default (0%)</span>
                <span>Less Sensitive (+20%)</span>
            </div>
        </div>
    `;
    container.appendChild(card);

    const slider = card.querySelector(".tolerance-slider");
    const valDisplay = card.querySelector(`#val-${siteKey}`);

    slider.addEventListener("input", () => {
        const val = parseInt(slider.value, 10);
        valDisplay.textContent = `${val > 0 ? '+' : ''}${val}%${val === 0 ? ' (Default)' : ''}`;
    });

    slider.addEventListener("change", () => {
        const val = parseInt(slider.value, 10);
        const currentOverrides = getThresholdOverrides();
        if (!currentOverrides[siteKey]) currentOverrides[siteKey] = {};
        currentOverrides[siteKey].adjustment = val;
        localStorage.setItem("siteThresholdOverrides", JSON.stringify(currentOverrides));
        if (latestData) updateDashboard(latestData);
    });

    card.querySelector(".tolerance-reset-btn").addEventListener("click", () => {
        const currentOverrides = getThresholdOverrides();
        delete currentOverrides[siteKey];
        localStorage.setItem("siteThresholdOverrides", JSON.stringify(currentOverrides));
        
        // Rebuild tolerance inputs and re-render dashboard
        buildToleranceEditor(activeIsland, activeShore);
        if (latestData) updateDashboard(latestData);
    });
}

function projectActiveData(rawData) {
    const activeData = {
        last_updated: rawData.last_updated,
        cdip_health: rawData.cdip_health,
        model_wind: rawData.model_wind
    };

    if (activeShore === "south") {
        activeData.wind = rawData.wind;
        activeData.swell = rawData.swell;
        activeData.tides = rawData.tides;
        activeData.forecast_text = rawData.forecast_text;
    } else if (activeShore === "napali") {
        // 1. Wind: map based on selected launch point
        //    - Kikiaola: PHBK METAR (PMRF Barking Sands) as primary; NWS grid HFO/75,174 as model
        //    - Port Allen: NWS grid HFO/82,171 as primary harbor wind; same grid as model
        //    OLD behavior used south shore Koloa PWS stations — not valid for this coast.
        const metar = rawData.metar_phbk;
        const gridPA = rawData.model_wind_port_allen;
        const gridKik = rawData.model_wind_kikiaola;

        if (activeLaunch === "kekaha") {
            // Kikiaola: PHBK ASOS is the real observed wind at the harbor
            const src = metar || gridKik;
            if (src) {
                activeData.wind = {
                    stations: [{ id: "PHBK", role: "PMRF Barking Sands ASOS", speed_mph: src.speed_mph, direction_deg: src.direction_deg, gust_mph: src.gust_mph || null, status: "Online" }],
                    num_stations: 1,
                    average_speed_mph: src.speed_mph,
                    vector_average_speed_mph: src.speed_mph,
                    average_direction_deg: src.direction_deg,
                    average_direction_compass: src.direction_compass || degToCompass(src.direction_deg),
                    direction_reliable: true,
                    note: metar ? `METAR PHBK (PMRF Barking Sands, Kekaha) — ${metar.raw_metar}` : "NWS grid HFO/75,174 — Kikiaola area"
                };
            } else {
                activeData.wind = null;
            }
            // Model wind: Kikiaola NWS grid (HFO/75,174)
            // If harbor-specific grid is unavailable, surface null rather than the south shore Koloa grid.
            // Wrong data (Koloa/Poipu) is worse than missing data on the Na Pali tab.
            activeData.model_wind = gridKik || null;
        } else {
            // Port Allen: NWS grid HFO/82,171 is the best available source directly over the harbor
            const src = gridPA;
            if (src) {
                activeData.wind = {
                    stations: [{ id: "NWS-HFO/82,171", role: "NWS Grid Port Allen", speed_mph: src.speed_mph, direction_deg: src.direction_deg, gust_mph: null, status: "Online" }],
                    num_stations: 1,
                    average_speed_mph: src.speed_mph,
                    vector_average_speed_mph: src.speed_mph,
                    average_direction_deg: src.direction_deg,
                    average_direction_compass: src.direction_compass || degToCompass(src.direction_deg),
                    direction_reliable: true,
                    note: "NWS gridded forecast HFO/82,171 — directly over Port Allen Harbor"
                };
            } else {
                activeData.wind = null;
            }
            // Model wind: Port Allen NWS grid (HFO/82,171) — same point, used for coastline column
            // If harbor-specific grid is unavailable, surface null rather than the south shore Koloa grid.
            activeData.model_wind = gridPA || null;
        }

        // 2. Swell: map Buoy 51208 direct reading
        if (rawData.swell_51208) {
            const s51208 = rawData.swell_51208;
            activeData.swell = {
                current_south_shore_estimate: {
                    obs_time_utc: s51208.obs_time_utc,
                    wvht_ft: s51208.wvht_ft,
                    dpd_s: s51208.dpd_s,
                    mwd_deg: s51208.mwd_deg,
                    mwd_compass: s51208.mwd_compass,
                    lag_hours: 0.0,
                    lag_confidence: "high"
                },
                agreement: {
                    confirmed: true,
                    direction_diff_deg: 0,
                    height_diff_ft: 0
                },
                trend_next_several_hours: "holding steady"
            };
        } else {
            activeData.swell = null;
        }

        // 3. Tides: map selected launch point
        if (activeLaunch === "kekaha") {
            activeData.tides = rawData.tides_1611401 ? {
                predictions: rawData.tides_1611401.predictions || [],
                observations: (rawData.tides_1611401.observations || []).slice(-24),
                surge_ft: rawData.tides_1611401.tide_surge_ft
            } : null;
        } else { // default to portAllen
            activeData.tides = rawData.tides_1611347 ? {
                predictions: rawData.tides_1611347.predictions || [],
                observations: (rawData.tides_1611347.observations || []).slice(-24),
                surge_ft: rawData.tides_1611347.tide_surge_ft
            } : null;
        }

        // 4. Forecast
        let phz110 = rawData.forecast_text_110 || "PHZ110 Forecast unavailable.";
        let phz111 = rawData.forecast_text_111 || "PHZ111 Forecast unavailable.";
        activeData.forecast_text = `${phz110}\n\n========================================\nHAENA-END CONDITIONS CROSS-REFERENCE (PHZ111)\n========================================\n${phz111}`;
    }

    return activeData;
}

function updateNapaliSwellWidgets(data, rawData) {
    // 1. Card 1: Transit Swell (Northwest) from Buoy 51208
    if (rawData.swell_51208) {
        const tSwell = rawData.swell_51208;
        document.getElementById("napali-transit-height").textContent = tSwell.wvht_ft ? tSwell.wvht_ft.toFixed(1) : "--.-";
        document.getElementById("napali-transit-period").textContent = tSwell.dpd_s ? `${Math.round(tSwell.dpd_s)}s` : "--s";
        
        const compassDir = tSwell.mwd_compass || "N/A";
        const degDir = tSwell.mwd_deg !== undefined ? `${Math.round(tSwell.mwd_deg)}°` : "---°";
        document.getElementById("napali-transit-dir").textContent = `${degDir} ${compassDir}`;
        document.getElementById("napali-transit-dir-abbr").textContent = compassDir;
        document.getElementById("napali-transit-dir-deg").textContent = degDir;
    } else {
        document.getElementById("napali-transit-height").textContent = "--.-";
    }

    // 2. Card 2: Harbor Swell (South) from South Shore estimate (Buoy 51212/51213)
    if (rawData.swell && rawData.swell.current_south_shore_estimate) {
        const hSwell = rawData.swell.current_south_shore_estimate;
        document.getElementById("napali-harbor-swell-height").textContent = hSwell.wvht_ft ? hSwell.wvht_ft.toFixed(1) : "--.-";
        document.getElementById("napali-harbor-swell-period").textContent = hSwell.dpd_s ? `${Math.round(hSwell.dpd_s)}s` : "--s";
        
        const compassDir = hSwell.mwd_compass || "N/A";
        const degDir = hSwell.mwd_deg !== undefined ? `${Math.round(hSwell.mwd_deg)}°` : "---°";
        document.getElementById("napali-harbor-swell-dir").textContent = `${degDir} ${compassDir}`;
        document.getElementById("napali-harbor-swell-dir-abbr").textContent = compassDir;
        document.getElementById("napali-harbor-swell-dir-deg").textContent = degDir;
    } else {
        document.getElementById("napali-harbor-swell-height").textContent = "--.-";
    }

    // Trend badges
    const trendText = rawData.swell ? (rawData.swell.trend_next_several_hours || "") : "";
    const getTrendClass = (text) => {
        if (text.includes("building")) return "trend-badge building";
        if (text.includes("dropping")) return "trend-badge dropping";
        return "trend-badge holding";
    };
    const getTrendLabel = (text) => {
        if (text.includes("building")) return "Building";
        if (text.includes("dropping")) return "Dropping";
        return "Holding";
    };

    const transitTrend = document.getElementById("napali-transit-trend");
    if (transitTrend) {
        transitTrend.className = getTrendClass(trendText);
        transitTrend.textContent = getTrendLabel(trendText);
        transitTrend.title = trendText;
    }
    const harborTrend = document.getElementById("napali-harbor-swell-trend");
    if (harborTrend) {
        harborTrend.className = getTrendClass(trendText);
        harborTrend.textContent = getTrendLabel(trendText);
        harborTrend.title = trendText;
    }

    // 3. Card 3: Harbor Tides
    const activeTideData = data.tides;
    const tideTitle = document.getElementById("napali-tide-title");
    if (tideTitle) {
        tideTitle.textContent = activeLaunch === "kekaha" ? "Kikiaola Harbor Tides" : "Port Allen Tides";
    }

    if (activeTideData) {
        renderTideSVG(activeTideData.predictions, activeTideData.observations, "napali-tide-svg");
        findAndRenderExtremes(activeTideData.predictions, "napali-tide-extremes");
        
        const surgeBadge = document.getElementById("napali-tide-surge-badge");
        if (surgeBadge) {
            // Kikiaola is a very protected harbor — surge is not a meaningful safety factor here.
            // Port Allen faces open water and is relevant for surge monitoring.
            if (activeLaunch === "kekaha") {
                surgeBadge.style.display = "none";
            } else {
                surgeBadge.style.display = "";
                const surgeVal = activeTideData.surge_ft;
                if (surgeVal !== null && surgeVal !== undefined) {
                    const sign = surgeVal >= 0 ? "+" : "";
                    surgeBadge.textContent = `Surge: ${sign}${surgeVal.toFixed(2)} ft`;
                    if (Math.abs(surgeVal) >= 0.5) {
                        surgeBadge.style.background = "rgba(255, 107, 107, 0.12)";
                        surgeBadge.style.color = "var(--accent-sunset)";
                    } else if (Math.abs(surgeVal) >= 0.25) {
                        surgeBadge.style.background = "rgba(244, 208, 104, 0.12)";
                        surgeBadge.style.color = "var(--accent-gold)";
                    } else {
                        surgeBadge.style.background = "rgba(6, 214, 160, 0.12)";
                        surgeBadge.style.color = "var(--accent-teal)";
                    }
                } else {
                    surgeBadge.textContent = "Surge: Offline";
                    surgeBadge.style.background = "rgba(255, 255, 255, 0.05)";
                    surgeBadge.style.color = "var(--text-secondary)";
                }
            }
        }
    }

    // 4. Card 4: Harbor Alerts
    updateNapaliHarborAlerts(rawData);
}

function updateNapaliHarborAlerts(rawData) {
    const container = document.getElementById("napali-harbor-alerts-container");
    if (!container) return;
    container.innerHTML = "";

    const alerts = [];
    const activeTideData = activeLaunch === "kekaha" ? rawData.tides_1611401 : rawData.tides_1611347;
    const hSwell = rawData.swell ? rawData.swell.current_south_shore_estimate : null;
    const swellHeight = hSwell ? hSwell.wvht_ft : 0;



    if (activeLaunch === "kekaha") {
        if (swellHeight >= 4.0) {
            alerts.push({
                type: "danger",
                text: `⚠ CHANNEL DANGER: Large South swell (${swellHeight.toFixed(1)}ft) is creating dangerous breaking waves across the Kikiaola entrance channel. Do not transit.`
            });
        } else if (swellHeight >= 2.5) {
            alerts.push({
                type: "caution",
                text: `⚠ CHANNEL CAUTION: Moderate South swell (${swellHeight.toFixed(1)}ft) creating breaking waves at the Kikiaola rivermouth. Extreme caution advised.`
            });
        } else {
            alerts.push({
                type: "normal",
                text: `✓ Kikiaola Harbor entrance channel is clear. South swell is low (${swellHeight.toFixed(1)}ft).`
            });
        }
    } else { // portAllen
        if (swellHeight >= 5.0) {
            alerts.push({
                type: "danger",
                text: `⚠ DOCK DANGER: Large South swell (${swellHeight.toFixed(1)}ft) causing severe surge at Port Allen commercial pier. Lines chafing and heavy vessel movement expected.`
            });
        } else if (swellHeight >= 3.0) {
            alerts.push({
                type: "caution",
                text: `⚠ DOCK CAUTION: Moderate South swell (${swellHeight.toFixed(1)}ft) causing surge at Port Allen pier and public ramp. Monitor lines closely.`
            });
        } else {
            alerts.push({
                type: "normal",
                text: `✓ Port Allen commercial pier and public boat ramp clear. Harbor surge is minimal.`
            });
        }
    }

    alerts.forEach(alert => {
        const item = document.createElement("div");
        item.className = "harbor-alert-item";
        item.style.marginBottom = "0.5rem";
        
        let color = "var(--text-secondary)";
        let iconHtml = "✓";
        if (alert.type === "danger") {
            color = "var(--accent-sunset)";
            iconHtml = "⚠";
        } else if (alert.type === "caution") {
            color = "var(--accent-gold)";
            iconHtml = "⚠";
        } else {
            color = "var(--accent-teal)";
        }

        item.innerHTML = `
            <span class="harbor-alert-icon" style="color: ${color}; font-weight: bold; margin-right: 0.5rem;">${iconHtml}</span>
            <span class="harbor-alert-text" style="color: ${color}; font-size: 0.85rem; line-height: 1.4;">${alert.text}</span>
        `;
        container.appendChild(item);
    });
}

