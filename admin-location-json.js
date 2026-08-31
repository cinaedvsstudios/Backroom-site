/* Backroom Admin v1.11 — authoritative Country/City filters from live JSON files. */
(() => {
    'use strict';

    const state = {
        country: '',
        city: '',
        venues: [],
        events: [],
        venueMap: new Map(),
        venueById: new Map(),
        eventById: new Map(),
        loadPromise: null,
        timer: 0,
        observer: null
    };

    const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const key = (value) => clean(value)
        .toLocaleLowerCase('en')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const escapeHtml = (value) => clean(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function splitCities(value) {
        const values = Array.isArray(value) ? value : String(value ?? '').split(/[;,|]+/);
        return values.map(clean).filter(Boolean);
    }

    function directLocation(record) {
        return {
            country: clean(record?.Country || record?.Event_Country || record?.Venue_Country || record?.Location_Country),
            cities: splitCities(record?.City || record?.Event_City || record?.Venue_City || record?.Location_City)
        };
    }

    function resolveVenueLocation(record) {
        return directLocation(record || {});
    }

    function resolveEventLocation(record) {
        const direct = directLocation(record || {});
        const linked = state.venueMap.get(clean(record?.Venue_ID)) || { country: '', cities: [] };
        return {
            country: direct.country || linked.country,
            cities: direct.cities.length ? direct.cities : linked.cities
        };
    }

    function uniqueSorted(values) {
        const map = new Map();
        values.forEach((value) => {
            const display = clean(value);
            const normalized = key(display);
            if (display && normalized && !map.has(normalized)) map.set(normalized, display);
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    async function fetchJson(filename) {
        const response = await fetch(`${filename}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
        const parsed = await response.json();
        if (!Array.isArray(parsed)) throw new Error(`${filename}: expected a JSON array`);
        return parsed;
    }

    function rebuildIndexes() {
        state.venueMap = new Map();
        state.venueById = new Map();
        state.eventById = new Map();

        state.venues.forEach((record) => {
            const id = clean(record?.Venue_ID);
            if (!id) return;
            const location = resolveVenueLocation(record);
            state.venueById.set(id, record);
            state.venueMap.set(id, location);
        });

        state.events.forEach((record) => {
            const id = clean(record?.Event_ID);
            if (id) state.eventById.set(id, record);
        });
    }

    async function loadAuthoritativeJson(force = false) {
        if (state.loadPromise && !force) return state.loadPromise;

        state.loadPromise = Promise.allSettled([
            fetchJson('listings.json'),
            fetchJson('events.json')
        ]).then((results) => {
            const venueResult = results[0];
            const eventResult = results[1];
            const failures = [];

            if (venueResult.status === 'fulfilled') state.venues = venueResult.value;
            else failures.push(venueResult.reason?.message || 'listings.json failed');

            if (eventResult.status === 'fulfilled') state.events = eventResult.value;
            else failures.push(eventResult.reason?.message || 'events.json failed');

            rebuildIndexes();
            refreshControls();
            scheduleApply(80);

            if (failures.length && typeof showToast === 'function') {
                showToast(`Location list refresh failed: ${failures.join(' · ')}`);
            }
        }).finally(() => {
            state.loadPromise = null;
        });

        return state.loadPromise;
    }

    function getSourceRows() {
        return currentMode === 'events' ? state.events : state.venues;
    }

    function resolveSourceLocation(record) {
        return currentMode === 'events' ? resolveEventLocation(record) : resolveVenueLocation(record);
    }

    function getOptions() {
        const locations = getSourceRows().map((record) => resolveSourceLocation(record));
        const countries = uniqueSorted(locations.map((location) => location.country));
        const cities = uniqueSorted(locations.flatMap((location) => {
            if (state.country && key(location.country) !== key(state.country)) return [];
            return location.cities;
        }));
        return { countries, cities };
    }

    function installStyles() {
        if (document.getElementById('admin-json-location-style')) return;
        const style = document.createElement('style');
        style.id = 'admin-json-location-style';
        style.textContent = `
            #admin-location-filter-wrap { display:none !important; }
            #admin-json-location-filter-wrap {
                display:flex;
                gap:8px;
                align-items:center;
                flex:0 1 auto;
                flex-wrap:wrap;
            }
            #admin-json-country-filter,
            #admin-json-city-filter {
                width:auto;
                min-width:155px;
                max-width:230px;
                margin:0;
                padding:8px 34px 8px 13px;
                background:var(--panel-dark);
                color:#fff;
                border:1px solid var(--panel-mid);
            }
        `;
        document.head.appendChild(style);
    }

    function ensureControls() {
        installStyles();
        const toolbar = document.getElementById('btn-fetch-live')?.parentElement;
        if (!toolbar) return null;

        let wrap = document.getElementById('admin-json-location-filter-wrap');
        if (wrap) return wrap;

        wrap = document.createElement('div');
        wrap.id = 'admin-json-location-filter-wrap';
        wrap.title = 'Country and city options are built directly from listings.json and events.json';
        wrap.innerHTML = `
            <select id="admin-json-country-filter" class="form-input pill-input" aria-label="Filter records by country from live JSON">
                <option value="">Country</option>
            </select>
            <select id="admin-json-city-filter" class="form-input pill-input" aria-label="Filter records by city from live JSON">
                <option value="">City</option>
            </select>`;

        const oldWrap = document.getElementById('admin-location-filter-wrap');
        const clearButton = document.getElementById('btn-clear-all-filters');
        toolbar.insertBefore(wrap, oldWrap || clearButton || document.getElementById('btn-fetch-live'));

        wrap.querySelector('#admin-json-country-filter')?.addEventListener('change', (event) => {
            state.country = event.target.value;
            state.city = '';
            refreshControls();
            scheduleApply();
        });

        wrap.querySelector('#admin-json-city-filter')?.addEventListener('change', (event) => {
            state.city = event.target.value;
            scheduleApply();
        });

        return wrap;
    }

    function refreshControls() {
        ensureControls();
        const countrySelect = document.getElementById('admin-json-country-filter');
        const citySelect = document.getElementById('admin-json-city-filter');
        if (!countrySelect || !citySelect) return;

        const { countries, cities } = getOptions();

        if (state.country && !countries.some((value) => key(value) === key(state.country))) {
            state.country = '';
            state.city = '';
        }
        if (state.city && !cities.some((value) => key(value) === key(state.city))) {
            state.city = '';
        }

        countrySelect.innerHTML = '<option value="">Country</option>'
            + countries.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join('');
        countrySelect.value = state.country;

        citySelect.innerHTML = '<option value="">City</option>'
            + cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('');
        citySelect.value = state.city;
        citySelect.disabled = !cities.length;

        const label = currentMode === 'events' ? 'events.json' : 'listings.json';
        countrySelect.title = `Countries from ${label}`;
        citySelect.title = state.country ? `Cities in ${state.country} from ${label}` : `Cities from ${label}`;
    }

    function getDraftRecordForRow(row) {
        const index = Number(row?.dataset?.draftIndex);
        if (Number.isInteger(index) && index >= 0 && Array.isArray(draftData) && draftData[index]) {
            return draftData[index];
        }
        const idField = currentMode === 'events' ? 'Event_ID' : 'Venue_ID';
        return (Array.isArray(draftData) ? draftData : []).find((record) =>
            clean(record?.[idField]) === clean(row?.dataset?.id)
        ) || null;
    }

    function getAuthoritativeRecordForRow(row) {
        const id = clean(row?.dataset?.id);
        const source = currentMode === 'events' ? state.eventById : state.venueById;
        return source.get(id) || getDraftRecordForRow(row);
    }

    function matchesSelectedLocation(record) {
        if (!state.country && !state.city) return true;
        const location = resolveSourceLocation(record || {});
        if (state.country && key(location.country) !== key(state.country)) return false;
        if (state.city && !location.cities.some((city) => key(city) === key(state.city))) return false;
        return true;
    }

    function updateSummary(rows) {
        if (!state.country && !state.city) return;
        const total = Array.isArray(draftData) ? draftData.length : 0;
        const shown = rows.filter((row) => row.style.display !== 'none').length;
        const count = document.getElementById('summary-record-count');
        const context = document.getElementById('summary-filter-context');
        const clearButton = document.getElementById('btn-clear-all-filters');

        if (count) count.textContent = `Showing ${shown} of ${total} records`;

        const details = [];
        if (state.country) details.push(`country: ${state.country}`);
        if (state.city) details.push(`city: ${state.city}`);
        const globalSearch = clean(document.getElementById('admin-global-search')?.value);
        if (globalSearch) details.push(`search: “${globalSearch}”`);
        const columnCount = Object.keys(activeTableFilters || {}).length;
        if (columnCount) details.push(`${columnCount} column filter${columnCount === 1 ? '' : 's'}`);
        if (context) context.textContent = details.join(' · ');
        clearButton?.classList.remove('hidden');
    }

    function applyFilter() {
        refreshControls();
        const rows = Array.from(document.querySelectorAll('#admin-tbody tr[data-id]'));
        const query = clean(document.getElementById('admin-global-search')?.value).toLocaleLowerCase('en');

        rows.forEach((row) => {
            const record = getAuthoritativeRecordForRow(row);
            const searchable = Array.from(row.cells).slice(2).map((cell) => cell.innerText).join(' ').toLocaleLowerCase('en');
            const searchMatch = !query || searchable.includes(query);
            const locationMatch = record ? matchesSelectedLocation(record) : true;
            row.style.display = searchMatch && locationMatch ? '' : 'none';
        });

        let visible = 0;
        rows.forEach((row) => {
            const numberCell = row.querySelector('.admin-row-number-cell');
            if (row.style.display === 'none') {
                if (numberCell) numberCell.textContent = '';
            } else {
                visible += 1;
                if (numberCell) numberCell.textContent = String(visible);
            }
        });

        updateSummary(rows);
    }

    function scheduleApply(delay = 85) {
        window.clearTimeout(state.timer);
        state.timer = window.setTimeout(applyFilter, delay);
    }

    function resetFilters() {
        state.country = '';
        state.city = '';
        refreshControls();
        if (window.__backroomAdminV109?.applyLocationFilter) {
            window.__backroomAdminV109.applyLocationFilter();
        }
        scheduleApply(120);
    }

    function installObserver() {
        const table = document.getElementById('admin-table-container');
        if (!table || state.observer) return;
        state.observer = new MutationObserver(() => scheduleApply(95));
        state.observer.observe(table, { childList: true, subtree: true });
    }

    function install() {
        ensureControls();
        installObserver();
        loadAuthoritativeJson(true);

        document.getElementById('admin-global-search')?.addEventListener('input', () => scheduleApply(220));
        document.getElementById('btn-clear-all-filters')?.addEventListener('click', () => setTimeout(resetFilters, 0));
        document.getElementById('btn-sidebar-showall')?.addEventListener('click', () => setTimeout(resetFilters, 0));

        ['nav-venues', 'nav-events'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => {
                state.country = '';
                state.city = '';
                setTimeout(() => {
                    refreshControls();
                    loadAuthoritativeJson(true);
                }, 0);
            });
        });

        document.getElementById('btn-fetch-live')?.addEventListener('click', () => {
            setTimeout(() => loadAuthoritativeJson(true), 150);
        });

        window.__backroomAdminJsonLocations = {
            refresh: () => loadAuthoritativeJson(true),
            state
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install);
    } else {
        install();
    }
})();
