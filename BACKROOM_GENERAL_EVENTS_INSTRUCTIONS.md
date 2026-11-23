# BACKROOM — GENERAL EVENTS RESEARCH & IMPORT INSTRUCTIONS
**Version:** 1.0  
**Created:** 23 November 2026  
**Scope:** General events on the Backroom website (`events.json` and, where relevant, `festivals.json`)  
**Repository:** https://github.com/cinaedvsstudios/Backroom-site

> **Core distinction:** The general events directory tells visitors **what is happening and where they can go**. It is broader than Backroom's **Weekly Picks**, which is a curated promotional product. **A darkroom, men-only admission, or cruising area is NOT required for every general event listing.**

## 1. Keep these two workflows separate

| | General website events | Weekly Picks / Instagram |
|---|---|---|
| Purpose | Useful, accurate nightlife and festival listings for visitors | Promote a small number of especially relevant events |
| Scope | Gay male-focused nightlife, inclusive gay parties, fetish, cruising, saunas, clubs, Pride and local events | High-quality men-focused darkroom, cruising, sex-play and fetish experiences |
| Mixed-gender admission | **Allowed** when relevant to gay male visitors | Review against the stricter separate Weekly Picks editorial rules |
| Darkroom / sex-play facilities | **Not required** | Normally required and verified at the specific event |
| Selection | Breadth, relevance, accuracy and useful coverage | Exceptional quality, selectivity and travel appeal |
| Output | Add/update suggestions for `events.json`, festival groups in `festivals.json` | Proposed editorial shortlist, artwork and Featured workflow after approval |

**Never use the Weekly Picks exclusion rules as the general events database eligibility test.** Being present in `events.json` does not mean an event qualifies for Weekly Picks or should be promoted on Instagram. This file governs general event discovery even when an older generic Phase 3 instruction says to exclude all mixed-gender events.

The separate `BACKROOM_WEEKLY_PICKS_INSTRUCTIONS.md` continues to govern Weekly Picks. Do not silently change its stricter promotional requirements.

## 2. General event eligibility — what to include

Backroom primarily serves gay male locals and travellers. Include events a gay male visitor could reasonably consider attending or would find useful when planning a night out.

**Normally include, when date and location are sufficiently evidenced:**
- Gay and gay male-oriented club nights, parties, dance events, concerts, themed evenings and nightlife programmes.
- Gay cruising, darkroom, leather, rubber, sportswear, underwear, naked, BDSM/fetish and sexual-play events; note exact event restrictions and facilities.
- **Mixed-gender or all-gender parties with a strong gay male audience or meaningful gay male relevance.** Admission policy alone is **not** an exclusion. **SEXY Party in Cologne** is an explicit example of a relevant event that must not be rejected because other genders may attend.
- Gay saunas' special events and relevant recurring sessions. Do not invent a special event merely because a venue has normal opening hours.
- Pride festivals, queer festivals, citywide programmes and major event weekends relevant to gay travellers. General Pride events can appear as umbrella records even when there is no darkroom.
- Smaller-city queer nightlife and locally important inclusive events, especially where there are few or no dedicated gay venues or alternative events.
- One-off or touring parties, even when there is no permanent Backroom venue entry; put their actual location on the event record.

**A missing darkroom does not disqualify a general event.** A gay disco, Pride activity, themed bar evening or inclusive nightclub event may still be useful. Describe it accurately; never call a venue/event a darkroom party unless the facilities are actually supported.

**Gender is context, not a blunt automatic filter.** Do not claim a mixed-gender event has few women unless the audience composition is documented. Do not assume that a venue's usual features or usual audience necessarily apply to an individual night.

## 3. Lower relevance, exclusions and small-city exceptions

**Usually exclude or deprioritise:**
- Events principally marketed to a different audience, such as FLINTA-only, lesbian-only or women-only events where gay male visitors would not be admitted or are not the intended audience.
- Generic mixed-audience events with no clear relevance to gay male nightlife, travel, culture, cruising, fetish or local queer community.
- Broadly 'super queer' / inclusive dance events with no distinctive gay male relevance, **especially** when established more relevant options exist in the city.
- Ordinary heterosexual nightlife, generic tourist attractions, fabricated dates, cancelled events and events with no sufficiently supported location/date.
- Venues' normal weekly opening hours presented as if they were a special event.

**Local exception:** In a small city or place with very few alternatives, an inclusive queer party without a darkroom may be worth listing so visitors have a realistic place to go. Explain the actual audience and atmosphere, and verify that gay men are genuinely welcome. **Do not list a restrictive event as accessible to gay men if its admission rules exclude them.**

Do not make eligibility decisions from one keyword ('mixed', 'queer', 'FLINTA', 'fetish') alone. Check admission, audience, actual event content, city context, availability of alternatives and evidence of facilities.

**Only flag a candidate for editorial review** when relevance, admission or details are unclear. Do not silently discard a potentially useful listing because a third-party directory labelled it 'mixed-gender'.

## 4. Coverage: research the whole requested area

- Search the requested date window, from beginning to end, in the local calendar of each event.
- Include major destinations and smaller cities; **do not only check Berlin, London and other capitals.**
- Use the project's existing zone/city registry and known country assignments. Preserve existing assignments; do not make up new zone IDs.
- Start with the current `events.json` and `festivals.json`. Check nearby dates for cross-midnight or multi-day events and aliases.
- Use `admin-phase3-sources.json` as the research source register. It contains directories, city guides, official venue calendars, promoters and local/native-language sources. Prioritise the parts relevant to **events**, but do not claim the entire register was checked unless it actually was.
- Search local-language event titles and official calendars, ticketing and verified social accounts, not merely English travel directories.
- Record which sources were checked and distinguish **no qualifying dates found**, **calendar not published that far ahead**, **site inaccessible**, and **not checked**.
- A narrow first pass is not proof that organisers have announced nothing. If few results appear, conduct a deeper pass across venue calendars and additional cities and explain coverage limitations.

## 5. Verification and dating

For each event, aim to verify:
1. Exact event/edition name and organiser; distinguish series names from one-off editions.
2. Exact date or multi-day date range, with correct weekday and the event's local time zone.
3. Start time, entry window and end time **as separate concepts**; leave unknown times blank.
4. Venue name, address or event-specific location, city and country.
5. Admission/audience rules, age minimum, membership and dress code.
6. What the night actually offers. Only describe darkrooms, cruising or play facilities when they apply to that event.
7. Price, presale, registration, sold-out conditions and booking URL if available.
8. Official event, organiser, venue and verified social URLs, retaining the most specific pages.

**Evidence order:** Official dated organiser/venue page → official tickets / dated official social post → reputable dated specialist event calendar → general directory lead. Preserve conflicting claims and uncertainties. Do not manufacture facts to complete a row.

**Recurrence:** A regular Monday, Friday, first-Saturday or monthly pattern is a useful lead, **not proof that each future date has been announced**. Create future dated Live occurrences only with sufficient date-specific evidence or a genuinely published recurrence schedule that clearly covers those dates. Otherwise list the candidate for follow-up, not as a verified event. Never extrapolate a cancelled or changed series without checking.

**Status:** Respect the current production statuses, especially `Live`, `Hold` and `Flag`; maintain cancellation/closed history as appropriate to the existing data. An inaccessible website does not prove an event is cancelled. Do not overwrite a valid existing event because one source failed.

## 6. Separate individual events, venues and festivals

**`events.json`** stores individual dated events and qualifying festival sessions. General Pride events can also have a dated umbrella event record where helpful for discovery.

**`festivals.json`** stores umbrella festivals and multi-day programmes, with full start/end dates and existing related `Event_ID` references. When a multi-day festival has separate parties, list those sessions individually in `events.json` as reliable details become available; do not reduce a seven-day festival to one fabricated single-night event.

**`listings.json`** stores meaningful permanent venues, not every one-off address, touring event or festival. Use an existing, validated `Venue_ID` only where the permanent venue actually matches. For a rotating party, Pride, festival or one-time address without a useful permanent venue listing, leave `Venue_ID` empty and keep `Event_Location`, `City` and `Country` on the event itself. **Never invent a permanent Venue_ID merely to fill a field.**

An umbrella festival's audience may be broad. Describe separately which individual sessions, if any, offer men-only cruising, sex-play or darkroom access. A festival record does not automatically qualify all its sessions for Weekly Picks.

## 7. Existing data first: matching, deduplication and identity

Before proposing an import, successfully retrieve the current complete `events.json`, `listings.json`, and relevant `festivals.json`. Do not mistake a failed large JSON fetch for an empty file. Try the GitHub repository API/blob read if a standard fetch returns nothing.

Compare at minimum:
- Exact `Event_ID`, `Event_Date` and `Venue_ID`.
- Normalised organiser, name aliases, recurring series, city/location and date.
- Individual festival sessions against existing umbrella events and related `Event_IDs`.
- Events at the same venue on the same date with different sessions/times; these may be legitimate separate events.
- Event names that vary by language, venue branding or promotional subtitle.

An existing event should normally be **updated**, not re-added with a different ID. Keep existing valid IDs, fields and status. A new Event_ID may be created only for a genuinely new record after conflict checking; never recycle or fabricate a venue identity. Report ambiguous matches for review.

Do not silently remove historical records or duplicate a mixed-gender event under a second "men-only" name.

## 8. Production schema and merge file

Use the **current live `events.json` schema**, not a simplified example, as the authoritative structure. Preserve optional and unfamiliar fields. Common event fields include:

`Event_ID`, `Venue_ID`, `Venue_Name`, `Event_Location`, `City`, `Country`, `Event_Name`, `Event_Date`, `Event_Start_Time`, `Event_End_Time`, `Status`, `Event_Category`, `Event_Description`, `Dresscode_Info`, `Audience_Info`, `Price_Info`, `Ticket_URL`, `Event_URL`, `Source_URLs`, `Vibe_Tags`, `Recurrence_Type`, `Recurrence_Day`, `Recurrence_Until`, `Last_Updated`, `Flag_Reason`.

Keep the types and formatting used by production:
- ISO `YYYY-MM-DD` dates and 24-hour `HH:MM` local times where known.
- URLs with their complete useful event-specific paths; no invented social handles.
- Clear original descriptions, written naturally for someone deciding where to go. **Do not copy directory text verbatim and do not tell public readers that text was scraped or extrapolated.**
- Describe admission limitations, specific gear and age requirements honestly without hype.
- Do not give unsupported attendance demographics, darkroom claims, prices, popularity or ratings.
- Only update `Last_Updated` when a production record is actually added or changed.

For an **Update / Add** import, produce a JSON array with **only new and specifically approved updated events**, not the entire production database. Keep existing records untouched. Empty strings in import fields should never be used to erase nonempty existing values unless explicitly intended under the admin import rules; the deliberate clear marker is `__CLEAR__`. Do not use **Replace All** for partial updates. Validate UTF-8 JSON syntax, required fields, every new ID, venue linkage, duplicate names/dates and event/status conditions before exporting.

## 9. Research report: distinguish certainty and action

Every requested general-event research run should report:
1. **Scope** — date range, countries/cities/zones and actual sources checked.
2. **Confirmed missing events** — genuinely new and dated records after complete database comparison, with verified links and any admission restrictions.
3. **Existing events needing updates** — matching `Event_ID`, old/new value, why it changed and exact evidence.
4. **Unconfirmed leads** — possible upcoming occurrences, incomplete calendars, gender/access uncertainty, tentative locations or recurring series not specifically confirmed.
5. **Festivals** — new umbrella records and newly published individual sessions, separately.
6. **Skipped candidates** — short reasons for genuine irrelevance or exclusion, not just "mixed-gender".
7. **Coverage gaps** — sources inaccessible/unsearched, dates not yet on sale, and whether a deeper pass is warranted.
8. **Import summary** — new event count, update count, duplicates avoided, validation result and whether any repository changes were actually made.

Do **not** describe an event as "missing" until the current complete database has been checked. If the database could not be read, call it **candidate addition — database comparison not completed**.

Provide a reviewable merge file when requested. **Do not commit events, venues or festivals to GitHub, change statuses, remove entries or start promotional artwork without the relevant approval.** Creating or updating **this instruction file** is separate from changing production data.

## 10. Examples that settle common ambiguities

| Scenario | General events database | Weekly Picks |
|---|---|---|
| SEXY Party Cologne, formally mixed-gender, gay male audience | **Include** when an edition is verified | Apply stricter promotion review |
| Gay dance party with no darkroom | **Can include** if relevant | Generally not a Pick |
| Men-only sexual-play event with verified date | **Include** | Strong candidate, not automatically Featured |
| Main Pride festival, various locations, no single venue | **Include useful festival/event records** | Only promote verified relevant sessions under separate editorial rules |
| All-gender queer night in small city with no other gay nightlife | **Consider inclusion** if gay men are welcome and it helps visitors | Usually not a Pick |
| FLINTA-only night that does not admit gay male visitors | **Do not list as a place for gay male visitors to attend** | Exclude |
| A venue usually has a darkroom, but party's facilities are unknown | **May include event, without claiming play facilities** | Do not assume Weekly Picks eligibility |
| Famous monthly series with no confirmed date for requested month | **Research lead, not a dated Live import** | Not confirmed |

## 11. Conflict and precedence note for existing Phase 3 admin rules

As at 23 November 2026, `admin-phase3-instructions.json` still includes blanket men-only/darkroom and mixed-gender exclusions in its `EVENT_DISCOVERY`, `EVENT_UPDATES`, `COMBINED` and `COMMON_RULES` instructions. Those are **too strict for the GENERAL events directory** described here.

**For general event research, follow this file's general eligibility rules rather than the blanket mixed-gender/darkroom exclusion.** Venue discovery, public cruising-area research and Weekly Picks still have their own separate requirements. The admin panel may need its editable rules updated separately to use this policy automatically; merely saving this Markdown file does **not** itself rewrite `admin-phase3-instructions.json`.

---
**End of General Events Research & Import Instructions v1.0.**
