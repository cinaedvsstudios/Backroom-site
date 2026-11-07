#!/usr/bin/env python3
"""Assemble the 55 individually researched editorials into consistent Backroom venue fields.

Never edits listings.json. Preserves all 11 immutable five-record editorial batches
and source packets. Separates ready drafts, on-hold drafts, 257 excluded and 860 standby.
"""
from pathlib import Path
import json, re, unicodedata, difflib, collections
from datetime import datetime, timezone

repo=Path(__file__).resolve().parents[1]
root=repo/"research/cruising/part5"
work=root/"review55"
triage=json.loads((root/"listing_completeness_triage_2026-11-07.json").read_text(encoding="utf8"))
live=json.loads((repo/"listings.json").read_text(encoding="utf8"))
assert isinstance(live,list) and len(live)>0
packets=[]
editorials=[]
for i in range(1,12):
    packet=json.loads((work/f"source_packet_{i:02d}.json").read_text(encoding="utf8"))
    editorial=json.loads((work/f"editorial_batch_{i:02d}.json").read_text(encoding="utf8"))
    assert len(packet["records"])==len(editorial["records"])==5
    pidx=[r["triage"]["index"] for r in packet["records"]]
    eidx=[r["index"] for r in editorial["records"]]
    assert pidx==eidx,(i,pidx,eidx)
    packets.extend(packet["records"])
    editorials.extend(editorial["records"])
corrections=json.loads((work/"FACT_CORRECTIONS.json").read_text(encoding="utf8"))
corrections_by_index={c["index"]:c["fields"] for c in corrections["corrections"]}
indices=[x["index"] for x in editorials]
assert len(indices)==len(set(indices))==55
classified={r["index"]:r for r in triage["rows"]}
assert set(indices)=={r["index"] for r in triage["rows"] if r["bucket"]=="half_complete"}
assert len(classified)==1172

def normalize(s):
    s=unicodedata.normalize("NFKD",str(s or "")).casefold()
    s="".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+"," ",s).strip()
def compare_names(a,b):
    x,y=normalize(a),normalize(b)
    if not x or not y:return 0
    sim=difflib.SequenceMatcher(None,x,y).ratio()
    if x==y:return 1
    if min(len(x),len(y))>=8 and (x in y or y in x):
        sim=max(sim,0.82+0.18*min(len(x),len(y))/max(len(x),len(y)))
    return round(sim,4)
aliases={
    349:["Zeleni Venac","Zeleni Venac market toilet","Zeleni Venac WC","Zeleni Venac public toilet"],
    396:["Parco delle Cascine","Cascine Park","Cascine Firenze"],
    620:["Noord Aa","Noord Aa HOP","Noord Aa Homo Ontmoetingplaats"],
    627:["Bahnhofsklappe Sudkreuz","Südkreuz toilets","Sudkreuz Klappe","Südkreuz"],
    642:["Habermannsee","Kaulsdorfer Seen Habermannsee"],
    670:["Theodor-Heuss-Platz Klappe","Theodor Heuss Platz","Klappe Theodor Heuss Platz"],
    768:["Parkplatz Kalkumer Schlossallee","Kalkumer Schlossallee","Parkplatz Kalkum"],
    801:["Jacobi Park","Jacobipark"],
    812:["Stadtpark Blindengarten","Blindengarten","Hamburg Blindengarten"],
    920:["Fernsehturm Stuttgart","Stuttgart Fernsehturm","TV Tower Stuttgart"],
}
def city_match(a,b):
    x,y=normalize(a),normalize(b)
    return x==y or (x,y) in {("florence","firenze"),("firenze","florence"),("zoetermeer","the hague"),("the hague","zoetermeer")}
def find_existing(v,e):
    nm=v["Name"]; city=v["City"]; found=[]
    for old in live:
        if not isinstance(old,dict):continue
        if not city_match(city,old.get("City","")):continue
        if normalize(v["Country"])!=normalize(old.get("Country","")):continue
        candidates=[nm]+aliases.get(e["index"],[])
        score=max(compare_names(a,old.get("Name","")) for a in candidates)
        if score>=0.68:
            found.append({"Venue_ID":old.get("Venue_ID"),"Name":old.get("Name"),
                          "City":old.get("City"),"score":score})
    return sorted(found,key=lambda x:-x["score"])[:8]
def new_id(v,idx):
    c={"Germany":"DE","Italy":"IT","Serbia":"RS","Netherlands":"NL","Turkey":"TR","Hungary":"HU",
       "Romania":"RO","France":"FR","Spain":"ES","Greece":"GR","Latvia":"LV","Denmark":"DK",
       "United Kingdom":"GB","Poland":"PL"}.get(v["Country"],"XX")
    city=re.sub(r"[^A-Z0-9]","",normalize(v["City"]).upper())[:8]
    name=re.sub(r"[^A-Z0-9]","",normalize(v["Name"]).upper())[:12]
    return f"CRU-{c}-{city}-{name}-{idx:04d}"
def check_unverified(v):
    # Nulls remain unknown; false assertions are not fabricated.
    return [k for k in ("Latitude","Longitude","Opening_Open_Time","Opening_Close_Time","Rating_Age_Range")
            if v.get(k) in ("",None)]
now=datetime.now(timezone.utc).isoformat(timespec="seconds")
ready=[]
held=[]
reviewed=[]
route={}
op_counts=collections.Counter()
for packet,e in zip(packets,editorials):
    src=packet["research_venue"]
    orig=src["_Research"]
    idx=e["index"]
    assert orig["queue_index"]==idx
    base={k:v for k,v in src.items() if k!="_Research"}
    assert len(base)==51,(idx,len(base))
    base.update({
        "Description":e["description"],
        "Status":"Research",
        "Address":e.get("address") or base.get("Address",""),
        "Postcode":e.get("postcode") or base.get("Postcode",""),
        "Nearest_Station":e.get("nearest_station") or base.get("Nearest_Station",""),
        "Vibe_Tags":e.get("tags") or base.get("Vibe_Tags",""),
        "Opening_Notes":e.get("opening_notes") or base.get("Opening_Notes",""),
        "Last_Updated":now,
        "Source_URLs":" | ".join(dict.fromkeys(orig["all_source_urls"] + e.get("source_web_verified",[]))),
        "Feature_Cruise_Focused":True if e["decision"]=="ready" else None,
    })
    if idx in corrections_by_index:
        for field,value in corrections_by_index[idx].items():
            if field not in base:raise ValueError(f"Unknown field in correction: {field}")
            mapped_field={"address":"Address","postcode":"Postcode","nearest_station":"Nearest_Station"}.get(field,field)
            if mapped_field not in base:raise ValueError(f"Unknown mapped field {mapped_field}")
            base[mapped_field]=value
    # The old temporary ID remains linked in _Review. New IDs are proposed only.
    matches=find_existing(base,e)
    high=[m for m in matches if m["score"]>=0.82]
    if len(high)==1:
        proposed_operation="UPDATE_EXISTING"
        base["Venue_ID"]=high[0]["Venue_ID"]
    elif len(high)>1:
        proposed_operation="DUPLICATE_REVIEW"
    else:
        proposed_operation="POSSIBLE_ADD"
        base["Venue_ID"]=new_id(base,idx)
    # Never overwrite production file. These are proposals pending final source/crowd/access validation.
    op_counts[proposed_operation]+=1 if e["decision"]=="ready" else 0
    review={
        "queue_index":idx,
        "original_candidate_id":orig["original_candidate_id"],
        "source_packet":f"review55/source_packet_{(indices.index(idx)//5)+1:02d}.json",
        "editorial_batch":f"review55/editorial_batch_{(indices.index(idx)//5)+1:02d}.json",
        "decision":e["decision"],
        "decision_basis":"human-authored interpretation of preserved original research and checked public references",
        "blocking_gaps":e.get("blockers",[]),
        "caveats":e.get("caveats",[]),
        "research_source_count":orig["original_source_count"],
        "web_verified_urls":e.get("source_web_verified",[]),
        "original_urls":orig["all_source_urls"],
        "existing_match_candidates":matches,
        "proposed_operation":proposed_operation,
        "requires_additional_page_checks":True,
        "not_published_to_live_site":True,
        "unknown_fields":check_unverified(base)
    }
    record={"venue":base,"review":review}
    reviewed.append(record)
    if e["decision"]=="ready":ready.append(record)
    elif e["decision"]=="hold":held.append(record)
    else:raise ValueError(f"Invalid decision: {e['decision']}")
    route[idx]={"route":"draft_ready" if e["decision"]=="ready" else "research_hold","Venue_ID":base["Venue_ID"]}
assert len(reviewed)==55 and len(ready)+len(held)==55
ready_count=len(ready)
for idx,r in classified.items():
    if idx in route:continue
    if r["bucket"]=="quarter_complete":
        route[idx]={"route":"standby"}
    elif r["bucket"]=="forget_for_now":
        route[idx]={"route":"excluded_from_active_research","reason":"Only older dated reports; preservation in original research remains unchanged"}
    else:raise ValueError((idx,r["bucket"]))
assert len(route)==1172
rc=collections.Counter(v["route"] for v in route.values())
assert rc["standby"]==860 and rc["excluded_from_active_research"]==257 and rc["draft_ready"]==ready_count and rc["research_hold"]==55-ready_count

def dump(path,obj):
    (work/path).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
dump("ALL_55_REVIEWED.json",{"metadata":{"completed":55,"batches":11,"reviewed_date":now,"scope":"55 only"},"records":reviewed})
dump("READY_VENUE_DRAFTS.json",{"metadata":{"count":len(ready),"venue_fields":51,"status":"RESEARCH DRAFT, NOT LIVE, NOT FINAL VERIFIED","ready_means":"draft sufficient from known evidence; original eight websites were not all freshly checked"},"records":ready})
dump("HELD_VENUE_DRAFTS.json",{"metadata":{"count":len(held),"venue_fields":51,"reason":"cannot substantiate current activity/access/precise location from gathered evidence"},"records":held})
dump("ACTIVE_SCOPE_ROUTING_1172.json",{"metadata":{"total":1172,"excluded":257,"standby":860,"actively_reviewed":55,"does_not_delete_original_research":True},"by_index":route})
report={"total_reviewed":55,"batches_saved":11,"detailed_editorial_drafts_written":55,
        "drafts_with_enough_evidence_to_advance":len(ready),
        "drafts_held_missing_current_reliable_evidence":len(held),
        "discarded_from_active_scope":257,"standby":860,
        "possible_operations_for_advanced_drafts":dict(op_counts),
        "ready":[{"index":r["review"]["queue_index"],"name":r["venue"]["Name"],"city":r["venue"]["City"],
                  "operation":r["review"]["proposed_operation"],
                  "venue_id":r["venue"]["Venue_ID"],"matches":r["review"]["existing_match_candidates"][:3]} for r in ready],
        "held":[{"index":r["review"]["queue_index"],"name":r["venue"]["Name"],
                 "gaps":r["review"]["blocking_gaps"]} for r in held],
        "limitations":["No live listings.json was modified.","10 drafts are not a claim that all eight websites were freshly accessed.",
                       "Empty ratings/crowd data remain unverified, not invented.",
                       "Original research for all 1,172 remains intact.",
                       "Duplicate matches are name-and-city screening; final manual review needed."]}
dump("REPORT_55.json",report)
print("ALL_55_ASSEMBLED="+json.dumps({k:v for k,v in report.items() if k not in ("held","ready")},ensure_ascii=False))
print("READY_DETAIL="+json.dumps(report["ready"],ensure_ascii=False))
for name in ["ALL_55_REVIEWED.json","READY_VENUE_DRAFTS.json","HELD_VENUE_DRAFTS.json",
             "ACTIVE_SCOPE_ROUTING_1172.json","REPORT_55.json"]:
    path=work/name;print("OUTPUT_FILE="+name+" bytes="+str(path.stat().st_size))
