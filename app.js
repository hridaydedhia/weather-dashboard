/**
 * app.js
 * Interactive Weather & Forecast Dashboard
 *
 * Phase 3A: API Integration and Application Foundation
 * Phase 3B: Weather Data Processing and DOM Rendering
 *
 * API: Open-Meteo (no API key required)
 * Language: Vanilla ES6+ JavaScript (fetch, async/await)
 */

/* ==========================================================================
   1. DOM References
   ========================================================================== */

const searchForm        = document.getElementById('search-form');
const cityInput         = document.getElementById('city-search-input');

const loadingIndicator  = document.getElementById('loading-indicator');

const errorContainer    = document.getElementById('error-container');
const errorMessageEl    = document.getElementById('error-message');

// Current weather display elements
const currentCityEl       = document.getElementById('current-city');
const currentDateEl       = document.getElementById('current-date');
const currentWeatherIcon  = document.getElementById('current-weather-icon');
const currentTempEl       = document.getElementById('current-temperature');
const currentConditionEl  = document.getElementById('current-weather-condition');

// Metric display elements
const humidityValueEl   = document.getElementById('humidity-value');
const windSpeedValueEl  = document.getElementById('wind-speed-value');
const feelsLikeValueEl  = document.getElementById('feels-like-value');

// Forecast elements
const forecastContainer     = document.getElementById('forecast-container');
const forecastCardTemplate  = document.getElementById('forecast-card-template');

/* ==========================================================================
   2. API Configuration
   ========================================================================== */

const API = {
    geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
    weather:   'https://api.open-meteo.com/v1/forecast',
};

/**
 * Weather variables requested from the Open-Meteo forecast endpoint.
 * These are the exact parameter names the API expects.
 */
const WEATHER_PARAMS = {
    current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'is_day',
    ].join(','),

    daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
    ].join(','),

    forecastDays: 5,
};

/* ==========================================================================
   3. Application State
   ========================================================================== */

/**
 * Central state object.
 * Populated after a successful search.
 * Phase 3B reads from this to render the UI.
 */
const state = {
    /** Geocoded location info from the geocoding API */
    location: null,

    /** Full weather response from the forecast API */
    weather: null,
};

/* ==========================================================================
   4. Event Listeners
   ========================================================================== */

/**
 * Listen for search form submissions.
 * The form submit event fires on both button click AND Enter key press,
 * so no separate keydown listener is needed.
 */
searchForm.addEventListener('submit', handleSearch);

/* ==========================================================================
   5. Search / Input Handling
   ========================================================================== */

/**
 * handleSearch()
 *
 * Entry point for a user-initiated weather search.
 * Orchestrates the full data-fetch and rendering flow:
 *   validate → geocode → fetch weather → store in state → render UI
 *
 * @param {Event} event - The form submit event
 */
async function handleSearch(event) {
    // 1. Prevent the browser's default form submission (page reload)
    event.preventDefault();

    // 2. Read and sanitize the city input
    const city = cityInput.value.trim();

    // 3. Validate: do not proceed if input is empty
    if (!city) {
        showError('Please enter a city name before searching.');
        return;
    }

    // 4. Reset any previous error and show the loading indicator
    hideError();
    showLoading();

    try {
        // 5. Step 1 — Geocode the city name to coordinates
        const location = await getLocationCoordinates(city);

        // 6. Step 2 — Fetch weather data using the resolved coordinates
        const weather = await getWeatherData(location.latitude, location.longitude);

        // 7. Persist results into application state
        state.location = location;
        state.weather  = weather;

        // 8. Render all weather data into the DOM
        renderWeather();

        // 9. Log a concise summary for verification during development
        console.log('✅ Weather data retrieved and rendered:', {
            location: state.location,
            current:  state.weather.current,
            daily:    state.weather.daily,
        });

    } catch (error) {
        // Surface meaningful error messages to the user
        showError(error.message);
        console.error('❌ Search failed:', error);
    } finally {
        // Always hide the loading indicator regardless of success or failure
        hideLoading();
    }
}

/* ==========================================================================
   6. Geocoding Service
   ========================================================================== */

/**
 * getLocationCoordinates()
 *
 * Calls the Open-Meteo Geocoding API to resolve a city name into
 * geographic coordinates and metadata.
 *
 * Geocoding API docs: https://open-meteo.com/en/docs/geocoding-api
 *
 * @param   {string} city - The raw city name entered by the user
 * @returns {Object}      - Location object: { name, country, latitude, longitude, timezone }
 * @throws  {Error}       - If the city is not found or the request fails
 */
async function getLocationCoordinates(city) {
    // Encode the city name so special characters are safe in a URL
    const encodedCity = encodeURIComponent(city);

    const url =
        `${API.geocoding}?name=${encodedCity}&count=1&language=en&format=json`;

    const response = await fetch(url);

    // Check for a non-2xx HTTP status (e.g. 500, 429)
    if (!response.ok) {
        throw new Error(
            `Geocoding service unavailable (HTTP ${response.status}). Please try again later.`
        );
    }

    const data = await response.json();

    // The API returns a "results" array; an empty array means the city wasn't found
    if (!data.results || data.results.length === 0) {
        throw new Error(
            'Location not found. Please check the city name and try again.'
        );
    }

    // Extract only the fields we need from the first (best-match) result
    const result = data.results[0];

    return {
        name:      result.name,
        country:   result.country   ?? '',
        latitude:  result.latitude,
        longitude: result.longitude,
        timezone:  result.timezone  ?? 'auto',
    };
}

/* ==========================================================================
   7. Weather Service
   ========================================================================== */

/**
 * getWeatherData()
 *
 * Calls the Open-Meteo Forecast API to retrieve current conditions
 * and the 5-day daily forecast.
 *
 * Forecast API docs: https://open-meteo.com/en/docs
 *
 * @param   {number} latitude  - Decimal latitude from geocoding
 * @param   {number} longitude - Decimal longitude from geocoding
 * @returns {Object}           - The full API response object (current + daily)
 * @throws  {Error}            - If the request fails or response is malformed
 */
async function getWeatherData(latitude, longitude) {
    const params = new URLSearchParams({
        latitude,
        longitude,
        current:       WEATHER_PARAMS.current,
        daily:         WEATHER_PARAMS.daily,
        forecast_days: WEATHER_PARAMS.forecastDays,
        timezone:      'auto',  // Automatically use the location's local timezone
    });

    const url = `${API.weather}?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Weather service unavailable (HTTP ${response.status}). Please try again later.`
        );
    }

    const data = await response.json();

    // Validate the shape of the response before trusting it
    if (!data.current || !data.daily) {
        throw new Error(
            'Unexpected response from the weather service. Please try again.'
        );
    }

    return data;
}

/* ==========================================================================
   8. Loading State
   ========================================================================== */

/**
 * showLoading()
 *
 * Reveals the loading indicator. The element uses role="status" and
 * aria-live="polite" so screen readers announce it unobtrusively.
 */
function showLoading() {
    loadingIndicator.removeAttribute('hidden');
}

/**
 * hideLoading()
 *
 * Hides the loading indicator.
 */
function hideLoading() {
    loadingIndicator.setAttribute('hidden', '');
}

/* ==========================================================================
   9. Error Handling
   ========================================================================== */

/**
 * showError()
 *
 * Displays a user-readable error message. The container uses role="alert"
 * and aria-live="assertive" so screen readers announce it immediately.
 *
 * @param {string} message - The human-readable error message to display
 */
function showError(message) {
    errorMessageEl.textContent = message;
    errorContainer.removeAttribute('hidden');
}

/**
 * hideError()
 *
 * Clears and hides the error container.
 */
function hideError() {
    errorMessageEl.textContent = '';
    errorContainer.setAttribute('hidden', '');
}

/* ==========================================================================
   10. Application Initialization
   ========================================================================== */

/**
 * init()
 *
 * Runs once when the script loads (deferred, so the DOM is already ready).
 * The dashboard starts in its placeholder state; no city is pre-searched.
 */
function init() {
    hideLoading();
    hideError();
    console.log('🌤 Weather Dashboard initialized. Waiting for user search.');
}

// Kick off the application
init();

/* ==========================================================================
   11. Weather Data Processing & Rendering
   ========================================================================== */

/* --------------------------------------------------------------------------
   11a. WMO Weather Code Mapping
   --------------------------------------------------------------------------
   Open-Meteo uses WMO (World Meteorological Organization) weather codes.
   Each code maps to a human-readable condition label and an emoji icon.
   The is_day flag (1 = daytime, 0 = night) is used to choose between
   sun and moon icons for clear-sky conditions.
   -------------------------------------------------------------------------- */

/**
 * getWeatherInfo()
 *
 * Converts a WMO weather code into a human-readable condition string
 * and an appropriate emoji icon.
 *
 * @param   {number}  code  - WMO weather interpretation code
 * @param   {number}  isDay - 1 if daytime, 0 if night (from API)
 * @returns {Object}        - { condition: string, emoji: string }
 */
function getWeatherInfo(code, isDay) {
    // WMO weather code table, based on Open-Meteo's official documentation.
    // Each entry: [condition label, daytime emoji, nighttime emoji]
    const codeMap = {
        0:  ['Clear Sky',           '☀️',  '🌙'],
        1:  ['Mainly Clear',        '🌤️', '🌙'],
        2:  ['Partly Cloudy',       '⛅',  '🌑'],
        3:  ['Overcast',            '☁️',  '☁️'],
        45: ['Fog',                 '🌫️', '🌫️'],
        48: ['Icy Fog',             '🌫️', '🌫️'],
        51: ['Light Drizzle',       '🌦️', '🌧️'],
        53: ['Moderate Drizzle',    '🌦️', '🌧️'],
        55: ['Heavy Drizzle',       '🌧️', '🌧️'],
        56: ['Light Freezing Drizzle', '🌧️', '🌧️'],
        57: ['Heavy Freezing Drizzle', '🌧️', '🌧️'],
        61: ['Slight Rain',         '🌧️', '🌧️'],
        63: ['Moderate Rain',       '🌧️', '🌧️'],
        65: ['Heavy Rain',          '🌧️', '🌧️'],
        66: ['Light Freezing Rain', '🌧️', '🌧️'],
        67: ['Heavy Freezing Rain', '🌧️', '🌧️'],
        71: ['Slight Snowfall',     '❄️',  '❄️'],
        73: ['Moderate Snowfall',   '❄️',  '❄️'],
        75: ['Heavy Snowfall',      '❄️',  '❄️'],
        77: ['Snow Grains',         '🌨️', '🌨️'],
        80: ['Slight Rain Showers', '🌦️', '🌧️'],
        81: ['Moderate Rain Showers','🌦️','🌧️'],
        82: ['Violent Rain Showers','🌧️', '🌧️'],
        85: ['Slight Snow Showers', '🌨️', '🌨️'],
        86: ['Heavy Snow Showers',  '🌨️', '🌨️'],
        95: ['Thunderstorm',        '⛈️',  '⛈️'],
        96: ['Thunderstorm with Hail', '⛈️', '⛈️'],
        99: ['Thunderstorm with Heavy Hail', '⛈️', '⛈️'],
    };

    const entry = codeMap[code];

    if (!entry) {
        // Graceful fallback for any unrecognized code
        return { condition: 'Unknown Condition', emoji: '🌡️' };
    }

    const [condition, dayEmoji, nightEmoji] = entry;
    const emoji = isDay === 1 ? dayEmoji : nightEmoji;

    return { condition, emoji };
}

/* --------------------------------------------------------------------------
   11b. Icon Rendering
   --------------------------------------------------------------------------
   We cannot put an emoji directly as an <img> src in the traditional sense.
   Instead, we encode the emoji inside a minimal inline SVG and use a
   data: URI as the src. This works in all modern browsers, requires
   zero external dependencies, and preserves the existing <img> IDs/classes.
   -------------------------------------------------------------------------- */

/**
 * createWeatherIconSrc()
 *
 * Generates a data-URI src string that renders an emoji inside an SVG,
 * suitable for use as an <img> src attribute.
 *
 * @param   {string} emoji  - The emoji character to render
 * @param   {number} size   - The desired viewBox/render size in px
 * @returns {string}        - A data:image/svg+xml URI
 */
function createWeatherIconSrc(emoji, size = 64) {
    // fontSize is proportional to the container size
    const fontSize = Math.round(size * 0.72);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 ${size} ${size}"
        width="${size}" height="${size}">
        <text
            x="50%"
            y="${Math.round(size * 0.82)}"
            text-anchor="middle"
            font-size="${fontSize}"
            font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        >${emoji}</text>
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* --------------------------------------------------------------------------
   11c. Date Formatting
   -------------------------------------------------------------------------- */

/**
 * formatCurrentDate()
 *
 * Formats the current date in the searched location's local timezone.
 * Uses the Intl.DateTimeFormat API for locale-aware, timezone-correct output.
 *
 * @param   {string} timezone - IANA timezone string, e.g. "Asia/Kolkata"
 * @returns {Object}          - { display: string, iso: string }
 *                              display: "Friday, October 2"
 *                              iso: "2026-10-02" (for <time datetime="">)
 */
function formatCurrentDate(timezone) {
    const now = new Date();

    // Format the readable display date in the location's local timezone
    const display = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        month:   'long',
        day:     'numeric',
    }).format(now);

    // Build an ISO date string (YYYY-MM-DD) in the location's local timezone
    // by extracting year/month/day parts from the timezone-shifted date
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year:     'numeric',
        month:    '2-digit',
        day:      '2-digit',
    }).format(now);
    // en-CA locale produces "YYYY-MM-DD" format natively

    return { display, iso: parts };
}

/**
 * formatForecastDate()
 *
 * Converts an ISO date string ("YYYY-MM-DD") from the daily forecast array
 * into two readable labels for the forecast card.
 *
 * Open-Meteo daily dates are already in the location's local timezone,
 * so we parse them as local dates (using year/month/day components)
 * rather than letting the Date constructor treat them as UTC midnight.
 *
 * @param   {string} dateStr - ISO date string from the API, e.g. "2026-10-03"
 * @returns {Object}         - { day: "Saturday", date: "Oct 3", iso: "2026-10-03" }
 */
function formatForecastDate(dateStr) {
    // Destructure to avoid UTC-midnight timezone-shift issues
    const [year, month, day] = dateStr.split('-').map(Number);

    // new Date(year, monthIndex, day) creates a LOCAL date with no UTC shift
    const dateObj = new Date(year, month - 1, day);

    const dayLabel  = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return { day: dayLabel, date: dateLabel, iso: dateStr };
}

/* --------------------------------------------------------------------------
   11d. Rendering Functions
   -------------------------------------------------------------------------- */

/**
 * renderWeather()
 *
 * Top-level rendering coordinator.
 * Reads from the global `state` object and delegates to three
 * focused sub-renderers. Called after every successful API fetch.
 */
function renderWeather() {
    renderCurrentWeather();
    renderWeatherMetrics();
    renderForecast();
}

/**
 * renderCurrentWeather()
 *
 * Populates the current weather card using state.location and
 * state.weather.current.
 *
 * Updates:
 *   - City name (#current-city)
 *   - Local date (#current-date)
 *   - Temperature (#current-temperature)
 *   - Weather condition (#current-weather-condition)
 *   - Weather icon (#current-weather-icon)
 */
function renderCurrentWeather() {
    const { location, weather } = state;
    const current = weather.current;

    // --- City Name ---
    // Display "City, Country" if country is available
    const locationLabel = location.country
        ? `${location.name}, ${location.country}`
        : location.name;
    currentCityEl.textContent = locationLabel;

    // --- Date ---
    const { display: dateDisplay, iso: dateISO } = formatCurrentDate(location.timezone);
    currentDateEl.textContent            = dateDisplay;
    currentDateEl.setAttribute('datetime', dateISO);

    // --- Temperature ---
    // Round to the nearest whole number; use "--" as a safe fallback
    const temp = current.temperature_2m;
    currentTempEl.textContent = (temp !== undefined && temp !== null)
        ? Math.round(temp)
        : '--';

    // --- Weather Condition & Icon ---
    const code  = current.weather_code;
    const isDay = current.is_day;
    const { condition, emoji } = getWeatherInfo(code, isDay);

    currentConditionEl.textContent = condition;
    currentWeatherIcon.src         = createWeatherIconSrc(emoji, 64);
    currentWeatherIcon.alt         = condition; // Descriptive alt text for accessibility
}

/**
 * renderWeatherMetrics()
 *
 * Populates the three secondary metric cards using state.weather.current.
 *
 * Updates:
 *   - Humidity (#humidity-value)
 *   - Wind speed (#wind-speed-value)
 *   - Feels like (#feels-like-value)
 */
function renderWeatherMetrics() {
    const current = state.weather.current;

    // Helper: safely round a value, returning "--" if undefined/null
    const safeRound = (val) =>
        (val !== undefined && val !== null) ? Math.round(val) : '--';

    humidityValueEl.textContent  = safeRound(current.relative_humidity_2m);
    windSpeedValueEl.textContent = safeRound(current.wind_speed_10m);
    feelsLikeValueEl.textContent = safeRound(current.apparent_temperature);
}

/**
 * renderForecast()
 *
 * Generates the 5-day forecast cards dynamically from the HTML <template>
 * element and inserts them into #forecast-container.
 *
 * Process:
 *   1. Clear existing cards (prevents duplication on repeated searches)
 *   2. Loop through daily forecast entries
 *   3. Clone the <template> for each day
 *   4. Fill in the cloned card's fields
 *   5. Append the completed card to the container
 */
function renderForecast() {
    const daily = state.weather.daily;

    // 1. Clear any previously rendered forecast cards
    forecastContainer.innerHTML = '';

    // Guard: ensure we actually have daily data arrays to work with
    if (!daily.time || daily.time.length === 0) {
        console.warn('No daily forecast data available.');
        return;
    }

    // 2. Iterate through each forecast day
    daily.time.forEach((dateStr, index) => {
        // 3. Clone the <template> content into a usable document fragment
        const clone = forecastCardTemplate.content.cloneNode(true);

        // 4. Locate the elements inside the cloned fragment
        //    Note: querySelector works on the document fragment
        const dayEl       = clone.querySelector('.forecast-day');
        const dateEl      = clone.querySelector('.forecast-date');
        const iconImg     = clone.querySelector('.forecast-icon');
        const conditionEl = clone.querySelector('.forecast-condition');
        const tempHighEl  = clone.querySelector('.temp-high-value');
        const tempLowEl   = clone.querySelector('.temp-low-value');

        // --- Date ---
        const { day, date, iso } = formatForecastDate(dateStr);
        dayEl.textContent              = day;
        dateEl.textContent             = date;
        dateEl.setAttribute('datetime', iso);

        // --- Weather Code & Icon ---
        const code  = daily.weather_code[index];
        // Forecast cards always use the daytime icon (is_day = 1)
        // since daily summaries represent the full day
        const { condition, emoji } = getWeatherInfo(code, 1);

        conditionEl.textContent = condition;
        iconImg.src             = createWeatherIconSrc(emoji, 48);
        iconImg.alt             = condition;

        // --- Temperatures ---
        const safeRound = (val) =>
            (val !== undefined && val !== null) ? Math.round(val) : '--';

        tempHighEl.textContent = safeRound(daily.temperature_2m_max[index]);
        tempLowEl.textContent  = safeRound(daily.temperature_2m_min[index]);

        // 5. Append the fully populated card to the forecast container
        forecastContainer.appendChild(clone);
    });
}
