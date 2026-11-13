# Backroom Admin v0.23.4 — Phase 3 Research Studio

## Status
Phase 3 is the in-browser **Scrape Builder**, **Master Source Library** and **Instruction Library**. It generates research briefs, not a crawler or automatic database publisher. All production records and source research archives remain untouched.

## New files
- `admin-phase3-data.js`: safe HTTP(S) URL keying (tracking-parameter dedup without losing exact variants, paths, query params or anchors), nested JSON extraction, record-to-source links and provenance; actual geographic zone mapping and country-contiguous batching; research-only packet generation.
- `admin-phase3.js`: dedicated 🧭 Scrape Builder sidebar screen with three tabs and handlers.
- `admin-phase3.css`: responsive research studio UI.
- `admin-phase3-sources.json`: 122 canonical research URLs after deduplicating all 192 original seed/catalogue references from the P1 rules, October zone plan and 102-URL Collector. Every original entry remains attached as a structured `source_references` array, with its exact original URL, ID, source category, workflow and provenance.
- `admin-phase3-instructions.json`: 10 templates including six specialized workflows, common and zone rules, plus the exact recovered original P1 zoned scraping prompt and the Oct 2026 combined zone plan preserved as separate historical items.
- `admin.html` + versions in `admin-polish.js`, `admin-upgrade.js`: Phase 3 assets and v0.23.4.

## Workflow options
Event Discovery, Event Updates, Venue Discovery, Venue Updates, Cruising Area Updates and Combined Venue + Event Research.

Select countries and specific cities from the Phase 2 editable registry, including uncovered tourist destinations. Filter existing working records by status, text and pasted Venue_ID/Event_ID values copied from Compact View. Set ISO date window (six months from browser's Berlin-local date by default), research zone, batch size and source limit. Batches are split contiguously by zone and country rather than silently mixing zones.

Current Oct 2026 research boundaries (preserved as separate history rather than overwriting older instructions):
- Zone 0: Germany.
- Zone 1: France, Benelux and **Switzerland**.
- Zone 2: UK and Ireland.
- Zone 3: Spain, Portugal and all relevant islands.
- Zone 4: Italy, Austria, Czechia, Hungary, Greece, **Slovakia and Slovenia**.
- Zone 5: Poland, Denmark, Sweden, Finland, Estonia, Latvia and Lithuania.
- Zone 6: Other European/adjacent destinations, including Balkans, Norway/Iceland and cross-zone European touring parents. The specific Oct 2026 European campaign excluded USA cities.
- Zone 8: Public-space cruising areas exclusively. No Zone 7.

## Source Library
Automatic inputs: curated original source URLs, current `listings.json` and `events.json` URLs and URL fields, plus **lazy-loaded** full `research/CRUISING_SOURCE_REGISTRY.json` and `research/events/2027-01/venue_url_audit.json` when requested or before generating.

The user can:
- Search exact URLs, source category, linked record IDs, country and origin.
- Edit the name, URL, category and verification note; enable/disable; add new sources.
- Select an individual subset of URLs for generated briefs; or select all eligible by clearing selection.
- Import JSON arrays, `{sources:[...]}`, CSV/TSV with a URL/Website_URL column, plain-text URL lists and nested research JSON, preserving the original exact URL variants and provenance where present.
- Export all assembled sources to JSON/CSV. No web availability checking is implied by a URL being indexed.
- See per-source record and file associations.

**Collector correction (13 Nov 2026):** Recovered the original **Backroom_scraping_source_URLs.txt** from ChatGPT Library (102 lines, 102 distinct exact URLs). Preserved every original line in **`scraping/Backroom_scraping_source_URLs_102_2026-11-06.txt`**, and included all 102 as provenance-tagged `COLLECTOR-001`…`COLLECTOR-102` entries in `admin-phase3-sources.json`. The saved source catalogue initially had **192 source entries** (90 earlier entries plus 102 Collector lines). The v0.23.6 deduplication pass consolidated them into **122 distinct canonical URL rows**, each retaining its original references. This replaces the earlier unverified statement that the collector export was unavailable. The original paths, query strings and anchors are preserved; URL indexing is not a claim of current availability.

The consolidated cruising registry reports 1,591 location records and 3,516 alternate references in its 2026-11-13 audit, but remains research evidence, not current venue verification. Source imports and database references do not constitute independent validation, legal-access confirmation or publication approval. Source archive files were not deleted.

## Instruction Library
Separate current workflow-specific prompts and editable shared rules. Includes verbatim recovered archived P1 rules and Oct 2026 zone plan sourced from existing personal Library files. Preserve multiple historically differing zone definitions as separate versions; current Oct 2026 boundaries are used in newly generated jobs. Local edits save only in browser until exported. Import compatible instruction JSON to add or revise.

All prompts require retained IDs and unknown fields, real source-date evidence and current men-only/darkroom criteria, no fabricated features/ratings, correct recurrence/ticket rules, original useful page-specific URLs, human editorial copy, and Zone 8 broad public map references rather than hidden micro-routes.

## Research output and publication safety
Generate a Markdown brief or research-only JSON packet. JSON includes date window, workflow, country/city and zone selection, complete original rows in `existing_records` with all unknown production fields preserved, separate zero-record discovery tasks, record-linked sources, schema field lists, workflow instructions and geographic batch membership. Download individual batches if needed. There is **no Apply/Publish** operation and no change to `listings.json`, `events.json`, `admin-city-registry.json` or the cruising research registry.

## Verification
- Source data, UI JavaScript and integration script compiled with `new Function`.
- URL tests: HTTP(S) only; retain path case and URL hash; collapse tracking variants without dropping record linkages; parse semicolon/comma separated Source_URLs.
- Source test: 122 canonical seed URLs; 192 original source reference IDs and exact URL strings retained; all 102 Collector URLs and linked archival lines preserved; imported nested source reference retains Venue_ID and provenance.
- Batch tests: Switzerland Zone 1, Slovakia/Slovenia Zone 4, cruising Zone 8, country-contiguous batches; zero-record city targets; all optional fields preserved.
- Dedicated source selection, six-month configurable date ranges, combined venue/event rules, research-only marking and correct asset references.
- Mock-DOM UI smoke: mounting sidebar, opening builder, source library, reading two research archives, showing imported URL origin and archived instructions, hiding/reopening screen.
- Real Chrome/GitHub Pages visual verification not yet performed.

## Deployment QA
1. Load admin with Ctrl+Shift+R; confirm 🧭 Scrape Builder appears as a new sidebar item while other Admin sections remain intact.
2. Pick an Events workflow and Germany/Berlin, choose dates and a small batch size, Generate, inspect JSON and Markdown, ensure no production data changes.
3. Inspect a Zone 8 Cruising Area Updates job and confirm only cruising entries and approved zone rules appear.
4. Open Source Library; check the 122 canonical seed URLs and 192 original reference count. Expand a duplicate's Provenance and original URL variants details, and verify its original IDs; check cruising registry/January audit lazy loading, pagination, search, category and record-ID filters, and source selection. The historical 102-URL Collector is already included—do not re-import it unless checking import behaviour.
5. Open Instruction Library and verify current prompts plus two full archival texts. Edit/copy/export/import, refresh and check local storage persistence.
6. Revisit Venues, Events, Cruising Areas and Data & Analytics to ensure routing and themes still function.

## Permanent Source Seed Deduplication — v0.23.6 (13 Nov 2026)

The saved `admin-phase3-sources.json` originally contained 192 seed rows, of which 40 repeated an identical URL and 30 were additional HTTP/HTTPS, www or trailing-slash equivalents. The source catalogue now has **122 canonical URL rows** spanning **51 duplicate groups**.

The exact original 192 source records are still accessible through every canonical entry's `source_references`: original ID, original URL string, original name/type, workflows, geographic notes, verification note, enabled state and provenance. The original 102-line Collector text remains unchanged in `scraping/Backroom_scraping_source_URLs_102_2026-11-06.txt`. A machine-readable audit of each merged group is saved at `scraping/Backroom_source_seed_dedupe_audit_2026-11-13.json`.

The Phase 3 runtime Source Library already deduplicated production URLs and research registry URLs on load. Version 0.23.6 additionally removes repeated entries from the *saved seed catalogue* without modifying the large cruising registry or historic research archives. Source Library details and JSON/CSV exports now retain exact original references. Source-type filters consider original categories where a canonical URL had several classifications.

**Scope distinction:** 122 is the number of distinct seed catalogue URLs, not the total number of unique URLs across current venue/event records and the cruising research registry. The latter are loaded and deduplicated dynamically, and their totals vary with data updates. Deduplication groups addresses for review; it does not verify live redirects, current opening/activity or legal status.
