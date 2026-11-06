#!/usr/bin/env python3
"""Rebuild Backroom's category-aware venue-rating eligibility audit.

Run: python3 scripts/audit_venue_ratings.py
Ratings are editorial 1–5. Darkroom=0 means confirmed none; a blank means unknown.
An event-brand mode must be VERIFIED manually before applying fixed-venue scores.
"""
import argparse
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALL = ["Rating_General", "Rating_Darkroom", "Rating_Age_Range", "Rating_Cost",
       "Rating_Size", "Rating_Location", "Rating_Busyness"]
OUTDOOR = ["Rating_General", "Rating_Age_Range", "Rating_Location", "Rating_Busyness"]
TRAVELLING = ["Rating_Age_Range", "Rating_Cost"]
PRIDE_WORDS = re.compile(
    r"\b(pride|csd|orgullo|orgull|orgulho)\b|worldpride|equality march|"
    r"parada r[oó]wno[sś]ci|marcha do orgulho", re.I
)

def classify(row, modes):
    ident = str(row.get("Venue_ID") or "")
    name = str(row.get("Name") or "")
    cat = str(row.get("Category") or "").lower()
    if "-PRD-" in ident or PRIDE_WORDS.search(name):
        return "exempt_pride", [], "", "Pride event (not a fixed nightlife venue)"
    if "film festival" in cat or "film festival" in name.lower():
        return "exclude_film_festival", [], "", "Film festival is outside Backroom's scope"
    if "community" in cat:
        return "exempt_community", [], "", "Community organisation/social group"
    if "shop" in cat or re.search(r"(?:^|-)SHP(?:-|$)", ident):
        return "exempt_shop", [], "", "Retail listing"
    if "cruising area" in cat or cat.strip() == "beach":
        return "outdoor_four_fields", OUTDOOR, "", "Only four outdoor-area rating fields apply"
    if any(label in cat for label in ("party", "festival", "event brand")):
        mode = modes.get(ident, "")
        if mode == "fixed":
            return "fixed_event", ALL, mode, "Same venue for most editions, manually verified"
        if mode in ("travelling", "rotating", "multi_venue"):
            return "variable_event", TRAVELLING, mode, "No stable venue; only age and ticket cost applicable"
        return "review_venue_mode", [], mode, "Verify fixed vs travelling before facility ratings"
    return "standard_venue", ALL, "", "Permanent venue: seven standard ratings"

def missing_fields(row, required):
    missing = []
    for field in required:
        raw = row.get(field, "")
        try:
            number = float(raw)
        except (TypeError, ValueError):
            number = None
        if number is None or (number == 0 and field != "Rating_Darkroom") or number < 0 or number > 5:
            missing.append(field)
    return missing

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listings", type=Path, default=ROOT / "listings.json")
    parser.add_argument("--venue-review", type=Path,
                        default=ROOT / "audits/2026-11-06_party_venue_location_review.csv")
    parser.add_argument("--output", type=Path,
                        default=ROOT / "audits/current_venue_rating_eligibility.csv")
    args = parser.parse_args()
    venues = json.loads(args.listings.read_text(encoding="utf-8"))
    modes = {}
    if args.venue_review.is_file():
        with args.venue_review.open(encoding="utf-8-sig", newline="") as source:
            for record in csv.DictReader(source):
                ident = (record.get("Venue_ID") or "").strip()
                mode = (record.get("Confirmed_Mode") or "").strip().lower()
                if mode in ("fixed", "travelling", "rotating", "multi_venue"):
                    modes[ident] = mode
    headings = ["Venue_ID", "Name", "City", "Country", "Category", "Status",
                "Audit_Class", "Confirmed_Mode", "Applicable_Ratings",
                "Missing_Applicable_Ratings", "Missing_Count", "Explanation"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    totals = {}
    with args.output.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=headings)
        writer.writeheader()
        for row in venues:
            if str(row.get("Status") or "") != "Live":
                continue
            category, required, mode, reason = classify(row, modes)
            missing = missing_fields(row, required)
            totals[category] = totals.get(category, 0) + 1
            writer.writerow({
                "Venue_ID": row.get("Venue_ID", ""), "Name": row.get("Name", ""),
                "City": row.get("City", ""), "Country": row.get("Country", ""),
                "Category": row.get("Category", ""), "Status": row.get("Status", ""),
                "Audit_Class": category, "Confirmed_Mode": mode,
                "Applicable_Ratings": "; ".join(required),
                "Missing_Applicable_Ratings": "; ".join(missing),
                "Missing_Count": len(missing), "Explanation": reason
            })
    print(f"Wrote {args.output}. Rating eligibility classes: {totals}")

if __name__ == "__main__":
    main()
