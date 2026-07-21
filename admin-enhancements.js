/* Backroom Admin v0.65 enhancements
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
