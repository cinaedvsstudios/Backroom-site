/* Backroom Admin performance layer v0.15
   - Caps rendered table rows by default to reduce browser lag on large JSON files.
   - Keeps all draft data loaded; exports and saves still use the full dataset.
   - Optimises mismatch checks and edited-cell lookup with Venue_ID/Event_ID maps.
*/
(() => {
    'use strict';

    if (window.__backroomAdminPerformanceInstalled) return;
    window.__backroomAdminPerformanceInstalled = true;

    const VERSION = 'v0.15';
    const DEFAULT_ROW_CAP = 250;
    const STORAGE_KEY = 'br_admin_table_row_cap';

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const jsString = (value) => JSON.stringify(String(value ?? '')).replace(/</g, '\\u003c');

    function getCap() {
        const stored = localStorage.getItem(STORAGE_KEY) || String(DEFAULT_ROW_CAP);
        if (stored === 'all') return 'all';
        const parsed = Number.parseInt(stored, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ROW_CAP;
    }

    function setCap(value) {
        const next = value === 'all' ? 'all' : String(Number.parseInt(value, 10) || DEFAULT_ROW_CAP);
        localStorage.setItem(STORAGE_KEY, next);
        if (typeof renderTable === 'function') renderTable();
        if (typeof showToast === 'function') showToast(next === 'all' ? 'Showing all matching rows. This may lag on large files.' : `Showing up to ${next} matching rows.`);
    }

    function getLiveMap(idField) {
        const map = new Map();
        (Array.isArray(liveData) ? liveData : []).forEach((row) => {
            const id = String(row?.[idField] ?? '');
            if (id) map.set(id, row);
        });
        return map;
    }

    function buildCapBar(total, showing) {
        if (total <= 0) return '';
        const cap = getCap();
        const active = (value) => String(cap) === String(value)
            ? 'background:var(--primary-blue);color:#fff;border-color:var(--primary-blue);'
            : 'background:var(--panel-standard);color:#fff;border-color:var(--panel-mid);';
        const warning = cap === 'all'
            ? '<span style="color:var(--bright-red-orange);font-weight:700;">All rows are rendered; expect lag on huge files.</span>'
            : total > showing
                ? `<span style="color:var(--text-light);">Use filters/search, or raise the row cap if the row you need is below this cut.</span>`
                : '<span style="color:var(--text-light);">All matching rows are visible.</span>';

        return `
            <div id="admin-performance-bar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:10px 12px;background:var(--panel-dark);border:1px solid var(--panel-mid);border-radius:var(--radius-card);">
                <strong class="display-font" style="color:var(--primary-blue);letter-spacing:.06em;">FAST TABLE</strong>
                <span>Showing <strong>${showing}</strong> of <strong>${total}</strong> matching ${currentMode === 'events' ? 'events' : 'venues'}.</span>
                <span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <button class="btn pill-btn admin-row-cap-btn" data-admin-row-cap="250" style="width:auto;padding:4px 10px;font-size:.82rem;${active(250)}">250</button>
                    <button class="btn pill-btn admin-row-cap-btn" data-admin-row-cap="500" style="width:auto;padding:4px 10px;font-size:.82rem;${active(500)}">500</button>
                    <button class="btn pill-btn admin-row-cap-btn" data-admin-row-cap="1000" style="width:auto;padding:4px 10px;font-size:.82rem;${active(1000)}">1000</button>
                    <button class="btn pill-btn admin-row-cap-btn" data-admin-row-cap="all" style="width:auto;padding:4px 10px;font-size:.82rem;${active('all')}">All</button>
                </span>
                ${warning}
            </div>`;
    }

    function installCapButtons() {
        if (document.body.dataset.adminRowCapDelegated) return;
        document.body.dataset.adminRowCapDelegated = 'true';
        document.body.addEventListener('click', (event) => {
            const button = event.target.closest('[data-admin-row-cap]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            setCap(button.dataset.adminRowCap);
        });
    }

    function installVersionBadge() {
        document.title = `Backroom Admin Dashboard - ${VERSION}`;
        const summary = document.getElementById('data-summary-bar');
        if (!summary || document.getElementById('admin-version-badge')) return;
        const badge = document.createElement('div');
        badge.id = 'admin-version-badge';
        badge.className = 'display-font';
        badge.textContent = `ADMIN ${VERSION}`;
        badge.style.cssText = 'color:var(--primary-blue);border:1px solid var(--primary-blue);border-radius:999px;padding:3px 10px;font-size:.82rem;letter-spacing:.08em;margin-left:auto;margin-right:14px;white-space:nowrap;';
        const right = summary.lastElementChild;
        if (right) summary.insertBefore(badge, right);
        else summary.appendChild(badge);
    }

    function installFastMismatchCheck() {
        if (typeof updateMismatchCount !== 'function' || updateMismatchCount.__adminFastMismatch) return;
        const fastMismatch = function updateMismatchCountFast() {
            const mismatchEl = document.getElementById('summary-mismatch');
            if (!Array.isArray(liveData) || liveData.length === 0) {
                if (mismatchEl) {
                    mismatchEl.innerText = 'Live data not loaded.';
                    mismatchEl.style.color = 'var(--text-light)';
                }
                return;
            }

            const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
            const liveMap = getLiveMap(idField);
            currentMismatchIds = [];

            (Array.isArray(draftData) ? draftData : []).forEach((dRow) => {
                const id = String(dRow?.[idField] ?? '');
                const lRow = liveMap.get(id);
                if (!lRow || JSON.stringify(lRow) !== JSON.stringify(dRow)) currentMismatchIds.push(id);
            });

            if (mismatchEl) {
                if (currentMismatchIds.length === 0) {
                    mismatchEl.innerText = 'All records match live data.';
                    mismatchEl.style.color = 'var(--primary-blue)';
                } else {
                    mismatchEl.innerText = `${currentMismatchIds.length} records do not match.`;
                    mismatchEl.style.color = 'var(--bright-red-orange)';
                }
            }
        };
        fastMismatch.__adminFastMismatch = true;
        updateMismatchCount = fastMismatch;
    }

    function installFastTableRenderer() {
        if (typeof generateTableHTML !== 'function' || generateTableHTML.__adminFastTable) return;
        const originalGenerateTableHTML = generateTableHTML;

        const fastTable = function generateTableHTMLFast(dataObj, isMainTable) {
            if (!isMainTable) return originalGenerateTableHTML(dataObj, isMainTable);

            const allRows = Array.isArray(dataObj) ? dataObj : [];
            const columns = getAdminColumns(allRows);
            if (!columns.length) return "<p style='padding:20px;'>No data available.</p>";

            const cap = getCap();
            const visibleRows = cap === 'all' ? allRows : allRows.slice(0, cap);
            const idField = getAdminIdField();
            const liveMap = getLiveMap(idField);
            const capBar = buildCapBar(allRows.length, visibleRows.length);

            let html = `${capBar}<table><thead id="admin-thead"><tr>`;
            html += '<th style="min-width:70px;">Review</th>';

            columns.forEach((col, idx) => {
                const displayName = headerMapping[col] || col;
                html += `<th class="col-idx-${idx}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="highlight-toggle-btn" title="Highlight Column" data-col-idx="${idx}">🖍️</span>
                        <span class="eye-btn" onclick="toggleColumn(${idx})" title="Toggle Hide">👁️</span>
                        <span class="col-title" style="flex-grow:1;">${escapeHtml(displayName)}</span>
                    </div>`;

                if (col === 'Status') {
                    html += `<select class="filter-header-select filter-dropdown" data-col="${escapeHtml(col)}"><option value="">Filter...</option><option value="Live">Live</option><option value="Closed">Closed</option><option value="Hold">Hold</option><option value="Flag">Flag</option></select>`;
                } else if (col === 'Priority') {
                    html += `<select class="filter-header-select filter-dropdown" data-col="${escapeHtml(col)}"><option value="">Filter...</option><option value="1">Priority 1</option><option value="2">Priority 2</option><option value="3">Priority 3</option></select>`;
                } else if (String(col).startsWith('Rating_')) {
                    html += `<select class="filter-header-select filter-dropdown" data-col="${escapeHtml(col)}"><option value="">Filter...</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>`;
                } else {
                    html += `<input type="text" class="filter-header-input" placeholder="Filter..." data-col="${escapeHtml(col)}">`;
                }
                html += '</th>';
            });

            html += '</tr></thead><tbody id="admin-tbody">';

            if (!allRows.length) {
                html += `<tr><td colspan="${columns.length + 1}" style="padding:20px; color:var(--label-grey); text-align:center;">No matching rows. Headers are kept so filters can be changed.</td></tr>`;
                html += '</tbody></table>';
                return html;
            }

            visibleRows.forEach((row, rowIndex) => {
                const id = row?.[idField] || rowIndex;
                const liveRow = liveMap.get(String(id));
                const actualIndex = draftData.indexOf(row);
                const editIndex = actualIndex >= 0 ? actualIndex : rowIndex;
                const isNew = liveData.length > 0 ? !liveRow : false;
                const rowIdForJs = jsString(id);

                html += `<tr data-id="${escapeHtml(id)}" data-draft-index="${editIndex}" class="${isNew ? 'new-entry-row' : ''}" onmousedown="selectAdminRecord(this.dataset.id)">`;

                const needsReview = (!row.Share_URL || String(row.Share_URL).toLowerCase() === 'false' || String(row.Share_URL) === 'PENDING' || String(row.Status || '') === 'Draft');
                html += `<td style="text-align:center;">
                    <span class="highlight-toggle-btn" title="Highlight Row">🖍️</span><br>
                    ${needsReview ? `<button onclick="markReviewed(${rowIdForJs})" style="background:var(--primary-blue); border:none; color:#fff; border-radius:4px; cursor:pointer; padding:2px 5px;" title="Mark Reviewed">✔️</button>` : ''}
                    ${isNew ? '<br><span class="new-badge">NEW</span>' : ''}
                </td>`;

                columns.forEach((col, idx) => {
                    let isEdited = false;
                    if (liveData.length > 0 && !isNew && liveRow) {
                        if (String(liveRow[col] ?? '') !== String(row[col] ?? '')) isEdited = true;
                    }

                    const emptyClass = (!row[col] || String(row[col]).trim() === '') ? 'empty-cell' : '';
                    const editedClass = isEdited ? 'edited-cell' : '';
                    html += `<td class="col-idx-${idx} ${editedClass} ${emptyClass}" onclick="editCell(this, ${editIndex}, ${jsString(col)})">${escapeHtml(row[col] ?? '')}</td>`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
            return html;
        };

        fastTable.__adminFastTable = true;
        generateTableHTML = fastTable;
    }

    function installPerformanceLayer() {
        installCapButtons();
        installVersionBadge();
        installFastMismatchCheck();
        installFastTableRenderer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPerformanceLayer);
    } else {
        installPerformanceLayer();
    }

    window.backroomAdminSetRowCap = setCap;
})();
