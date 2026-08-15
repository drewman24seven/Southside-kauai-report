import { getBearing, degToCompass, groupVelocityKmh, computeLagHours, formatHST, parsePredictionTime, getHSTDateStr, getHSTMinutes, getThresholdOverrides, getSiteToleranceAdjustment, getEffectiveThreshold, findSiteInConfig, calculateDynamicLeeDecay, getWindExposure } from "./js/core/utils.js";
import { REGIONS } from './js/configs/regions.js';

import { state } from './js/core/state.js';
import { fetchConditions } from './js/core/api.js';
import { updateHarborAlerts } from './js/widgets/harbor.js';
import { updateDiveSites, updateTransitComfort } from './js/widgets/dive.js';
import { analyzeSwell, updateNapaliSwellWidgets, toggleSwellWidgetsVisibility } from './js/widgets/swell.js';


import { computeTideState, renderTideSVG, findAndRenderExtremes } from './js/widgets/tides.js';


var loadingInterval = null;
var latestData = null;


import { buildDynamicWindWidget } from './js/widgets/wind.js';


// ─── Constants & Configurations ───────────────────────────────────────────────

// Safety thresholds based on site type




// Master configurations for all islands

// State Variables




// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    fetchAll();
    initMobileTabs();
    initSettingsDrawer(); // Initialize settings drawer UI and events (Section 5)
    setInterval(fetchAll, 600000); // auto-refresh every 10 minutes
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









function stopFunLoading() {
    if (loadingInterval) clearInterval(loadingInterval);
}

// ─── Main Fetch Orchestrator ──────────────────────────────────────────────────
async function fetchAll() {
    startFunLoading();
    try {
        const data = await fetchConditions(state.activeIsland, state.activeShore);
        stopFunLoading();
        updateDashboard(data);
    } catch (e) {
        stopFunLoading();
        console.error("Critical error in fetchAll:", e);
        if (window.OFFLINE_DATA && window.OFFLINE_DATA.islands) {
            try {
                updateDashboard(window.OFFLINE_DATA);
                return;
            } catch (err) {
                console.error("Fallback updateDashboard failed:", err);
            }
        }
        const lastEl = document.getElementById("last-updated");
        if (lastEl) {
            lastEl.textContent = "Error loading data";
            lastEl.style.color = "var(--accent-sunset)";
        }
    }
}



// ─── Hawaii Time Helpers ──────────────────────────────────────────────────────
// NOAA tide predictions are always in Hawaii Standard Time (UTC-10, no DST).
// Appending -10:00 ensures correct epoch parsing regardless of browser timezone.



// ─── Wind Shadow Decay (single source of truth) ───────────────────────────────
// Estimates Koloa Landing cove wind from offshore NWS model wind.
// Direction-dependent decay accounts for Makahuena Point's lee shadow.
// shadowDecayConfig: { defaultDecay: N, segments: [{ dirMin, dirMax, decay }, ...] }
// Pass from REGIONS[state.activeIsland].shores[state.activeShore].shadowDecay
// Falls back to generic Kauai South values if config is missing (backward compat)
function estimateCoveWindFromModel(modelWind, shadowDecayConfig) {
    if (!modelWind || modelWind.speed_mph === undefined) return null;
    const mwDir = modelWind.direction_deg ?? 90;
    const cfg = shadowDecayConfig || { defaultDecay: 0.60, segments: [
        { dirMin: 45, dirMax: 110, decay: 0.30 },
        { dirMin: 135, dirMax: 225, decay: 0.90 }
    ]};
    let decayCoeff = cfg.defaultDecay;
    for (const seg of (cfg.segments || [])) {
        if (mwDir >= seg.dirMin && mwDir <= seg.dirMax) {
            decayCoeff = seg.decay;
            break;
        }
    }
    return modelWind.speed_mph * decayCoeff;
}

// ─── 3-State Tidal Model ──────────────────────────────────────────────────────
// Returns { isFlooding, isEbbing, isSlack, available }.
// Slack is detected via rate-of-change of water level: tidal current ∝ dh/dt,
// so near-zero slope at high/low tide = near-zero current = slack water.
// This prevents false standing-wave alerts at the top and bottom of each cycle.




function updateDashboard(rawData) {
    latestData = rawData;

    // Update Dynamic Header & Meta labels (Section 5a)
    const headerTitle = document.querySelector(".header-logo h1");
    const islandBadge = document.querySelector(".header-logo .island-badge");
    const locationVal = document.querySelector(".header-meta .meta-item .meta-val");
    const zoneBadge = document.querySelector(".forecast-card .zone-badge");
    const forecastFooter = document.querySelector(".forecast-card .card-footer .footer-note");

    const islandConfig = REGIONS[state.activeIsland];
    const shoreConfig = islandConfig?.shores?.[state.activeShore];
    
    if (islandConfig && shoreConfig) {
        if (islandBadge) islandBadge.textContent = islandConfig.label;
        let activeLabel = shoreConfig.label;
        if (state.activeShore === "napali") {
            const harborLabel = state.activeLaunch === "kekaha" ? "Kikiaola" : "Port Allen";
            if (headerTitle) {
                headerTitle.innerHTML = `${activeLabel} <span class="accent-text">Marine Report</span> <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: normal; margin-left: 0.5rem; display: inline-block; vertical-align: middle;">— ${harborLabel}</span>`;
            }
        } else {
            if (headerTitle) {
                headerTitle.innerHTML = `${islandConfig.label} ${activeLabel} <span class="accent-text">Marine Report</span>`;
            }
        }
        if (locationVal) locationVal.textContent = shoreConfig.locationRange || "";
        if (zoneBadge) zoneBadge.textContent = shoreConfig.zoneId || "";
        if (forecastFooter) forecastFooter.textContent = `${islandConfig.label} ${activeLabel} (${shoreConfig.zoneId}) Forecast Text`;
    }

    const data = projectActiveData(rawData);

    // 1. Last Updated and Small Craft Advisory (SCA)
    const lastUpdatedDt = data.last_updated;
    const lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = formatHST(lastUpdatedDt);
        lastUpdatedEl.style.color = "";
    }
    
    const scaBadge = document.getElementById("sca-badge");
    const forecastText = data.forecast_text ? data.forecast_text.toUpperCase() : "";
    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windSpeedKnots = data.model_wind ? data.model_wind.speed_knots : null; // used for NWS SCA threshold (25 KT)

    let scaActive = forecastText.includes("SMALL CRAFT ADVISORY");
    if (windSpeedKnots !== null && windSpeedKnots >= 25) scaActive = true; // NWS SCA threshold: 25 KT
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
    
    if (state.activeShore !== "napali") {
        toggleSwellWidgetsVisibility();
        
        if (data.swell && data.swell.current_south_shore_estimate) {
            const est = data.swell.current_south_shore_estimate;
            
            // Primary Swell (Groundswell)
            if (est.primary_swell && est.primary_swell.height_ft !== undefined) {
                document.getElementById("swell-height").textContent = est.primary_swell.height_ft.toFixed(1);
                document.getElementById("swell-period").textContent = est.primary_swell.period_s ? `${Math.round(est.primary_swell.period_s)}s` : "--s";
                const pCompass = est.primary_swell.compass || "N/A";
                const pDeg = est.primary_swell.direction_deg !== undefined ? `${Math.round(est.primary_swell.direction_deg)}°` : "---°";
                document.getElementById("swell-dir").textContent = `${pDeg} ${pCompass}`;
            } else {
                document.getElementById("swell-height").textContent = est.wvht_ft ? est.wvht_ft.toFixed(1) : "--.-";
                document.getElementById("swell-period").textContent = est.dpd_s ? `${Math.round(est.dpd_s)}s` : "--s";
                const compassDir = est.mwd_compass || "N/A";
                const degDir = est.mwd_deg !== undefined ? `${Math.round(est.mwd_deg)}°` : "---°";
                document.getElementById("swell-dir").textContent = `${degDir} ${compassDir}`;
            }

            // Wind Wave (Secondary)
            const windWaveContainer = document.getElementById("wind-wave-container");
            if (est.wind_wave && est.wind_wave.height_ft !== undefined && windWaveContainer) {
                windWaveContainer.style.display = "flex";
                document.getElementById("wind-wave-height").textContent = est.wind_wave.height_ft.toFixed(1);
                document.getElementById("wind-wave-period").textContent = est.wind_wave.period_s ? `${Math.round(est.wind_wave.period_s)}s` : "--s";
                const wCompass = est.wind_wave.compass || "N/A";
                const wDeg = est.wind_wave.direction_deg !== undefined ? `${Math.round(est.wind_wave.direction_deg)}°` : "---°";
                document.getElementById("wind-wave-dir").textContent = `${wDeg} ${wCompass}`;
            } else if (windWaveContainer) {
                windWaveContainer.style.display = "none";
            }
            
            document.getElementById("swell-lag").textContent = est.lag_hours !== undefined ? `${est.lag_hours.toFixed(2)}h` : "-.--h";
            
            const confBadge = document.getElementById("swell-conf");
            const confVal = (est.lag_confidence || "low").toLowerCase();
            let profileText = "Mixed";
            if (confVal === "high") profileText = "Groundswell";
            else if (confVal === "medium") profileText = "Mixed Swell";
            
            confBadge.textContent = profileText;
            confBadge.className = `sub-val confidence-${confVal}`;

            // Swell agreement
            const verifyLabel = document.getElementById("swell-verify");
            if (data.swell.agreement) {
                const agr = data.swell.agreement;
                if (agr.confirmed) {
                    verifyLabel.innerHTML = `✓ Swell confirmed by verification buoy (Dir diff: ${agr.direction_diff_deg}°, Ht diff: ${agr.height_diff_ft} ft)`;
                    verifyLabel.style.color = "var(--accent-teal)";
                } else {
                    verifyLabel.innerHTML = `ℹ Local Variance: Buoy delta reflects localized wave profiles (Dir diff: ${agr.direction_diff_deg}°, Ht diff: ${agr.height_diff_ft} ft)`;
                    verifyLabel.style.color = "var(--accent-gold)";
                }
            } else {
                verifyLabel.textContent = "Verification buoy unreachable this run.";
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

    // 3. Wind Card (Multi-Zone Wind Report)
    buildDynamicWindWidget(data, state.activeIsland, state.activeShore, state.activeLaunch);

    // 4. Tide Card (Standard Shore)
    if (state.activeShore !== "napali" && data.tides) {
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

    // 7. Harbor Dock & Ramp Alerts
    if (state.activeShore !== "napali") {
        updateHarborAlerts(data);
    }

    // 8. Transit Comfort Levels (West vs. East of Makahuena)
    updateTransitComfort(data);
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
            buildToleranceEditor(state.activeIsland, state.activeShore);
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
        selectIsland.value = state.activeIsland;

        // Shore
        populateShores();
        selectShore.value = state.activeShore;

        // Launch
        populateLaunches();
        if (selectLaunch) selectLaunch.value = state.activeLaunch;
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
            if (!keys.includes(state.activeLaunch)) {
                state.setActiveLaunch(keys[0]);
                localStorage.setItem("selectedLaunch", state.activeLaunch);
            }
        } else {
            launchGroup.style.display = "none";
            state.setActiveLaunch(keys[0] || "");
            localStorage.setItem("selectedLaunch", state.activeLaunch);
        }
    }

    if (selectIsland) {
        selectIsland.addEventListener("change", () => {
            state.setActiveIsland(selectIsland.value);
            localStorage.setItem("selectedIsland", state.activeIsland);
            populateShores();
            state.setActiveShore(selectShore.value);
            localStorage.setItem("selectedShore", state.activeShore);
            populateLaunches();
            if (selectLaunch) state.setActiveLaunch(selectLaunch.value);
            buildToleranceEditor(state.activeIsland, state.activeShore);
            fetchAll();
        });
    }

    if (selectShore) {
        selectShore.addEventListener("change", () => {
            state.setActiveShore(selectShore.value);
            localStorage.setItem("selectedShore", state.activeShore);
            populateLaunches();
            if (selectLaunch) state.setActiveLaunch(selectLaunch.value);
            buildToleranceEditor(state.activeIsland, state.activeShore);
            fetchAll();
        });
    }

    if (selectLaunch) {
        selectLaunch.addEventListener("change", () => {
            state.setActiveLaunch(selectLaunch.value);
            localStorage.setItem("selectedLaunch", state.activeLaunch);
            if (latestData) updateDashboard(latestData);
        });
    }

    const selectVesselType = document.getElementById("select-vessel-type");
    const rangeVesselLength = document.getElementById("range-vessel-length");
    const labelVesselLength = document.getElementById("vessel-length-val");

    if (selectVesselType) {
        selectVesselType.value = state.vesselConfig.type;
        selectVesselType.addEventListener("change", () => {
            state.vesselConfig.type = selectVesselType.value;
            localStorage.setItem("vesselType", state.vesselConfig.type);
            if (latestData) updateDashboard(latestData);
        });
    }

    if (rangeVesselLength && labelVesselLength) {
        rangeVesselLength.value = state.vesselConfig.length;
        labelVesselLength.textContent = state.vesselConfig.length;
        rangeVesselLength.addEventListener("input", () => {
            labelVesselLength.textContent = rangeVesselLength.value;
        });
        rangeVesselLength.addEventListener("change", () => {
            state.vesselConfig.length = parseInt(rangeVesselLength.value, 10);
            localStorage.setItem("vesselLength", state.vesselConfig.length);
            if (latestData) updateDashboard(latestData);
        });
    }
    
    const toggleProUser = document.getElementById("toggle-pro-user");
    if (toggleProUser) {
        toggleProUser.checked = state.isProUser;
        toggleProUser.addEventListener("change", () => {
            state.isProUser = toggleProUser.checked;
            localStorage.setItem("state.isProUser", state.isProUser);
            if (latestData) updateDashboard(latestData);
        });
    }

    populateSelectors();
    buildToleranceEditor(state.activeIsland, state.activeShore);
}

const NUMERIC_TOLERANCE_TYPES = new Set(['boat', 'shore', 'snorkel']);

function buildToleranceEditor(islandKey, shoreKey) {
    const toleranceList = document.getElementById("tolerance-list");
    if (!toleranceList) return;
    toleranceList.innerHTML = '';
    
    const sites = REGIONS[islandKey]?.shores?.[shoreKey]?.sites || {};
    Object.entries(sites).forEach(([siteKey, site]) => {
        if (!NUMERIC_TOLERANCE_TYPES.has(site.type)) {
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
        buildToleranceEditor(state.activeIsland, state.activeShore);
        if (latestData) updateDashboard(latestData);
    });
}

function projectActiveData(rawData) {
    if (!rawData) return null;

    const island = rawData.islands?.[state.activeIsland];
    const shore = island?.shores?.[state.activeShore];
    
    const activeData = {
        ...rawData,
        last_updated: rawData.last_updated,
        cdip_health: rawData.cdip_health,
        extra_winds: shore?.extra_winds || rawData.extra_winds,
        islands_data: rawData.islands
    };

    if (!shore) {
        // Fallback for backward compatibility/legacy local runs
        if (state.activeIsland === "kauai" && state.activeShore === "south") {
            activeData.wind = rawData.wind;
            activeData.model_wind = rawData.model_wind;
            activeData.swell = rawData.swell;
            activeData.tides = rawData.tides;
            activeData.forecast_text = rawData.forecast_text;
        }
        return activeData;
    }

    // Swell mapping
    activeData.swell = shore.swell;
    activeData.forecast_text = island.forecast_text;

    // Wind mapping based on active launch (Port Allen vs Kukuiula vs Kikiaola)
    const launchPoints = REGIONS[state.activeIsland]?.shores?.[state.activeShore]?.launchPoints || {};
    const lpKey = (state.activeLaunch && launchPoints[state.activeLaunch]) ? state.activeLaunch : Object.keys(launchPoints)[0];
    const lp = lpKey ? launchPoints[lpKey] : null;
    
    if (shore.wind) {
        activeData.wind = shore.wind;
    } else if ((lpKey === "portAllen" || lpKey === "kekaha") && shore.metar_wind) {
        const m = shore.metar_wind;
        activeData.wind = {
            stations: [{ id: m.station, role: `${m.station} ASOS`, speed_mph: m.speed_mph, direction_deg: m.direction_deg, gust_mph: m.gust_mph || null, status: "Online" }],
            num_stations: 1,
            average_speed_mph: m.speed_mph,
            vector_average_speed_mph: m.speed_mph,
            average_direction_deg: m.direction_deg,
            average_direction_compass: m.direction_compass,
            direction_reliable: true,
            note: m.raw_metar ? `METAR ${m.station} — ${m.raw_metar}` : `METAR ASOS ${m.station}`
        };
    } else if (shore.metar_wind) {
        const m = shore.metar_wind;
        activeData.wind = {
            stations: [{ id: m.station, role: `${m.station} ASOS`, speed_mph: m.speed_mph, direction_deg: m.direction_deg, gust_mph: m.gust_mph || null, status: "Online" }],
            num_stations: 1,
            average_speed_mph: m.speed_mph,
            vector_average_speed_mph: m.speed_mph,
            average_direction_deg: m.direction_deg,
            average_direction_compass: m.direction_compass,
            direction_reliable: true,
            note: m.raw_metar ? `METAR ${m.station} — ${m.raw_metar}` : `METAR ASOS ${m.station}`
        };
    } else if (shore.model_wind || rawData.model_wind) {
        const s = shore.model_wind || rawData.model_wind;
        const shoreDecayCfg = shore.shadowDecay;
        const decayedSpeed = estimateCoveWindFromModel(s, shoreDecayCfg);
        const coveSpeed = decayedSpeed !== null ? Math.round(decayedSpeed * 10) / 10 : s.speed_mph;
        
        activeData.wind = {
            stations: [],
            stations_online: 0,
            num_stations: 0,
            average_speed_mph: coveSpeed,
            vector_average_speed_mph: coveSpeed,
            average_direction_deg: s.direction_deg,
            average_direction_compass: s.direction_compass,
            direction_reliable: true,
            is_fallback: true,
            note: `Computed Cove Shadow Model (${s.source})`
        };
    } else {
        activeData.wind = null;
    }

    // Model wind mapping (Sector Grid resolution per launch point)
    if (lpKey === "portAllen" && shore.extra_winds && shore.extra_winds["port_allen"]) {
        activeData.model_wind = shore.extra_winds["port_allen"];
    } else if (lpKey === "kukuiula" && shore.extra_winds && shore.extra_winds["poipu"]) {
        activeData.model_wind = shore.extra_winds["poipu"];
    } else if (shore.model_wind) {
        activeData.model_wind = shore.model_wind;
    } else if (rawData.model_wind) {
        activeData.model_wind = rawData.model_wind;
    }

    // Tides mapping
    if (lp && lp.tideStation && shore.tides && shore.tides[lp.tideStation]) {
        activeData.tides = shore.tides[lp.tideStation];
    } else if (shore.tides) {
        const firstTideStation = Object.keys(shore.tides)[0];
        activeData.tides = shore.tides[firstTideStation];
    } else {
        activeData.tides = null;
    }

    return activeData;
}



function updateNapaliHarborAlerts(rawData) {
    const container = document.getElementById("napali-harbor-alerts-container");
    if (!container) return;
    container.innerHTML = "";

    const alerts = [];
    const activeTideData = state.activeLaunch === "kekaha" ? rawData.tides_1611401 : rawData.tides_1611347;
    const hSwell = rawData.swell ? rawData.swell.current_south_shore_estimate : null;
    const swellHeight = hSwell ? hSwell.wvht_ft : 0;



    if (state.activeLaunch === "kekaha") {
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

// ─── Universal Site Intel Modal Logic (Section 6) ─────────────────────────────
window.sitesLibraryData = null;

async function loadSitesLibrary() {
    if (window.sitesLibraryData) return window.sitesLibraryData;
    try {
        const res = await fetch("sites_library.json");
        if (res.ok) {
            window.sitesLibraryData = await res.json();
            return window.sitesLibraryData;
        }
    } catch (e) {
        console.warn("Could not load sites_library.json, using fallback:", e);
    }
    return null;
}

loadSitesLibrary();

async function openSiteIntelModal(siteKey) {
    const modal = document.getElementById("site-intel-modal");
    const overlay = document.getElementById("site-intel-overlay");
    const titleEl = document.getElementById("modal-site-title");
    const contentEl = document.getElementById("modal-site-content");

    if (!modal || !overlay || !contentEl) return;

    const lib = await loadSitesLibrary();
    const siteData = lib?.islands?.[state.activeIsland]?.[state.activeShore]?.[siteKey] || REGIONS[state.activeIsland]?.shores?.[state.activeShore]?.sites?.[siteKey];

    const siteLabel = siteData?.label || siteKey;
    if (titleEl) titleEl.textContent = siteLabel;

    if (!siteData) {
        contentEl.innerHTML = `<div class="intel-section"><p style="color: var(--text-secondary); margin:0;">Hydrodynamic profile for ${siteLabel} is loading...</p></div>`;
    } else {
        const typeProper = (siteData.type || "boat").toUpperCase();
        const depth = siteData.depth_profile || { min_ft: 20, max_ft: 50, reef_floor_ft: 40 };
        const substrate = siteData.substrate || "Coral Reef & Volcanic Basalt";
        const expScale = siteData.exposure_scale !== undefined ? siteData.exposure_scale : 1.00;
        const orbMult = siteData.orbital_velocity_multiplier !== undefined ? siteData.orbital_velocity_multiplier : 1.00;
        const description = siteData.description || "Active Hawaiian dive/snorkel site.";
        const coordsStr = siteData.coords ? `${siteData.coords[0].toFixed(3)}°N, ${Math.abs(siteData.coords[1]).toFixed(3)}°W` : "N/A";

        let shadowsHtml = "";
        if (siteData.shadow_windows && siteData.shadow_windows.length) {
            shadowsHtml = siteData.shadow_windows.map(s => 
                `<div class="intel-stat-box"><span class="intel-stat-label">${s.label} (${s.dirMin}°–${s.dirMax}°)</span><span class="intel-stat-val" style="color:var(--accent-teal);">${Math.round((1 - s.multiplier) * 100)}% Height Reduction</span></div>`
            ).join("");
        } else {
            shadowsHtml = `<div class="intel-stat-box"><span class="intel-stat-label">Swell Shadowing</span><span class="intel-stat-val">Unshadowed / Open Ocean</span></div>`;
        }

        let shelterHtml = "";
        if (siteData.mountain_shelter_window) {
            const m = siteData.mountain_shelter_window;
            shelterHtml = `<div class="intel-stat-box"><span class="intel-stat-label">Mountain Shield (${m.label})</span><span class="intel-stat-val" style="color:var(--accent-gold);">${m.dirMin}°–${m.dirMax}° Protection</span></div>`;
        }

        let transitHtml = "";
        if (siteData.required_transit_crossing) {
            transitHtml = `<div class="intel-stat-box"><span class="intel-stat-label">Required Transit Crossing</span><span class="intel-stat-val">${siteData.required_transit_crossing} Leg</span></div>`;
        }

        if (!state.isProUser) {
            contentEl.innerHTML = `
                <div class="intel-section">
                    <div class="intel-section-title">Site Profile & Coordinates</div>
                    <div class="intel-grid">
                        <div class="intel-stat-box"><span class="intel-stat-label">Site Type</span><span class="intel-stat-val">${typeProper}</span></div>
                        <div class="intel-stat-box"><span class="intel-stat-label">GPS Coordinates</span><span class="intel-stat-val">${coordsStr}</span></div>
                    </div>
                </div>
                <div class="intel-section" style="position: relative; overflow: hidden; padding: 2rem; text-align: center; border: 1px solid rgba(244, 208, 104, 0.3); border-radius: 8px; background: rgba(0,0,0,0.3); margin-top: 1rem;">
                    <div style="filter: blur(5px); opacity: 0.3; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;">
                        <p>Live Physics Data</p><p>Refraction Shadows</p><p>Makahuena Transit</p><p>Hydrodynamic Math</p>
                    </div>
                    <div style="position: relative; z-index: 1;">
                        <h3 style="color: var(--accent-gold); margin-top: 0;">Unlock Live Physics Analysis</h3>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">Pro members get access to real-time bathymetric math, localized refraction shadows, and compounding surge warnings.</p>
                        <button style="background: var(--accent-gold); color: #000; font-weight: bold; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">Upgrade to Pro</button>
                    </div>
                </div>
            `;
            overlay.classList.add("active");
            modal.classList.add("active");
            return;
        }

        const liveIntel = (window.currentSiteIntel && window.currentSiteIntel[siteKey]) ? window.currentSiteIntel[siteKey] : [];
        let liveIntelHtml = "";
        if (liveIntel.length > 0) {
            liveIntelHtml = `
                <div class="intel-section" style="border: 1px solid rgba(6, 214, 160, 0.3); background: rgba(6, 214, 160, 0.05);">
                    <div class="intel-section-title" style="color: var(--accent-teal);">Live Physics Analysis</div>
                    <div class="intel-grid" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${liveIntel.map(msg => `<div style="font-size: 0.8rem; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid var(--accent-teal);">⚡ ${msg}</div>`).join("")}
                    </div>
                </div>
            `;
        }

        contentEl.innerHTML = `
            ${liveIntelHtml}
            <div class="intel-section">
                <div class="intel-section-title">Site Profile & Coordinates</div>
                <div class="intel-grid">
                    <div class="intel-stat-box"><span class="intel-stat-label">Site Type</span><span class="intel-stat-val">${typeProper}</span></div>
                    <div class="intel-stat-box"><span class="intel-stat-label">GPS Coordinates</span><span class="intel-stat-val">${coordsStr}</span></div>
                    <div class="intel-stat-box"><span class="intel-stat-label">Depth Range</span><span class="intel-stat-val">${depth.min_ft || depth.entry_ft || 15}ft – ${depth.max_ft || 50}ft (Floor: ${depth.reef_floor_ft || 40}ft)</span></div>
                    <div class="intel-stat-box"><span class="intel-stat-label">Substrate / Terrain</span><span class="intel-stat-val">${substrate}</span></div>
                </div>
            </div>

            <div class="intel-section">
                <div class="intel-section-title">Hydrodynamic Exposure & Orbital Physics</div>
                <div class="intel-grid">
                    <div class="intel-stat-box"><span class="intel-stat-label">Bathymetric Physics Scale</span><span class="intel-stat-val">${expScale} (${Math.round((1 - expScale) * 100)}% tighter limits)</span></div>
                    <div class="intel-stat-box"><span class="intel-stat-label">Seabed Surge Velocity</span><span class="intel-stat-val">${orbMult}x Orbital Surge Factor</span></div>
                    ${shadowsHtml}
                    ${shelterHtml}
                    ${transitHtml}
                </div>
            </div>

            <div class="intel-section">
                <div class="intel-section-title">Hydrodynamic Intel Notes</div>
                <p style="margin: 0; font-size: 0.85rem; color: #fff; line-height: 1.5;">${description}</p>
            </div>
        `;
    }

    modal.classList.add("open");
    overlay.classList.add("open");
}

function closeSiteIntelModal() {
    const modal = document.getElementById("site-intel-modal");
    const overlay = document.getElementById("site-intel-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("close-site-intel-btn");
    const overlay = document.getElementById("site-intel-overlay");

    if (closeBtn) closeBtn.addEventListener("click", closeSiteIntelModal);
    if (overlay) overlay.addEventListener("click", closeSiteIntelModal);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSiteIntelModal();
            const settingsDrawer = document.getElementById("settings-drawer");
            const settingsOverlay = document.getElementById("drawer-overlay");
            if (settingsDrawer) settingsDrawer.classList.remove("open");
            if (settingsOverlay) settingsOverlay.classList.remove("open");
        }
    });
});


function getActiveLiveConfig() {
    const island = REGIONS[state.activeIsland];
    const shore = island?.shores?.[state.activeShore];
    const launch = shore?.launchPoints?.[state.activeLaunch] || Object.values(shore?.launchPoints || {})[0];
    
    return {
        buoyPrimary:  shore?.buoyPrimary  || "51212",
        buoyVerify:   shore?.buoyVerify   || "51213",
        tideStation:  launch?.tideStation || shore?.tideStation || "1611347",
        zoneId:       shore?.zoneId       || "PHZ112",
        windGrid:     shore?.windGrid     || "HFO/88,169",
        // Coordinates used by computeLagHours for dynamic swell travel lag
        buoyCoords:   shore?.buoyCoords   || [21.323, -158.149],
        coastCoords:  shore?.coastCoords  || [21.877705, -159.485705]
    };
}

function startFunLoading() {
    const messages = [
        "Checking lineup",
        "Calling uncles",
        "Scouting trades",
        "Paddling out",
        "Reading mana",
        "Hang loose",
        "Fetching data",
        "Talking story",
        "Checking sets",
        "Consulting kupuna"
    ];
    // Randomize array
    for (let i = messages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [messages[i], messages[j]] = [messages[j], messages[i]];
    }
    
    let i = 0;
    const el = document.getElementById("last-updated");
    const sca = document.getElementById("sca-badge");
    if (el) el.textContent = messages[i];
    if (sca) sca.textContent = "Loading...";
    
    loadingInterval = setInterval(() => {
        i = (i + 1) % messages.length;
        if (el) el.textContent = messages[i];
        if (sca) sca.textContent = messages[(i+2) % messages.length]; // offset rotation
    }, 2500);
}
