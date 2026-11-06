# Backroom venue ratings — eligibility rules (6 November 2026)

These rules apply to future venue-rating completeness checks and editorial research. The dated 5 November audit is historical; use `python3 scripts/audit_venue_ratings.py` to regenerate a current, category-aware audit.

1. **Keep community organisations and social groups.** They help represent smaller cities, but are exempt from mandatory nightlife rating fields.
2. **Remove film festivals.** These fall outside Backroom's venue and cruising scope. This does not remove legitimate fetish parties or other nightlife events.
3. **Keep Pride marches and Pride events.** They do not require fixed-venue ratings, even if one is temporarily held at a particular location. Pride names and `-PRD-` IDs take precedence over inconsistent category labels.
4. **Shops and retail listings:** exempt from fixed-venue nightlife ratings.
5. **Fixed bars, clubs, saunas, cinemas and permanent venues:** seven editorial 1–5 fields: general, darkroom, age range, cost, size, location, busyness. `Rating_Darkroom: 0` is valid when **confirmed no darkroom**, not as a default for unknowns.
6. **Outdoor cruising locations / gay naturist beaches:** only general, age range, location, busyness; no venue size, ticket price or darkroom rating.
7. **Party brands / non-Pride festivals:** establish their actual usual venue BEFORE rating facilities. The accompanying `2026-11-06_party_venue_location_review.csv` distinguishes evidence *candidates*, not confirmed facts. Populate `Confirmed_Mode` only after reviewing official pages and recent editions:
   - `fixed`: same specific venue for most editions; use its size, darkroom and location, combined with party-specific age range, ticket cost, busyness and quality.
   - `travelling`, `rotating`, or `multi_venue`: only typical attendee age range and ticket cost are eligible; leave other venue-dependent fields not applicable.
   - Blank `Confirmed_Mode`: needs editorial classification, NOT a missing-score defect. An address or single past event alone does not prove a fixed venue.
8. **Do not invent ratings** to make completeness counts fall. Preserve existing valid ratings. A blank value means unknown or not applicable unless the category policy says it should exist.
9. **Site data safety:** ratings use `Venue_ID` merge updates; never overwrite `Public_Rating` or unrelated fields. Deletions should preserve community venues and Pride records.

The review CSV and the generated eligibility audit are curation aids, not new public listing fields; they do not automatically assign scores.
