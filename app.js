/**
 * app.js
 * Interactive Weather & Forecast Dashboard
 *
 * Phase 3A: API Integration and Application Foundation
 * Phase 3B: Weather Data Processing and DOM Rendering
 * Phase 3C.1: Celsius / Fahrenheit Unit Switching
 * Phase 3C.2: Recent Searches Using localStorage
 * Phase 3C.3: Use My Location / Browser Geolocation
 * Phase 3C.4: Dynamic Weather and Day/Night Theming
 * Phase 3C.5: Final Micro-Interactions and UI Polish
 *
 * API: Open-Meteo (no API key required)
 * Language: Vanilla ES6+ JavaScript (fetch, async/await)
 */

/* ==========================================================================
   1. DOM References
   ========================================================================== */

const searchForm        = document.getElementById('search-form');
const cityInput         = document.getElementById('city-search-input');
const searchSubmitBtn   = document.getElementById('search-submit-btn');

const loadingIndicator  = document.getElementById('loading-indicator');

const errorContainer    = document.getElementById('error-container');
const errorMessageEl    = document.getElementById('error-message');

// Header control buttons
const geolocationBtn    = document.getElementById('geolocation-btn');
const unitCelsiusBtn    = document.getElementById('unit-celsius-btn');
const unitFahrenheitBtn = document.getElementById('unit-fahrenheit-btn');

// Recent searches section and container
const recentSearchesSection   = document.getElementById('recent-searches-section');
const recentSearchesContainer = document.getElementById('recent-searches-container');

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
   2. API & Storage Configuration
   ========================================================================== */

const API = {
    geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
    weather:   'https://api.open-meteo.com/v1/forecast',
    reverse:   'https://api.bigdatacloud.net/data/reverse-geocode-client',
};

const STORAGE_KEYS = {
    recentSearches: 'weatherRecentSearches',
};

const MAX_RECENT_SEARCHES = 5;

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
 * - location: Geocoded location object from Open-Meteo or reverse geocoding.
 * - weather: Complete raw forecast API response (temperatures stored in Celsius).
 * - recentSearches: Array of recent location objects [{ name, country }, ...]
 */
const state = {
    /** Active temperature unit: 'celsius' | 'fahrenheit' */
    unit: 'celsius',

    /** Geocoded location info from geocoding service */
    location: null,

    /** Full weather response from the forecast API (kept in Celsius) */
    weather: null,

    /** Stored list of up to 5 recent searches */
    recentSearches: [],
};

/* ==========================================================================
   4. Event Listeners
   ========================================================================== */

// Search form submit (handles both Search button click and Enter key press)
searchForm.addEventListener('submit', handleSearch);

// Geolocation button
if (geolocationBtn) {
    geolocationBtn.addEventListener('click', handleGeolocation);
}

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
   6. Recent Searches (localStorage & State Management)
   ========================================================================== */

/**
 * loadRecentSearchesFromStorage()
 *
 * Safely loads and parses the recent searches array from localStorage.
 * Handles missing keys and corrupt JSON gracefully by returning an empty array.
 *
 * @returns {Array<Object>} - Array of { name: string, country: string }
 */
function loadRecentSearchesFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.recentSearches);
        if (!stored) {
            return [];
        }
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('⚠️ Unable to load recent searches from localStorage:', error);
        return [];
    }
}

/**
 * saveRecentSearchesToStorage()
 *
 * Safely persists the recent searches array to localStorage.
 * Fails gracefully if storage quota is exceeded or storage is disabled.
 *
 * @param {Array<Object>} searches - Array of location objects to persist
 */
function saveRecentSearchesToStorage(searches) {
    try {
        localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(searches));
    } catch (error) {
        console.warn('⚠️ Unable to save recent searches to localStorage:', error);
    }
}

/**
 * addRecentSearch()
 *
 * Adds a geocoded location to recent searches:
 * - Uses the geocoded location's name and country.
 * - Case-insensitive deduplication: if already present, removes the old entry first.
 * - Appends the new entry to the end (most recent).
 * - Caps the list at MAX_RECENT_SEARCHES (5), dropping the oldest.
 * - Saves to localStorage and updates DOM.
 *
 * @param {Object} location - Geocoded location object { name: string, country: string }
 */
function addRecentSearch(location) {
    if (!location || !location.name || location.name === 'Your Location') {
        return;
    }

    const newEntry = {
        name:    location.name,
        country: location.country || '',
    };

    // Normalized key for duplicate detection: "name|country" in lower case
    const normalize = (item) =>
        `${(item.name || '').trim().toLowerCase()}|${(item.country || '').trim().toLowerCase()}`;

    const targetKey = normalize(newEntry);

    // Remove any existing entry matching the same normalized location
    const updated = state.recentSearches.filter((item) => normalize(item) !== targetKey);

    // Add the new location at the end (newest)
    updated.push(newEntry);

    // Keep only the last 5 entries (dropping the oldest from the front)
    if (updated.length > MAX_RECENT_SEARCHES) {
        updated.splice(0, updated.length - MAX_RECENT_SEARCHES);
    }

    state.recentSearches = updated;
    saveRecentSearchesToStorage(updated);
    renderRecentSearches();
}

/**
 * renderRecentSearches()
 *
 * Renders the recent search chips:
 * - If recentSearches is empty, hides #recent-searches-section.
 * - If searches exist, displays the section and builds accessible chip buttons.
 * - Uses document.createElement() and textContent to prevent XSS.
 * - Each button triggers searchCity() when clicked.
 */
function renderRecentSearches() {
    if (!recentSearchesContainer || !recentSearchesSection) {
        return;
    }

    // Clear existing chip elements
    recentSearchesContainer.innerHTML = '';

    // If no recent searches, hide the section
    if (!state.recentSearches || state.recentSearches.length === 0) {
        recentSearchesSection.setAttribute('hidden', '');
        return;
    }

    // Reveal the section
    recentSearchesSection.removeAttribute('hidden');

    // Create chip button for each search
    state.recentSearches.forEach((search) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-chip';

        // City name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chip-name';
        nameSpan.textContent = search.name;
        btn.appendChild(nameSpan);

        // Optional subtle country indicator
        if (search.country) {
            const countrySpan = document.createElement('span');
            countrySpan.className = 'chip-country';
            countrySpan.textContent = search.country;
            btn.appendChild(countrySpan);
        }

        const fullLabel = search.country
            ? `${search.name}, ${search.country}`
            : search.name;
        btn.setAttribute('aria-label', `Search weather for ${fullLabel}`);

        // Clicking the chip triggers the search flow
        btn.addEventListener('click', () => {
            searchCity(search.name);
        });

        recentSearchesContainer.appendChild(btn);
    });
}

/* ==========================================================================
   7. Search / Input Handling
   ========================================================================== */

/**
 * handleSearch()
 *
 * Form submit handler for the city search form.
 * Reads the input value and initiates searchCity().
 *
 * @param {Event} event - The form submit event
 */
async function handleSearch(event) {
    event.preventDefault();
    const city = cityInput.value.trim();

    if (!city) {
        showError('Please enter a city name before searching.');
        return;
    }

    await searchCity(city);
}

/**
 * searchCity()
 *
 * Unified weather search flow shared by manual search and recent search chips:
 *   1. Updates input field value
 *   2. Validates input
 *   3. Shows loading & clears error
 *   4. Geocodes city to coordinates
 *   5. Fetches weather data
 *   6. Stores in application state
 *   7. Renders weather to DOM
 *   8. Adds location to recent searches
 *
 * @param {string} cityName - The city name to search for
 */
async function searchCity(cityName) {
    const city = (cityName || '').trim();

    if (!city) {
        showError('Please enter a city name before searching.');
        return;
    }

    // Reflect the selected city in the search input
    cityInput.value = city;

    // Reset error state and display loading spinner
    hideError();
    showLoading();

    try {
        // Step 1 — Geocode the city name to coordinates
        const location = await getLocationCoordinates(city);

        // Step 2 — Fetch weather data using the resolved coordinates
        const weather = await getWeatherData(location.latitude, location.longitude);

        // Step 3 — Persist results into application state
        state.location = location;
        state.weather  = weather;

        // Step 4 — Render all weather data into the DOM
        renderWeather();

        // Step 5 — Save location to recent searches
        addRecentSearch(location);

        console.log('✅ Weather data retrieved and rendered:', {
            location: state.location,
            unit:     state.unit,
            current:  state.weather.current,
            daily:    state.weather.daily,
        });

    } catch (error) {
        showError(error.message);
        console.error('❌ Search failed:', error);
    } finally {
        hideLoading();
    }
}

/* ==========================================================================
   8. Geocoding Service (Open-Meteo Geocoding API)
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
   9. Weather Service (Open-Meteo Forecast API)
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
   10. UI Feedback State Management
   ========================================================================== */

/**
 * showLoading()
 *
 * Activates the loading state:
 * - Unhides the #loading-indicator element
 * - Disables the search submit button, input, and geolocation button
 */
function showLoading() {
    loadingIndicator.removeAttribute('hidden');
    cityInput.setAttribute('disabled', '');
    if (searchSubmitBtn) {
        searchSubmitBtn.setAttribute('disabled', '');
    }
    if (geolocationBtn) {
        geolocationBtn.setAttribute('disabled', '');
    }
}

/**
 * hideLoading()
 *
 * Deactivates the loading state:
 * - Hides the #loading-indicator element
 * - Re-enables the search submit button, input, and geolocation button
 */
function hideLoading() {
    loadingIndicator.setAttribute('hidden', '');
    cityInput.removeAttribute('disabled');
    if (searchSubmitBtn) {
        searchSubmitBtn.removeAttribute('disabled');
    }
    if (geolocationBtn) {
        geolocationBtn.removeAttribute('disabled');
    }
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
   11. Application Initialization
   ========================================================================== */

/**
 * init()
 *
 * Runs once when the script loads (deferred, DOM ready).
 * 1. Resets loading and error states
 * 2. Initializes unit switcher button state
 * 3. Safely loads recent searches from localStorage and renders them
 */
function init() {
    hideLoading();
    hideError();
    updateUnitButtons();

    // Restore recent searches from localStorage (if any)
    state.recentSearches = loadRecentSearchesFromStorage();
    renderRecentSearches();

    console.log('🌤 Weather Dashboard initialized. Unit set to °C. Waiting for user search.');
}

// Kick off application
init();

/* ==========================================================================
   12. Geolocation (Browser GPS & Reverse Geocoding)
   ========================================================================== */

/**
 * getCurrentPosition()
 *
 * Promisified wrapper around native navigator.geolocation.getCurrentPosition().
 * Requests the device's location once.
 *
 * @param   {PositionOptions} [options] - Geolocation options
 * @returns {Promise<GeolocationPosition>}
 */
function getCurrentPosition(options = { timeout: 10000, enableHighAccuracy: true }) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser. Please search for a city manually.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

/**
 * getLocationFromCoordinates()
 *
 * Resolves geographic coordinates to a human-readable city/location name.
 * Uses a free client reverse-geocoding service.
 * If reverse geocoding is unavailable or cannot determine a city,
 * falls back safely to "Your Location" to ensure the application never crashes.
 *
 * @param   {number} latitude  - Latitude coordinate
 * @param   {number} longitude - Longitude coordinate
 * @returns {Promise<Object>}  - Compatible state.location object
 */
async function getLocationFromCoordinates(latitude, longitude) {
    const fallbackLocation = {
        name:      'Your Location',
        country:   '',
        latitude:  latitude,
        longitude: longitude,
        timezone:  'auto',
    };

    try {
        const url = new URL(API.reverse);
        url.searchParams.set('latitude', latitude);
        url.searchParams.set('longitude', longitude);
        url.searchParams.set('localityLanguage', 'en');

        const response = await fetch(url.toString());
        if (!response.ok) {
            return fallbackLocation;
        }

        const data = await response.json();
        const cityName = data.city || data.locality || data.principalSubdivision || '';
        const countryName = data.countryName || '';

        if (!cityName) {
            return fallbackLocation;
        }

        return {
            name:      cityName,
            country:   countryName,
            latitude:  latitude,
            longitude: longitude,
            timezone:  'auto',
        };
    } catch (error) {
        console.warn('⚠️ Reverse geocoding unavailable, using fallback:', error);
        return fallbackLocation;
    }
}

/**
 * handleGeolocationError()
 *
 * Maps GeolocationPositionError codes to clear, friendly user messages.
 *
 * @param   {GeolocationPositionError|Error} error
 * @returns {string} - Human-readable error description
 */
function handleGeolocationError(error) {
    if (!error) {
        return 'An unknown error occurred while retrieving your location.';
    }

    // Standard GeolocationPositionError error codes
    switch (error.code) {
        case 1: // PERMISSION_DENIED
            return 'Location access was denied. Please allow location access or search for a city manually.';
        case 2: // POSITION_UNAVAILABLE
            return 'Your location could not be determined. Please try again or search for a city.';
        case 3: // TIMEOUT
            return 'Location request timed out. Please try again.';
        default:
            return error.message || 'An error occurred while retrieving your location. Please try searching manually.';
    }
}

/**
 * handleGeolocation()
 *
 * Dedicated click handler for the "Use My Location" button:
 *   1. Shows loading indicator and disables action buttons
 *   2. Requests user coordinates via navigator.geolocation
 *   3. Resolves coordinates to location name via reverse geocoding
 *   4. Reuses getWeatherData() to fetch live atmospheric data
 *   5. Updates state.location and state.weather
 *   6. Re-renders UI (preserving active °C/°F unit selection)
 *   7. Updates search input & adds to recent searches if valid city
 *   8. Handles all permission and device errors gracefully
 */
async function handleGeolocation() {
    hideError();
    showLoading();

    try {
        // Step 1: Request browser coordinates once
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        // Step 2: Concurrently resolve location name and fetch weather data
        const [location, weather] = await Promise.all([
            getLocationFromCoordinates(latitude, longitude),
            getWeatherData(latitude, longitude),
        ]);

        // If location timezone was fallback 'auto', update with timezone from weather data
        if (weather.timezone && weather.timezone !== 'auto') {
            location.timezone = weather.timezone;
        }

        // Step 3: Persist into application state
        state.location = location;
        state.weather  = weather;

        // Step 4: Render weather to DOM using existing renderer (preserves active unit)
        renderWeather();

        // Step 5: Update search input & recent searches only if real named city resolved
        if (location.name && location.name !== 'Your Location') {
            cityInput.value = location.name;
            addRecentSearch(location);
        } else {
            cityInput.value = '';
        }

        console.log('✅ Geolocation weather retrieved and rendered:', {
            location: state.location,
            unit:     state.unit,
            coords:   { latitude, longitude },
        });

    } catch (error) {
        const message = handleGeolocationError(error);
        showError(message);
        console.error('❌ Geolocation error:', error);
    } finally {
        hideLoading();
    }
}

/* ==========================================================================
   13. Dynamic Weather Theming
   ========================================================================== */

/**
 * getWeatherThemeCategory()
 *
 * Maps Open-Meteo WMO weather codes into atmospheric theme categories:
 * - 'clear': WMO 0, 1 (Clear, Mainly Clear)
 * - 'cloudy': WMO 2, 3 (Partly Cloudy, Overcast)
 * - 'fog': WMO 45, 48 (Fog, Icy Fog)
 * - 'rain': WMO 51-67, 80-82 (Drizzle, Rain, Rain Showers)
 * - 'snow': WMO 71-77, 85-86 (Snowfall, Snow Grains, Snow Showers)
 * - 'storm': WMO 95-99 (Thunderstorms)
 *
 * @param   {number} code - WMO weather interpretation code
 * @returns {string}      - Theme category name ('clear', 'cloudy', 'fog', 'rain', 'snow', 'storm')
 */
function getWeatherThemeCategory(code) {
    if (code === 0 || code === 1) {
        return 'clear';
    }
    if (code === 2 || code === 3) {
        return 'cloudy';
    }
    if (code === 45 || code === 48) {
        return 'fog';
    }
    if (
        (code >= 51 && code <= 67) ||
        (code >= 80 && code <= 82)
    ) {
        return 'rain';
    }
    if (
        (code >= 71 && code <= 77) ||
        code === 85 ||
        code === 86
    ) {
        return 'snow';
    }
    if (code >= 95 && code <= 99) {
        return 'storm';
    }
    return 'clear';
}

/**
 * applyWeatherTheme()
 *
 * Dynamically selects and applies an atmospheric theme based on:
 *   1. state.weather.current.weather_code (clear, cloudy, fog, rain, snow, storm)
 *   2. state.weather.current.is_day (1 = day, 0 = night)
 *
 * Sets document.documentElement.dataset.theme = `${dayOrNight}-${category}`.
 * The visual appearance is governed completely by CSS custom properties in styles.css.
 */
function applyWeatherTheme() {
    if (!state.weather || !state.weather.current) {
        return;
    }

    const { weather_code, is_day } = state.weather.current;
    const category = getWeatherThemeCategory(weather_code);
    const dayOrNight = is_day === 1 ? 'day' : 'night';
    const themeName = `${dayOrNight}-${category}`;

    document.documentElement.dataset.theme = themeName;
    console.log(`🎨 Applied weather theme: "${themeName}" (WMO: ${weather_code}, is_day: ${is_day})`);
}

/* ==========================================================================
   14. Weather Data Processing & Rendering
   ========================================================================== */

/* --------------------------------------------------------------------------
   14a. WMO Weather Code Mapping
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
   13b. Icon Rendering
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
   13c. Date Formatting
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
   13d. Rendering Functions
   -------------------------------------------------------------------------- */

/**
 * renderWeather()
 *
 * Top-level rendering coordinator.
 * Reads state.weather and state.unit to render current weather,
 * metrics, and 5-day forecast.
 */
function renderWeather() {
    applyWeatherTheme();
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

        // Assign staggered entrance animation delay (50ms per card)
        const cardArticle = clone.querySelector('.forecast-card');
        if (cardArticle) {
            cardArticle.style.setProperty('--reveal-delay', `${index * 50}ms`);
        }

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
