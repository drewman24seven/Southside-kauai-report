document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch
    fetchData();

    // Auto-refresh every 5 minutes (if dashboard is kept open)
    setInterval(fetchData, 300000);


});



async function fetchData() {
    try {
        const response = await fetch("data.json?_t=" + Date.now());
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.error("Error loading dashboard data:", error);
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

function updateDashboard(data) {
    // 1. Last Updated and Small Craft Advisory (SCA)
    const lastUpdatedDt = data.last_updated;
    document.getElementById("last-updated").textContent = formatHST(lastUpdatedDt);
    
    const scaBadge = document.getElementById("sca-badge");
    const forecastText = data.forecast_text ? data.forecast_text.toUpperCase() : "";
    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;

    let scaActive = forecastText.includes("SMALL CRAFT ADVISORY");
    if (windSpeedExposed !== null && windSpeedExposed >= 25) scaActive = true;
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
        
        // Swell arrow rotation. Since it comes FROM mwd_deg, it travels TOWARD (mwd_deg + 180)
        if (est.mwd_deg !== undefined) {
            const travelDir = (est.mwd_deg + 180) % 360;
            document.getElementById("swell-arrow").style.transform = `rotate(${travelDir}deg)`;
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
            // Apply wind shadow decay fallback if all three stations are offline
            if (data.model_wind && data.model_wind.speed_mph !== undefined) {
                const mw = data.model_wind;
                const mwSpeed = mw.speed_mph;
                const mwDir = mw.direction_deg !== undefined ? mw.direction_deg : 90;
                
                let decayCoeff = 0.6;
                if (mwDir >= 45 && mwDir <= 110) {
                    decayCoeff = 0.3; // ENE trades - heavy leeward shadow of Makahuena Point
                } else if (mwDir >= 135 && mwDir <= 225) {
                    decayCoeff = 0.9; // South winds - direct onshore, no shadow
                }
                
                windSpeedCove = mwSpeed * decayCoeff;
                windDirCove = mwDir;
                
                const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
                const val = Math.floor((mwDir / 22.5) + 0.5);
                windCompassCove = directions[val % 16];
                isFallback = true;
            }
        }

        // PWS (Cove) Wind Speed
        document.getElementById("wind-speed").textContent = windSpeedCove ? windSpeedCove.toFixed(1) : "--.-";
        
        // PWS (Cove) Details
        const compassDir = windCompassCove;
        const degDir = windDirCove !== undefined ? `${Math.round(windDirCove)}°` : "---°";
        document.getElementById("wind-dir").textContent = (w.direction_reliable || isFallback) ? `${degDir} ${compassDir}` : "Variable";
        
        let sumGusts = 0;
        let countGusts = 0;
        w.stations.forEach(s => {
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
        } else if (w.direction_reliable) {
            relBadge.textContent = "Reliable";
            relBadge.style.background = "rgba(6, 214, 160, 0.12)";
            relBadge.style.color = "var(--accent-teal)";
        } else {
            relBadge.textContent = "Variable";
            relBadge.style.background = "rgba(244, 208, 104, 0.12)";
            relBadge.style.color = "var(--accent-gold)";
        }
        if (w.note) relBadge.title = w.note;

        // PWS Wind arrow rotation (blowing TOWARD wind_deg + 180)
        if (windDirCove !== undefined && (w.direction_reliable || isFallback)) {
            const travelDir = (windDirCove + 180) % 360;
            document.getElementById("wind-arrow").style.transform = `rotate(${travelDir}deg)`;
            document.getElementById("wind-arrow").style.opacity = "1";
        } else {
            document.getElementById("wind-arrow").style.opacity = "0.2"; // fade out if variable
        }

        // Render PWS Station list pills in footer
        const listContainer = document.getElementById("station-list");
        listContainer.innerHTML = "";
        if (isFallback) {
            const pill = document.createElement("div");
            pill.className = "station-pill offline";
            pill.innerHTML = `
                <span class="station-status-dot offline" style="background: var(--accent-sunset);"></span>
                <span>All Koloa Stations Offline</span>
                <span class="station-val">Model Fallback Active</span>
            `;
            listContainer.appendChild(pill);
        } else {
            w.stations.forEach(s => {
                const pill = document.createElement("div");
                pill.className = "station-pill";
                pill.innerHTML = `
                    <span class="station-status-dot"></span>
                    <span>${s.id}</span>
                    <span class="station-val">${Math.round(s.speed_mph)} mph ${s.direction_compass}</span>
                `;
                listContainer.appendChild(pill);
            });
        }
    } else {
        document.getElementById("wind-speed").textContent = "--.-";
    }

    // NAM Model (Exposed) Wind
    if (data.model_wind) {
        const mw = data.model_wind;
        
        // Model Speed in Knots (KT)
        document.getElementById("model-wind-speed").textContent = mw.speed_knots !== undefined ? mw.speed_knots.toFixed(1) : "--.-";
        
        // Model Speed in MPH
        document.getElementById("model-wind-mph").textContent = mw.speed_mph !== undefined ? `${mw.speed_mph.toFixed(1)} mph` : "--.- mph";
        
        // Model Direction
        const mwCompass = mw.direction_compass || "N/A";
        const mwDeg = mw.direction_deg !== undefined ? `${Math.round(mw.direction_deg)}°` : "---°";
        document.getElementById("model-wind-dir").textContent = `${mwDeg} ${mwCompass}`;
        
        // Model Wind arrow rotation (blowing TOWARD direction_deg + 180)
        if (mw.direction_deg !== undefined) {
            const travelDir = (mw.direction_deg + 180) % 360;
            document.getElementById("model-wind-arrow").style.transform = `rotate(${travelDir}deg)`;
            document.getElementById("model-wind-arrow").style.opacity = "1";
        } else {
            document.getElementById("model-wind-arrow").style.opacity = "0.2";
        }
    } else {
        document.getElementById("model-wind-speed").textContent = "--.-";
        document.getElementById("model-wind-mph").textContent = "--.- mph";
        document.getElementById("model-wind-dir").textContent = "---° --";
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

    // Locate indicator dots on the curve for "Current Time"
    // Since prediction dates are formatted as '2026-07-08 16:30', let's see which one is closest to local system time
    const now = new Date();
    // Format local time to match predictions format (YYYY-MM-DD HH:MM)
    // Predictions are in Hawaii local standard time (LST_LDT) because we query with time_zone=lst_ldt
    const localHour = now.getHours();
    const localMin = now.getMinutes();
    
    // Find matching time in predictions
    let minDiff = Infinity;
    let closestIdx = 0;
    
    predictions.forEach((p, idx) => {
        // Parse "2026-07-08 16:30"
        const tParts = p.time.split(' ')[1].split(':');
        const h = parseInt(tParts[0]);
        const m = parseInt(tParts[1]);
        
        const diff = Math.abs((h * 60 + m) - (localHour * 60 + localMin));
        if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
        }
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
        if (windSpeedExposed !== null && windDirExposed !== null) {
            let decayCoeff = 0.6;
            if (windDirExposed >= 45 && windDirExposed <= 110) decayCoeff = 0.3;
            else if (windDirExposed >= 135 && windDirExposed <= 225) decayCoeff = 0.9;
            windSpeedCove = windSpeedExposed * decayCoeff;
        }
    }

    // Determine wind alignment relative to the South Shore (facing 180°)
    let windExposure = "cross-shore";
    if (windDirExposed !== null) {
        if (windDirExposed >= 315 || windDirExposed <= 45) {
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
                if (windSpeedExposed >= windDangerLimitBoat) windStatus = "danger";
                else if (windSpeedExposed >= windCautionLimitBoat) windStatus = "caution";
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

        // 3. Transit Condition
        let transit = "Smooth Transit";
        if (type === "Shore") {
            transit = "N/A (Shore Entry)";
        } else {
            if (windSpeedExposed !== null) {
                if (windSpeedExposed >= 20 || energy >= 250) transit = "Rough Ride";
                else if (windSpeedExposed >= 12 || energy >= 120) transit = "Bumpy Ride";
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
            name: "Turtle Bluffs",
            type: "Boat",
            getConditions: () => getFormattedConditions("Boat", "Turtle Bluffs", rawSwellHeight, swellPeriod, swellDir, windSpeedCove, windSpeedExposed)
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
    
    // Check if current date falls within Whale Season (Dec 1 - Apr 1)
    const now = new Date();
    const m = now.getMonth(); // 0 = Jan, 11 = Dec
    const d = now.getDate();
    const isWhaleSeason = (m === 11) || (m === 0) || (m === 1) || (m === 2) || (m === 3 && d === 1);

    // Dock Time shifts mapping function
    function getDockShiftName(timeStr) {
        // timeStr format is "YYYY-MM-DD HH:MM"
        const timePart = timeStr.split(' ')[1];
        if (!timePart) return null;
        const timeParts = timePart.split(':');
        const hour = parseInt(timeParts[0]);
        const min = parseInt(timeParts[1]);
        const mins = hour * 60 + min;

        // Morning: 07:00 (420) to 08:45 (525)
        if (mins >= 420 && mins <= 525) return "Morning (07:00 - 08:45)";
        // Mid-Morning: 10:30 (630) to 11:45 (705)
        if (mins >= 630 && mins <= 705) return "Mid-Morning (10:30 - 11:45)";
        // Afternoon 1: 14:00 (840) to 14:30 (870)
        if (mins >= 840 && mins <= 870) return "Afternoon (14:00 - 14:30)";
        // Afternoon 2: 15:00 (900) to 16:00 (960)
        if (mins >= 900 && mins <= 960) return "Afternoon (15:00 - 16:00)";
        // Evening: 18:00 (1080) to 18:30 (1110)
        if (mins >= 1080 && mins <= 1110) return "Evening (18:00 - 18:30)";

        return null;
    }

    // 1. Check Tide Flooding in daily dock windows
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
        
        // Track the maximum water level per dock shift window
        const shiftWaterLevels = {};

        predictions.forEach(p => {
            const shiftName = getDockShiftName(p.time);
            if (shiftName) {
                const totalHeight = p.value_ft + surge;
                if (!shiftWaterLevels[shiftName] || totalHeight > shiftWaterLevels[shiftName]) {
                    shiftWaterLevels[shiftName] = totalHeight;
                }
            }
        });

        // Generate warnings per shift
        for (const [shiftName, maxVal] of Object.entries(shiftWaterLevels)) {
            const suffix = isWaveSetupFallback ? " (includes swell setup estimate)" : "";
            if (maxVal >= 1.9) {
                alerts.push({
                    status: "danger",
                    icon: "🌊",
                    text: `DOCK FLOODING: High tide (+${maxVal.toFixed(2)} ft) will flood Kukuiula dock during the ${shiftName} loading window${suffix}.`
                });
            } else if (maxVal >= 1.6) {
                alerts.push({
                    status: "caution",
                    icon: "⚠",
                    text: `HIGH WATER: High tide (+${maxVal.toFixed(2)} ft) approaching wash-over level during the ${shiftName} loading window${suffix}.`
                });
            }
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

    // 3. Reverse Current (West-to-East) ebbing current colliding with East trade wind waves
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed = data.model_wind ? data.model_wind.direction_deg : null;
    let isEbbing = false;

    if (data.tides && data.tides.predictions && data.tides.predictions.length > 0) {
        const preds = data.tides.predictions;
        const nowLocal = new Date();
        let closestIdx = 0;
        let minDiff = Infinity;
        
        for (let i = 0; i < preds.length; i++) {
            const pDate = new Date(preds[i].time.replace(' ', 'T'));
            const diff = Math.abs(nowLocal - pDate);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        
        // Ebb is falling tide (next hour height is lower)
        if (closestIdx < preds.length - 1) {
            isEbbing = preds[closestIdx + 1].value_ft < preds[closestIdx].value_ft;
        }
    }

    if (isEbbing && windSpeedExposed !== null && windSpeedExposed > 12 && windDirExposed !== null) {
        // Wind is from East/ENE (45° to 110°)
        if (windDirExposed >= 45 && windDirExposed <= 110) {
            alerts.push({
                status: "caution",
                icon: "🌊",
                text: `HARSH SEAS: Ebb tide generating reverse West-to-East current against East trades. Expect steep standing waves and a rough boat ride.`
            });
        }
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
        note.textContent = "Whale season dock alerts active Dec 1 - Apr 1. (Currently in demo mode for testing).";
    }
    container.appendChild(note);
}

function updateTransitComfort(data) {
    const westBadge = document.getElementById("comfort-west");
    const eastBadge = document.getElementById("comfort-east");
    if (!westBadge || !eastBadge) return;

    // Get swell and wind stats
    const swellHeight = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.wvht_ft : null;
    const swellPeriod = data.swell && data.swell.current_south_shore_estimate ? data.swell.current_south_shore_estimate.dpd_s : null;
    const windSpeedExposed = data.model_wind ? data.model_wind.speed_mph : null;
    const windDirExposed = data.model_wind ? data.model_wind.direction_deg : null;

    // Calculate Swell Energy
    const energy = (swellHeight !== null && swellPeriod !== null) ? (swellHeight * swellHeight * swellPeriod) : 0;

    // A. Evaluate West of Makahuena (Poipu / Kukuiula)
    // Sheltered from trades, but vulnerable to reverse current ebb tide standing waves
    let westStatus = "smooth";
    
    let isEbbing = false;
    if (data.tides && data.tides.predictions && data.tides.predictions.length > 0) {
        const preds = data.tides.predictions;
        const nowLocal = new Date();
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < preds.length; i++) {
            const pDate = new Date(preds[i].time.replace(' ', 'T'));
            const diff = Math.abs(nowLocal - pDate);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        if (closestIdx < preds.length - 1) {
            isEbbing = preds[closestIdx + 1].value_ft < preds[closestIdx].value_ft;
        }
    }

    const hasReverseCurrent = isEbbing && windSpeedExposed !== null && windSpeedExposed > 12 && windDirExposed !== null && (windDirExposed >= 45 && windDirExposed <= 110);

    if (hasReverseCurrent) {
        westStatus = "harsh"; // Standing waves!
    } else if (windSpeedExposed !== null && windSpeedExposed > 20 || energy > 250) {
        westStatus = "rough";
    } else if (windSpeedExposed !== null && windSpeedExposed > 12 || energy > 110) {
        westStatus = "choppy";
    } else {
        westStatus = "smooth";
    }

    // Render West
    westBadge.className = `comfort-badge ${westStatus}`;
    if (westStatus === "harsh") {
        westBadge.textContent = "Standing Waves";
    } else {
        westBadge.textContent = westStatus;
    }

    // B. Evaluate East of Makahuena (Makahuena to Kipu Kai)
    // Fully exposed to ENE trades and open-ocean swell
    let eastStatus = "smooth";
    if (windSpeedExposed !== null && windSpeedExposed > 20 || energy > 250) {
        eastStatus = "harsh"; // Very Rough
    } else if (windSpeedExposed !== null && windSpeedExposed > 14 || energy > 160) {
        eastStatus = "rough";
    } else if (windSpeedExposed !== null && windSpeedExposed > 10 || energy > 90) {
        eastStatus = "choppy";
    } else {
        eastStatus = "smooth";
    }

    // Render East
    eastBadge.className = `comfort-badge ${eastStatus}`;
    if (eastStatus === "harsh") {
        eastBadge.textContent = "Very Rough";
    } else {
        eastBadge.textContent = eastStatus;
    }
}
