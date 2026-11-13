# Backroom Admin — Phase 3 Quick Setup (v0.23.7)

**Status:** Implemented in the same admin project as the Phase 3 Source Library and Instruction Library. No automatic website crawling, production imports or publishing.

## Why Quick Setup exists

The detailed Phase 3 research builder exposed all options at once — useful for advanced filtering, but overwhelming for a typical weekly research run. Version 0.23.7 makes **✨ Quick Setup** the default tab, alongside **⚙ Advanced Builder**, **🌐 Source Library**, **📜 Instructions** and **❓ How It Works**.

## Three-step workflow

1. **What to research:** choose Event Discovery, Event Updates, Venue Discovery, Venue Updates, Cruising Area Updates or Combined Venue/Event Research. Discovery looks for new candidates; Updates checks existing records. Combined performs venue research and event discovery in one packet. Cruising Updates automatically uses Zone 8.
2. **Where to research:** choose a geography preset. Presets replace the country/city selection but preserve your chosen workflow and date window; manual editing in Advanced Builder makes the selection Custom.
3. **When and how large:** set research date range and batch size, then press **Preview scope** to see existing matches, or **Generate research brief** to prepare Markdown instructions and a JSON research packet. Nothing runs a live crawl or changes production records.

The existing packet section still lets you Copy the research brief, download Markdown or export full JSON/individual batches for a separate research chat.

**Coverage guarantee:** In Discovery/Combined workflows, a selected city is included as a citywide discovery task **even if Backroom already lists places there**. Whole-country presets similarly include explicit countrywide research tasks. Update-only workflows focus on current records and preserve zero-record targets for separately selected uncovered cities.

## Coverage boundaries

The Phase 3 country selector now contains only **54 allowed countries and territories**. It covers Europe (including Iceland, the Faroe Islands, the entire UK, Åland, Isle of Man, Jersey, Guernsey, Gibraltar, Vatican City, etc.) plus **Turkey and Israel**. Spain includes Canary Island cities (Maspalomas, Playa del Inglés and Las Palmas) and the Balearics (Ibiza, Palma). Outside-area countries such as Australia, the United States, Morocco, Greenland and Kazakhstan are not offered.

This is a **Phase 3 UI scope**, not deletion from the global 250-country registry or the website. The same allowlist is applied to generated research packets to prevent out-of-scope production records being selected unintentionally.

Territory scope is an editorial convention for research, not a geopolitical or tourism ranking judgment. The original worldwide city data remains unchanged.

## Presets

| Preset | What it selects | Data basis |
| --- | --- | --- |
| 50 popular tourist cities | 50 **curated** major visitor and gay-travel cities within Europe, Turkey and Israel. Includes Paris, London, Rome, Madrid, Berlin, Maspalomas, Ibiza, Istanbul, Tel Aviv and Jerusalem | Editorial city list with broad 2025 city-tourism context. **Not represented as a measured official arrivals ranking** |
| 10 major tourist countries | Spain, Italy, Turkey, France, United Kingdom, Greece, Austria, Croatia, Germany and Netherlands | Based on 2025 international visitor nights, as reported in Euronews on 19 May 2026 (UK comparison uses 2024) |
| Top 20 Backroom cities | Top 20 city/country pairs by combined counts of **Live/Active venue and event records**, computed dynamically from the working database, with event venue fallback | Backroom's actual loaded venue/event data; not a tourism ranking |
| Gay nightlife & Pride hubs | 20 established nightlife city targets | Editorial coverage list |
| Islands & holiday resorts | 22 city/island/coastal targets including Gran Canaria, Ibiza, Mykonos, Hvar, Tenerife, Faroes | Editorial coverage list |
| All capital cities | Eligible capitals from the admin city registry | Backroom curated registry, not an arrivals ranking |
| 35 uncovered cities | Up to 35 tourist/nightlife-relevant city targets with no matching existing venue/event record | Backroom city registry + current records; research leads only |
| All eligible countries | All 54 eligible countries/territories | Coverage whitelist |

Sources supporting context:
- Euromonitor International, 2025 Top 100 City Destinations Index: https://www.euromonitor.com/newsroom/press-releases/december-2025/euromonitor-international-unveils-worlds-top-100-city-destinations-for-2025
- Euronews, European country visitor nights 2025 (published 2026-05-19): https://www.euronews.com/2026/05/19/which-are-europes-most-visited-countries-by-tourists

## Exact controls explained

**Quick Setup** chooses the workflow, a preset, dates and batches. **Preview scope** only counts matching current records. **Generate research brief** prepares files and instructions.

**Advanced Builder** exposes countries/cities one-by-one; zone auto/manual; date range; status, ID and text filters; source-type and source-count limits. It is not necessary for typical weekly research. Country-only scope means whole countries; chosen cities narrow the search. A country without selected cities is country-wide.

**Source Library** deduplicates URLs while retaining exact original references and provenance. You can browse, filter, select specific sources, edit/import/export references. The 102-line original Collect Scraping URLs file is already included.

**Instructions** holds current editable research rules and verbatim historical P1 prompt/zone plan; edited instructions are used for subsequently generated briefs.

**How It Works** is a separate help tab explaining the six stages and each button.

## Source seed deduplication included

This release also completes the preexisting Phase 3 seed deduplication: 192 original catalogue rows consolidated to **122 unique canonical seed URLs**. Exact original strings and all 192 source references, including the 102 original Collector lines, remain available within each canonical row and in the audit file `scraping/Backroom_source_seed_dedupe_audit_2026-11-13.json`. This does **not** change the original cruising registry and does **not** assert current website availability.

## Testing priorities

- Confirm Quick Setup is the first tab and all five tabs load.
- Confirm country selector contains allowed Europe/Israel/Turkey countries only, and city picker says **cities**.
- Apply the 50 tourist city preset: exactly 50 city targets, including Maspalomas and Tel Aviv. 10 tourist countries: exactly 10 countries and zero city restrictions.
- Top 20 Backroom preset must derive from current active venue/event data, not a hardcoded list. Uncovered cities must come from the city registry and exclude already covered cities.
- Generate a sample packet and verify a non-European (e.g. Australia) production record is excluded, with no change to original JSON.
- Verify the Source Library has one seed row per distinct URL, 122 unique seed URLs / 192 original references, and original variants visible under Provenance. Global venue/event and research registry URLs load separately and deduplicate dynamically.
- No browser-level visual test has been completed in the author's environment; test GitHub Pages with Chrome hard refresh after deploy.
