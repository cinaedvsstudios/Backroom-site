

/* Backroom Admin v1.08 record dashboard */
(() => {
    'use strict';

    const dashboardState = {
        globalSearch: '',
        sortColumn: '',
        sortDirection: ''
    };

    const mismatchState = {
        newIds: [],
        editedIds: [],
        removedIds: []
    };

    let decorateTimer = 0;

    const escapeHTML = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function ensureDashboardStyles() {
        if (document.getElementById('admin-dashboard-v108-styles')) return;
        const style = document.createElement('style');
        style.id = 'admin-dashboard-v108-styles';
        style.textContent = `
            #data-summary-bar.admin-summary-three-part {
                display:grid;
                grid-template-columns:minmax(220px,1fr) minmax(260px,1fr) minmax(260px,1fr);
                gap:18px;
                align-items:center;
            }
            .admin-summary-section { min-width:0; }
            .admin-summary-center { text-align:center; display:flex; flex-direction:column; align-items:center; gap:3px; }
            .admin-summary-right { text-align:right; }
            #summary-record-count { color:#fff; font-size:1.1rem; }
            #summary-filter-context { color:var(--label-grey); font-size:.86rem; overflow-wrap:anywhere; }
            #summary-duplicate-warning { color:#ffd84a; font-size:.86rem; font-weight:bold; }
            #admin-global-search-wrap { display:flex; align-items:center; gap:7px; min-width:240px; flex:1 1 280px; max-width:420px; }
            #admin-global-search { width:100%; margin:0; }
            #btn-clear-all-filters { white-space:nowrap; }
            .admin-row-number-head,
            .admin-row-number-cell {
                width:48px;
                min-width:48px;
                max-width:48px;
                text-align:center !important;
                background:var(--near-black) !important;
                color:var(--primary-blue);
                font-weight:bold;
                position:sticky;
                left:0;
                z-index:9;
                border-right:1px solid var(--panel-mid);
            }
            #admin-thead th:nth-child(2),
            #admin-tbody td:nth-child(2) {
                position:sticky;
                left:48px;
                z-index:8;
                background:var(--panel-dark);
                border-right:1px solid var(--panel-mid);
            }
            #admin-thead .admin-row-number-head { z-index:12; resize:none; }
            #admin-thead th:nth-child(2) { z-index:11; }
            .admin-sort-button {
                flex:0 0 auto;
                border:1px solid var(--panel-mid);
                border-radius:999px;
                background:var(--near-black);
                color:var(--label-grey);
                width:24px;
                height:24px;
                padding:0;
                cursor:pointer;
                line-height:1;
                font-size:.72rem;
            }
            .admin-sort-button.active {
                color:#fff;
                border-color:var(--primary-blue);
                background:var(--dark-cyan);
            }
            @media (max-width: 980px) {
                #data-summary-bar.admin-summary-three-part { grid-template-columns:1fr; text-align:left; }
                .admin-summary-center { align-items:flex-start; text-align:left; }
                .admin-summary-right { text-align:left; }
            }
        `;
        document.head.appendChild(style);
    }

    function showMismatchModal() {
        const total = mismatchState.newIds.length + mismatchState.editedIds.length + mismatchState.removedIds.length;
        if (!total) return;
        const list = document.getElementById('mismatch-list');
        const modal = document.getElementById('mismatch-modal');
        if (!list || !modal) return;

        const section = (title, ids, clickable) => {
            if (!ids.length) return '';
            return `<li style="margin:8px 0 4px;color:#fff;font-weight:bold;">${escapeHTML(title)} (${ids.length})</li>`
                + ids.map((id) => clickable
                    ? `<li><button type="button" class="mismatch-jump" data-id="${escapeHTML(id)}" style="padding:3px 0;border:0;background:none;color:var(--bright-red-orange);font-weight:bold;text-decoration:underline;cursor:pointer;">${escapeHTML(id)}</button></li>`
                    : `<li style="padding:3px 0;color:var(--label-grey);">${escapeHTML(id)} <span style="font-size:.8rem;">(removed from working data)</span></li>`
                ).join('');
        };

        list.innerHTML = section('New records', mismatchState.newIds, true)
            + section('Edited records', mismatchState.editedIds, true)
            + section('Removed records', mismatchState.removedIds, false);

        list.querySelectorAll('.mismatch-jump').forEach((button) => button.addEventListener('click', () => {
            modal.classList.add('hidden');
            window.jumpToRow?.(button.dataset.id);
        }));
        modal.classList.remove('hidden');
    }

    function ensureSummaryLayout() {
        const bar = document.getElementById('data-summary-bar');
        if (!bar) return;
        bar.classList.add('admin-summary-three-part');

        const children = Array.from(bar.children);
        const left = children[0];
        const right = children[children.length - 1];
        left?.classList.add('admin-summary-section', 'admin-summary-left');
        right?.classList.add('admin-summary-section', 'admin-summary-right');

        let center = document.getElementById('admin-summary-status');
        if (!center) {
            center = document.createElement('div');
            center.id = 'admin-summary-status';
            center.className = 'admin-summary-section admin-summary-center';
            center.innerHTML = `
                <strong id="summary-record-count" class="display-font">0 records</strong>
                <span id="summary-filter-context">No filters active</span>
                <span id="summary-duplicate-warning" class="hidden"></span>`;
            bar.insertBefore(center, right || null);
        }

        const mismatch = document.getElementById('summary-mismatch');
        if (mismatch && !mismatch.dataset.dashboardEnhanced) {
            const replacement = mismatch.cloneNode(true);
            replacement.dataset.dashboardEnhanced = 'true';
            mismatch.replaceWith(replacement);
            replacement.addEventListener('click', showMismatchModal);
        }
    }

    function scheduleDecorate() {
        window.clearTimeout(decorateTimer);
        decorateTimer = window.setTimeout(decorateTable, 0);
    }

    function resetDashboardViewState() {
        dashboardState.globalSearch = '';
        dashboardState.sortColumn = '';
        dashboardState.sortDirection = '';
        const input = document.getElementById('admin-global-search');
        if (input) input.value = '';
    }

    function clearAllFilters() {
        activeTableFilters = {};
        currentReviewFilter = 'all';
        resetDashboardViewState();
        document.getElementById('sidebar-pending-list')?.classList.add('hidden');
        document.getElementById('sidebar-old-list')?.classList.add('hidden');
        renderFilters();

        const cleanupExit = document.getElementById('btn-exit-old-events');
        if (cleanupExit) cleanupExit.click();
        else renderTable();
        showToast('All filters, search and sorting cleared.');
    }

    function ensureToolbarControls() {
        const fetchButton = document.getElementById('btn-fetch-live');
        const toolbar = fetchButton?.parentElement;
        if (!toolbar) return;

        if (!document.getElementById('admin-global-search-wrap')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'admin-global-search-wrap';
            wrapper.innerHTML = `<span aria-hidden="true">🔎</span><input type="search" id="admin-global-search" class="filter-header-input" placeholder="Search all record fields…" aria-label="Search all record fields">`;
            toolbar.insertBefore(wrapper, toolbar.firstChild);

            let timer = 0;
            wrapper.querySelector('input').addEventListener('input', (event) => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                    dashboardState.globalSearch = event.target.value.trim().toLowerCase();
                    applyTableViewState();
                }, 100);
            });
        }

        if (!document.getElementById('btn-clear-all-filters')) {
            const button = document.createElement('button');
            button.id = 'btn-clear-all-filters';
            button.type = 'button';
            button.className = 'btn secondary-btn pill-btn hidden';
            button.style.width = 'auto';
            button.textContent = '✕ Clear All Filters';
            button.addEventListener('click', clearAllFilters);
            const searchWrap = document.getElementById('admin-global-search-wrap');
            toolbar.insertBefore(button, searchWrap?.nextSibling || toolbar.firstChild);
        }
    }

    function getDuplicateIds() {
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const counts = new Map();
        (Array.isArray(draftData) ? draftData : []).forEach((row) => {
            const id = String(row?.[idField] ?? '').trim();
            if (id) counts.set(id, (counts.get(id) || 0) + 1);
        });
        return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id]) => id);
    }

    function getReviewLabel() {
        if (currentReviewFilter === 'pending') return 'pending';
        if (currentReviewFilter === 'old') return 'older than 30 days';
        if (currentReviewFilter === 'flaghold') return 'flag/hold';
        return '';
    }

    function updateDashboardStatus(rows) {
        const total = Array.isArray(draftData) ? draftData.length : 0;
        const shown = rows.filter((row) => row.style.display !== 'none').length;
        const columnFilterCount = Object.keys(activeTableFilters || {}).length;
        const reviewLabel = getReviewLabel();
        const hasFilter = Boolean(columnFilterCount || reviewLabel || dashboardState.globalSearch);
        const count = document.getElementById('summary-record-count');
        const context = document.getElementById('summary-filter-context');
        const duplicate = document.getElementById('summary-duplicate-warning');
        const clearButton = document.getElementById('btn-clear-all-filters');

        if (count) {
            if (reviewLabel) count.textContent = `Showing ${shown} ${reviewLabel} record${shown === 1 ? '' : 's'} of ${total}`;
            else if (hasFilter || shown !== total) count.textContent = `Showing ${shown} of ${total} records`;
            else count.textContent = `${total} record${total === 1 ? '' : 's'}`;
        }

        const details = [];
        if (columnFilterCount) details.push(`${columnFilterCount} column filter${columnFilterCount === 1 ? '' : 's'}`);
        if (dashboardState.globalSearch) details.push(`search: “${dashboardState.globalSearch}”`);
        if (dashboardState.sortColumn && dashboardState.sortDirection) details.push(`sorted by ${dashboardState.sortColumn} ${dashboardState.sortDirection === 'asc' ? '↑' : '↓'}`);
        if (context) context.textContent = details.length ? details.join(' · ') : 'No filters active';

        const duplicates = getDuplicateIds();
        if (duplicate) {
            duplicate.classList.toggle('hidden', !duplicates.length);
            duplicate.textContent = duplicates.length ? `⚠ ${duplicates.length} duplicate ID${duplicates.length === 1 ? '' : 's'}` : '';
            duplicate.title = duplicates.length ? duplicates.join(', ') : '';
        }

        clearButton?.classList.toggle('hidden', !(hasFilter || dashboardState.sortColumn));
    }

    function parseSortValue(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return { type: 'empty', value: '' };
        if (/^-?\d+(?:[.,]\d+)?$/.test(raw)) return { type: 'number', value: Number(raw.replace(',', '.')) };
        const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (dmy) return { type: 'date', value: new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime() };
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return { type: 'date', value: new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime() };
        return { type: 'text', value: raw.toLowerCase() };
    }

    function compareRows(a, b, cellIndex) {
        const left = parseSortValue(a.cells[cellIndex]?.innerText);
        const right = parseSortValue(b.cells[cellIndex]?.innerText);
        if (left.type === 'empty' && right.type !== 'empty') return 1;
        if (right.type === 'empty' && left.type !== 'empty') return -1;
        if (left.type === right.type && (left.type === 'number' || left.type === 'date')) return left.value - right.value;
        return String(left.value).localeCompare(String(right.value), undefined, { numeric: true, sensitivity: 'base' });
    }

    function updateSortButtons() {
        document.querySelectorAll('.admin-sort-button').forEach((button) => {
            const active = button.dataset.sortColumn === dashboardState.sortColumn && dashboardState.sortDirection;
            button.classList.toggle('active', Boolean(active));
            button.textContent = !active ? '↕' : (dashboardState.sortDirection === 'asc' ? '▲' : '▼');
            button.setAttribute('aria-label', `Sort by ${button.dataset.sortColumn}${active ? ` ${dashboardState.sortDirection}` : ''}`);
        });
    }

    function installSortButtons() {
        document.querySelectorAll('#admin-thead th').forEach((th) => {
            const column = th.querySelector('[data-col]')?.dataset.col;
            const headerRow = th.querySelector('div');
            if (!column || !headerRow || th.querySelector('.admin-sort-button')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'admin-sort-button';
            button.dataset.sortColumn = column;
            button.textContent = '↕';
            button.title = `Sort by ${column}`;
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (dashboardState.sortColumn !== column) {
                    dashboardState.sortColumn = column;
                    dashboardState.sortDirection = 'asc';
                } else if (dashboardState.sortDirection === 'asc') {
                    dashboardState.sortDirection = 'desc';
                } else if (dashboardState.sortDirection === 'desc') {
                    dashboardState.sortColumn = '';
                    dashboardState.sortDirection = '';
                } else {
                    dashboardState.sortDirection = 'asc';
                }
                applyTableViewState();
            });
            headerRow.appendChild(button);
        });
        updateSortButtons();
    }

    function applyTableViewState() {
        const tbody = document.getElementById('admin-tbody');
        const header = document.getElementById('admin-thead');
        if (!tbody || !header) {
            updateDashboardStatus([]);
            return;
        }

        const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));
        rows.forEach((row) => {
            const searchable = Array.from(row.cells).slice(2).map((cell) => cell.innerText).join(' ').toLowerCase();
            row.style.display = dashboardState.globalSearch && !searchable.includes(dashboardState.globalSearch) ? 'none' : '';
        });

        if (dashboardState.sortColumn && dashboardState.sortDirection) {
            const sortButton = Array.from(header.querySelectorAll('.admin-sort-button')).find((button) => button.dataset.sortColumn === dashboardState.sortColumn);
            const cellIndex = sortButton?.closest('th')?.cellIndex;
            if (Number.isInteger(cellIndex)) {
                rows.sort((a, b) => {
                    const comparison = compareRows(a, b, cellIndex);
                    return dashboardState.sortDirection === 'desc' ? -comparison : comparison;
                });
            }
        } else {
            rows.sort((a, b) => Number(a.dataset.originalOrder || 0) - Number(b.dataset.originalOrder || 0));
        }

        rows.forEach((row) => tbody.appendChild(row));
        let visibleNumber = 0;
        rows.forEach((row) => {
            const numberCell = row.querySelector('.admin-row-number-cell');
            if (row.style.display === 'none') {
                if (numberCell) numberCell.textContent = '';
            } else {
                visibleNumber += 1;
                if (numberCell) numberCell.textContent = visibleNumber;
            }
        });

        updateSortButtons();
        updateDashboardStatus(rows);
    }

    function decorateTable() {
        ensureSummaryLayout();
        ensureToolbarControls();
        const table = document.querySelector('#admin-table-container table');
        const headerRow = document.querySelector('#admin-thead tr');
        const tbody = document.getElementById('admin-tbody');
        if (!table || !headerRow || !tbody) {
            updateDashboardStatus([]);
            return;
        }

        if (!headerRow.querySelector('.admin-row-number-head')) {
            const th = document.createElement('th');
            th.className = 'admin-row-number-head';
            th.textContent = '#';
            th.title = 'Visible row number';
            headerRow.insertBefore(th, headerRow.firstChild);
        }

        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        Array.from(tbody.querySelectorAll('tr[data-id]')).forEach((row, index) => {
            if (!row.querySelector('.admin-row-number-cell')) {
                const td = document.createElement('td');
                td.className = 'admin-row-number-cell';
                row.insertBefore(td, row.firstChild);
            }
            const dataIndex = Array.isArray(draftData)
                ? draftData.findIndex((item) => String(item?.[idField] ?? '') === String(row.dataset.id ?? ''))
                : -1;
            row.dataset.originalOrder = String(dataIndex >= 0 ? dataIndex : index);
        });

        tbody.querySelectorAll('tr:not([data-id]) td[colspan]').forEach((cell) => {
            if (!cell.dataset.rowNumberAdjusted) {
                cell.colSpan = Number(cell.colSpan || 1) + 1;
                cell.dataset.rowNumberAdjusted = 'true';
            }
        });

        installSortButtons();
        applyTableViewState();
    }

    function enhancedUpdateMismatchCount() {
        const text = document.getElementById('summary-mismatch');
        mismatchState.newIds = [];
        mismatchState.editedIds = [];
        mismatchState.removedIds = [];
        currentMismatchIds = [];

        if (!Array.isArray(liveData) || !liveData.length) {
            if (text) {
                text.textContent = 'Live data not loaded.';
                text.style.color = 'var(--text-light)';
            }
            updateDashboardStatus(Array.from(document.querySelectorAll('#admin-tbody tr[data-id]')));
            return;
        }

        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const liveById = new Map(liveData.map((row) => [String(row?.[idField] ?? ''), row]));
        const draftById = new Map(draftData.map((row) => [String(row?.[idField] ?? ''), row]));

        draftData.forEach((row) => {
            const id = String(row?.[idField] ?? '');
            const liveRow = liveById.get(id);
            if (!liveRow) mismatchState.newIds.push(id);
            else if (JSON.stringify(liveRow) !== JSON.stringify(row)) mismatchState.editedIds.push(id);
        });
        liveData.forEach((row) => {
            const id = String(row?.[idField] ?? '');
            if (!draftById.has(id)) mismatchState.removedIds.push(id);
        });

        currentMismatchIds = Array.from(new Set([...mismatchState.newIds, ...mismatchState.editedIds]));
        const total = mismatchState.newIds.length + mismatchState.editedIds.length + mismatchState.removedIds.length;
        if (text) {
            if (!total) {
                text.textContent = 'All records match live data.';
                text.style.color = 'var(--primary-blue)';
            } else {
                text.textContent = `${mismatchState.newIds.length} new · ${mismatchState.editedIds.length} edited · ${mismatchState.removedIds.length} removed`;
                text.style.color = 'var(--bright-red-orange)';
                text.title = 'Click for the full unsaved-change breakdown';
            }
        }
        updateDashboardStatus(Array.from(document.querySelectorAll('#admin-tbody tr[data-id]')));
    }

    function installDashboard() {
        ensureDashboardStyles();
        ensureSummaryLayout();
        ensureToolbarControls();

        const previousRenderTable = renderTable;
        renderTable = function dashboardRenderTable(...args) {
            const result = previousRenderTable.apply(this, args);
            scheduleDecorate();
            return result;
        };

        updateMismatchCount = enhancedUpdateMismatchCount;

        document.getElementById('btn-sidebar-showall')?.addEventListener('click', () => {
            resetDashboardViewState();
            scheduleDecorate();
        });
        ['nav-venues', 'nav-events'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => {
            resetDashboardViewState();
            scheduleDecorate();
        }));

        if (Array.isArray(draftData) && draftData.length) renderTable();
        else {
            scheduleDecorate();
            enhancedUpdateMismatchCount();
        }
    }

    document.addEventListener('DOMContentLoaded', installDashboard);
})();
