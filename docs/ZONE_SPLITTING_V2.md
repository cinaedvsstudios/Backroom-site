# Backroom Zone Splitting — v2 (Phase 2)

## Purpose
The city registry is a worldwide research planning reference, not a source of confirmed venues, events or cruising areas. The Backroom production venue schema and existing Zone 8 cruising conventions are unchanged.

## Shared data sources
- `admin-city-registry.json`: editorial global country/city registry. Contains ISO-style country codes, names, capitals, other cities and destinations. Some entries are territories, administrative seats or tourist areas rather than formal municipalities. Unknown or disputed capitals may require additional review before public use.
- `listings.json`: existing venue and cruising area records, identified permanently by Venue_ID.
- `events.json`: existing event records, identified by Event_ID. Where event location fields are blank, derive city/country from the linked Venue_ID when available.
- City Coverage Manager: read-only per-destination summary of those datasets.

## Geographic targeting
1. Organize first by country, using existing country labels and known aliases for consistent matching.
2. Include the capital, meaningful secondary population centers and major visitor/tourist destinations (including islands, resorts and smaller known nightlife destinations such as Ibiza, Venice, Sitges, Torremolinos, Mykonos and Hvar).
3. Avoid city-size or population-only selection rules. City relevance depends on actual nightlife/travel signals, directory coverage, reliable sources and practical access as well as population.
4. Where large metropolitan regions contain neighborhoods/suburbs that have different names in source listings, retain the source location and normalize thoughtfully; do not create duplicates just because spelling or administrative boundaries differ.
5. Preserve prior Backroom zone IDs for existing work. Zones are research batches, not a new database column. Split oversized countries into contiguous geographic/travel regions or numbered manageable batches; record the membership explicitly rather than silently skipping locations.
6. Use City Coverage to identify missing and low-coverage locations. Zero records means *not currently represented in Backroom*, not "no venue exists".
7. A registry entry is never sufficient evidence to publish a venue or cruising area. New location candidates must pass their separate source verification and editorial review.

## Phase 3 interface
The Scrape Builder should read this same registry, allow country and specific-city selection (including no-coverage cities), and preserve user-chosen batch membership. Copy Selected Cities from Phase 2 may be pasted into a research brief.

## Safe editing
City Registry edits remain in browser localStorage until `admin-city-registry.json` is exported and committed. The public `listings.json` and `events.json` do not change when cities are edited. Preserve unknown columns when handling production data.
