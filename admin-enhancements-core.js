/* Backroom Admin v1.09 enhancements
   - Event cleanup for events older than 30 days
   - Filterable/excludable merge preview
   - File System Access API save/save-as support
*/
(() => {
    'use strict';

    const state = {
        cleanupActive: false,
        cleanupCutoff: null,
        mergeRows: [],
        mergeColumns: [],
        mergeSearch: '',
        mergeStatus: '',
        mergeColumnFilters: {},
        mergeMode: false,
        jsonHandles: { venues: null, events: null }
    };

    const deepClone = (value) => JSON.parse(JSON.stringify(value));
    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function localDateOnly(value) {
        if (!value) return null;
        const raw = String(value).trim();
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        let date;
        if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        else if (dmy) date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        else {
            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) return null;
            date = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getCutoffDate() {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - 30);
        return cutoff;
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric'
        }).format(date);
    }

    function getOldEventInfo() {
        const cutoff = state.cleanupCutoff || getCutoffDate();
        const old = [];
        const invalid = [];
        (Array.isArray(draftData) ? draftData : []).forEach((row) => {
            const date = localDateOnly(row?.Event_Date);
            if (!date) invalid.push(row);
            else if (date < cutoff) old.push(row);
        });
        return { cutoff, old, invalid };
    }

    function ensureCleanupBar() {
        let bar = document.getElementById('old-event-cleanup-bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'old-event-cleanup-bar';
        bar.className = 'hidden';
        bar.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 15px;padding:12px 14px;background:var(--panel-dark);border:1px solid var(--bright-red-orange);border-radius:var(--radius-card);';
        const activeFilters = document.getElementById('active-filters');
        activeFilters?.parentNode?.insertBefore(bar, activeFilters);
        return bar;
    }

    function renderCleanupBar() {
        const bar = ensureCleanupBar();
        if (!state.cleanupActive || currentMode !== 'events') {
            bar.classList.add('hidden');
            bar.innerHTML = '';
            return;
        }
        const { cutoff, old, invalid } = getOldEventInfo();
        bar.classList.remove('hidden');
        bar.innerHTML = `
            <strong class="display-font" style="color:var(--bright-red-orange);">OLD EVENT CLEANUP</strong>
            <span>Showing <strong>${old.length}</strong> events dated before ${escapeHtml(formatDate(cutoff))}.</span>
            ${invalid.length ? `<span style="color:var(--bright-red-orange);">${invalid.length} missing/invalid date${invalid.length === 1 ? '' : 's'} not included.</span>` : ''}
            <button id="btn-delete-old-events" class="btn pill-btn" style="width:auto;background:var(--dark-red);color:#fff;">🗑️ Delete All ${old.length} Old Events</button>
            <button id="btn-exit-old-events" class="btn secondary-btn pill-btn" style="width:auto;">Return to All Events</button>`;

        document.getElementById('btn-delete-old-events')?.addEventListener('click', () => {
            if (!old.length) return showToast('No events older than 30 days were found.');
            const message = `Delete ${old.length} events dated before ${formatDate(cutoff)}?\n\nThis changes the working data only. Save the JSON file afterward to overwrite your local file.`;
            if (!window.confirm(message)) return;
            const ids = new Set(old.map((row) => String(row.Event_ID ?? '')));
            draftData = draftData.filter((row) => !ids.has(String(row.Event_ID ?? '')));
            state.cleanupActive = false;
            activeTableFilters = {};
            saveDraftsToLocal();
            renderFilters();
            renderCleanupBar();
            renderTable();
            showToast(`${old.length} old event${old.length === 1 ? '' : 's'} deleted from the working data.`);
        });

        document.getElementById('btn-exit-old-events')?.addEventListener('click', () => {
            state.cleanupActive = false;
            activeTableFilters = {};
            renderFilters();
            renderCleanupBar();
            renderTable();
            showToast('Showing all events.');
        });
    }

    function bindCleanupTableFilters() {
        document.querySelectorAll('#admin-table-container .filter-header-input').forEach((input) => {
            input.addEventListener('keypress', (event) => {
                if (event.key !== 'Enter' || !event.target.value.trim()) return;
                activeTableFilters[event.target.dataset.col] = event.target.value.trim();
                event.target.value = '';
                renderFilters();
                renderTable();
            });
        });
        document.querySelectorAll('#admin-table-container .filter-header-select').forEach((select) => {
            select.addEventListener('change', (event) => {
                if (!event.target.value) return;
                activeTableFilters[event.target.dataset.col] = event.target.value;
                event.target.value = '';
                renderFilters();
                renderTable();
            });
        });
    }

    function renderOldEventTable() {
        const container = document.getElementById('admin-table-container');
        if (!container) return;
        const { old } = getOldEventInfo();
        const filtered = old.filter((row) => Object.entries(activeTableFilters).every(([column, value]) =>
            String(row?.[column] ?? '').toLowerCase().includes(String(value).toLowerCase())
        ));
        container.innerHTML = generateTableHTML(filtered, true);
        bindCleanupTableFilters();
        applyDefaultHiddenColumns();
        refreshAdminRecordSelection();
        updateMismatchCount();
        renderCleanupBar();
    }

    function installCleanupMode() {
        const exportCsv = document.getElementById('btn-export-csv');
        if (!exportCsv || document.getElementById('btn-remove-old-events')) return;
        const button = document.createElement('button');
        button.id = 'btn-remove-old-events';
        button.className = 'btn secondary-btn pill-btn';
        button.style.width = 'auto';
        button.textContent = '🗑️ Remove Old';
        exportCsv.parentNode.insertBefore(button, exportCsv);
        ensureCleanupBar();

        const originalRenderTable = renderTable;
        renderTable = function enhancedRenderTable() {
            if (state.cleanupActive && currentMode === 'events') return renderOldEventTable();
            renderCleanupBar();
            return originalRenderTable();
        };

        button.addEventListener('click', () => {
            if (currentMode !== 'events') {
                showToast('Remove Old is available in the Events editor.');
                return;
            }
            state.cleanupCutoff = getCutoffDate();
            state.cleanupActive = true;
            activeTableFilters = {};
            renderFilters();
            renderTable();
        });

        document.getElementById('nav-venues')?.addEventListener('click', () => {
            state.cleanupActive = false;
            renderCleanupBar();
        });
    }

    function calculateMergeStatus(entry) {
        if (!entry.included) return 'Excluded';
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const id = String(entry.row?.[idField] ?? '').trim();
        if (!id) return 'Invalid';
        const sameId = state.mergeRows.filter((item) => String(item.row?.[idField] ?? '').trim() === id);
        if (sameId.length > 1) {
            const signatures = new Set(sameId.map((item) => JSON.stringify(item.row)));
            return signatures.size > 1 ? 'Conflict' : 'Duplicate';
        }
        const existing = draftData.find((item) => String(item?.[idField] ?? '') === id);
        if (!existing) return 'New';
        const merged = { ...existing, ...entry.row };
        return JSON.stringify(existing) === JSON.stringify(merged) ? 'Unchanged' : 'Updating';
    }

    function getVisibleMergeEntries() {
        const search = state.mergeSearch.trim().toLowerCase();
        return state.mergeRows.filter((entry) => {
            const status = calculateMergeStatus(entry);
            if (state.mergeStatus && status !== state.mergeStatus) return false;
            if (search && !Object.values(entry.row || {}).some((value) => String(value ?? '').toLowerCase().includes(search))) return false;
            return Object.entries(state.mergeColumnFilters).every(([column, value]) =>
                String(entry.row?.[column] ?? '').toLowerCase().includes(String(value).toLowerCase())
            );
        });
    }

    function getMergeCounts() {
        const counts = { Uploaded: state.mergeRows.length, New: 0, Updating: 0, Unchanged: 0, Invalid: 0, Duplicate: 0, Conflict: 0, Excluded: 0 };
        state.mergeRows.forEach((entry) => {
            const status = calculateMergeStatus(entry);
            counts[status] = (counts[status] || 0) + 1;
        });
        counts.WillMerge = state.mergeRows.filter((entry) => entry.included && !['Invalid', 'Duplicate', 'Conflict'].includes(calculateMergeStatus(entry))).length;
        return counts;
    }

    function ensureMergeControls() {
        let controls = document.getElementById('merge-preview-controls');
        if (controls) return controls;
        controls = document.createElement('div');
        controls.id = 'merge-preview-controls';
        controls.className = 'hidden';
        controls.style.cssText = 'padding:12px;background:var(--panel-dark);border-bottom:1px solid var(--panel-mid);display:flex;flex-direction:column;gap:10px;';
        const table = document.getElementById('preview-table-container');
        table?.parentNode?.insertBefore(controls, table);
        return controls;
    }

    function renderMergePreview() {
        const controls = ensureMergeControls();
        const tableContainer = document.getElementById('preview-table-container');
        const applyButton = document.getElementById('btn-apply-merge');
        if (!controls || !tableContainer || !applyButton) return;

        const visible = getVisibleMergeEntries();
        const counts = getMergeCounts();
        controls.classList.remove('hidden');
        controls.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input id="merge-global-search" class="filter-header-input" style="width:min(420px,100%);margin:0;" placeholder="Search all incoming event fields…" value="${escapeHtml(state.mergeSearch)}">
                <select id="merge-status-filter" class="filter-header-select filter-dropdown" style="width:auto;">
                    <option value="">All merge results</option>
                    ${['New','Updating','Unchanged','Invalid','Duplicate','Conflict','Excluded'].map((value) => `<option value="${value}" ${state.mergeStatus === value ? 'selected' : ''}>${value}</option>`).join('')}
                </select>
                <button id="merge-clear-filters" class="btn secondary-btn pill-btn" style="width:auto;">Clear Filters</button>
            </div>
            <div id="merge-count-summary" style="display:flex;gap:12px;flex-wrap:wrap;color:var(--text-light);font-size:.9rem;">
                <strong>Uploaded: ${counts.Uploaded}</strong><span>New: ${counts.New}</span><span>Updates: ${counts.Updating}</span><span>Unchanged: ${counts.Unchanged}</span><span>Invalid: ${counts.Invalid}</span><span>Duplicate: ${counts.Duplicate}</span><span>Conflict: ${counts.Conflict}</span><span>Excluded: ${counts.Excluded}</span><strong style="color:var(--primary-blue);">Will merge: ${counts.WillMerge}</strong><span>Showing: ${visible.length}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="merge-exclude-filtered" class="btn pill-btn" style="width:auto;background:var(--dark-red);color:#fff;">Exclude All ${visible.length} Filtered</button>
                <button id="merge-restore-filtered" class="btn secondary-btn pill-btn" style="width:auto;">Restore Filtered</button>
                <button id="merge-restore-all" class="btn secondary-btn pill-btn" style="width:auto;">Restore All Excluded</button>
                <button id="merge-cancel" class="btn secondary-btn pill-btn" style="width:auto;margin-left:auto;">Cancel Merge</button>
            </div>`;

        let html = '<table><thead id="preview-thead"><tr><th style="min-width:90px;">Include</th><th style="min-width:100px;">Result</th>';
        state.mergeColumns.forEach((column) => {
            html += `<th><div>${escapeHtml(column)}</div><input class="filter-header-input merge-column-filter" data-column="${escapeHtml(column)}" placeholder="Filter…" value="${escapeHtml(state.mergeColumnFilters[column] || '')}"></th>`;
        });
        html += '</tr></thead><tbody>';
        visible.forEach((entry) => {
            const status = calculateMergeStatus(entry);
            html += `<tr data-merge-index="${entry.index}" style="${entry.included ? '' : 'opacity:.48;'}">
                <td style="text-align:center;"><input type="checkbox" class="merge-include-toggle" data-index="${entry.index}" ${entry.included ? 'checked' : ''}></td>
                <td style="font-weight:bold;color:${status === 'New' ? '#00ff00' : status === 'Updating' ? 'var(--bright-red-orange)' : status === 'Excluded' ? 'var(--label-grey)' : 'var(--primary-blue)'};">${status}</td>`;
            state.mergeColumns.forEach((column) => {
                html += `<td class="preview-editable-cell" contenteditable="true" data-index="${entry.index}" data-column="${escapeHtml(column)}">${escapeHtml(entry.row?.[column] ?? '')}</td>`;
            });
            html += '</tr>';
        });
        if (!visible.length) html += `<tr><td colspan="${state.mergeColumns.length + 2}" style="padding:20px;text-align:center;color:var(--label-grey);">No incoming rows match these filters.</td></tr>`;
        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        applyButton.textContent = `Merge ${counts.WillMerge} Included Records`;
        applyButton.classList.remove('hidden');

        document.getElementById('merge-global-search')?.addEventListener('input', (event) => {
            state.mergeSearch = event.target.value;
            renderMergePreview();
            document.getElementById('merge-global-search')?.focus();
        });
        document.getElementById('merge-status-filter')?.addEventListener('change', (event) => {
            state.mergeStatus = event.target.value;
            renderMergePreview();
        });
        document.getElementById('merge-clear-filters')?.addEventListener('click', () => {
            state.mergeSearch = '';
            state.mergeStatus = '';
            state.mergeColumnFilters = {};
            renderMergePreview();
        });
        document.querySelectorAll('.merge-column-filter').forEach((input) => {
            input.addEventListener('change', (event) => {
                const value = event.target.value.trim();
                if (value) state.mergeColumnFilters[event.target.dataset.column] = value;
                else delete state.mergeColumnFilters[event.target.dataset.column];
                renderMergePreview();
            });
        });
        document.querySelectorAll('.merge-include-toggle').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                const entry = state.mergeRows.find((item) => item.index === Number(event.target.dataset.index));
                if (entry) entry.included = event.target.checked;
                renderMergePreview();
            });
        });
        document.querySelectorAll('.preview-editable-cell[data-index]').forEach((cell) => {
            cell.addEventListener('blur', (event) => {
                const entry = state.mergeRows.find((item) => item.index === Number(event.target.dataset.index));
                if (entry) entry.row[event.target.dataset.column] = event.target.innerText.trim();
                renderMergePreview();
            });
        });
        document.getElementById('merge-exclude-filtered')?.addEventListener('click', () => {
            getVisibleMergeEntries().forEach((entry) => { entry.included = false; });
            renderMergePreview();
        });
        document.getElementById('merge-restore-filtered')?.addEventListener('click', () => {
            getVisibleMergeEntries().forEach((entry) => { entry.included = true; });
            renderMergePreview();
        });
        document.getElementById('merge-restore-all')?.addEventListener('click', () => {
            state.mergeRows.forEach((entry) => { entry.included = true; });
            renderMergePreview();
        });
        document.getElementById('merge-cancel')?.addEventListener('click', closeMergePreview);
    }

    function closeMergePreview() {
        state.mergeMode = false;
        state.mergeRows = [];
        state.mergeColumns = [];
        state.mergeSearch = '';
        state.mergeStatus = '';
        state.mergeColumnFilters = {};
        document.getElementById('merge-preview-controls')?.classList.add('hidden');
        document.getElementById('preview-import-modal')?.classList.add('hidden');
    }

    function handleMergeFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (!Array.isArray(parsed)) throw new Error('File is not an array');
                state.mergeMode = true;
                state.mergeRows = parsed.map((row, index) => ({ row: deepClone(row), index, included: true }));
                state.mergeColumns = Array.from(new Set(parsed.flatMap((row) => Object.keys(row || {}))));
                state.mergeSearch = '';
                state.mergeStatus = '';
                state.mergeColumnFilters = {};
                tempMergeData = parsed;
                document.getElementById('preview-modal-title').innerText = '👁️ REVIEW & MERGE IMPORT';
                document.getElementById('preview-import-modal').classList.remove('hidden');
                renderMergePreview();
            } catch (error) {
                handleJSONError(error, event.target.result);
            }
        };
        reader.readAsText(file);
    }

    function installMergePreview() {
        const oldInput = document.getElementById('file-upload-merge');
        const oldApply = document.getElementById('btn-apply-merge');
        if (!oldInput || !oldApply) return;

        const newInput = oldInput.cloneNode(true);
        oldInput.replaceWith(newInput);
        newInput.addEventListener('change', (event) => {
            handleMergeFile(event.target.files?.[0]);
            event.target.value = '';
        });

        const newApply = oldApply.cloneNode(true);
        oldApply.replaceWith(newApply);
        newApply.addEventListener('click', () => {
            const valid = state.mergeRows.filter((entry) => entry.included && !['Invalid', 'Duplicate', 'Conflict'].includes(calculateMergeStatus(entry)));
            const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
            let updated = 0;
            let added = 0;
            valid.forEach((entry) => {
                const index = draftData.findIndex((row) => String(row?.[idField] ?? '') === String(entry.row?.[idField] ?? ''));
                if (index >= 0) {
                    draftData[index] = { ...draftData[index], ...entry.row };
                    updated += 1;
                } else {
                    draftData.push(entry.row);
                    added += 1;
                }
            });
            saveDraftsToLocal();
            renderTable();
            closeMergePreview();
            showToast(`Merge applied: ${updated} updated, ${added} new.`);
        });

        ensureMergeControls();
    }

    function fallbackDownload(content, filename, mimeType) {
        const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function writeWithPicker(content, options, handleKey, forcePicker) {
        if (!('showSaveFilePicker' in window)) {
            fallbackDownload(content, options.suggestedName, options.types?.[0]?.accept ? Object.keys(options.types[0].accept)[0] : 'application/octet-stream');
            showToast('Browser file picker unavailable; downloaded instead.');
            return;
        }
        try {
            let handle = !forcePicker && handleKey ? state.jsonHandles[handleKey] : null;
            if (!handle) handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            if (handleKey) state.jsonHandles[handleKey] = handle;
            lastSavedDate = new Date().toLocaleString();
            localStorage.setItem('br_admin_timestamp', lastSavedDate);
            const stamp = document.getElementById('summary-timestamp');
            if (stamp) stamp.innerText = `Saved locally: ${lastSavedDate}`;
            showToast(`Saved ${handle.name || options.suggestedName} successfully.`);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error(error);
                showToast(`Save failed: ${error.message || 'Unknown error'}`);
            }
        }
    }

    function installFileSaving() {
        const oldJson = document.getElementById('btn-export-json');
        const oldCsv = document.getElementById('btn-export-csv');
        if (!oldJson || !oldCsv) return;

        const jsonButton = oldJson.cloneNode(true);
        oldJson.replaceWith(jsonButton);
        jsonButton.textContent = '💾 Save JSON';
        jsonButton.addEventListener('click', () => {
            if (!Array.isArray(draftData)) return showToast('No data to save.');
            const filename = currentMode === 'venues' ? 'listings.json' : 'events.json';
            writeWithPicker(JSON.stringify(draftData, null, 2), {
                suggestedName: filename,
                types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }]
            }, currentMode, false);
        });

        const saveAs = document.createElement('button');
        saveAs.id = 'btn-save-json-as';
        saveAs.className = 'btn secondary-btn pill-btn';
        saveAs.style.width = 'auto';
        saveAs.textContent = 'Save JSON As…';
        jsonButton.parentNode.insertBefore(saveAs, jsonButton.nextSibling);
        saveAs.addEventListener('click', () => {
            if (!Array.isArray(draftData)) return showToast('No data to save.');
            const filename = currentMode === 'venues' ? 'listings.json' : 'events.json';
            writeWithPicker(JSON.stringify(draftData, null, 2), {
                suggestedName: filename,
                types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }]
            }, currentMode, true);
        });

        const csvButton = oldCsv.cloneNode(true);
        oldCsv.replaceWith(csvButton);
        csvButton.textContent = '📊 Save CSV As…';
        csvButton.addEventListener('click', () => {
            if (!draftData?.length) return showToast('No data to save.');
            const columns = Object.keys(draftData[0]);
            const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const csv = [columns.map(escapeCsv).join(','), ...draftData.map((row) => columns.map((column) => escapeCsv(row[column])).join(','))].join('\r\n');
            const filename = `backroom_${currentMode}_${new Date().toISOString().slice(0, 10)}.csv`;
            writeWithPicker(csv, {
                suggestedName: filename,
                types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }]
            }, null, true);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        installCleanupMode();
        installMergePreview();
        installFileSaving();
        renderCleanupBar();
    });
})();

/* Backroom Admin v1.09 record dashboard */
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
