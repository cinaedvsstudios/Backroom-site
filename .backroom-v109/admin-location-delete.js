
/* Backroom Admin v1.09 location filters and safe bulk delete */
(() => {
    'use strict';

    const locationDeleteState = {
        country: '',
        city: '',
        deleteMode: false,
        selectedIndexes: new Set(),
        venueLocations: new Map(),
        applyTimer: 0
    };

    const normalize = (value) => String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const escapeHTMLV109 = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function firstValue(record, keys) {
        for (const key of keys) {
            const value = String(record?.[key] ?? '').trim();
            if (value) return value;
        }
        return '';
    }

    function getDirectLocation(record) {
        return {
            country: firstValue(record, ['Country', 'Event_Country', 'Venue_Country']),
            city: firstValue(record, ['City', 'Event_City', 'Venue_City'])
        };
    }

    function rebuildVenueLocationMap(records) {
        const map = new Map();
        (Array.isArray(records) ? records : []).forEach((record) => {
            const id = String(record?.Venue_ID ?? '').trim();
            if (!id) return;
            const location = getDirectLocation(record);
            if (location.country || location.city) map.set(id, location);
        });
        locationDeleteState.venueLocations = map;
    }

    async function refreshVenueLocationMap() {
        try {
            const stored = JSON.parse(localStorage.getItem('br_admin_venues_draft') || '[]');
            if (Array.isArray(stored) && stored.length) {
                rebuildVenueLocationMap(stored);
                return;
            }
        } catch {}

        try {
            const response = await fetch(`listings.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            rebuildVenueLocationMap(await response.json());
        } catch {
            locationDeleteState.venueLocations = new Map();
        }
    }

    function getRecordLocation(record) {
        const direct = getDirectLocation(record);
        if (direct.country || direct.city || currentMode !== 'events') return direct;
        return locationDeleteState.venueLocations.get(String(record?.Venue_ID ?? '').trim()) || direct;
    }

    function uniqueSorted(values) {
        const byKey = new Map();
        values.forEach((value) => {
            const display = String(value ?? '').trim();
            const key = normalize(display);
            if (display && key && !byKey.has(key)) byKey.set(key, display);
        });
        return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    function getLocationOptions() {
        const rows = (Array.isArray(draftData) ? draftData : []).map((record) => ({
            record,
            location: getRecordLocation(record)
        }));
        const countries = uniqueSorted(rows.map((entry) => entry.location.country));
        const cities = uniqueSorted(rows
            .filter((entry) => !locationDeleteState.country || normalize(entry.location.country) === normalize(locationDeleteState.country))
            .map((entry) => entry.location.city));
        return { countries, cities };
    }

    function ensureLocationDeleteStyles() {
        if (document.getElementById('admin-location-delete-v109-styles')) return;
        const style = document.createElement('style');
        style.id = 'admin-location-delete-v109-styles';
        style.textContent = `
            #admin-location-filter-wrap {
                display:flex;
                gap:8px;
                align-items:center;
                flex:0 1 auto;
                flex-wrap:wrap;
            }
            #admin-country-filter,
            #admin-city-filter {
                width:auto;
                min-width:155px;
                max-width:230px;
                margin:0;
                padding:8px 34px 8px 13px;
                background:var(--panel-dark);
                color:#fff;
                border:1px solid var(--panel-mid);
            }
            #btn-delete-records {
                width:auto;
                white-space:nowrap;
                background:var(--dark-red);
                color:#fff;
                border-color:var(--bright-red-orange);
            }
            #btn-delete-records.delete-mode-armed {
                animation:adminDeletePulse .72s ease-in-out infinite alternate;
                background:#7d123f;
                border-color:#ff4fd8;
                box-shadow:0 0 0 2px rgba(255,79,216,.25), 0 0 14px rgba(255,79,216,.55);
            }
            body.admin-delete-mode #admin-table-container tbody tr[data-id] { cursor:pointer; }
            #admin-tbody tr.delete-record-selected > td {
                background:#7b1d70 !important;
                color:#fff !important;
                box-shadow:inset 0 2px 0 #ff4fd8, inset 0 -2px 0 #ff4fd8 !important;
            }
            #admin-tbody tr.delete-record-selected > td:first-child {
                box-shadow:inset 2px 0 0 #ff4fd8, inset 0 2px 0 #ff4fd8, inset 0 -2px 0 #ff4fd8 !important;
            }
            #admin-tbody tr.delete-record-selected > td:last-child {
                box-shadow:inset -2px 0 0 #ff4fd8, inset 0 2px 0 #ff4fd8, inset 0 -2px 0 #ff4fd8 !important;
            }
            @keyframes adminDeletePulse {
                from { transform:translateY(0); filter:brightness(.92); }
                to { transform:translateY(-1px); filter:brightness(1.35); }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureLocationControls() {
        const toolbar = document.getElementById('btn-fetch-live')?.parentElement;
        if (!toolbar) return;

        if (!document.getElementById('admin-location-filter-wrap')) {
            const wrap = document.createElement('div');
            wrap.id = 'admin-location-filter-wrap';
            wrap.innerHTML = `
                <select id="admin-country-filter" class="form-input pill-input" aria-label="Filter records by country">
                    <option value="">Country</option>
                </select>
                <select id="admin-city-filter" class="form-input pill-input" aria-label="Filter records by city">
                    <option value="">City</option>
                </select>`;
            const clearButton = document.getElementById('btn-clear-all-filters');
            toolbar.insertBefore(wrap, clearButton || document.getElementById('btn-fetch-live'));

            wrap.querySelector('#admin-country-filter').addEventListener('change', (event) => {
                locationDeleteState.country = event.target.value;
                locationDeleteState.city = '';
                refreshLocationControls();
                scheduleLocationApply();
            });
            wrap.querySelector('#admin-city-filter').addEventListener('change', (event) => {
                locationDeleteState.city = event.target.value;
                scheduleLocationApply();
            });
        }

        if (!document.getElementById('btn-delete-records')) {
            const button = document.createElement('button');
            button.id = 'btn-delete-records';
            button.type = 'button';
            button.className = 'btn pill-btn';
            button.textContent = '🗑 Delete Record';
            button.title = 'Select one or more records to delete from the working data';
            button.addEventListener('click', handleDeleteButton);
            const viewButton = document.getElementById('btn-view-record');
            toolbar.insertBefore(button, viewButton || null);
        }
    }

    function refreshLocationControls() {
        ensureLocationControls();
        const countrySelect = document.getElementById('admin-country-filter');
        const citySelect = document.getElementById('admin-city-filter');
        if (!countrySelect || !citySelect) return;

        const { countries, cities } = getLocationOptions();
        if (locationDeleteState.country && !countries.some((value) => normalize(value) === normalize(locationDeleteState.country))) {
            locationDeleteState.country = '';
            locationDeleteState.city = '';
        }
        if (locationDeleteState.city && !cities.some((value) => normalize(value) === normalize(locationDeleteState.city))) {
            locationDeleteState.city = '';
        }

        countrySelect.innerHTML = '<option value="">Country</option>'
            + countries.map((country) => `<option value="${escapeHTMLV109(country)}">${escapeHTMLV109(country)}</option>`).join('');
        countrySelect.value = locationDeleteState.country;

        citySelect.innerHTML = '<option value="">City</option>'
            + cities.map((city) => `<option value="${escapeHTMLV109(city)}">${escapeHTMLV109(city)}</option>`).join('');
        citySelect.value = locationDeleteState.city;
        citySelect.disabled = !cities.length;
    }

    function recordForRow(row) {
        const index = Number(row?.dataset?.draftIndex);
        if (Number.isInteger(index) && index >= 0 && Array.isArray(draftData) && draftData[index]) return draftData[index];
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        return (Array.isArray(draftData) ? draftData : []).find((record) => String(record?.[idField] ?? '') === String(row?.dataset?.id ?? '')) || null;
    }

    function matchesLocation(record) {
        if (!locationDeleteState.country && !locationDeleteState.city) return true;
        const location = getRecordLocation(record);
        if (locationDeleteState.country && normalize(location.country) !== normalize(locationDeleteState.country)) return false;
        if (locationDeleteState.city && normalize(location.city) !== normalize(locationDeleteState.city)) return false;
        return true;
    }

    function currentSortDescription() {
        const active = document.querySelector('.admin-sort-button.active');
        if (!active) return '';
        const direction = active.textContent === '▲' ? '↑' : active.textContent === '▼' ? '↓' : '';
        return `sorted by ${active.dataset.sortColumn || 'column'} ${direction}`.trim();
    }

    function reviewLabel() {
        if (currentReviewFilter === 'pending') return 'pending';
        if (currentReviewFilter === 'old') return 'older than 30 days';
        if (currentReviewFilter === 'flaghold') return 'flag/hold';
        return '';
    }

    function updateLocationStatus(rows) {
        const total = Array.isArray(draftData) ? draftData.length : 0;
        const shown = rows.filter((row) => row.style.display !== 'none').length;
        const count = document.getElementById('summary-record-count');
        const context = document.getElementById('summary-filter-context');
        const clearButton = document.getElementById('btn-clear-all-filters');
        const globalSearch = String(document.getElementById('admin-global-search')?.value || '').trim();
        const columnFilterCount = Object.keys(activeTableFilters || {}).length;
        const special = reviewLabel();
        const sortDescription = currentSortDescription();
        const hasFilters = Boolean(locationDeleteState.country || locationDeleteState.city || globalSearch || columnFilterCount || special || sortDescription);

        if (count) {
            if (special) count.textContent = `Showing ${shown} ${special} record${shown === 1 ? '' : 's'} of ${total}`;
            else if (hasFilters || shown !== total) count.textContent = `Showing ${shown} of ${total} records`;
            else count.textContent = `${total} record${total === 1 ? '' : 's'}`;
        }

        const details = [];
        if (locationDeleteState.country) details.push(`country: ${locationDeleteState.country}`);
        if (locationDeleteState.city) details.push(`city: ${locationDeleteState.city}`);
        if (columnFilterCount) details.push(`${columnFilterCount} column filter${columnFilterCount === 1 ? '' : 's'}`);
        if (globalSearch) details.push(`search: “${globalSearch}”`);
        if (sortDescription) details.push(sortDescription);
        if (context) context.textContent = details.length ? details.join(' · ') : 'No filters active';
        clearButton?.classList.toggle('hidden', !hasFilters);
    }

    function updateVisibleNumbers(rows) {
        let visible = 0;
        rows.forEach((row) => {
            const cell = row.querySelector('.admin-row-number-cell');
            if (row.style.display === 'none') {
                if (cell) cell.textContent = '';
            } else {
                visible += 1;
                if (cell) cell.textContent = String(visible);
            }
        });
    }

    function applyDeleteSelectionStyles(rows) {
        rows.forEach((row) => {
            const index = Number(row.dataset.draftIndex);
            row.classList.toggle('delete-record-selected', locationDeleteState.deleteMode && locationDeleteState.selectedIndexes.has(index));
        });
        updateDeleteButton();
    }

    function applyLocationFilter() {
        refreshLocationControls();
        const rows = Array.from(document.querySelectorAll('#admin-tbody tr[data-id]'));
        const query = String(document.getElementById('admin-global-search')?.value || '').trim().toLowerCase();

        rows.forEach((row) => {
            const record = recordForRow(row);
            const searchable = Array.from(row.cells).slice(2).map((cell) => cell.innerText).join(' ').toLowerCase();
            const searchMatch = !query || searchable.includes(query);
            const locationMatch = record ? matchesLocation(record) : true;
            row.style.display = searchMatch && locationMatch ? '' : 'none';
        });

        updateVisibleNumbers(rows);
        applyDeleteSelectionStyles(rows);
        updateLocationStatus(rows);
    }

    function scheduleLocationApply(delay = 35) {
        window.clearTimeout(locationDeleteState.applyTimer);
        locationDeleteState.applyTimer = window.setTimeout(applyLocationFilter, delay);
    }

    function updateDeleteButton() {
        const button = document.getElementById('btn-delete-records');
        if (!button) return;
        const count = locationDeleteState.selectedIndexes.size;
        button.classList.toggle('delete-mode-armed', locationDeleteState.deleteMode);
        button.textContent = !locationDeleteState.deleteMode
            ? '🗑 Delete Record'
            : count
                ? `🗑 Delete Selected (${count})`
                : '🗑 Select Records';
        document.body.classList.toggle('admin-delete-mode', locationDeleteState.deleteMode);
    }

    function cancelDeleteMode(showMessage = false) {
        locationDeleteState.deleteMode = false;
        locationDeleteState.selectedIndexes.clear();
        document.querySelectorAll('#admin-tbody tr.delete-record-selected').forEach((row) => row.classList.remove('delete-record-selected'));
        updateDeleteButton();
        if (showMessage) showToast('Delete mode cancelled.');
    }

    function deleteSelectedRecords() {
        const selected = Array.from(locationDeleteState.selectedIndexes)
            .filter((index) => Number.isInteger(index) && index >= 0 && index < draftData.length);
        if (!selected.length) {
            cancelDeleteMode(true);
            return;
        }

        const count = selected.length;
        const confirmed = window.confirm(
            `You are going to delete ${count} record${count === 1 ? '' : 's'}.\n\n`
            + 'This removes them from the working data. Remember to save or download the JSON again after this.\n\nContinue?'
        );
        if (!confirmed) return;

        const selectedSet = new Set(selected);
        draftData = draftData.filter((record, index) => !selectedSet.has(index));
        selectedAdminRecordId = '';
        selectedAdminRecordMode = '';
        saveDraftsToLocal();
        cancelDeleteMode(false);
        renderTable();
        showToast(`${count} record${count === 1 ? '' : 's'} deleted. Save or download the JSON again.`);
    }

    function handleDeleteButton() {
        if (!locationDeleteState.deleteMode) {
            locationDeleteState.deleteMode = true;
            locationDeleteState.selectedIndexes.clear();
            updateDeleteButton();
            showToast('Delete mode active. Click records to mark them, then press Delete Selected.');
            return;
        }
        deleteSelectedRecords();
    }

    function handleDeleteRowEvent(event) {
        if (!locationDeleteState.deleteMode) return;
        const row = event.target.closest('#admin-tbody tr[data-id]');
        if (!row) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.type !== 'click') return;

        const index = Number(row.dataset.draftIndex);
        if (!Number.isInteger(index) || index < 0) return;
        if (locationDeleteState.selectedIndexes.has(index)) locationDeleteState.selectedIndexes.delete(index);
        else locationDeleteState.selectedIndexes.add(index);
        row.classList.toggle('delete-record-selected', locationDeleteState.selectedIndexes.has(index));
        updateDeleteButton();
    }

    function resetLocationFilters() {
        locationDeleteState.country = '';
        locationDeleteState.city = '';
        refreshLocationControls();
        scheduleLocationApply();
    }

    function installLocationDeleteTools() {
        ensureLocationDeleteStyles();
        ensureLocationControls();
        refreshVenueLocationMap().then(() => {
            refreshLocationControls();
            scheduleLocationApply();
        });

        const previousRenderTableV109 = renderTable;
        renderTable = function locationDeleteRenderTable(...args) {
            const result = previousRenderTableV109.apply(this, args);
            scheduleLocationApply(55);
            return result;
        };

        const tableContainer = document.getElementById('admin-table-container');
        tableContainer?.addEventListener('mousedown', handleDeleteRowEvent, true);
        tableContainer?.addEventListener('click', (event) => {
            handleDeleteRowEvent(event);
            if (event.target.closest('.admin-sort-button')) scheduleLocationApply(20);
        }, true);

        document.getElementById('admin-global-search')?.addEventListener('input', () => scheduleLocationApply(170));
        document.getElementById('btn-clear-all-filters')?.addEventListener('click', resetLocationFilters);
        document.getElementById('btn-sidebar-showall')?.addEventListener('click', resetLocationFilters);

        ['nav-venues', 'nav-events'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => {
            cancelDeleteMode(false);
            locationDeleteState.country = '';
            locationDeleteState.city = '';
            refreshVenueLocationMap().then(() => {
                refreshLocationControls();
                scheduleLocationApply(80);
            });
        }));

        ['btn-fetch-live', 'btn-apply-merge', 'btn-delete-old-events'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => cancelDeleteMode(false));
        });
        ['file-upload-replace', 'file-upload-merge'].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => cancelDeleteMode(false));
        });

        scheduleLocationApply();
    }

    window.__backroomAdminV109 = {
        applyLocationFilter,
        cancelDeleteMode,
        state: locationDeleteState
    };

    document.addEventListener('DOMContentLoaded', installLocationDeleteTools);
})();
