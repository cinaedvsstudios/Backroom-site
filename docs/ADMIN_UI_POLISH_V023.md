# Backroom Admin v0.23 — Visual consolidation and chart interactions

## Scope
Implements the user-requested admin interface cleanup without changing `listings.json`, `events.json`, their schemas, or any existing record IDs.

### Default table and flags
- Compact View is the default on upgrading to v0.23. Subsequent Full/Compact choices are remembered in `br_admin_table_view_v023`.
- Compact location rows display country flag + city, and country dropdowns display flag + full country name.
- City Coverage table uses a flag-first country column (full country name remains accessible as a tooltip), with flag + name in its filter dropdown.
- Country flags also appear in the City Registry, quality checks, top location filter and Reporting country statistics.
- Country/territory names map through one shared `admin-flags.js` utility; unknown identifiers display a globe rather than an invented flag.

### Grouped action toolbar
The original live control elements are **moved, not cloned**, so attached event listeners and file-input labels retain their behavior.

- **📂 Load & Clear:** Current / all live reloads.
- **💾 Save & Merge:** Save JSON, Save JSON As, CSV export, Merge JSON.
- **👁️ View & Fields:** View/Edit Record, Show Hidden Fields, Unhide Columns.
- **🗑️ Delete & Remove:** Delete Record, Remove JSON, Remove Old and Replace JSON (destructive action).
- **⚙️ More:** Preserves any unrecognized toolbar controls rather than discarding them.

The global search, live country/city selectors and clear-filters button are consolidated into a separate filter row, above the grouped actions. Existing destructive confirmations remain in place.

### Data & Analytics
- The former separate Reporting & Statistics sidebar item is hidden, and the full **existing** reporting view is moved into a new **📊 Reporting & Stats** tab in the Data & Analytics section. Its data, history, advanced query builder, downloads and controls are preserved, rather than reimplemented.
- Other tabs: 📥 Data Tools, ✅ Quality Checks, 🌍 City Registry, 🗺️ Coverage, 📚 Zone Rules. Each has a distinct colored style.
- Top summary counts are displayed in individual metric chips.
- Reporting's duplicate prominent completeness section is now a collapsed quick overview, while the detailed Quality Checks live in their own tab.

### Inline Zone Rules
The full geographic research rules are now presented in six expandable sections directly within the Zone Rules tab, not as an external-document link.

### Visual treatment
- Rounded table/card shells, contrasting cyan-blue header rows, alternating body rows, hover effects, consistent controls, better spacing and dark backgrounds.
- Responsive control layout at reduced widths; top tools wrap into separate rows without hiding data operations.

### Charts
- Reporting growth history and historical query comparisons have readable, labelled numeric vertical axes, horizontal gridlines and hoverable plotted points.
- The Results Explorer line, bar and pie charts and published-capture comparison bars have corresponding axes and/or count labels as appropriate.
- A single floating dark tooltip shows precise values and dates/groups when hovering or keyboard-focusing SVG points. For the growth graph it shows venues, cruising areas and events plus the date/source, similar to the requested reference screenshot.

## Files
- New: `admin-flags.js`, `admin-polish.js`, `admin-polish.css`.
- Modified: `admin.html`, `admin-phase1.js`, `admin-reporting.js`, `admin-phase2.js`, `admin-phase2-geo.js`, `admin-phase2-import.js`, `admin-location-json.js`, `admin-upgrade.js`, `admin-enhancements.js`.

## Verification
Static JavaScript syntax checks passed for all updated scripts; script load-order and asset-link checks passed.
Focused smoke tests passed for flags, Compact View default, four chart styles including history bars, vertical scales and hover data.
Additional DOM-mock tests verified that dropdown grouping preserves original action elements, file-upload labels, search field, unknown toolbar controls and version label.
A true Chrome/GitHub Pages visual regression test was not available in the GitHub connector development environment. Check the deployed interface after merging.

## Production checks
1. Hard-refresh admin (Ctrl+Shift+R). Confirm Compact View is the initial mode and can be switched to/from Full Table.
2. Confirm 🇩🇪 Berlin-like location rows and flag-inclusive country selectors.
3. Open each dropdown; test current/all reloads, JSON Save/Merge, View/Edit, column unhide, Remove JSON and Remove Old without losing existing confirmation flows.
4. Open Data & Analytics, switch between all six tabs. Verify Reporting has no separate sidebar item and continues to execute queries.
5. Inspect rounded compact table, old full table, quality/coverage tables, and reporting table headers.
6. Confirm inline Zone Rules can be expanded without opening an external file.
7. Capture/open growth data and hover points; confirm the y-axis and date/count popup are readable.
8. Check tablet/narrow desktop wrapping, dropdown positioning, clipboard selection and existing admin editor functions.
