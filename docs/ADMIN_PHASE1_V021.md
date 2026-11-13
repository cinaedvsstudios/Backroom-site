# Backroom Admin v0.21 — Phase 1

Release scope: admin dashboard only. No production venue or event JSON data is modified.

## Files

- `admin.html`: load `admin-phase1.js` after existing admin/reporting modules; show admin dashboard v0.21.
- `admin-upgrade.js`: expose the current admin filtering function for the alternative view; update sidebar version.
- `admin-reporting.js`: notify the Phase 1 module after results/history rendering; expose a saved-query restoration API that preserves already executed results.
- `admin-phase1.js` (new): compact table, selection tools, secondary results explorer, selective copy, chart controls and history enhancements.

## Features

1. **Full Table / Compact View**: switch without changing underlying draft rows. Compact View displays a two-line record summary with a left-side checkbox. It retains existing global and table filters, adds country/city/status/tags/date filters, paginates 50 records at a time, and supports Select All Filtered, Select Page, Clear Selection and Copy Selected IDs. Selections are tracked independently for venues and events.
2. **Results Explorer**: works on the most recently executed reporting query, without rerunning or modifying it. Includes secondary text filters, up to three grouping fields, chart/table views, bar/line/pie charts, a paginated 100-record detail table and complete filtered JSON/CSV/group CSV exports.
3. **Selective Copy Results**: a collapsed-by-default section inside the explorer for choosing individual fields and copying current filtered rows as TSV, or copying grouped counts.
4. **Reporting history**: published snapshot rows show a baseline or net increases/decreases since the preceding published snapshot. Unlike actual Admin change operations, published captures only retain totals; they cannot establish the exact number of individual IDs added, deleted or modified. Growth history includes existing line and new bar presentation (bars show published captures only). Query comparison supports line and bar charts.
5. **Query restoration**: each saved query in history has Restore Query, which restores dataset scope, operators and conditions without executing or replacing the last result set.

## Safeguards

- The original full table and original query export buttons remain available.
- All exploration and copying are read-only. Existing venue/event JSON and IndexedDB query histories are not rewritten by exploration.
- If the native clipboard API is blocked, copied content is shown in the existing Admin Clipboard.
- The module is removable by removing its script reference in `admin.html`.
- Original file versions remain available on the main branch until this feature branch is merged.

## Verification

Automated-in-tool smoke checks passed for JavaScript syntax, compact filters, escaped record display, selected checkbox states, 2-field grouping, bar/line/pie generation, CSV quoting including multiline strings, event-month grouping, selected-column TSV copy, grouped-total copy and restoring saved query conditions without changing existing results.

**Before merging**, perform interactive desktop Chrome checks:

- Load venue and event drafts, switch Full Table → Compact → Full, edit a cell in Full Table, and check the draft remains unchanged when switching views.
- Apply both an existing table filter and a Compact View filter; verify Select All Filtered and Select Page choose the expected IDs.
- Check country/city/status/tags/date filters, pagination and clipboard fallback.
- Execute a reporting query, explore multiple groupings, switch chart types, filter results, and export CSV/JSON. Ensure exports contain the complete matching fields and the original executed result remains intact.
- Expand Selective Copy Results, choose columns, copy rows and groups.
- Restore a historical query and confirm it has **not** executed until Execute Query is pressed.
- Capture two published data points after a known count change and check that published net comparisons are correctly labeled.
- Check existing group download, History Backup/Restore, country statistics and monthly event coverage.

No browser-based visual test has been performed in this connector-only implementation environment.
