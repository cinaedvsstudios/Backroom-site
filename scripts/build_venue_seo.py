#!/usr/bin/env python3
"""Generate crawlable Backroom venue entry pages from the public listings.json.

These pages are search/discovery entry points only. All navigation leads back
to the existing Backroom single-page app; venue info remains in listings.json.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

BASE = "https://cinaedvsstudios.github.io/Backroom-site/"
ROOT = Path(__file__).resolve().parents[1]
VENUES = ROOT / "venue"

HTML_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <title>__TITLE__</title>
  <meta name="description" content="__META__">
  <link rel="canonical" href="__CANONICAL__">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Backroom">
  <meta property="og:title" content="__TITLE__">
  <meta property="og:description" content="__META__">
  <meta property="og:url" content="__CANONICAL__">
  __OG_IMAGE__
  <style>
    :root{color-scheme:dark}
    *{box-sizing:border-box}
    body{background:#000;color:#d3d8e3;font:16px/1.45 Arial,Helvetica,sans-serif;margin:0}
    .site{max-width:920px;margin:20px auto;padding:24px;background:#1F2535;border:1px solid #313748;border-radius:12px}
    h1{color:#fff;font-size:2rem;margin:12px 0 6px}
    h2{font-size:1.12rem;color:#2CA8D4;margin:22px 0 8px}
    a{color:#65c5ee}
    .nav{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .nav a,.action{border:1px solid #2CA8D4;border-radius:6px;padding:9px 12px;text-decoration:none}
    .nav strong{color:#2CA8D4;margin-right:auto;letter-spacing:.08em}
    .meta{color:#aab4c6;margin:0 0 14px}
    .facts{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
    .facts span{background:#313748;border-radius:5px;padding:6px 9px}
    .photo{width:100%;max-height:340px;object-fit:cover;border-radius:8px;display:block;margin:12px 0}
    .description{white-space:pre-wrap;overflow-wrap:anywhere}
    .actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
    .muted{color:#aab4c6;font-size:.9rem}
    .gate{position:fixed;z-index:100;inset:0;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;padding:20px}
    .gate-panel{max-width:460px;border:1px solid #2CA8D4;border-radius:12px;background:#1F2535;padding:25px;text-align:center}
    button{border:0;background:#2CA8D4;color:#000;padding:12px 22px;border-radius:7px;font-weight:bold;cursor:pointer}
    @media(max-width:700px){.site{margin:0;padding:17px;border-radius:0}.nav strong{width:100%}h1{font-size:1.55rem}}
  </style>
</head>
<body>
<!-- Backroom SEO: GENERATED; source of truth is listings.json. -->
<main class="site">
  <nav class="nav" aria-label="Backroom navigation">
    <strong>BACKROOM</strong>
    <a href="../">Home</a>
    <a href="../#venues">Venues</a>
    <a href="../#calendar">Events</a>
  </nav>
  <h1 id="venue-name">__NAME__</h1>
  <p class="meta" id="venue-location">__LOCATION__</p>
  __IMAGE__
  <section aria-label="Venue details">
    <div class="facts">
      <span id="venue-category">__CATEGORY__</span>
      <span id="venue-address">__ADDRESS__</span>
      <span id="venue-hours">__HOURS__</span>
    </div>
    <h2>About this venue</h2>
    <p class="description" id="venue-description">__DESCRIPTION__</p>
    <div class="actions">
      <a class="action" id="venue-open" href="../#venue=__ID_URL__">Open in Backroom</a>
      <a class="action" href="../#calendar">Check upcoming events</a>
      __WEBSITE__
    </div>
  </section>
  <p class="muted">18+ gay nightlife and cruising directory. Check the venue's official information for current hours, entry rules and event details.</p>
  <p class="muted"><a href="../privacy.html">Privacy</a> · <a href="../contact.html">Contact</a></p>
</main>
<div class="gate" id="age-gate">
  <div class="gate-panel">
    <h2>BACKROOM · 18+</h2>
    <p>This directory contains adult nightlife and cruising information. Confirm that you are 18 or older to continue.</p>
    <button type="button" id="enter">I AM 18+ — ENTER</button>
  </div>
</div>
<script>
(function(){
  "use strict";
  var gate = document.getElementById("age-gate");
  try { if(localStorage.getItem("br_age_verified")==="true") gate.remove(); } catch(e){}
  document.getElementById("enter")?.addEventListener("click",function(){
    try { localStorage.setItem("br_age_verified","true"); } catch(e){}
    gate?.remove();
  });
  // Keep the screen accurate even if the JSON changes before the next SEO build.
  fetch("../listings.json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(data){
    var venue = Array.isArray(data) ? data.find(function(v){return v.Venue_ID===__ID_JSON__;}) : null;
    if(!venue || venue.Status!=="Live") {
      document.getElementById("venue-description").textContent = "This listing is no longer available. Browse the current Backroom venues.";
      return;
    }
    var set = function(id,value){var el=document.getElementById(id);if(el) el.textContent=String(value||"");};
    set("venue-name",venue.Name);
    set("venue-location",[venue.City,venue.Country].filter(Boolean).join(", "));
    set("venue-category",venue.Category);
    set("venue-address",venue.Address);
    set("venue-hours",[venue.Opening_Days,venue.Opening_Open_Time,venue.Opening_Close_Time].filter(Boolean).join(" · "));
    set("venue-description",String(venue.Description||"").replace(/={4,}\s*\+{4,}/g,"\n\n").replace(/\|\|/g," ").replace(/ \-\- /g," · "));
  }).catch(function(){ /* Initial server-rendered details remain available. */ });
})();
</script>
</body>
</html>
"""

def esc(value):
    return html.escape(str(value if value is not None else ""), quote=True)

def plain(value):
    s = str(value or "")
    s = re.sub(r"={4,}\s*\+{4,}", "\n\n", s)
    s = s.replace("||", " ").replace(" -- ", " · ")
    return re.sub(r"[\t ]+", " ", s).strip()

def url(value):
    s = str(value or "").strip()
    return s if s.startswith(("https://", "http://")) else ""

def valid_date(value):
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", str(value or ""))
    return match.group(1) if match else ""

def build_page(venue):
    vid = str(venue["Venue_ID"])
    title = f"{venue.get('Name','')} — {venue.get('City','')} | Backroom"
    desc = plain(venue.get("Description"))
    meta = f"{venue.get('Name','')}, {venue.get('Category','')} in {venue.get('City','')}, {venue.get('Country','')}. {desc}"
    meta = re.sub(r"\s+", " ", meta).strip()[:160]
    canonical = BASE + "venue/" + quote(vid, safe="-_") + ".html"
    image = url(venue.get("Image_URL"))
    if not image:
        raw_image = str(venue.get("Image_URL") or "")
        if raw_image and not raw_image.startswith("/") and ".." not in raw_image:
            image = "../" + quote(raw_image, safe="/-_.")
    official = url(venue.get("Website_URL"))
    parts = {
        "__TITLE__": esc(title),
        "__META__": esc(meta),
        "__CANONICAL__": esc(canonical),
        "__OG_IMAGE__": ('<meta property="og:image" content="' + esc(image if image.startswith("http") else BASE + image.removeprefix("../")) + '">') if image else "",
        "__NAME__": esc(venue.get("Name")),
        "__LOCATION__": esc(", ".join(filter(None,[venue.get("City"),venue.get("Country")]))),
        "__IMAGE__": '<img class="photo" loading="lazy" alt="' + esc(venue.get("Name")) + '" src="' + esc(image) + '" onerror="this.remove()">' if image else "",
        "__CATEGORY__": esc(venue.get("Category")),
        "__ADDRESS__": esc(venue.get("Address") or "See venue details"),
        "__HOURS__": esc(" · ".join(filter(None,[venue.get("Opening_Days"),venue.get("Opening_Open_Time"),venue.get("Opening_Close_Time")])) or "Check current opening hours"),
        "__DESCRIPTION__": esc(desc),
        "__WEBSITE__": '<a class="action" rel="noopener noreferrer" target="_blank" href="' + esc(official) + '">Official website</a>' if official else "",
        "__ID_URL__": quote(vid, safe="-_"),
        "__ID_JSON__": json.dumps(vid).replace("<","\\u003c"),
    }
    result = HTML_PAGE
    for key,value in parts.items():
        result = result.replace(key,value)
    return result

def main():
    data = json.loads((ROOT / "listings.json").read_text(encoding="utf-8"))
    eligible = []
    seen = set()
    for item in data:
        vid = str(item.get("Venue_ID") or "").strip()
        if (item.get("Status") != "Live" or
            not re.fullmatch(r"[A-Za-z0-9_-]+",vid) or vid in seen or
            not item.get("Name") or not item.get("City") or not item.get("Description")):
            continue
        seen.add(vid)
        eligible.append(item)
    VENUES.mkdir(exist_ok=True)
    expected = set()
    for item in eligible:
        filename = item["Venue_ID"] + ".html"
        expected.add(filename)
        page = build_page(item)
        target = VENUES / filename
        if not target.exists() or target.read_text(encoding="utf-8") != page:
            target.write_text(page, encoding="utf-8")
    for path in VENUES.glob("*.html"):
        if path.name not in expected and "Backroom SEO: GENERATED" in path.read_text(encoding="utf-8")[:5000]:
            path.unlink()
    static_paths = ("", "about.html", "dress-codes.html", "cruising-guide.html",
                    "heatmap.html", "featured.html", "privacy.html")
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path in static_paths:
        if not path or (ROOT / path).exists():
            sitemap.append("  <url><loc>" + xml_escape(BASE + path) + "</loc></url>")
    for item in sorted(eligible,key=lambda v:v["Venue_ID"]):
        path = "venue/" + quote(item["Venue_ID"],safe="-_") + ".html"
        lastmod = valid_date(item.get("Last_Updated"))
        date_tag = "<lastmod>" + lastmod + "</lastmod>" if lastmod else ""
        sitemap.append("  <url><loc>" + xml_escape(BASE + path) + "</loc>" + date_tag + "</url>")
    sitemap.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8")
    print(f"Generated {len(eligible)} live venue pages and sitemap entries.")
if __name__ == "__main__":
    main()
