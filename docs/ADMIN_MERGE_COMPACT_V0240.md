# Backroom Admin v0.24.0 — Compact Review & Merge Import

## What changed
The **Review & Merge Import** modal now opens in **Compact** mode by default for both Events and Venues. The compact table deliberately mirrors the established regular Phase 1 table:
- ✓: include/exclude each incoming record for this merge
- Record: event name **@ venue name** (or venue name in Venues), status, merge result (**New / Updating / Unchanged / Excluded / ...**), location and date/time metadata
- Open: opens the public event/venue pages in new tabs
- Tags: up to five incoming `Vibe_Tags`, or **No tags**

Each compact record has **Edit fields**, exposing all original incoming data fields in a responsive grid so that the full-field editing workflow is still available. Edited complex JSON values are parsed and validated to retain arrays/objects; numeric and boolean types remain typed. Escaped HTML prevents injected markup from record content.

The existing full-field merge table is retained unchanged under the short **Table** toggle. **Compact** switches back. Every new merge defaults to Compact, regardless of the previous session's choice.

The existing global search, result filter, per-column filters (in Table), include/exclude/restore actions, merge counts, pagination, merge preview and apply actions all continue to operate on the **same indexed incoming record objects**, not separate copies. Switching views does not reset filters, edits or inclusion state.

Event venue names are resolved from the existing saved Venues draft/live caches when the import has `Venue_ID` but no `Venue_Name`.

## Additional merge safety
The older `admin.js` merge guard from v0.23.8 was bypassed by a later enhancement script that cloned and replaced the merge input and Apply button. That handler now invokes the exact same primary-ID type validator **before showing the preview** and **again before applying the included rows**. It also blocks applying a merge after switching the active Events/Venues area. This corrects the live-handler gap without altering production data.

## Files
- `admin-enhancements-core.js` — actual enhanced merge-modal renderer and handlers
- `admin-merge-compact.css` — new modal-only compact layout and venue/event header colour
- `admin-enhancements.js` — script loader cache bust
- `admin.html` — new stylesheet, script cache bust, version display
- `admin-upgrade.js` and `admin-polish.js` — v0.24.0 version badges

## Verification
- JavaScript syntax checks passed for modified scripts.
- 23 focused compact renderer/editor tests passed (record format, public links, statuses, tags, typed editing, excluded records and HTML escaping).
- 12 mocked toggle/renderer integration tests passed, including checking that **Table** produces the original full-field header and **Compact** comes back without resetting review state.
- 5 imported-file tests passed, confirming correct type guards run in the actual enhanced modal, and that each new merge resets to compact.
- 3 enhanced Apply tests passed: invalid Events→Venues blocked with zero saves/writes, valid Events still update correctly and close/refresh the preview.
- No edits to `events.json`, `listings.json`, templates or research archives.
- Actual deployed Chrome visual QA remains outstanding.

## Browser QA
Hard-refresh `admin.html`, navigate to **Events** or **Venues**, then choose **Save & Merge → Merge JSON**. The modal should open with four compact columns, showing a **Compact / Table** switch beside the global search and result filters. Expand a record with **Edit fields**, change a value, switch to **Table**, then return to **Compact** and ensure it is retained. Verify include/exclude counts and pagination still work. Do not click **Merge Included Records** unless you intend to modify the current draft.
