#!/usr/bin/env python3
"""Make eleven 5-record SOURCE packets for manual verification and editing.
No publication/approval is implied and original evidence is retained unmodified.
"""
import json, pathlib
root=pathlib.Path(__file__).resolve().parents[1]/"research/cruising/part5"
classification=json.loads((root/"listing_completeness_triage_2026-11-07.json").read_text(encoding="utf-8"))
selected=[r for r in classification["rows"] if r["bucket"]=="half_complete"]
selected_id={r["index"]:r for r in selected}
full=json.loads((root/"venues_normalized_1172_RESEARCH_ONLY.json").read_text(encoding="utf-8"))
records={r["_Research"]["queue_index"]:r for r in full["venues"]}
assert len(selected)==55
out=root/"review55"
out.mkdir(exist_ok=True)
for b in range(11):
    chosen=selected[b*5:(b+1)*5]
    packet={
       "_meta":{"batch_number":b+1,"of":11,"type":"SOURCE_PACKET_TO_RESEARCH_NOT_A_COMPLETE_LISTING",
                "note":"Original research, original source URLs, original queue index and all standard venue fields are retained. Read the URLs and validate first."},
       "records":[{"triage":selected_id[c["index"]],"research_venue":records[c["index"]]} for c in chosen]
    }
    fname=out/f"source_packet_{b+1:02d}.json"
    fname.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"PACKET_{b+1:02d} "+ " / ".join(f"{c['index']} {c['name']}" for c in chosen))
print("PACKETS_CREATED="+str(len(selected)))
