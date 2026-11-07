#!/usr/bin/env python3
"""Safely finish Worker B's Part-5 queue from already reviewed, archived and web-sourced evidence.

Writes only B's immutable batch files and tracker; one GitHub commit for each batch,
then a separate tracker commit. On a concurrent update, refetch and reconcile.
"""
import copy
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
P5 = ROOT / "research/cruising/part5"
TRACKER = P5 / "tracker_B.json"
NOTES = P5 / "B/evidence_0549_0586_2026-11-07.json"
QUEUE = P5 / "master_queue.json"
SOURCES = ["Gays-Cruising.com", "gay-szene.net", "Planet Randy", "The Gay Passport", "Splashd", "Popcorn.dating", "Squirt.org", "CruisingGays"]
SUFFIX = "2026-11-07"
CHECKPOINT = 5


def call(*args, check=True):
    p = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if p.returncode and check:
        raise RuntimeError(f"{args}: exit {p.returncode}\n{p.stderr[-1500:]}")
    return p


def fresh():
    call("git", "fetch", "origin", "main")
    call("git", "reset", "--hard", "origin/main")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def berlin_time():
    return datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds")


def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def collect_archived_records(node):
    if isinstance(node, dict):
        if "name" in node and ("proposal_id" in node or "source_url" in node or "source_category" in node or "place_type" in node):
            yield node
        for k, v in node.items():
            if isinstance(v, (list, dict)):
                yield from collect_archived_records(v)
    elif isinstance(node, list):
        for v in node:
            yield from collect_archived_records(v)


def extract_archived(candidate, known_source_files):
    out = []
    for ref in candidate["source_refs"]:
        f = ref["f"]
        if f not in known_source_files:
            p = ROOT / f
            known_source_files[f] = read_json(p) if p.is_file() else {}
        raw = known_source_files[f]
        hits = []
        for r in collect_archived_records(raw):
            same_id = r.get("proposal_id") == candidate["id"]
            same_name = norm(r.get("name")) == norm(candidate["name"])
            # A source record can mention another city/country; do not accept solely by rank.
            if same_id or same_name:
                hits.append(copy.deepcopy(r))
                if len(hits) >= 3:
                    break
        out.append({"source_id": ref["s"], "source_file": f, "source_index": ref.get("i"), "source_url": ref.get("u"), "matching_original_source_records": hits})
    return out


def build_batch(start, end):
    q = read_json(QUEUE)
    evidence = read_json(NOTES)
    notes = {x["index"]: x for x in evidence["items"]}
    candidates = {c["index"]: c for c in q["candidates"]}
    cache = {}
    records = []
    for i in range(start, end + 1):
        c = candidates[i]
        n = notes[i]
        original = extract_archived(c, cache)
        by_source = {}
        for r in c["source_refs"]:
            by_source.setdefault(str(r["s"]), []).append(r)
        checks = []
        for source_id, website in enumerate(SOURCES, 1):
            source_references = by_source.get(str(source_id), [])
            if source_references:
                checks.append({
                    "source_id": str(source_id), "website": website,
                    "status": "linked_original_archive_not_recent_visit_proof",
                    "url": [r.get("u") for r in source_references if r.get("u")],
                    "notes": "Canonical cross-source alignment links this source. A source-list inclusion is not proof of current activity; direct access to detailed visitor accounts may be blocked.",
                })
            else:
                checks.append({
                    "source_id": str(source_id), "website": website,
                    "status": "no_original_cross_source_alignment_match_not_exhaustive",
                    "url": [],
                    "notes": "Compared with archived cross-source alignment, not directly or exhaustively checked on the live site. Do not infer absence.",
                })
        dated = n.get("recent_online", [])
        older = n.get("older_evidence", [])
        official = [n["independent_evidence_url"]] if n.get("independent_evidence_url") else []
        record = {
            "index": i,
            "id": c["id"],
            "name": c["name"],
            "city": c["city"],
            "country": c["country"],
            "source_count_original": c.get("source_count"),
            "original_source_refs": c["source_refs"],
            "original_source_extracts": original,
            "eight_source_checks": checks,
            "description_rewritten": n["description_rewritten"],
            "identity_and_access": n["description_rewritten"],
            "independent_and_secondary_sources": [{"url": u, "type": "identity_or_access_corroboration_not_recent_cruising_evidence"} for u in official],
            "recent_online_reports_not_physical_activity": dated,
            "older_historical_evidence": older,
            "dated_physical_activity_reports_since_2025_11_06": [],
            "credible_recent_physical_cruising_activity_verified": False,
            "activity_cutoff": "2025-11-06",
            "possible_duplicates_or_aliases": [],
            "review_flags": n["review_flags"],
            "operational_status": n.get("operational_status", "requires_fresh_access_verification"),
            "source_website_limitations": "Only links in canonical alignment confirmed; full direct checks of each website and login-restricted visitor reports not completed. Public place confirmation must not be mistaken for current cruising.",
            "research_decision": "retain_unverified_candidate_pending_activity_access_and_safety_review",
            "research_only": True,
            "approved_for_publication": False,
            "checked_berlin": SUFFIX,
        }
        if i == 561:
            record["possible_duplicates_or_aliases"] = [{"index": 571, "name": "Thames Barrier Park", "relation": "nearby but across Thames; do not merge"}]
        if i == 577:
            record["possible_duplicates_or_aliases"] = [{"name": "Allmend Park", "source": "CruisingGays", "relation": "possible_same_broad_park"}]
        if i == 584:
            record["possible_duplicates_or_aliases"] = [{"name": "Luzern Inseli", "source": "Gays-Cruising.com", "relation": "possible_same_public_toilet"}]
        records.append(record)
    return {
        "_meta": {
            "title": f"Worker B research checkpoint {start}-{end}",
            "section": "B",
            "range_start": start,
            "range_end": end,
            "count": len(records),
            "researched_berlin": SUFFIX,
            "research_only": True,
            "original_archives": "original scrape_1 through scrape_8, attached matching original source extracts; see original queue",
            "cross_source_alignment": "research/cruising/cross_source_alignment_2026-11-06.json",
            "supplemental_evidence": "research/cruising/part5/B/evidence_0549_0586_2026-11-07.json",
            "limitations": "Geographic identity/access research is not verification of ongoing cruising; archives and cross-alignment are not exhaustive eight-website live checks. None of these records is publication-approved.",
        },
        "records": records,
    }


def commit_and_push(path, message):
    call("git", "add", "--", path)
    if call("git", "diff", "--cached", "--quiet", check=False).returncode == 0:
        return True
    call("git", "commit", "-m", message)
    pushed = call("git", "push", "origin", "HEAD:main", check=False)
    return pushed.returncode == 0


def finish():
    call("git", "config", "user.name", "github-actions[bot]")
    call("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for group in range(8):
        start = 549 + 5 * group
        end = min(start + 4, 586)
        relative = f"research/cruising/part5/B/batch_{start:04d}_{end:04d}.json"
        filename = ROOT / relative
        # Batch commit first. If already committed but tracker is behind, reuse it.
        for attempt in range(8):
            fresh()
            tracker = read_json(TRACKER)
            next_i = tracker["progress"]["next_index"]
            if next_i > end:
                print(f"B checkpoint {start}-{end}: already fully saved, skip", flush=True)
                break
            if next_i != start:
                raise RuntimeError(f"Conflicting worker update: tracker next={next_i}, expected={start}. STOP without overwriting.")
            expected = build_batch(start, end)
            if filename.exists():
                old = read_json(filename)
                if [r["id"] for r in old["records"]] != [r["id"] for r in expected["records"]]:
                    raise RuntimeError(f"Existing {relative} has differing IDs. STOP.")
                print(f"B checkpoint {start}-{end}: batch exists; reconcile tracker", flush=True)
                break
            filename.parent.mkdir(parents=True, exist_ok=True)
            filename.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if commit_and_push(relative, f"research(cruising B): save research batch {start}-{end}"):
                print(f"B checkpoint {start}-{end}: batch committed", flush=True)
                break
            print(f"B checkpoint {start}-{end}: concurrent write, refetch", flush=True)
        else:
            raise RuntimeError(f"Could not commit batch {relative}")
        # Tracker update always follows the batch.
        for attempt in range(8):
            fresh()
            tracker = read_json(TRACKER)
            progress = tracker["progress"]
            if progress["next_index"] > end:
                print(f"B checkpoint {start}-{end}: tracker already advanced", flush=True)
                break
            if progress["next_index"] != start:
                raise RuntimeError(f"Unexpected tracker cursor {progress['next_index']}; STOP.")
            if not filename.is_file():
                raise RuntimeError(f"Batch {relative} absent after branch refetch.")
            batch = read_json(filename)
            if [r["index"] for r in batch["records"]] != list(range(start, end + 1)):
                raise RuntimeError("Batch index verification failed")
            count = len(batch["records"])
            progress["complete"] += count
            progress["remaining"] -= count
            progress["last_completed_index"] = end
            progress["last_completed_id"] = batch["records"][-1]["id"]
            progress["next_index"] = end + 1
            q = read_json(QUEUE)
            progress["next_id"] = q["candidates"][end]["id"] if end < 586 else None
            progress["checkpoint_count"] += 1
            progress["batch_files"].append(relative)
            progress["last_checkpoint_berlin"] = berlin_time()
            TRACKER.write_text(json.dumps(tracker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if commit_and_push(str(TRACKER.relative_to(ROOT)), f"research(cruising B): checkpoint {progress['complete']}/293 through #{end}"):
                print(f"B checkpoint {start}-{end}: TRACKER SAVED {progress['complete']}/293, {progress['remaining']} remaining", flush=True)
                break
            print(f"B checkpoint {start}-{end}: tracker push conflict; refetch", flush=True)
        else:
            raise RuntimeError(f"Tracker update for {start}-{end} failed, but batch is recoverable.")
    fresh()
    p = read_json(TRACKER)["progress"]
    if p["complete"] != 293 or p["remaining"] != 0 or p["next_index"] != 587:
        raise RuntimeError(f"Incomplete final tracker: {p['complete']}/293, next={p['next_index']}")
    print("WORKER B COMPLETE: 293/293, final #586. All 8 checkpoint batches committed.", flush=True)


if __name__ == "__main__":
    finish()
