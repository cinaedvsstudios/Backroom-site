/* Backroom Admin v1.10 enhancements loader and live coverage statistics. */
document.write('<script src="admin-enhancements-core.js?v=1.09"><\/script>');

(() => {
    'use strict';

    const coverageState = {
        venueMap: null,
        venueMapPromise: null,
        timer: 0
    };

    const cleanValue = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const countKey = (value) => cleanValue(value).toLocaleLowerCase('en');

    function readStoredVenueDraft() {
        try {
            const parsed = JSON.parse(localStorage.getItem('br_admin_venues_draft') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function addVenuesToMap(map, rows) {
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = cleanValue(row?.Venue_ID);
            if (!id) return;
            map.set(id, {
                city: cleanValue(row?.City),
                country: cleanValue(row?.Country)
            });
        });
    }

    async function getVenueMap(forceRefresh = false) {
        if (forceRefresh) {
            coverageState.venueMap = null;
            coverageState.venueMapPromise = null;
        }
        if (coverageState.venueMap) return coverageState.venueMap;
        if (coverageState.venueMapPromise) return coverageState.venueMapPromise;

        coverageState.venueMapPromise = (async () => {
            const map = new Map();
            try {
                const response = await fetch(`listings.json?v=${Date.now()}`);
                if (response.ok) addVenuesToMap(map, await response.json());
            } catch {
                // Local drafts below still provide useful coverage when offline.
            }
            addVenuesToMap(map, readStoredVenueDraft());
            coverageState.venueMap = map;
            coverageState.venueMapPromise = null;
            return map;
        })();

        return coverageState.venueMapPromise;
    }

    function getDirectLocation(row) {
        return {
            city: cleanValue(row?.City || row?.Event_City || row?.Venue_City || row?.Location_City),
            country: cleanValue(row?.Country || row?.Event_Country || row?.Venue_Country || row?.Location_Country)
        };
    }

    function resolveEventLocation(row, venueMap) {
        const direct = getDirectLocation(row);
        if (direct.city && direct.country) return direct;
        const linked = venueMap.get(cleanValue(row?.Venue_ID)) || {};
        return {
            city: direct.city || cleanValue(linked.city),
            country: direct.country || cleanValue(linked.country)
        };
    }

    function ensureCoverageLine() {
        const center = document.getElementById('admin-summary-status');
        const recordCount = document.getElementById('summary-record-count');
        if (!center || !recordCount) return null;

        let line = document.getElementById('summary-location-count');
        if (!line) {
            line = document.createElement('span');
            line.id = 'summary-location-count';
            line.className = 'admin-summary-coverage';
            line.textContent = '0 cities · 0 countries';
            recordCount.insertAdjacentElement('afterend', line);
        }
        return line;
    }

    function installCoverageStyle() {
        if (document.getElementById('admin-coverage-style')) return;
        const style = document.createElement('style');
        style.id = 'admin-coverage-style';
        style.textContent = `
            #summary-location-count.admin-summary-coverage {
                color: var(--primary-blue);
                font-family: 'Barlow Condensed', sans-serif;
                font-size: .98rem;
                font-weight: 700;
                letter-spacing: .035em;
            }
        `;
        document.head.appendChild(style);
    }

    async function updateCoverageStats() {
        const line = ensureCoverageLine();
        if (!line || (currentMode !== 'venues' && currentMode !== 'events')) return;

        const rows = Array.isArray(draftData) ? draftData : [];
        const cities = new Set();
        const countries = new Set();
        const venueMap = currentMode === 'events' ? await getVenueMap() : new Map();

        rows.forEach((row) => {
            const location = currentMode === 'events'
                ? resolveEventLocation(row, venueMap)
                : getDirectLocation(row);
            const city = countKey(location.city);
            const country = countKey(location.country);
            if (city) cities.add(city);
            if (country) countries.add(country);
        });

        const cityLabel = cities.size === 1 ? 'city' : 'cities';
        const countryLabel = countries.size === 1 ? 'country' : 'countries';
        line.textContent = `${cities.size} ${cityLabel} · ${countries.size} ${countryLabel}`;
        line.title = `Unique locations represented by the ${rows.length} working ${currentMode === 'venues' ? 'venue' : 'event'} records currently loaded.`;
    }

    function scheduleCoverageUpdate(delay = 30) {
        window.clearTimeout(coverageState.timer);
        coverageState.timer = window.setTimeout(() => updateCoverageStats(), delay);
    }

    function installCoverageStats() {
        installCoverageStyle();
        ensureCoverageLine();

        if (typeof renderTable === 'function' && !renderTable.__coverageStatsWrapped) {
            const previousRenderTable = renderTable;
            const wrapped = function coverageStatsRenderTable(...args) {
                const result = previousRenderTable.apply(this, args);
                scheduleCoverageUpdate();
                return result;
            };
            wrapped.__coverageStatsWrapped = true;
            renderTable = wrapped;
        }

        const recordCount = document.getElementById('summary-record-count');
        if (recordCount) {
            new MutationObserver(() => scheduleCoverageUpdate()).observe(recordCount, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }

        ['nav-venues', 'nav-events'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => scheduleCoverageUpdate(100));
        });
        document.getElementById('btn-fetch-live')?.addEventListener('click', () => {
            getVenueMap(true);
            scheduleCoverageUpdate(350);
        });
        ['file-upload-replace', 'file-upload-merge'].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => {
                getVenueMap(true);
                scheduleCoverageUpdate(250);
            });
        });

        scheduleCoverageUpdate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installCoverageStats);
    } else {
        installCoverageStats();
    }
})();
