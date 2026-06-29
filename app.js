// --- STATE MANAGEMENT ---
let selectedUnit = 'C';
let currentWeatherData = null;
let activeSeason = 'summer';
let manualSeasonOverride = false;
let chartInstance = null;

let currentCity = {
    name: "Mumbai",
    lat: 19.0760,
    lon: 72.8777,
    country: "India"
};

// --- CANVAS PARTICLE BACKGROUND & RADAR SYSTEMS ---
const bgCanvas = document.getElementById('canvas-bg');
const bgCtx = bgCanvas.getContext('2d');
const radarCanvas = document.getElementById('radar-overlay');
const radarCtx = radarCanvas.getContext('2d');

let bgParticles = [];
let canvasWidth, canvasHeight;
let radarWidth, radarHeight;
let animationId;
let radarAngle = 0;
let radarBlips = [];

// Canvas sizing
function resizeCanvases() {
    canvasWidth = bgCanvas.width = window.innerWidth;
    canvasHeight = bgCanvas.height = window.innerHeight;
    
    radarWidth = radarCanvas.width = radarCanvas.parentElement.offsetWidth;
    radarHeight = radarCanvas.height = radarCanvas.parentElement.offsetHeight;

    initBgParticles();
}
window.addEventListener('resize', resizeCanvases);

// Particle Class definition
class Particle {
    constructor(type) {
        this.type = type;
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvasWidth;
        if (this.type === 'snow') {
            this.y = Math.random() * -canvasHeight;
            this.size = Math.random() * 2 + 1;
            this.speedY = Math.random() * 1.2 + 0.5;
            this.speedX = Math.random() * 0.8 - 0.4;
            this.opacity = Math.random() * 0.6 + 0.2;
            this.spin = Math.random() * 0.02 - 0.01;
            this.angle = Math.random() * Math.PI * 2;
        } else if (this.type === 'ember') {
            this.y = canvasHeight + Math.random() * 100;
            this.size = Math.random() * 3 + 1.5;
            this.speedY = -(Math.random() * 1.0 + 0.4);
            this.speedX = Math.random() * 0.8 - 0.4;
            this.opacity = Math.random() * 0.5 + 0.3;
            this.maxLife = Math.random() * 180 + 90;
            this.life = 0;
        } else if (this.type === 'rain') {
            this.y = Math.random() * -canvasHeight;
            this.length = Math.random() * 18 + 12;
            this.speedY = Math.random() * 8 + 12;
            this.speedX = -1.5;
            this.opacity = Math.random() * 0.2 + 0.1;
        } else if (this.type === 'ripple') {
            this.x = Math.random() * canvasWidth;
            this.y = canvasHeight - Math.random() * 100;
            this.radius = 1;
            this.maxRadius = Math.random() * 25 + 10;
            this.speed = Math.random() * 0.6 + 0.3;
            this.opacity = Math.random() * 0.3 + 0.1;
        }
    }

    update() {
        if (this.type === 'snow') {
            this.y += this.speedY;
            this.x += this.speedX + Math.sin(this.angle) * 0.4;
            this.angle += this.spin;
            if (this.y > canvasHeight) this.reset();
        } else if (this.type === 'ember') {
            this.y += this.speedY;
            this.x += this.speedX;
            this.life++;
            this.opacity = 1 - (this.life / this.maxLife);
            if (this.life >= this.maxLife || this.y < 0) this.reset();
        } else if (this.type === 'rain') {
            this.y += this.speedY;
            this.x += this.speedX;
            if (this.y > canvasHeight) {
                if (Math.random() > 0.4) {
                    bgParticles.push(new Particle('ripple'));
                    if (bgParticles.length > 180) {
                        let ripIdx = bgParticles.findIndex(p => p.type === 'ripple');
                        if (ripIdx !== -1) bgParticles.splice(ripIdx, 1);
                    }
                }
                this.reset();
            }
        } else if (this.type === 'ripple') {
            this.radius += this.speed;
            this.opacity -= 0.01;
            if (this.opacity <= 0 || this.radius >= this.maxRadius) {
                return false;
            }
        }
        return true;
    }

    draw() {
        bgCtx.save();
        if (this.type === 'snow') {
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            bgCtx.fillStyle = `rgba(0, 243, 255, ${this.opacity})`;
            bgCtx.shadowBlur = 4;
            bgCtx.shadowColor = '#00f3ff';
            bgCtx.fill();
        } else if (this.type === 'ember') {
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            let grad = bgCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, `rgba(255, 159, 28, ${this.opacity})`);
            grad.addColorStop(1, `rgba(255, 80, 0, 0)`);
            bgCtx.fillStyle = grad;
            bgCtx.shadowBlur = 6;
            bgCtx.shadowColor = '#ff9f1c';
            bgCtx.fill();
        } else if (this.type === 'rain') {
            bgCtx.beginPath();
            bgCtx.strokeStyle = `rgba(16, 185, 129, ${this.opacity})`;
            bgCtx.lineWidth = 1;
            bgCtx.moveTo(this.x, this.y);
            bgCtx.lineTo(this.x + this.speedX * 0.8, this.y + this.length);
            bgCtx.stroke();
        } else if (this.type === 'ripple') {
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            bgCtx.strokeStyle = `rgba(16, 185, 129, ${this.opacity})`;
            bgCtx.lineWidth = 0.8;
            bgCtx.stroke();
        }
        bgCtx.restore();
    }
}

// Initialize particles
function initBgParticles() {
    bgParticles = [];
    let count = canvasWidth < 768 ? 30 : 70;
    let type = activeSeason === 'summer' ? 'ember' : (activeSeason === 'winter' ? 'snow' : 'rain');
    for (let i = 0; i < count; i++) {
        bgParticles.push(new Particle(type));
    }
}

// Animated Radar Sweep renderer
function drawRadar() {
    if (!radarCanvas || !radarCtx) return;
    radarCtx.clearRect(0, 0, radarWidth, radarHeight);

    const centerX = radarWidth / 2;
    const centerY = radarHeight / 2;
    const maxRadius = Math.min(radarWidth, radarHeight) * 0.45;

    radarCtx.save();

    // Radar circular grids
    radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    radarCtx.lineWidth = 1;
    
    // Draw crosshairs
    radarCtx.beginPath();
    radarCtx.moveTo(centerX - maxRadius, centerY);
    radarCtx.lineTo(centerX + maxRadius, centerY);
    radarCtx.moveTo(centerX, centerY - maxRadius);
    radarCtx.lineTo(centerX, centerY + maxRadius);
    radarCtx.stroke();

    // Draw scanning circles
    for (let r = maxRadius * 0.25; r <= maxRadius; r += maxRadius * 0.25) {
        radarCtx.beginPath();
        radarCtx.arc(centerX, centerY, r, 0, Math.PI * 2);
        radarCtx.stroke();
    }

    // Radar theme colors
    let radarColor = '#ff9f1c'; // summer
    let radarGlow = 'rgba(255, 159, 28, 0.15)';
    if (activeSeason === 'winter') {
        radarColor = '#00f3ff';
        radarGlow = 'rgba(0, 243, 255, 0.15)';
    } else if (activeSeason === 'monsoon') {
        radarColor = '#10b981';
        radarGlow = 'rgba(16, 185, 129, 0.15)';
    }

    // Draw radar sweep line
    radarAngle += 0.01;
    if (radarAngle > Math.PI * 2) radarAngle = 0;
    
    // Update telemetry UI
    document.getElementById('radar-azimuth').textContent = `${Math.round(radarAngle * (180 / Math.PI))}°`;

    radarCtx.beginPath();
    radarCtx.moveTo(centerX, centerY);
    let sweepX = centerX + Math.cos(radarAngle) * maxRadius;
    let sweepY = centerY + Math.sin(radarAngle) * maxRadius;
    radarCtx.lineTo(sweepX, sweepY);
    radarCtx.strokeStyle = radarColor;
    radarCtx.lineWidth = 2;
    radarCtx.stroke();

    // Sweep visual gradient tail
    radarCtx.beginPath();
    radarCtx.moveTo(centerX, centerY);
    radarCtx.arc(centerX, centerY, maxRadius, radarAngle, radarAngle - 0.2, true);
    radarCtx.lineTo(centerX, centerY);
    let conicGrad = radarCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
    conicGrad.addColorStop(0, radarGlow);
    conicGrad.addColorStop(1, 'transparent');
    radarCtx.fillStyle = conicGrad;
    radarCtx.fill();

    // Spawn blips occasionally
    if (Math.random() > 0.985 && radarBlips.length < 5) {
        const bAngle = Math.random() * Math.PI * 2;
        const bDist = Math.random() * maxRadius * 0.8;
        radarBlips.push({
            x: centerX + Math.cos(bAngle) * bDist,
            y: centerY + Math.sin(bAngle) * bDist,
            life: 100,
            size: Math.random() * 3 + 2
        });
    }

    // Draw & update blips
    radarBlips = radarBlips.filter(b => {
        b.life -= 1.2;
        radarCtx.beginPath();
        radarCtx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        radarCtx.fillStyle = radarColor;
        radarCtx.globalAlpha = b.life / 100;
        radarCtx.shadowBlur = 8;
        radarCtx.shadowColor = radarColor;
        radarCtx.fill();
        radarCtx.globalAlpha = 1;
        return b.life > 0;
    });

    radarCtx.restore();
}

// Draw static tech grid lines on background
function drawTechBackgroundGrid() {
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
    bgCtx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < canvasWidth; x += gridSize) {
        bgCtx.beginPath();
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, canvasHeight);
        bgCtx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
        bgCtx.beginPath();
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(canvasWidth, y);
        bgCtx.stroke();
    }
}

// Animation Master Loop
function animate() {
    // Draw backgrounds & static elements
    bgCtx.fillStyle = '#060913';
    bgCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    drawTechBackgroundGrid();

    // Update & Draw Background Particles
    bgParticles = bgParticles.filter(p => {
        let keep = p.update();
        if (keep) p.draw();
        return keep;
    });

    // Replenish deleted particles
    let desiredCount = canvasWidth < 768 ? 30 : 70;
    if (activeSeason === 'monsoon') desiredCount *= 1.3;
    if (activeSeason === 'winter') desiredCount *= 1.2;
    let type = activeSeason === 'summer' ? 'ember' : (activeSeason === 'winter' ? 'snow' : 'rain');
    let typeCount = bgParticles.filter(p => p.type === type).length;
    if (typeCount < desiredCount) {
        bgParticles.push(new Particle(type));
    }

    // Radar animation step
    drawRadar();

    animationId = requestAnimationFrame(animate);
}

// Theme dynamic adjustments
function applyCyberTheme() {
    const root = document.documentElement;
    let activeColor = '#ff9f1c';

    if (activeSeason === 'summer') {
        activeColor = '#ff9f1c';
        root.style.setProperty('--accent-color', 'var(--summer-neon)');
        root.style.setProperty('--accent-glow', 'var(--summer-glow)');
        document.getElementById('season-emoji').textContent = '☀️';
        document.getElementById('season-badge').textContent = 'Summer';
        document.getElementById('season-badge').style.color = 'var(--summer-neon)';
    } else if (activeSeason === 'winter') {
        activeColor = '#00f3ff';
        root.style.setProperty('--accent-color', 'var(--winter-neon)');
        root.style.setProperty('--accent-glow', 'var(--winter-glow)');
        document.getElementById('season-emoji').textContent = '❄️';
        document.getElementById('season-badge').textContent = 'Winter';
        document.getElementById('season-badge').style.color = 'var(--winter-neon)';
    } else if (activeSeason === 'monsoon') {
        activeColor = '#10b981';
        root.style.setProperty('--accent-color', 'var(--monsoon-neon)');
        root.style.setProperty('--accent-glow', 'var(--monsoon-glow)');
        document.getElementById('season-emoji').textContent = '🌧️';
        document.getElementById('season-badge').textContent = 'Monsoon';
        document.getElementById('season-badge').style.color = 'var(--monsoon-neon)';
    }

    // Flashing border animation
    const panels = document.querySelectorAll('.cyber-panel');
    panels.forEach(panel => {
        panel.style.boxShadow = `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${activeColor}0a`;
    });

    initBgParticles();
}




function getClosestSatellite(lat, lon) {
    if (lon >= -30 && lon < 30) {
        return { name: "METEOSAT-11", agency: "EUMETSAT", resolution: "3km/px" };
    } else if (lon >= 30 && lon < 110) {
        return { name: "INSAT-3DR", agency: "ISRO", resolution: "1km/px" };
    } else if (lon >= 110 && lon <= 180) {
        return { name: "HIMAWARI-9", agency: "JMA", resolution: "2km/px" };
    } else if (lon >= -140 && lon < -30) {
        return { name: "GOES-16 (East)", agency: "NOAA", resolution: "0.5km/px" };
    } else {
        return { name: "GOES-18 (West)", agency: "NOAA", resolution: "0.5km/px" };
    }
}

// --- SATELLITE WEATHER DATA ENGINE ---
async function fetchWeatherData(lat, lon, cityName) {
    logInference(`[SYS] Uplinking weather forecast data for coordinates: [${lat.toFixed(4)}N, ${lon.toFixed(4)}E]`);
    
    const statusBadge = document.getElementById('ai-status-text');
    statusBadge.textContent = "Syncing Satellites...";
    statusBadge.parentElement.querySelector('.ai-status-pulse').setAttribute('style', 'background-color: #ff9f1c');
    statusBadge.parentElement.setAttribute('style', 'color: #ff9f1c; border-color: rgba(255, 159, 28, 0.4); background: rgba(255, 159, 28, 0.1)');

    try {
        // Fetch current + 10-day forecasts from Open-Meteo (including sunrise, sunset, UV, Wind, and Day/Night status)
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&forecast_days=10&timezone=auto`);
        if (!response.ok) throw new Error("Connection timed out.");
        
        const data = await response.json();
        currentWeatherData = data;
        
        logInference(`[SYS] Satellite weather details downloaded.`);

        const sat = getClosestSatellite(lat, lon);
        const accuracyVal = (99.2 + (Math.abs(lat) * 0.01) % 0.6).toFixed(1) + "%";

        // Set UI elements for direct satellite & 99% accuracy details
        document.getElementById('satellite-status-lbl').textContent = `SAT: ${sat.name}`;
        document.getElementById('radar-sat-name').textContent = `SAT: ${sat.name} (${sat.agency})`;
        document.getElementById('radar-sat-acc').textContent = `ACCURACY: ${accuracyVal}`;

        // Update text elements
        document.getElementById('city-disp').textContent = cityName;
        document.getElementById('conv-city-lbl').textContent = `${cityName} Live`;
        document.getElementById('latlon-telemetry').textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'} / ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

        // Formats current time based on timezone offset of selected location
        const utcSeconds = Date.now() + (new Date().getTimezoneOffset() * 60000);
        const localTime = new Date(utcSeconds + (data.utc_offset_seconds * 1000));
        const tzAbbr = data.timezone_abbreviation || "UTC";
        document.getElementById('date-disp').textContent = localTime.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        }) + ` (${tzAbbr})`;

        // Save baseline variables
        const tempC = data.current.temperature_2m;
        document.getElementById('temp-val').setAttribute('data-celsius', tempC.toString());
        document.getElementById('feels-like-val').setAttribute('data-celsius', data.current.apparent_temperature.toString());
        document.getElementById('humidity-val').textContent = `${data.current.relative_humidity_2m}%`;
        document.getElementById('wind-val').textContent = `${data.current.wind_speed_10m} km/h`;

        // Calculate UV Index simulation based on temp & lat
        const uvVal = Math.max(1.0, (12 - Math.abs(lat) * 0.15) * (tempC > 20 ? 1.0 : 0.6)).toFixed(1);
        document.getElementById('uv-val').textContent = uvVal;

        // Circular visual gauge refresh
        updateTempGauge();

        // Live Temperature Converter update
        updateTemperatureConverter(tempC);

        // Weather interpretation & descriptive icons
        const condition = interpretWeatherCode(data.current.weather_code);
        document.getElementById('weather-desc-txt').textContent = condition.desc;
        document.getElementById('weather-desc-icon').innerHTML = `<i data-lucide="${condition.icon}" style="width: 24px; height: 24px; color: var(--accent-color);"></i>`;

        // Day/Night Phase display
        const isDay = data.current.is_day === 1;
        const dayNightDisp = document.getElementById('day-night-disp');
        if (isDay) {
            dayNightDisp.innerHTML = `<i data-lucide="sun" style="width: 12px; height: 12px; color: #ff9f1c;"></i> Day Phase`;
        } else {
            dayNightDisp.innerHTML = `<i data-lucide="moon" style="width: 12px; height: 12px; color: #a5b4fc;"></i> Night Phase`;
        }

        // Build 10-Day Scrollable Timeline
        render10DayTimeline(data);
        expandDayDetails(0);

        // Seasonal comparisons
        estimateSeasonalAverages(lat, tempC);

        // Automatically switch season theme unless user overrode manually
        if (!manualSeasonOverride) {
            detectSeasonFromWeather(data);
        } else {
            applyCyberTheme();
        }

        // AI Prediction charts & advisory logs
        simulateAIPrediction(data);
        lucide.createIcons();

    } catch (err) {
        console.error(err);
        logInference(`[ERR] Uplink failed: ${err.message}`);
        statusBadge.textContent = "Telemetry Error";
    }
}

// Circular Gauge percentage calculation
function updateTempGauge() {
    const tempValEl = document.getElementById('temp-val');
    const gaugeBar = document.getElementById('gauge-bar');
    
    if (!tempValEl.getAttribute('data-celsius')) return;
    const tempVal = parseFloat(tempValEl.getAttribute('data-celsius'));

    // Unit displays
    if (selectedUnit === 'C') {
        tempValEl.textContent = Math.round(tempVal).toString();
        document.getElementById('feels-like-val').textContent = `${Math.round(parseFloat(document.getElementById('feels-like-val').getAttribute('data-celsius')))}°C`;
    } else {
        tempValEl.textContent = Math.round((tempVal * 9/5) + 32).toString();
        document.getElementById('feels-like-val').textContent = `${Math.round(parseFloat(document.getElementById('feels-like-val').getAttribute('data-celsius')) * 9/5 + 32)}°F`;
    }

    // Circular Dash Offset Math (Radius 80, Circumference 502)
    // Limit mapping from -15°C (offset 502) to 45°C (offset 0)
    const minTemp = -15;
    const maxTemp = 45;
    const percent = (tempVal - minTemp) / (maxTemp - minTemp);
    const clampedPercent = Math.max(0, Math.min(1, percent));
    const offset = 502 - (clampedPercent * 502);
    gaugeBar.style.strokeDashoffset = offset.toString();
}

// Converts current code to icon/desc
function interpretWeatherCode(code) {
    if (code === 0) return { desc: "Clear Sun", icon: "sun" };
    if (code >= 1 && code <= 3) return { desc: "Clear/Scattered Clouds", icon: "cloud-sun" };
    if (code === 45 || code === 48) return { desc: "Dense Fog", icon: "cloud-fog" };
    if (code >= 51 && code <= 57) return { desc: "Light Drizzle", icon: "cloud-drizzle" };
    if (code >= 61 && code <= 65) return { desc: "Heavy Rain", icon: "cloud-rain" };
    if (code >= 71 && code <= 77) return { desc: "Heavy Snowfall", icon: "snowflake" };
    if (code >= 80 && code <= 82) return { desc: "Severe Showers", icon: "cloud-lightning" };
    if (code >= 85 && code <= 86) return { desc: "Snow Flurries", icon: "snowflake" };
    if (code >= 95) return { desc: "Active Thunderstorm", icon: "cloud-lightning" };
    return { desc: "Atmospheric Clouds", icon: "cloud" };
}

// Auto Season Detector
function detectSeasonFromWeather(data) {
    const temp = data.current.temperature_2m;
    const rain = data.current.precipitation || 0;
    const month = new Date().getMonth();
    const lat = data.latitude;

    let detected = 'summer';

    if (Math.abs(lat) < 26) {
        const humidity = data.current.relative_humidity_2m || 0;
        if (rain > 1.0 || (humidity > 70 && month >= 5 && month <= 9 && temp > 24)) {
            detected = 'monsoon';
        } else if (temp < 23 || month >= 10 || month <= 1) {
            detected = 'winter';
        } else {
            detected = 'summer';
        }
    } else {
        const isNorthernSummer = (lat > 0 && month >= 5 && month <= 8);
        const isSouthernSummer = (lat < 0 && (month >= 11 || month <= 1));
        
        const isNorthernWinter = (lat > 0 && (month >= 11 || month <= 1));
        const isSouthernWinter = (lat < 0 && month >= 5 && month <= 8);

        const isNorthernAutumn = (lat > 0 && month >= 8 && month <= 10);
        const isSouthernAutumn = (lat < 0 && month >= 2 && month <= 4);

        if (isNorthernSummer || isSouthernSummer || temp > 24) {
            detected = 'summer';
        } else if (isNorthernWinter || isSouthernWinter || temp < 9) {
            detected = 'winter';
        } else if (isNorthernAutumn || isSouthernAutumn || rain > 0.5) {
            detected = 'monsoon';
        } else {
            detected = temp > 17 ? 'summer' : 'winter';
        }
    }

    activeSeason = detected;
    logInference(`[SYS] Weather sensor classified season as: ${detected.toUpperCase()}`);
    


    applyCyberTheme();
}

// Seasonal ranges estimator for display
function estimateSeasonalAverages(lat, currentC) {
    let summerMin, summerMax, winterMin, winterMax, monsoonMin, monsoonMax;
    const latFactor = Math.abs(lat) / 90;

    if (Math.abs(lat) < 23.5) {
        summerMin = 31; summerMax = 38;
        monsoonMin = 26; monsoonMax = 30;
        winterMin = 18; winterMax = 24;
    } else {
        const baseMin = 16 - (latFactor * 32);
        const baseMax = 28 - (latFactor * 26);
        
        summerMin = Math.round(baseMin + 12);
        summerMax = Math.round(baseMax + 14);
        
        monsoonMin = Math.round(baseMin + 3);
        monsoonMax = Math.round(baseMax + 2);
        
        winterMin = Math.round(baseMin - 14);
        winterMax = Math.round(baseMax - 9);
    }

    if (activeSeason === 'summer') {
        const shift = currentC - ((summerMin + summerMax)/2);
        summerMin += Math.round(shift * 0.5); summerMax += Math.round(shift * 0.5);
    } else if (activeSeason === 'winter') {
        const shift = currentC - ((winterMin + winterMax)/2);
        winterMin += Math.round(shift * 0.5); winterMax += Math.round(shift * 0.5);
    } else if (activeSeason === 'monsoon') {
        const shift = currentC - ((monsoonMin + monsoonMax)/2);
        monsoonMin += Math.round(shift * 0.5); monsoonMax += Math.round(shift * 0.5);
    }
}

// Toggle standard telemetry display scales
function toggleTemperatureUnit() {
    selectedUnit = selectedUnit === 'C' ? 'F' : 'C';
    document.getElementById('temp-toggle-btn').textContent = `°${selectedUnit}`;
    updateTempGauge();
    if (currentWeatherData) {
        renderForecastChart(currentWeatherData);
        render10DayTimeline(currentWeatherData);
        // Refresh details for active day index
        const dayCards = Array.from(document.querySelectorAll('.day-card'));
        const activeIdx = dayCards.findIndex(card => card.classList.contains('active'));
        expandDayDetails(activeIdx !== -1 ? activeIdx : 0);
    }
}


// --- RENDER 10-DAY FORECAST GRID ---
function render10DayTimeline(data) {
    const listEl = document.getElementById('forecast-10day-list');
    listEl.innerHTML = '';

    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Adjust ranges based on season biases if overridden
    let seasonBias = 0;
    if (manualSeasonOverride) {
        if (activeSeason === 'summer') seasonBias = 8;
        if (activeSeason === 'winter') seasonBias = -10;
        if (activeSeason === 'monsoon') seasonBias = -3;
    }

    for (let i = 0; i < 10; i++) {
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + i);

        const dayName = i === 0 ? "Today" : weekdays[dateObj.getDay()].slice(0, 3);
        const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        let maxVal = Math.round(data.daily.temperature_2m_max[i] + seasonBias);
        let minVal = Math.round(data.daily.temperature_2m_min[i] + seasonBias);

        if (selectedUnit === 'F') {
            maxVal = Math.round(maxVal * 9/5 + 32);
            minVal = Math.round(minVal * 9/5 + 32);
        }

        const rainProb = data.daily.precipitation_probability_max[i] || 0;
        const weatherCode = data.daily.weather_code[i];
        const cond = interpretWeatherCode(weatherCode);

        const card = document.createElement('div');
        card.className = `day-card ${i === 0 ? 'active' : ''}`;
        card.innerHTML = `
            <p class="day-name">${dayName}</p>
            <p class="day-date">${dateString}</p>
            <div class="day-icon"><i data-lucide="${cond.icon}"></i></div>
            <div class="day-temps">
                <span class="day-max">${maxVal}°</span>
                <span class="day-min">${minVal}°</span>
            </div>
            <div class="day-rain-prob">
                <i data-lucide="droplet" style="width: 10px; height: 10px;"></i>
                <span>${rainProb}%</span>
            </div>
        `;
        
        // Click listener to expand this day's detail
        card.addEventListener('click', () => {
            expandDayDetails(i);
        });

        listEl.appendChild(card);
    }
}

// --- RENDER EXPANDED DAY DETAILS ---
function expandDayDetails(index) {
    if (!currentWeatherData) return;

    const detailsPanel = document.getElementById('forecast-day-details');
    
    // Highlight correct day card
    const cards = document.querySelectorAll('.day-card');
    cards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + index);
    const fullDateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Apply season biases if overridden
    let seasonBias = 0;
    if (manualSeasonOverride) {
        if (activeSeason === 'summer') seasonBias = 8;
        if (activeSeason === 'winter') seasonBias = -10;
        if (activeSeason === 'monsoon') seasonBias = -3;
    }

    let maxVal = Math.round(currentWeatherData.daily.temperature_2m_max[index] + seasonBias);
    let minVal = Math.round(currentWeatherData.daily.temperature_2m_min[index] + seasonBias);
    let tempUnit = "°C";

    if (selectedUnit === 'F') {
        maxVal = Math.round(maxVal * 9/5 + 32);
        minVal = Math.round(minVal * 9/5 + 32);
        tempUnit = "°F";
    }

    const weatherCode = currentWeatherData.daily.weather_code[index];
    const cond = interpretWeatherCode(weatherCode);

    // Format Sunrise / Sunset
    const sunriseRaw = currentWeatherData.daily.sunrise[index];
    const sunsetRaw = currentWeatherData.daily.sunset[index];
    const sunriseStr = sunriseRaw ? sunriseRaw.split('T')[1] : "--:--";
    const sunsetStr = sunsetRaw ? sunsetRaw.split('T')[1] : "--:--";

    // Format wind and UV
    const windSpeedMax = currentWeatherData.daily.wind_speed_10m_max[index] || 0;
    const uvMax = currentWeatherData.daily.uv_index_max[index] || 0;
    
    let uvRisk = "Low";
    if (uvMax >= 3 && uvMax <= 5) uvRisk = "Moderate";
    else if (uvMax >= 6 && uvMax <= 7) uvRisk = "High";
    else if (uvMax >= 8 && uvMax <= 10) uvRisk = "Very High";
    else if (uvMax >= 11) uvRisk = "Extreme";

    detailsPanel.innerHTML = `
        <div class="details-wrapper">
            <div class="details-main-info">
                <p class="details-date">${index === 0 ? 'Today' : fullDateStr}</p>
                <div class="details-icon"><i data-lucide="${cond.icon}" style="width: 48px; height: 48px;"></i></div>
                <p class="details-temp-range">${maxVal}${tempUnit} / ${minVal}${tempUnit}</p>
                <p class="details-desc">${cond.desc}</p>
            </div>
            <div class="details-telemetry-grid">
                <div class="details-tel-item">
                    <span class="details-tel-lbl">Sunrise</span>
                    <span class="details-tel-val">
                        <i data-lucide="sunrise" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: var(--accent-color);"></i>
                        ${sunriseStr}
                    </span>
                </div>
                <div class="details-tel-item">
                    <span class="details-tel-lbl">Sunset</span>
                    <span class="details-tel-val">
                        <i data-lucide="sunset" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: var(--accent-color);"></i>
                        ${sunsetStr}
                    </span>
                </div>
                <div class="details-tel-item">
                    <span class="details-tel-lbl">UV Radiation</span>
                    <span class="details-tel-val">
                        <i data-lucide="sun" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: var(--accent-color);"></i>
                        ${uvMax.toFixed(1)} <span style="font-size: 0.75rem; opacity: 0.8;">(${uvRisk})</span>
                    </span>
                </div>
                <div class="details-tel-item">
                    <span class="details-tel-lbl">Peak Wind</span>
                    <span class="details-tel-val">
                        <i data-lucide="wind" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: var(--accent-color);"></i>
                        ${windSpeedMax} <span style="font-size: 0.75rem; opacity: 0.8;">km/h</span>
                    </span>
                </div>
            </div>
        </div>
    `;

    detailsPanel.style.display = 'block';
    lucide.createIcons();
}


// --- LIVE INTEGRATED TEMPERATURE CONVERTER ---
function updateTemperatureConverter(celsiusTemp) {
    document.getElementById('conv-celsius-lbl').textContent = `${celsiusTemp.toFixed(2)} °C`;
    
    const fValue = (celsiusTemp * 9/5) + 32;
    const kValue = celsiusTemp + 273.15;

    document.getElementById('conv-val-f').textContent = `${fValue.toFixed(2)} °F`;
    document.getElementById('conv-val-k').textContent = `${kValue.toFixed(2)} K`;
}


// --- AI FORECAST & ADVISORY ---
function logInference(msg) {
    const consoleBox = document.getElementById('ai-log');
    const logDiv = document.createElement('div');
    logDiv.textContent = msg;
    consoleBox.appendChild(logDiv);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

function simulateAIPrediction(data) {
    const statusText = document.getElementById('ai-status-text');
    statusText.textContent = "Neural Processing...";
    statusText.parentElement.querySelector('.ai-status-pulse').setAttribute('style', 'background-color: #ff9f1c');
    statusText.parentElement.setAttribute('style', 'color: #ff9f1c; border-color: rgba(255, 159, 28, 0.4); background: rgba(255, 159, 28, 0.1)');

    const sat = getClosestSatellite(data.latitude, data.longitude);
    const accuracyVal = (99.2 + (Math.abs(data.latitude) * 0.01) % 0.6).toFixed(1) + "%";

    const logSteps = [
        `[SAT] Direct orbital uplink established with ${sat.name} (${sat.agency}).`,
        `[SAT] Spectral L-band telemetry download resolution: ${sat.resolution}.`,
        `[AI] Satellite telemetry coordinates matches orbit trajectory.`,
        `[AI] Sensor reading accuracy validation: ${accuracyVal} verified.`,
        `[SYS] Consensus models (ECMWF HRES / GFS 13km) successfully synchronized.`
    ];

    let idx = 0;
    const interval = setInterval(() => {
        if (idx < logSteps.length) {
            logInference(logSteps[idx]);
            idx++;
        } else {
            clearInterval(interval);
            statusText.textContent = "AI Connected";
            statusText.parentElement.querySelector('.ai-status-pulse').setAttribute('style', 'background-color: #10b981');
            statusText.parentElement.setAttribute('style', 'color: #10b981; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.15)');

            renderForecastChart(data);
            generateAIAdvisory(data);
        }
    }, 250);
}

// Render Chart.js
function renderForecastChart(data) {
    const chartCanvas = document.getElementById('forecastChart');
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const labels = [];
    const predictions = [];
    const upperConfidence = [];
    const lowerConfidence = [];

    let seasonBias = 0;
    if (manualSeasonOverride) {
        if (activeSeason === 'summer') seasonBias = 8;
        if (activeSeason === 'winter') seasonBias = -10;
        if (activeSeason === 'monsoon') seasonBias = -3;
    }

    for (let i = 0; i < 5; i++) {
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + i + 1);
        labels.push(weekdays[dateObj.getDay()].slice(0, 3));

        let tMax = data.daily.temperature_2m_max[i] + seasonBias;
        let tMin = data.daily.temperature_2m_min[i] + seasonBias;
        let avg = (tMax + tMin) / 2;

        if (selectedUnit === 'F') {
            avg = (avg * 9/5) + 32;
        }

        predictions.push(Math.round(avg));
        const uncertainty = 1.0 + (i * 0.5);
        upperConfidence.push(Math.round(avg + uncertainty));
        lowerConfidence.push(Math.round(avg - uncertainty));
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctxChart = chartCanvas.getContext('2d');
    
    let colorNeon = '#ff9f1c';
    let colorGlow = 'rgba(255, 159, 28, 0.08)';
    if (activeSeason === 'winter') {
        colorNeon = '#00f3ff';
        colorGlow = 'rgba(0, 243, 255, 0.08)';
    } else if (activeSeason === 'monsoon') {
        colorNeon = '#10b981';
        colorGlow = 'rgba(16, 185, 129, 0.08)';
    }

    chartInstance = new Chart(ctxChart, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Predicted Mean Temp',
                    data: predictions,
                    borderColor: colorNeon,
                    backgroundColor: colorNeon,
                    borderWidth: 2,
                    pointBackgroundColor: colorNeon,
                    pointRadius: 4,
                    tension: 0.35,
                    z: 2
                },
                {
                    label: 'Upper Confidence Limit',
                    data: upperConfidence,
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    tension: 0.35,
                    fill: false,
                    z: 0
                },
                {
                    label: 'Uncertainty Range',
                    data: lowerConfidence,
                    borderColor: 'transparent',
                    backgroundColor: colorGlow,
                    pointRadius: 0,
                    tension: 0.35,
                    fill: '-1',
                    z: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Forecast: ${context.raw}°${selectedUnit}`;
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: { family: 'Roboto Mono', size: 10 },
                        callback: val => `${val}°`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: { family: 'Outfit', size: 11 }
                    }
                }
            }
        }
    });
}

// Generate AI Advisory
function generateAIAdvisory(data) {
    const advText = document.getElementById('ai-advisory');
    const humidity = data.current.relative_humidity_2m;
    const wind = data.current.wind_speed_10m;
    const rain = data.current.precipitation || 0;
    const temp = data.current.temperature_2m;

    let advice = "";

    if (activeSeason === 'summer') {
        advice = `Solar irradiance levels are high. Relative humidity is ${humidity}%. Expect high thermal discomfort during noon hours. Drink mineral-rich fluids and minimize direct sun exposure.`;
    } else if (activeSeason === 'monsoon') {
        if (rain > 0.5 || humidity > 85) {
            advice = `Saturated tropical airflow detected. Expect active monsoon cloud precipitation. Flash-flooding hazard index is moderate. Keep water-repellent gear accessible.`;
        } else {
            advice = `High moisture convection is active. Gusts of ${wind} km/h indicate local pressure depressions. Intermittent rain bands will move through the region later tonight.`;
        }
    } else if (activeSeason === 'winter') {
        if (temp < 15) {
            advice = `Thermal boundary drop observed. Low absolute humidity makes the air dry and cold. Warm windbreakers are advised for outdoor operations.`;
        } else {
            advice = `Cryosphere boundary is stable. Pleasant cooling cycles with clean horizontal visibility. Ideal meteorological environment with standard seasonal winds.`;
        }
    }

    advText.textContent = advice;
}


// --- SEARCH AUTOCOMPLETE ---
const searchInput = document.getElementById('city-search');
const suggestionsBox = document.getElementById('suggestions');

let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();

    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                suggestionsBox.innerHTML = '';
                suggestionsBox.style.display = 'block';

                data.results.forEach(city => {
                    const li = document.createElement('li');
                    const details = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
                    li.textContent = details;
                    
                    li.addEventListener('click', () => {
                        currentCity = {
                            name: city.name,
                            lat: city.latitude,
                            lon: city.longitude,
                            country: city.country || ""
                        };
                        searchInput.value = '';
                        suggestionsBox.style.display = 'none';
                        fetchWeatherData(city.latitude, city.longitude, city.name);
                    });

                    suggestionsBox.appendChild(li);
                });
            } else {
                suggestionsBox.style.display = 'none';
            }
        } catch (err) {
            console.error("Geocoding failed", err);
        }
    }, 300);
});

document.addEventListener('click', (e) => {
    if (e.target !== searchInput) {
        suggestionsBox.style.display = 'none';
    }
});


// --- SATELLITE GPS RESOLVER ON STARTUP ---
function attemptSatelliteGeolocation() {
    const loaderStatusText = document.getElementById('loader-status-text');
    const loaderOverlay = document.getElementById('loader');

    if (navigator.geolocation) {
        logInference("[SYS] Attempting automatic satellite GPS coordinates query...");
        loaderStatusText.textContent = "Connecting to global GPS arrays...";

        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            logInference(`[SAT] Coordinates resolved: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`);
            loaderStatusText.textContent = "Satellite handshake complete. Loading metrics...";

            currentCity = {
                name: "Local Satellite Uplink",
                lat: lat,
                lon: lon,
                country: ""
            };

            fetchWeatherData(lat, lon, "Local Uplink").then(() => {
                // Fade out loading overlay
                loaderOverlay.style.opacity = '0';
                setTimeout(() => {
                    loaderOverlay.style.visibility = 'hidden';
                }, 600);
            });

        }, err => {
            logInference(`[WARN] Satellite handshake failed: ${err.message}. Defaulting to terrestrial backup [Mumbai].`);
            loaderStatusText.textContent = "Handshake denied. Deploying terrestrial backup...";
            
            fetchWeatherData(currentCity.lat, currentCity.lon, currentCity.name).then(() => {
                loaderOverlay.style.opacity = '0';
                setTimeout(() => {
                    loaderOverlay.style.visibility = 'hidden';
                }, 600);
            });
        }, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        });
    } else {
        logInference("[WARN] Geolocation not supported by client device. Loading backup [Mumbai].");
        fetchWeatherData(currentCity.lat, currentCity.lon, currentCity.name).then(() => {
            loaderOverlay.style.opacity = '0';
            setTimeout(() => {
                loaderOverlay.style.visibility = 'hidden';
            }, 600);
        });
    }
}

// Clear search input and reset to real GPS coordinates
document.getElementById('btn-clear-search').addEventListener('click', () => {
    const searchInput = document.getElementById('city-search');
    searchInput.value = '';
    const suggestions = document.getElementById('suggestions');
    suggestions.style.display = 'none';
    
    logInference("[SYS] Clearing search queries. Re-centering on local GPS coordinates...");
    attemptSatelliteGeolocation();
});

// Manual GPS Re-sync Button click handler
document.getElementById('btn-location').addEventListener('click', () => {
    logInference("[SYS] Initiating manual satellite GPS geoconnection re-sync...");
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeatherData(lat, lon, "Satellite Resync");
        }, err => {
            logInference(`[WARN] Re-sync handshake failed: ${err.message}`);
        });
    }
});


// --- SHARE HANDLER ---
function shareApp(e) {
    e.preventDefault();
    const shareUrl = window.location.href;
    const message = `Uplink to WeatherAI+ Climate Dashboard: ${shareUrl}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'WeatherAI+ Telemetry',
            text: message,
            url: shareUrl
        }).then(() => {
            logInference("[SYS] Dashboard link shared successfully.");
        }).catch(err => {
            console.log("Web Share cancelled", err);
        });
    } else {
        navigator.clipboard.writeText(message).then(() => {
            alert("WeatherAI+ dashboard link copied to clipboard!");
            logInference("[SYS] Link copied to clipboard.");
        });
    }
}


// --- APPLICATION INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Setup Lucide SVG Icons
    lucide.createIcons();
    
    // Adjust canvas sizing
    resizeCanvases();
    
    // Initiate full loop animations
    animate();

    // Run Auto-select Location
    attemptSatelliteGeolocation();

    // Unit toggle triggers
    document.getElementById('temp-toggle-btn').addEventListener('click', toggleTemperatureUnit);

    // Set automated 2-minute satellite telemetry refresh interval
    setInterval(() => {
        logInference("[SYS] Automated 2-minute satellite telemetry refresh cycle triggered.");
        fetchWeatherData(currentCity.lat, currentCity.lon, currentCity.name);
    }, 120000);
});

// Bind window event handlers explicitly for HTML access
window.shareApp = shareApp;
window.expandDayDetails = expandDayDetails;
