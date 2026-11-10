# Backroom downloads

`backroom-downloads.js` adds client-side downloads without accounts, storage writes, or an export server.

- Event details: **Share to story** previews a 1080 x 1920 JPEG, with a download button. The existing event image (or the site fallback) is centered and cropped into the card.
- Saved shortlist: the download icon beside Share exports all items, regardless of the active Venues/Events filter or collapsed cards.
- Received shortlist: **Download PDF** exports the received entries directly, without saving them to a profile.
- PDFs use searchable, wrapping text, full event/venue descriptions, full addresses linked to Google Maps, local times, website/ticket links, download date, and page numbers. Long content continues onto another page.

## Story tags

Use at most three unique tags from the event's own `Vibe_Tags`. Never infer tags from names or inherit venue tags for a story.

Priority: Men Only; Cruising / Sauna; Leather / Underwear / Naked / Fetish/Gear / Fetish / BDSM / Bear; then Techno / Pop/Dance / Queer / Young Crowd / Drag / Pride / Festival / Community / Social / Dancefloor / Party / Dresscode. Unlisted tags follow, preserving their source order.

The brand URL is **https://backroom.s.gy/**.

## Dependencies

The browser loads the locally vendored PDF library only when needed. Fonts are loaded from the same origin. jsPDF 3.0.3 uses the MIT license; Barlow Condensed uses the SIL Open Font License. Both licenses are included in `vendor/`.

## Verification

Verified in Chrome desktop and a 390px mobile viewport: story previews and JPEG download; agreed tag selection; saved and received PDF downloads; no profile changes from received exports; missing artwork fallback; long titles; multi-page text without loss; Google Maps and website link annotations.
