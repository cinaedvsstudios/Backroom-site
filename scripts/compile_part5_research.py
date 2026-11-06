#!/usr/bin/env python3
"""Combine saved Part 5 research batches; never alter source batches or live listings."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

repo = Path(__file__).resolve().parents[1]
root = repo / "research" / "cruising" / "part5"
records = []
batch_manifest = []
workers = []
seen = set()

for letter in "ABCD":
    tracker_path = root / f"tracker_{letter}.json"
    tracker = json.loads(tracker_path.read_text(encoding="utf-8"))
    progress, assigned = tracker["progress"], tracker["range"]
    worker_rows = []
    for relative_path in progress["batch_files"]:
        batch_file = repo / relative_path
        batch = json.loads(batch_file.read_text(encoding="utf-8"))
        if not isinstance(batch.get("records"), list):
            raise ValueError(f"Missing records array in {relative_path}")
        batch_manifest.append({
            "worker": letter,
            "source_batch": relative_path,
            "record_count": len(batch["records"]),
            "original_batch_meta": batch.get("_meta", {}),
        })
        for data in batch["records"]:
            index = data.get("index")
            candidate_id = data.get("id") or data.get("proposal_id")
            if not isinstance(index, int) or not candidate_id:
                raise ValueError(f"Invalid index/ID in {relative_path}: {index}")
            if index in seen:
                raise ValueError(f"Repeated queue index {index}")
            if not assigned["start"] <= index <= assigned["end"]:
                raise ValueError(f"Index {index} outside worker {letter} range")
            seen.add(index)
            worker_rows.append(index)
            records.append({
                "index": index, "id": candidate_id, "worker": letter,
                "source_batch": relative_path, "data": data,
            })
    expected = set(range(assigned["start"], progress["last_completed_index"] + 1))
    if set(worker_rows) != expected or len(worker_rows) != progress["complete"]:
        raise ValueError(f"Worker {letter} batch records disagree with tracker; missing {sorted(expected - set(worker_rows))[:10]}")
    workers.append({
        "worker": letter,
        "range": assigned,
        "completed": len(worker_rows),
        "remaining": assigned["total"] - len(worker_rows),
        "last_completed_index": progress["last_completed_index"],
        "next_index": progress["next_index"],
        "source_batch_count": len(progress["batch_files"]),
        "complete": len(worker_rows) == assigned["total"],
    })

addenda = []
for letter in "ABCD":
    for path in sorted((root / letter).glob("*.json")):
        if path.name.startswith("batch_"):
            continue
        addenda.append({
            "source_file": path.relative_to(repo).as_posix(),
            "content": json.loads(path.read_text(encoding="utf-8")),
        })

records.sort(key=lambda r: r["index"])
missing = [i for i in range(1, 1173) if i not in seen]
result = {
    "_meta": {
        "title": "Backroom Part 5 — combined saved research records",
        "snapshot_berlin": datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds"),
        "source_queue": "research/cruising/part5/master_queue.json",
        "handover": "research/cruising/part5/README_HANDOVER.md",
        "cross_source_alignment": "research/cruising/cross_source_alignment_2026-11-06.json",
        "research_only": True,
        "not_approved_for_publication": True,
        "candidate_count_total": 1172,
        "combined_record_count": len(records),
        "remaining_indices": missing,
        "workers": workers,
        "notes": "Original data objects are retained unchanged inside data; corrections and safety addenda remain appended separately. Do not mistake undated directory mentions for verified recent activity.",
        "production_files_modified": False,
    },
    "batch_manifest": batch_manifest,
    "records": records,
    "addenda": addenda,
}
destination = root / "combined_research_snapshot.json"
destination.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Combined {len(records)}/1172 records from {len(batch_manifest)} batches, {len(addenda)} addenda; {len(missing)} remain: {destination}")
