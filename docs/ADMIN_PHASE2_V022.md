# Backroom Admin v0.22 — Phase 2 implementation

**Status:** New Data Quality & Coverage sidebar module for the static local-admin workflow.

## Files
- `admin-city-registry.json`: 250 global country/territory seeds and 649 capital/secondary/tourist destination entries, seeded from the existing Backroom city heatmap and curated geographic reference. Where an administrative capital is contested or not applicable, confirm locally before using the label as public information.
- `admin-phase2-data.js`: pure schema-safe CSV/TSV/JSON parser, exporter, matching, coercion, validation and preview plans.
- `admin-phase2.js`: admin sidebar, tabbed shell, data reading, CSV export override, local-draft persistence.
- `admin-phase2-import.js`: spreadsheet Update/Add, Replace All, Remove, change previews, completeness checks and lightweight history.
- `admin-phase2-geo.js`: City Registry CRUD/import/export and City Coverage Manager (including event location inheritance), city selection/copy, Zone Rules.
- `admin-phase2.css`: dark sci-fi UI styling.
- `admin.html`: includes all new Phase 2 resources.
- `docs/ZONE_SPLITTING_V2.md`: geographic targeting rules.

## Important behavior

### Spreadsheet import/export
- Export the **union** of JSON fields across all records as CSV, including fields missing from row zero.
- Quoted UTF-8 CSV export supports embedded commas, quotation marks and multiline text; semicolon-delimited CSV is also accepted for import.
- Update/Add matches permanent Venue_ID / Event_ID and only modifies supplied, nonblank values; `__CLEAR__` intentionally clears a value. Preserve original JSON types where a field's existing type is known and retain unknown fields.
- `Last_Updated` changes only for newly added or modified records; unchanged rows retain their timestamp.
- Replace All and Remove require preview plus an explicit typed confirmation.
- Import results update **local working drafts only**. Export the resulting `listings.json` or `events.json` to publish.
- Duplicate IDs, missing required new-record fields, invalid event dates/coordinates, malformed structures and type-conversion problems block imports.
- Events referencing missing venues and unknown statuses generate warnings for manual review.

### Completeness
- Supports record type, country, city, status and check filters.
- Check results contain complete matching source rows for JSON/CSV export.
- History records only date, filter selections, examined/matched counts, percentages and whether data was downloaded. No record copies are stored in history.

### Master City Registry
- Includes countries outside Europe, capital locations, secondary cities and tourist destinations, with add/edit/delete actions and JSON backup/restore.
- Locally edited registry entries persist in browser storage until intentionally exported and committed; do not conflate registry membership with live venue verification.

### City Coverage
- City counts for permanent venues, cruising areas and events.
- Links events to their venue when event country or city is missing.
- Shows empty/low-coverage and unregistered destinations, supporting country and city filters.
- Select current page or all filtered cities, clear, copy selected, and export the coverage table.

### Zones
- See `docs/ZONE_SPLITTING_V2.md`. No production venue schema changes.

## Testing before further changes
1. Inspect admin.html and switch between existing Venue, Event, Cruising and Reporting modules and Data Quality & Coverage.
2. Export CSV containing a field that appears only in the second or later record; verify its header/value survives.
3. Reimport a partial CSV; check blank preservation, `__CLEAR__`, field types and timestamp changes.
4. Test preview-only, Cancel, Replace All and Remove confirmations on sample data (never on the complete live dataset for a test).
5. Execute completeness checks on venues, events and cruising, export matches and inspect lightweight history.
6. Edit a registry city, export the registry, reset to published, then import the exported registry file.
7. Confirm Ibiza, Venice and global countries appear; compare city coverage to representative venue IDs.
8. Check city selection and Copy Selected Cities behavior for filtered and paginated results.
9. Check the legacy CSV export uses all columns, and the old full table and Phase 1 compact/result exploration still work.

Phase 2 does not automatically publish the editable city registry or imported venue/event data. It also does not fetch current web evidence about individual locations.
