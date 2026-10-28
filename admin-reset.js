/* Backroom Admin v0.17 — scoped and complete live reload/clear.
   Keep venues and events drafts isolated; commit only after successful fetches.
*/
(() => {
    'use strict';
    if (window.__backroomAdminResetInstalled) return;
    window.__backroomAdminResetInstalled = true;
    const files = { venues: 'listings.json', events: 'events.json' };
    const keys = { venues: 'br_admin_venues_draft', events: 'br_admin_events_draft' };
    let busy = false;
    window.__backroomAdminLiveByMode = window.__backroomAdminLiveByMode || { venues: null, events: null };

    const notice = text => typeof showToast === 'function' ? showToast(text) : window.alert(text);
    const cloneRecords = rows => typeof structuredClone === 'function'
        ? structuredClone(rows)
        : JSON.parse(JSON.stringify(rows));

    function hasCurrentEdits() {
        if (!Array.isArray(draftData) || !Array.isArray(liveData)) return false;
        if (!liveData.length && !draftData.length) return false;
        return JSON.stringify(draftData) !== JSON.stringify(liveData);
    }

    async function fetchMode(mode) {
        const response = await fetch(files[mode] + '?v=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error(files[mode] + ': HTTP ' + response.status);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(files[mode] + ': expected an array of records');
        return data;
    }

    function writeDraftsAtomically(modes, draftCopies) {
        // Keep the previous stored drafts if a storage quota error occurs.
        const prior = {};
        const written = [];
        try {
            modes.forEach(mode => { prior[mode] = localStorage.getItem(keys[mode]); });
            modes.forEach(mode => {
                localStorage.setItem(keys[mode], JSON.stringify(draftCopies[mode]));
                written.push(mode);
            });
        } catch (error) {
            written.forEach(mode => {
                try {
                    if (prior[mode] === null) localStorage.removeItem(keys[mode]);
                    else localStorage.setItem(keys[mode], prior[mode]);
                } catch (restoreError) {
                    console.error('Could not restore ' + mode + ' draft after reset failure:', restoreError);
                }
            });
            throw error;
        }
    }

    async function reset(scope) {
        if (busy) return;
        if (currentMode !== 'venues' && currentMode !== 'events') {
            notice('Select Venues or Events first.');
            return;
        }
        const selectedMode = currentMode;
        const modes = scope === 'all' ? ['venues', 'events'] : [selectedMode];
        if (scope === 'all') {
            if (!window.confirm('Load / Clear All will discard ALL local working changes in BOTH Venues and Events and reload both live JSON files.\n\nContinue?')) return;
        } else if (hasCurrentEdits()) {
            if (!window.confirm('Discard the current ' + selectedMode + ' working changes and reload the live ' + files[selectedMode] + '?\n\nThe other tab will not be changed.')) return;
        }

        const currentButton = document.getElementById('btn-fetch-live');
        const allButton = document.getElementById('btn-fetch-live-all');
        busy = true;
        if (currentButton) currentButton.disabled = true;
        if (allButton) allButton.disabled = true;
        const previousText = currentButton?.textContent;
        if (currentButton) currentButton.textContent = 'Loading…';

        let committed = false;
        try {
            // Fetch before clearing anything. Failed network responses must never erase drafts.
            const fetched = {};
            const rows = await Promise.all(modes.map(mode => fetchMode(mode)));
            if (currentMode !== selectedMode) {
                throw new Error('You switched tabs during the reload. No changes were discarded; click again in the desired tab.');
            }
            modes.forEach((mode, i) => { fetched[mode] = rows[i]; });
            const newDrafts = {};
            modes.forEach(mode => { newDrafts[mode] = cloneRecords(fetched[mode]); });
            writeDraftsAtomically(modes, newDrafts);
            committed = true;

            // Release the previous import and preview DOM only after the reload succeeded.
            const mergeSource = window.__backroomAdminMergeSourceMode?.();
            if (scope === 'all' || !mergeSource || mergeSource === selectedMode) {
                window.__backroomAdminClearMerge?.(scope === 'all' ? 'all' : selectedMode);
                if (typeof tempMergeData !== 'undefined') tempMergeData = [];
            }
            window.__backroomAdminV109?.cancelDeleteMode?.(false);
            window.__backroomAdminResetDashboard?.();
            if (modes.includes('events')) window.__backroomAdminResetEventCleanup?.();

            window.__backroomAdminResetGeneration = (window.__backroomAdminResetGeneration || 0) + 1;
            modes.forEach(mode => { window.__backroomAdminLiveByMode[mode] = fetched[mode]; });
            liveData = window.__backroomAdminLiveByMode[selectedMode];
            draftData = newDrafts[selectedMode];
            activeTableFilters = {};
            currentReviewFilter = 'all';
            selectedAdminRecordId = '';
            selectedAdminRecordMode = '';
            const search = document.getElementById('admin-global-search');
            if (search) search.value = '';

            lastSavedDate = new Date().toLocaleString();
            try { localStorage.setItem('br_admin_timestamp', lastSavedDate); }
            catch (error) { console.warn('Could not store display timestamp:', error); }
            const timestamp = document.getElementById('summary-timestamp');
            if (timestamp) timestamp.textContent = 'Showing Data From: ' + lastSavedDate;

            window.dispatchEvent(new CustomEvent('backroom-admin-live-reset', {
                detail: { modes, data: fetched }
            }));
            renderFilters();
            renderTable();
            generateReviewLists();
            updateViewRecordButton();
            notice(scope === 'all'
                ? 'Venues and Events refreshed from live JSON. Both working drafts cleared.'
                : (selectedMode === 'venues' ? 'Venues' : 'Events') + ' refreshed. The other tab was preserved.');
        } catch (error) {
            console.error('Backroom Admin live reload failed:', error);
            notice(committed
                ? 'Live data was saved locally, but the Admin display could not refresh. Reload the Admin page. ' + (error.message || '')
                : 'Live reload failed. Your previous drafts were preserved. ' + (error.message || ''));
        } finally {
            busy = false;
            if (currentButton) {
                currentButton.disabled = false;
                currentButton.textContent = previousText || '☁️ Load / Clear';
            }
            if (allButton) allButton.disabled = false;
        }
    }

    window.backroomAdminReset = reset;
    function install() {
        document.getElementById('btn-fetch-live-all')?.addEventListener('click', () => reset('all'));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();