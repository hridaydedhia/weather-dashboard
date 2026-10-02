/**
 * app.js
 * Interactive Weather & Forecast Dashboard
 *
 * Phase 3A: API Integration and Application Foundation
 * Phase 3B: Weather Data Processing and DOM Rendering
 * Phase 3C.1: Celsius / Fahrenheit Unit Switching
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

// Unit switcher buttons
const unitCelsiusBtn    = document.getElementById('unit-celsius-btn');
const unitFahrenheitBtn = document.getElementById('unit-fahrenheit-btn');

// Current weather display elements
const currentCityEl       = document.getElementById('current-city');
const currentDateEl       = document.getElementById('current-date');
const currentWeatherIcon  = document.getElementById('current-weather-icon');
const currentTempEl       = document.getElementById('current-temperature');
const currentTempUnitEl   = document.querySelector('.temperature-wrapper .temperature-unit');
const currentConditionEl  = document.getElementById('current-weather-condition');

// Metric display elements
const humidityValueEl   = document.getElementById('humidity-value');
const windSpeedValueEl  = document.getElementById('wind-speed-value');
const feelsLikeValueEl  = document.getElementById('feels-like-value');
const feelsLikeUnitEl   = document.querySelector('#feels-like-value + .metric-unit');

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
 * Open-Meteo returns temperatures in Celsius by default.
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
 * Central application state.
 *
 * - unit: Active temperature unit ('celsius' | 'fahrenheit'). Defaults to 'celsius'.
 * - location: Geocoded location object from Open-Meteo.
 * - weather: Complete raw forecast API response (temperatures stored in Celsius).
 */
const state = {
    /** Active temperature unit: 'celsius' | 'fahrenheit' */
    unit: 'celsius',

    /** Geocoded location info from the geocoding API */
    location: null,

    /** Full weather response from the forecast API (kept in Celsius) */
    weather: null,
};

/* ==========================================================================
   4. Event Listeners
   ========================================================================== */

// Search form submit (handles both Search button click and Enter key press)
searchForm.addEventListener('submit', handleSearch);

// Temperature unit switcher buttons
unitCelsiusBtn.addEventListener('click', () => setUnit('celsius'));
unitFahrenheitBtn.addEventListener('click', () => setUnit('fahrenheit'));

/* ==========================================================================
   5. Unit Switching & Conversion Helpers
   ========================================================================== */

/**
 * convertCelsiusToFahrenheit()
 *
 * Converts a temperature from Celsius to Fahrenheit using standard formula:
 *   F = (C * 9 / 5) + 32
 *
 * @param   {number} celsius - Temperature in degrees Celsius
 * @returns {number}         - Temperature in degrees Fahrenheit
 */
function convertCelsiusToFahrenheit(celsius) {
    return (celsius * 9 / 5) + 32;
}

/**
 * convertTemperature()
 *
 * Returns the temperature converted to the active state.unit.
 * If Celsius is selected, returns the original Celsius value.
 * If Fahrenheit is selected, converts using convertCelsiusToFahrenheit().
 * Handles null/undefined/NaN values safely.
 *
 * @param   {number|null|undefined} celsius - Raw temperature in Celsius
 * @returns {number|null}                   - Converted temperature or null
 */
function convertTemperature(celsius) {
    if (celsius === null || celsius === undefined || isNaN(celsius)) {
        return null;
    }
    if (state.unit === 'fahrenheit') {
        return convertCelsiusToFahrenheit(celsius);
    }
    return celsius;
}

/**
 * formatTemperature()
 *
 * Reusable helper to format temperatures for display:
 *   1. Handles missing/null values safely by returning '--'.
 *   2. Converts only when Fahrenheit is selected in state.unit.
 *   3. Rounds to the nearest whole integer using Math.round().
 *   4. Returns the numeric string representation (e.g., '29', '84', '--').
 *
 * @param   {number|null|undefined} celsius - Raw temperature in Celsius
 * @returns {string}                        - Rounded numeric string or '--'
 */
function formatTemperature(celsius) {
    const converted = convertTemperature(celsius);
    if (converted === null) {
        return '--';
    }
    return Math.round(converted).toString();
}

/**
 * getTemperatureUnitSymbol()
 *
 * Returns the visible unit symbol for the active temperature unit.
 *
 * @returns {string} - '°C' or '°F'
 */
function getTemperatureUnitSymbol() {
    return state.unit === 'fahrenheit' ? '°F' : '°C';
}

/**
 * updateUnitButtons()
 *
 * Synchronizes the aria-pressed attribute on both unit buttons with state.unit.
 * The CSS selector .btn-unit[aria-pressed="true"] controls active styles.
 */
function updateUnitButtons() {
    const isCelsius = state.unit === 'celsius';
    unitCelsiusBtn.setAttribute('aria-pressed', isCelsius ? 'true' : 'false');
    unitFahrenheitBtn.setAttribute('aria-pressed', isCelsius ? 'false' : 'true');
}

/**
 * setUnit()
 *
 * Updates state.unit and re-renders the weather dashboard.
 * - Does NOT trigger a new API request.
 * - Re-renders only if weather data is already present in state.
 * - Safe to call before any search has been performed.
 *
 * @param {'celsius' | 'fahrenheit'} newUnit - The chosen temperature unit
 */
function setUnit(newUnit) {
    if (state.unit === newUnit) {
        return;
    }

    state.unit = newUnit;
    updateUnitButtons();

    // If weather data is already loaded, re-render it with the newly selected unit
    if (state.weather && state.location) {
        renderWeather();
    }
}

/* ==========================================================================
   6. Search / Input Handling
   ========================================================================== */

/**
 * handleSearch()
 *
 * Entry point for a user-initiated weather search.
 * Orchestrates the full data-fetch and rendering flow:
 *   validate -> geocode -> fetch weather -> store in state -> render UI
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
            unit:     state.unit,
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
   7. Geocoding Service (Open-Meteo Geocoding API)
   ========================================================================== */

/**
 * getLocationCoordinates()
 *
 * Resolves a human-entered city name to geographic coordinates.
 *
 * @param   {string}        cityName - The city name entered by the user
 * @returns {Promise<Object>}        - Object containing { name, latitude, longitude, country, timezone }
 * @throws  {Error}                  - If network fails, HTTP error occurs, or no city is found
 */
async function getLocationCoordinates(cityName) {
    const url = new URL(API.geocoding);
    url.searchParams.set('name', cityName);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    let response;
    try {
        response = await fetch(url.toString());
    } catch {
        throw new Error('Network error: Unable to connect to the geocoding service. Please check your internet connection.');
    }

    if (!response.ok) {
        throw new Error(`Geocoding service unavailable (HTTP ${response.status}). Please try again later.`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        throw new Error(`Location "${cityName}" not found. Please check the spelling and try again.`);
    }

    const first = data.results[0];

    return {
        name:      first.name,
        latitude:  first.latitude,
        longitude: first.longitude,
        country:   first.country || '',
        timezone:  first.timezone || 'auto',
    };
}

/* ==========================================================================
   8. Weather Service (Open-Meteo Forecast API)
   ========================================================================== */

/**
 * getWeatherData()
 *
 * Fetches current weather conditions and a 5-day daily forecast for coordinates.
 * The API always returns Celsius data, which is stored in its raw form in state.
 *
 * @param   {number}        latitude  - Latitude of the target location
 * @param   {number}        longitude - Longitude of the target location
 * @returns {Promise<Object>}         - Raw JSON response from Open-Meteo
 * @throws  {Error}                   - If network fails or HTTP error occurs
 */
async function getWeatherData(latitude, longitude) {
    const url = new URL(API.weather);
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('current', WEATHER_PARAMS.current);
    url.searchParams.set('daily', WEATHER_PARAMS.daily);
    url.searchParams.set('forecast_days', WEATHER_PARAMS.forecastDays);
    url.searchParams.set('timezone', 'auto');

    let response;
    try {
        response = await fetch(url.toString());
    } catch {
        throw new Error('Network error: Unable to connect to the weather service. Please check your internet connection.');
    }

    if (!response.ok) {
        throw new Error(`Weather service unavailable (HTTP ${response.status}). Please try again later.`);
    }

    return await response.json();
}

/* ==========================================================================
   9. UI Feedback State Management
   ========================================================================== */

/**
 * showLoading()
 *
 * Activates the loading state:
 * - Unhides the #loading-indicator element
 * - Disables the search submit button and input to prevent duplicate requests
 */
function showLoading() {
    loadingIndicator.removeAttribute('hidden');
    cityInput.setAttribute('disabled', '');
    document.getElementById('search-submit-btn').setAttribute('disabled', '');
}

/**
 * hideLoading()
 *
 * Deactivates the loading state:
 * - Hides the #loading-indicator element
 * - Re-enables the search submit button and input
 */
function hideLoading() {
    loadingIndicator.setAttribute('hidden', '');
    cityInput.removeAttribute('disabled');
    document.getElementById('search-submit-btn').removeAttribute('disabled');
}

/**
 * showError()
 *
 * Displays a descriptive error message to the user.
 *
 * @param {string} message - Human-readable error description
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
 * Runs once when the script loads (deferred, DOM ready).
 * The dashboard starts in its default placeholder state with Celsius selected.
 */
function init() {
    hideLoading();
    hideError();
    updateUnitButtons();
    console.log('🌤 Weather Dashboard initialized. Unit set to °C. Waiting for user search.');
}

// Kick off application
init();

/* ==========================================================================
   11. Weather Data Processing & Rendering
   ========================================================================== */

/* --------------------------------------------------------------------------
   11a. WMO Weather Code Mapping
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
        return { condition: 'Unknown Condition', emoji: '🌡️' };
    }

    const [condition, dayEmoji, nightEmoji] = entry;
    const emoji = isDay === 1 ? dayEmoji : nightEmoji;

    return { condition, emoji };
}

/* --------------------------------------------------------------------------
   11b. Icon Rendering
   -------------------------------------------------------------------------- */

/**
 * createWeatherIconSrc()
 *
 * Generates an SVG data URI rendering an emoji, suitable for <img> src.
 *
 * @param   {string} emoji - The emoji character to render
 * @param   {number} size  - The desired viewBox/render size in px
 * @returns {string}       - A data:image/svg+xml URI
 */
function createWeatherIconSrc(emoji, size = 64) {
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
 * Formats the current date in the location's local timezone.
 *
 * @param   {string} timezone - IANA timezone string, e.g. "Asia/Kolkata"
 * @returns {Object}          - { display: string, iso: string }
 */
function formatCurrentDate(timezone) {
    const now = new Date();

    const display = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        month:   'long',
        day:     'numeric',
    }).format(now);

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year:     'numeric',
        month:    '2-digit',
        day:      '2-digit',
    }).format(now);

    return { display, iso: parts };
}

/**
 * formatForecastDate()
 *
 * Converts an ISO date string ("YYYY-MM-DD") from the daily forecast array
 * into display labels for the forecast card.
 *
 * @param   {string} dateStr - ISO date string from the API
 * @returns {Object}         - { day: string, date: string, iso: string }
 */
function formatForecastDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
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
 * Reads state.weather and state.unit to render current weather,
 * metrics, and 5-day forecast.
 */
function renderWeather() {
    renderCurrentWeather();
    renderWeatherMetrics();
    renderForecast();
}

/**
 * renderCurrentWeather()
 *
 * Populates the current weather card using state.location,
 * state.weather.current, and state.unit.
 *
 * Updates:
 *   - City name (#current-city)
 *   - Local date (#current-date)
 *   - Temperature (#current-temperature) converted via formatTemperature()
 *   - Visible unit (.temperature-unit) updated to °C or °F
 *   - Weather condition (#current-weather-condition)
 *   - Weather icon (#current-weather-icon)
 */
function renderCurrentWeather() {
    const { location, weather } = state;
    const current = weather.current;

    // --- City Name ---
    const locationLabel = location.country
        ? `${location.name}, ${location.country}`
        : location.name;
    currentCityEl.textContent = locationLabel;

    // --- Date ---
    const { display: dateDisplay, iso: dateISO } = formatCurrentDate(location.timezone);
    currentDateEl.textContent = dateDisplay;
    currentDateEl.setAttribute('datetime', dateISO);

    // --- Temperature ---
    currentTempEl.textContent = formatTemperature(current.temperature_2m);
    if (currentTempUnitEl) {
        currentTempUnitEl.textContent = getTemperatureUnitSymbol();
    }

    // --- Weather Condition & Icon ---
    const code  = current.weather_code;
    const isDay = current.is_day;
    const { condition, emoji } = getWeatherInfo(code, isDay);

    currentConditionEl.textContent = condition;
    currentWeatherIcon.src         = createWeatherIconSrc(emoji, 64);
    currentWeatherIcon.alt         = condition;
}

/**
 * renderWeatherMetrics()
 *
 * Populates the three secondary metric cards using state.weather.current.
 *
 * - Humidity: remains %
 * - Wind Speed: remains km/h
 * - Feels Like: converted to selected unit and formatted with °C or °F
 */
function renderWeatherMetrics() {
    const current = state.weather.current;

    // Helper: safely round a non-temperature value, returning '--' if null/undefined
    const safeRound = (val) =>
        (val !== undefined && val !== null) ? Math.round(val) : '--';

    // Humidity and Wind Speed must NOT change units
    humidityValueEl.textContent  = safeRound(current.relative_humidity_2m);
    windSpeedValueEl.textContent = safeRound(current.wind_speed_10m);

    // Feels-like temperature changes according to state.unit
    feelsLikeValueEl.textContent = formatTemperature(current.apparent_temperature);
    if (feelsLikeUnitEl) {
        feelsLikeUnitEl.textContent = getTemperatureUnitSymbol();
    }
}

/**
 * renderForecast()
 *
 * Generates the 5-day forecast cards from the <template> element
 * and inserts them into #forecast-container.
 * High and low temperatures and their unit symbols are updated based on state.unit.
 */
function renderForecast() {
    const daily = state.weather.daily;
    const unitSymbol = getTemperatureUnitSymbol();

    // 1. Clear any previously rendered forecast cards
    forecastContainer.innerHTML = '';

    // Guard: ensure daily data arrays exist
    if (!daily.time || daily.time.length === 0) {
        console.warn('No daily forecast data available.');
        return;
    }

    // 2. Iterate through each forecast day
    daily.time.forEach((dateStr, index) => {
        // 3. Clone the <template> content
        const clone = forecastCardTemplate.content.cloneNode(true);

        // 4. Locate elements inside the cloned fragment
        const dayEl       = clone.querySelector('.forecast-day');
        const dateEl      = clone.querySelector('.forecast-date');
        const iconImg     = clone.querySelector('.forecast-icon');
        const conditionEl = clone.querySelector('.forecast-condition');
        const tempHighEl  = clone.querySelector('.temp-high-value');
        const tempLowEl   = clone.querySelector('.temp-low-value');

        // --- Date ---
        const { day, date, iso } = formatForecastDate(dateStr);
        dayEl.textContent  = day;
        dateEl.textContent = date;
        dateEl.setAttribute('datetime', iso);

        // --- Weather Code & Icon ---
        const code = daily.weather_code[index];
        const { condition, emoji } = getWeatherInfo(code, 1);

        conditionEl.textContent = condition;
        iconImg.src             = createWeatherIconSrc(emoji, 48);
        iconImg.alt             = condition;

        // --- Temperatures ---
        tempHighEl.textContent = formatTemperature(daily.temperature_2m_max[index]);
        tempLowEl.textContent  = formatTemperature(daily.temperature_2m_min[index]);

        // --- Forecast Temperature Units ---
        if (tempHighEl.nextSibling) {
            tempHighEl.nextSibling.textContent = unitSymbol;
        }
        if (tempLowEl.nextSibling) {
            tempLowEl.nextSibling.textContent = unitSymbol;
        }

        // 5. Append the populated card to the forecast container
        forecastContainer.appendChild(clone);
    });
}
