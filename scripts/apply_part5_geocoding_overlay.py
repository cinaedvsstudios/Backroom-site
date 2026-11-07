#!/usr/bin/env python3
"""Overlay map-checked locations onto research-only Part 5 normalized venues.

Reads the 55 geocoding overrides, preserves all other fields and the original
research. GPS points may describe a mapped park/complex rather than the exact
historically reported cruising location; see _Research.geocoding.precision.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "research" / "cruising" / "part5"
source = root / "review55" / "geocoding_55_2026-11-07.json"
target = root / "venues_normalized_1172_RESEARCH_ONLY.json"
overlay = json.loads(source.read_text(encoding="utf-8"))
records = overlay["rows"]
assert len(records) == 55
by_index = {int(row["queue_index"]): row for row in records}
assert len(by_index) == 55
assert sum(bool(r["Latitude"]) and bool(r["Longitude"]) for r in records) == 54
normalized = json.loads(target.read_text(encoding="utf-8"))
modified = 0
for venue in normalized["venues"]:
    idx = venue["_Research"]["queue_index"]
    if idx not in by_index:
        continue
    found = by_index[idx]
    if venue["Venue_ID"] != found["venue_id"]:
        raise ValueError(f"Venue ID mismatch at {idx}")
    for col in ("Address", "Latitude", "Longitude", "Google_Maps_URL"):
        value = found[col]
        venue[col] = "" if value is None else value
    venue["_Research"]["geocoding"] = {
        "as_of": "2026-11-07",
        "precision": found["precision"],
        "reference_url": found["source"],
        "note": (
            "Mapped geographic anchor, not an independently verified precise cruising point."
            if found["Latitude"] else
            "Aggregate of multiple sites; split before assigning individual GPS."
        )
    }
    modified += 1
assert modified == 55, f"Unexpected number modified: {modified}"
target.write_text(
    json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
print(f"GEOCODING_OVERLAY_APPLIED={modified}; GPS={sum(bool(r['Latitude']) for r in records)}")
