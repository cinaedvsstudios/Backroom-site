#!/usr/bin/env python3
"""Read-only descriptive audit of Backroom Part 5 research snapshot.
Creates a compact metrics file; never changes research candidates or publication data.
"""
import json
import collections
import re
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parents[1]
base = root / "research/cruising/part5"
source = json.loads((base / "combined_research_snapshot.json").read_text(encoding="utf8"))
rows = source["records"]
queue = json.loads((base / "master_queue.json").read_text(encoding="utf8"))["candidates"]
byidx = {c["index"]:c for c in queue}
assert len(rows) == 1172 and {r["index"] for r in rows} == set(range(1,1173))
c=collections.Counter
byworker=collections.defaultdict(list)
for row in rows:byworker[row["worker"]].append(row)

def preview(obj,maxlen=180):
    s=str(obj).replace("\n"," ")
    return s[:maxlen]

def recfield(obj, prefix=""):
    if isinstance(obj,dict):
        for k,v in obj.items():
            key=f"{prefix}.{k}" if prefix else k
            yield key,v
            yield from recfield(v,key)
    elif isinstance(obj,list):
        for i,v in enumerate(obj):
            yield from recfield(v,prefix+"[]")

key_counts={w:dict(c(k for r in rr for k in r["data"]).most_common(70)) for w,rr in byworker.items()}
boolcounts=collections.defaultdict(lambda:{"true":0,"false":0,"nonbool":0,"true_samples":[]})
for row in rows:
    for key,v in recfield(row["data"]):
        lastkey=key.split(".")[-1]
        if ("recent" in lastkey or "activity" in lastkey or "current" in lastkey or "verified" in lastkey or "approval" in lastkey or "approved" in lastkey or "confirm" in lastkey) and isinstance(v,(bool,str,int,float)):
            if isinstance(v,bool):
                item=boolcounts[key]
                item["true" if v else "false"]+=1
                if v and len(item["true_samples"])<12:
                    item["true_samples"].append({"index":row["index"],"name":row["data"].get("name"),"city":row["data"].get("city")})
            else:
                if lastkey.endswith("_status") or lastkey=="activity_assessment":
                    boolcounts[key]["nonbool"]+=1
bool_counts_out={key:v for key,v in boolcounts.items() if v["true"] or v["false"]}
bool_counts_out=dict(sorted(bool_counts_out.items(),key=lambda kv:(-kv[1]["true"],-kv[1]["false"])))

status_by_worker={}
status_overall=c()
source_status_count_by_worker={}
for worker,rr in byworker.items():
    cc=c()
    shape=c()
    bysource=c()
    for row in rr:
        d=row["data"]
        entries=d.get("site_evidence", d.get("eight_source_checks",d.get("source_checks",[])))
        shape[len(entries)]+=1
        for check in entries:
            state=check.get("status") or check.get("state") or "unknown"
            cc[state]+=1
            status_overall[state]+=1
            site=check.get("site") or check.get("name") or check.get("website") or check.get("source") or check.get("source_id") or "unknown"
            bysource[str(site)+"|"+str(state)]+=1
    status_by_worker[worker]=dict(cc.most_common())
    source_status_count_by_worker[worker]={"entries_per_candidate":dict(shape),"top_status_per_site":dict(bysource.most_common(30))}

duplicate_fields=["possible_duplicates","duplicates_or_aliases","possible_aliases","possible_duplicates_or_aliases","duplicate_candidates","same_area_or_aliases"]
review_fields=["review_flags","original_access_review_flags","access_review_flags","flags"]
duplicates=[]
flags=c()
for row in rows:
    d=row["data"]
    for f in duplicate_fields:
        a=d.get(f)
        if a and isinstance(a,list):
            duplicates.append({"index":row["index"],"name":d.get("name"),"worker":row["worker"],"field":f,"samples":a[:2]})
    for f in review_fields:
        v=d.get(f,[])
        if isinstance(v,list):
            flags.update(map(str,v))
        elif v:flags.update([str(v)])

dated_field_counts=c()
dated_samples={}
for row in rows:
    d=row["data"]
    for f in ("dated_reports","dated_evidence","dated_firsthand_reports","recent_online_reports_not_physical_activity","older_historical_evidence"):
        if isinstance(d.get(f),list) and len(d[f])>0:
            dated_field_counts[f]+=1
            dated_samples.setdefault(f,[])
            if len(dated_samples[f])<6:dated_samples[f].append({"index":row["index"],"name":d.get("name"),"examples":d[f][:1]})
    for f in ("recent_activity_since_2025_11_06","activity_evidence"):
        v=d.get(f)
        if isinstance(v,dict):
            for k,el in v.items():
                if isinstance(el,list) and el:
                    dated_field_counts[f+"."+k]+=1
                    dated_samples.setdefault(f+"."+k,[])
                    if len(dated_samples[f+"."+k])<6:dated_samples[f+"."+k].append({"index":row["index"],"name":d.get("name"),"examples":el[:1]})

# Sample records with explicit confident *physical* 2025–26 evidence, not online invitations.
recent_positive_field_names={
    "credible_recent_activity",
    "credible_physical_activity_since_2025_11_06",
    "credible_recent_physical_cruising_activity_verified",
    "latest_physical_activity_2025_11_06_or_later_verified",
    "independently_verified_current_activity",
    "confirmed",
}
recent_positive=[]
for row in rows:
    d=row["data"]
    positive=[]
    for k,v in recfield(d):
        if k.split(".")[-1] in recent_positive_field_names and v is True:
            positive.append(k)
    if positive:recent_positive.append({"index":row["index"],"name":d.get("name"),"city":d.get("city"),"worker":row["worker"],"true_fields":positive})

# Source reference frequency counts each candidate once per represented website.
source_counter=c()
source_count_counter=c()
for cand in queue:
    s={str(r["s"]) for r in cand.get("source_refs",[])}
    source_count_counter[len(s)]+=1
    source_counter.update(s)
country=c(r["data"].get("country") for r in rows)
city=c((r["data"].get("city"),r["data"].get("country")) for r in rows)
candidates_with_blank_name=[r["index"] for r in rows if not r["data"].get("name")]
link_counts=c()
for row in rows:
    urls=set()
    for k,v in recfield(row["data"]):
        if isinstance(v,str) and v.startswith("http"):urls.add(v)
    link_counts[len(urls)]+=1

out={
    "as_of_berlin":datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds"),
    "data_source":"research/cruising/part5/combined_research_snapshot.json",
    "records":len(rows),"missing_index_count":len([i for i in range(1,1173) if i not in {r["index"] for r in rows}]),
    "workers":{w:{"count":len(v),"range":[min(x["index"] for x in v),max(x["index"] for x in v)]} for w,v in byworker.items()},
    "countries":len(country),"cities":len(city),
    "top_countries":country.most_common(45),
    "top_cities":[{"city":k[0],"country":k[1],"count":v} for k,v in city.most_common(35)],
    "candidate_source_count_histogram":dict(source_count_counter),
    "candidate_source_frequency":dict(source_counter),
    "top_level_fields_by_worker":key_counts,
    "source_statuses_by_worker":status_by_worker,
    "source_statuses_total":dict(status_overall.most_common()),
    "source_status_details_by_worker":source_status_count_by_worker,
    "recency_related_boolean_fields":bool_counts_out,
    "recent_activity_explicit_positive_records":recent_positive[:60],
    "recent_activity_explicit_positive_count":len(recent_positive),
    "records_with_dated_evidence_fields":dict(dated_field_counts),
    "dated_evidence_samples":dated_samples,
    "duplicate_or_alias_flags_count":len(set(o["index"] for o in duplicates)),
    "duplicate_or_alias_samples":duplicates[:35],
    "top_review_flags":flags.most_common(40),
    "distinct_url_count_per_record_distribution":dict(link_counts),
    "blank_names":candidates_with_blank_name,
    "addenda":len(source.get("addenda",[])),
    "cautions":["Candidates are not equivalent to active venues or independently confirmed cruising","Source coverage fields are heterogeneously named across workers; statuses must be interpreted literally","Multiple directory references are not necessarily independent current activity","Positive booleans are reported as the source research asserted, not independent verification by this report","Avoid adding unverified public toilets, schools, nature reserves or transport sites to the live directory"],
}

def find_listing_rows(node, prefix="", maxdepth=3):
    if maxdepth < 0:
        return []
    if isinstance(node,list):
        if node and isinstance(node[0],dict) and any(k in node[0] for k in ("Name","name","Venue_ID","venue_id","VenueName")):
            return [(prefix,node)]
        return []
    if isinstance(node,dict):
        all_rows=[]
        for k,v in node.items():
            if isinstance(v,(dict,list)):
                all_rows+=find_listing_rows(v,prefix+"."+k,maxdepth-1)
        return all_rows
    return []

def rname(x):
    return norm(x.get("Name") or x.get("name") or x.get("VenueName") or x.get("venue_name"))

def rcity(x):
    return norm(x.get("City") or x.get("city") or x.get("Location_City") or x.get("location_city"))

live_docs={}
for file in ["listings.json","cruising_research.json"]:
    raw=read=json.loads((root/file).read_text(encoding="utf8"))
    groups=find_listing_rows(raw)
    live_docs[file]={
        "root_type":type(raw).__name__,
        "root_keys":list(raw.keys())[:25] if isinstance(raw,dict) else None,
        "candidate_list_groups":[{"path":k,"count":len(v),"sample_keys":list(v[0])[:25]} for k,v in groups[:10]]
    }
    if file=="listings.json":
        listings=max(groups,key=lambda x:len(x[1]))[1] if groups else []
        indexed=collections.defaultdict(list)
        for v in listings:indexed[(rname(v),rcity(v))].append(v)
        exact=[]
        for item in rows:
            key=(norm(item["data"].get("name")),norm(item["data"].get("city")))
            if key in indexed:
                exact.append({"index":item["index"],"name":item["data"].get("name"),"city":item["data"].get("city"),"matches":[{"name":a.get("Name") or a.get("name"),"id":a.get("Venue_ID") or a.get("venue_id"),"category":a.get("Category") or a.get("category")} for a in indexed[key][:2]]})
        live_docs[file]["exact_name_city_matched_candidates"]=len(exact)
        live_docs[file]["exact_match_samples"]=exact[:35]
        live_docs[file]["entries_count"]=len(listings)
out["current_site_file_comparison"]=live_docs

p=base / "research_audit_metrics_2026-11-07.json"
p.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
print(json.dumps({"records":len(rows),"countries":len(country),"cities":len(city),"source_counts":dict(source_count_counter),"source_statuses":dict(status_overall.most_common(15)),"recent_positive":recent_positive[:10],"recent_positive_count":len(recent_positive),"duplicate_candidates":out["duplicate_or_alias_flags_count"],"top_flags":flags.most_common(12),"dated_fields":dict(dated_field_counts)},ensure_ascii=False))
print(f"WROTE {p.relative_to(root)}",flush=True)
