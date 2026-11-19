#!/usr/bin/env python3
"""Generate seven complete Backroom app entry pages from index.html.

Only SEO metadata, an initial hash route and a no-JavaScript crawlable fallback
are different. Never edit the generated *-app.html files by hand.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://cinaedvsstudios.github.io/Backroom-site/"
ENTRY_PAGES = {
  "venues-app.html": {
    "route": "#venues",
    "title": "Gay Venues, Bars, Clubs and Saunas | Backroom",
    "heading": "Venues",
    "description": "Find gay bars, clubs, saunas, darkrooms and cruising venues across Europe. Browse locations, features and venue details using Backroom."
  },
  "events-app.html": {
    "route": "#calendar",
    "title": "Gay Nightlife Events Calendar | Backroom",
    "heading": "Events",
    "description": "Explore gay nightlife events and fetish parties across Europe. Browse Backroom's events calendar by date and location."
  },
  "festivals-app.html": {
    "route": "#festivals",
    "title": "Gay Pride and Fetish Festivals | Backroom",
    "heading": "Festivals",
    "description": "Discover gay Pride celebrations, fetish festivals and multi-day nightlife events in Backroom's festival calendar."
  },
  "cruising-app.html": {
    "route": "#cruising-guide",
    "title": "Gay Cruising Areas Guide | Backroom",
    "heading": "Cruising Guide",
    "description": "Explore Backroom's guide to gay cruising areas, with city and location information to help plan your visit."
  },
  "travel-app.html": {
    "route": "#travel",
    "title": "Gay Travel and City Guides | Backroom",
    "heading": "Travel",
    "description": "Plan gay nightlife travel with Backroom's city and destination guide, connected to venues, events and local information."
  },
  "heatmap-app.html": {
    "route": "#heatmap",
    "title": "Gay Nightlife Heat Map | Backroom",
    "heading": "Heat Map",
    "description": "Explore gay nightlife destinations and venue coverage geographically with Backroom's interactive heat map."
  },
  "terminology-app.html": {
    "route": "#dress-codes",
    "title": "Fetish Terminology and Dress Codes | Backroom",
    "heading": "Terminology & Dress Codes",
    "description": "Learn gay nightlife, fetish and cruising terminology and dress code meanings with Backroom's terminology guide."
  }
}

def swap_once(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise ValueError(f"Missing or duplicated {label} in index.html")
    return updated

def build_entry_page(template: str, filename: str, config: dict) -> str:
    route = config["route"]
    title = html.escape(config["title"], quote=True)
    description = html.escape(config["description"], quote=True)
    heading = html.escape(config["heading"])
    canonical = html.escape(BASE + filename, quote=True)

    substitutions = (
        (r'<title>[^<]*</title>', f'<title>{title}</title>', "title"),
        (r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{description}">', "description"),
        (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{canonical}">', "canonical"),
        (r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{title}">', "og:title"),
        (r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{description}">', "og:description"),
        (r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{canonical}">', "og:url"),
        (r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{title}">', "twitter:title"),
        (r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{description}">', "twitter:description"),
    )
    page = template
    for pattern, replacement, label in substitutions:
        page = swap_once(page, pattern, replacement, label)

    schema = {
        "@context": "https://schema.org",
        "@type": "WebPage" if filename == "heatmap-app.html" else "CollectionPage",
        "name": config["title"],
        "description": config["description"],
        "url": BASE + filename,
        "inLanguage": "en",
        "isPartOf": {"@type": "WebSite", "name": "Backroom", "url": BASE},
    }
    structured = ("    <script type=\"application/ld+json\">\n"
                  + "\n".join("    " + line for line in json.dumps(schema, ensure_ascii=False, indent=2).splitlines())
                  + "\n    </script>")
    page = swap_once(page, r'    <script type="application/ld\+json">[\s\S]*?</script>',
                     structured, "structured data")

    startup = (
        "    <!-- Section selection is applied before the existing app starts. Explicit deep links win. -->\n"
        "    <script data-backroom-entry-route>\n"
        "    (() => {\n"
        "      if (window.location.hash || window.location.search) return;\n"
        f"      history.replaceState(history.state, '', location.pathname + location.search + '{route}');\n"
        "    })();\n"
        "    </script>\n"
    )
    page = swap_once(page, r'</head>', startup + '</head>', "head end")

    links = " ".join(
        f'<a href="{html.escape(path, quote=True)}">{html.escape(info["heading"])}</a>'
        for path, info in ENTRY_PAGES.items()
    )
    fallback = (
        "<noscript>\n"
        "    <style>\n"
        "      #age-gate, #app-shell { display: none !important; }\n"
        "      .backroom-entry-fallback { max-width: 760px; margin: 32px auto; padding: 24px; color: #d3d8e3; font: 16px/1.5 Arial, sans-serif; }\n"
        "      .backroom-entry-fallback a { color: #65c5ee; margin-right: 12px; }\n"
        "    </style>\n"
        "    <main class=\"backroom-entry-fallback\">\n"
        f"      <h1>Backroom: {heading}</h1>\n"
        f"      <p>{html.escape(config['description'])}</p>\n"
        "      <p>Enable JavaScript to open this section in the full Backroom application, including search, filters and your saved settings.</p>\n"
        f"      <nav aria-label=\"Browse Backroom sections\">{links}</nav>\n"
        "    </main>\n"
        "</noscript>"
    )
    page = swap_once(page, r'<body>', '<body>\n' + fallback, "body opening")
    return page

def main() -> None:
    template = (ROOT / "index.html").read_text(encoding="utf-8")
    for filename, config in ENTRY_PAGES.items():
        output = build_entry_page(template, filename, config)
        target = ROOT / filename
        if not target.exists() or target.read_text(encoding="utf-8") != output:
            target.write_text(output, encoding="utf-8")
    print(f"Generated {len(ENTRY_PAGES)} full-app section entry pages from index.html")

if __name__ == "__main__":
    main()
