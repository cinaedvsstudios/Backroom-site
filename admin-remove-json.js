/* Backroom Admin — Remove JSON (venues and events)
   Matches strictly by the ID for the active tab; never changes live GitHub/Drive files.
*/
(() => {
    'use strict';

    if (window.__backroomRemoveJsonInstalled) return;
    window.__backroomRemoveJsonInstalled = true;

    const LIMIT = 200;
    let pending = null;
    const clean = value => String(value ?? '').trim();
    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function message(value) {
        if (typeof showToast === 'function') showToast(value);
        else window.alert(value);
    }

    function idField(mode) {
        return mode === 'venues' ? 'Venue_ID' : 'Event_ID';
    }

    function recordName(row, mode) {
        return clean(mode === 'venues' ? row?.Name : row?.Event_Name) || '(unnamed)';
    }

    function signature(rows, mode) {
        const field = idField(mode);
        return rows.length + ':' + rows.map(row => clean(row?.[field])).join('\u001f');
    }

    function analyse(uploaded, working, mode) {
        const field = idField(mode);
        const byId = new Map();
        working.forEach(row => {
            const id = clean(row?.[field]);
            if (!id) return;
            if (!byId.has(id)) byId.set(id, []);
            byId.get(id).push(row);
        });

        const matched = [];
        const unmatched = [];
        const missing = [];
        const duplicate = [];
        const ambiguous = [];
        const seen = new Set();

        uploaded.forEach((row, index) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
                missing.push('Row ' + (index + 1) + ': not a JSON record object');
                return;
            }
            const id = clean(row[field]);
            if (!id) {
                missing.push('Row ' + (index + 1) + ': missing ' + field);
                return;
            }
            if (seen.has(id)) {
                duplicate.push(id);
                return;
            }
            seen.add(id);
            const candidates = byId.get(id) || [];
            if (!candidates.length) {
                unmatched.push({ id: id, name: recordName(row, mode) });
            } else if (candidates.length !== 1) {
                ambiguous.push({ id: id, count: candidates.length });
            } else {
                matched.push({
                    id: id,
                    name: recordName(candidates[0], mode),
                    meta: mode === 'venues'
                        ? [candidates[0].City, candidates[0].Country].filter(Boolean).join(' · ')
                        : clean(candidates[0].Event_Date),
                    selected: true
                });
            }
        });
        return { matched, unmatched, missing, duplicate, ambiguous };
    }

    function ensureDialog() {
        let dialog = document.getElementById('br-remove-json-dialog');
        if (dialog) return dialog;

        const style = document.createElement('style');
        style.id = 'br-remove-json-style';
        style.textContent = [
            '#br-remove-json-dialog{position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.84);display:flex;align-items:center;justify-content:center;padding:18px;color:#fff;}',
            '#br-remove-json-dialog.hidden{display:none!important;}',
            '#br-remove-json-panel{background:var(--panel-dark,#1f2535);border:1px solid var(--primary-blue,#2ca8d4);border-radius:14px;width:min(860px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 12px 45px rgba(0,0,0,.6);}',
            '#br-remove-json-panel header,#br-remove-json-panel footer{padding:14px 18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
            '#br-remove-json-panel header{border-bottom:1px solid var(--panel-mid,#313748);justify-content:space-between;}',
            '#br-remove-json-panel footer{border-top:1px solid var(--panel-mid,#313748);justify-content:flex-end;}',
            '#br-remove-json-scroll{padding:16px 18px;overflow:auto;min-height:0;}',
            '.br-remove-line{border:1px solid var(--panel-mid,#313748);border-radius:8px;padding:7px 10px;margin:5px 0;display:flex;gap:10px;align-items:center;background:var(--near-black,#0b0f19);}',
            '.br-remove-line small{color:var(--text-light,#969cae);display:block;margin-top:2px;}',
            '.br-remove-note{font-size:.92rem;color:var(--text-light,#969cae);margin:9px 0;}',
            '#br-remove-json-dialog .btn{width:auto;}',
            '#br-remove-json-dialog input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary-blue,#2ca8d4);flex-shrink:0;}',
            '#br-remove-json-apply{background:var(--dark-red,#871300);color:#fff;border:1px solid var(--bright-red-orange,#d55036);}',
            '#br-remove-json-apply:disabled{opacity:.4;cursor:not-allowed;}'
        ].join('\n');
        document.head.appendChild(style);

        dialog = document.createElement('div');
        dialog.id = 'br-remove-json-dialog';
        dialog.className = 'hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'br-remove-json-title');
        dialog.innerHTML =
            '<div id="br-remove-json-panel">' +
                '<header><strong class="display-font" style="color:var(--primary-blue);font-size:1.35rem;" id="br-remove-json-title">REVIEW REMOVALS</strong>' +
                    '<button type="button" class="btn secondary-btn pill-btn" id="br-remove-json-close">Cancel ✕</button></header>' +
                '<div id="br-remove-json-scroll">' +
                    '<div id="br-remove-json-summary"></div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">' +
                        '<button class="btn secondary-btn pill-btn" id="br-remove-json-select-all">Select All Matches</button>' +
                        '<button class="btn secondary-btn pill-btn" id="br-remove-json-select-none">Deselect All</button>' +
                    '</div>' +
                    '<div id="br-remove-json-matches"></div>' +
                    '<div id="br-remove-json-skipped"></div>' +
                '</div>' +
                '<footer><button type="button" class="btn secondary-btn pill-btn" id="br-remove-json-backup">Download Current List</button>' +
                    '<button type="button" class="btn pill-btn" id="br-remove-json-apply">Remove Selected</button></footer>' +
            '</div>';
        document.body.appendChild(dialog);

        dialog.querySelector('#br-remove-json-close').addEventListener('click', closeDialog);
        dialog.querySelector('#br-remove-json-select-all').addEventListener('click', () => selectAll(true));
        dialog.querySelector('#br-remove-json-select-none').addEventListener('click', () => selectAll(false));
        dialog.querySelector('#br-remove-json-apply').addEventListener('click', applyRemoval);
        dialog.querySelector('#br-remove-json-backup').addEventListener('click', downloadBackup);
        dialog.querySelector('#br-remove-json-matches').addEventListener('change', event => {
            const input = event.target.closest('input[data-remove-id]');
            if (!input || !pending) return;
            const item = pending.matched.find(row => row.id === input.dataset.removeId);
            if (item) item.selected = input.checked;
            updateSelectionCount();
        });
        dialog.addEventListener('click', event => {
            if (event.target === dialog) closeDialog();
        });
        dialog.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeDialog();
        });
        return dialog;
    }

    function closeDialog() {
        pending = null;
        document.getElementById('br-remove-json-dialog')?.classList.add('hidden');
    }

    function selectAll(selected) {
        if (!pending) return;
        pending.matched.forEach(row => { row.selected = selected; });
        document.querySelectorAll('#br-remove-json-matches input[data-remove-id]').forEach(input => {
            input.checked = selected;
        });
        updateSelectionCount();
    }

    function updateSelectionCount() {
        if (!pending) return;
        const count = pending.matched.reduce((n, item) => n + Number(item.selected), 0);
        const button = document.getElementById('br-remove-json-apply');
        button.textContent = 'Remove ' + count + ' Selected';
        button.disabled = count === 0;
    }

    function renderPreview() {
        if (!pending) return;
        const dialog = ensureDialog();
        const modeName = pending.mode === 'venues' ? 'Venues' : 'Events';
        const notes = [];
        if (pending.unmatched.length) notes.push(pending.unmatched.length + ' IDs not found in the working list');
        if (pending.missing.length) notes.push(pending.missing.length + ' records missing a usable ID');
        if (pending.duplicate.length) notes.push(pending.duplicate.length + ' repeated IDs in the upload (ignored)');
        if (pending.ambiguous.length) notes.push(pending.ambiguous.length + ' IDs duplicated in the working list (excluded for safety)');

        document.getElementById('br-remove-json-title').textContent = 'REVIEW ' + modeName.toUpperCase() + ' REMOVALS';
        document.getElementById('br-remove-json-summary').innerHTML =
            '<strong>Uploaded: ' + pending.uploadedCount + '</strong> · ' +
            '<strong style="color:var(--bright-red-orange);">Matched: ' + pending.matched.length + '</strong> · ' +
            'Current working records: ' + pending.workingCount +
            '<p class="br-remove-note">Only exact ' + idField(pending.mode) +
            ' matches are eligible. Nothing has been removed yet.</p>';

        const matches = document.getElementById('br-remove-json-matches');
        matches.innerHTML = pending.matched.length
            ? '<strong>Matching records to remove</strong>' +
                pending.matched.slice(0, LIMIT).map(item =>
                    '<label class="br-remove-line"><input type="checkbox" data-remove-id="' + esc(item.id) +
                    '"' + (item.selected ? ' checked' : '') + '>' +
                    '<span><strong>' + esc(item.name) + '</strong> · ' + esc(item.id) +
                    (item.meta ? '<small>' + esc(item.meta) + '</small>' : '') + '</span></label>'
                ).join('') +
                (pending.matched.length > LIMIT
                    ? '<p class="br-remove-note">First ' + LIMIT + ' matches shown. Select All / Deselect All acts on every matched ID, including hidden rows.</p>'
                    : '')
            : '<p class="br-remove-note">No matching records found. Nothing can be removed.</p>';

        document.getElementById('br-remove-json-skipped').innerHTML = notes.length
            ? '<h3 style="color:var(--bright-red-orange);margin-top:18px;">Skipped / needs review</h3>' +
                '<p class="br-remove-note">' + esc(notes.join(' · ')) + '</p>' +
                pending.unmatched.slice(0, 60).map(x => '<div class="br-remove-note">Not found: ' + esc(x.id) + ' — ' + esc(x.name) + '</div>').join('') +
                pending.ambiguous.slice(0, 30).map(x => '<div class="br-remove-note">Ambiguous ID: ' + esc(x.id) + ' (' + x.count + ' loaded records)</div>').join('') +
                pending.missing.slice(0, 20).map(x => '<div class="br-remove-note">' + esc(x) + '</div>').join('')
            : '';
        updateSelectionCount();
        dialog.classList.remove('hidden');
        document.getElementById('br-remove-json-close')?.focus();
    }

    function triggerDownload(text, filename) {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        window.setTimeout(() => {
            URL.revokeObjectURL(url);
            link.remove();
        }, 1000);
    }

    function downloadBackup() {
        if (!pending || currentMode !== pending.mode) return;
        const filename = (pending.mode === 'venues' ? 'listings' : 'events') + '_before_removal_' +
            new Date().toISOString().slice(0, 10) + '.json';
        triggerDownload(JSON.stringify(draftData, null, 2), filename);
        message('Current working list backup downloaded.');
    }

    function applyRemoval() {
        if (!pending) return;
        if (currentMode !== pending.mode) {
            message('The Admin tab changed. Reopen Remove JSON to avoid editing the wrong list.');
            closeDialog();
            return;
        }
        if (signature(draftData, pending.mode) !== pending.snapshot) {
            message('The working records have changed since preview. Please upload the removal file again.');
            closeDialog();
            return;
        }

        const selected = pending.matched.filter(item => item.selected);
        if (!selected.length) return;
        const count = selected.length;
        if (!window.confirm('Remove ' + count + ' ' + pending.mode + ' from the working data?\n\n' +
            'This will change your local Admin draft only. Export the updated JSON to replace the master file later.')) return;

        if (count >= 100 || count >= Math.ceil(pending.workingCount * 0.5)) {
            const required = 'REMOVE ' + count;
            if (window.prompt('Large removal: type ' + required + ' to confirm.', '') !== required) {
                message('Bulk removal cancelled.');
                return;
            }
        }

        const ids = new Set(selected.map(item => item.id));
        const field = idField(pending.mode);
        const before = draftData;
        const after = before.filter(row => !ids.has(clean(row?.[field])));
        if (before.length - after.length !== count) {
            message('Removal count changed unexpectedly. No records removed; reopen the preview.');
            closeDialog();
            return;
        }

        const mode = pending.mode;
        try {
            draftData = after;
            selectedAdminRecordId = '';
            selectedAdminRecordMode = '';
            activeTableFilters = {};
            currentReviewFilter = 'all';
            saveDraftsToLocal();
        } catch (error) {
            draftData = before;
            console.error('Remove JSON failed:', error);
            message('Could not save removals locally. Nothing was written to the master file.');
            return;
        }
        closeDialog();
        try {
            renderFilters();
            renderTable();
            updateViewRecordButton();
        } catch (error) {
            console.warn('Working data saved but Admin display needs refreshing:', error);
        }
        message(count + ' ' + mode + ' removed from the working list. Export JSON to save the new file.');
    }

    async function handleFile(file) {
        if (!file) return;
        if (currentMode !== 'venues' && currentMode !== 'events') return;
        const mode = currentMode;
        if (!Array.isArray(draftData) || !draftData.length) {
            message('Load Live / Clear Changes or your working JSON list before using Remove JSON.');
            return;
        }
        try {
            const uploaded = JSON.parse(await file.text());
            if (!Array.isArray(uploaded)) throw new Error('Removal file must contain a JSON array of records.');
            if (!uploaded.length) {
                message('The removal JSON file contains no records.');
                return;
            }
            if (currentMode !== mode) {
                message('Admin tab changed while reading the file. Upload it again.');
                return;
            }
            const audit = analyse(uploaded, draftData, mode);
            pending = {
                mode: mode,
                uploadedCount: uploaded.length,
                workingCount: draftData.length,
                snapshot: signature(draftData, mode),
                ...audit
            };
            renderPreview();
        } catch (error) {
            console.error('Remove JSON import failed:', error);
            message('Remove JSON failed: ' + error.message);
        }
    }

    function install() {
        const inputMerge = document.getElementById('file-upload-merge');
        const labelMerge = inputMerge?.closest('label');
        if (!labelMerge || document.getElementById('br-remove-json-label')) return;
        const label = document.createElement('label');
        label.id = 'br-remove-json-label';
        label.className = 'btn secondary-btn pill-btn';
        label.title = 'Upload a subset JSON file and review which records to remove';
        label.style.cssText = 'width:auto;cursor:pointer;';
        label.innerHTML = '🗑️ Remove JSON <input type="file" id="br-remove-json-file" class="hidden" accept=".json,application/json">';
        labelMerge.insertAdjacentElement('afterend', label);

        label.querySelector('input').addEventListener('change', event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            handleFile(file);
        });

        ['nav-venues', 'nav-events', 'btn-fetch-live'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', closeDialog);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();