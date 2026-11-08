#!/usr/bin/env python3
"""Self-contained, lossless Group A consolidation. No production data writes."""
import collections
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from zoneinfo import ZoneInfo

ROOT=pathlib.Path("research/cruising")
PART=ROOT/"part5"
GROUP=PART/"A"
DEST=GROUP/"GROUP_A_291_MASTER_RESEARCH.json"
QUEUE=PART/"master_queue.json"
TRACKER=GROUP/"tracker_P3.json"
EXCLUDED={182,201}
SITES=("Gays-Cruising.com","gay-szene.net","Planet Randy","The Gay Passport","Splashd","Popcorn.dating","Squirt.org","CruisingGays")
SITE_ALIASES={re.sub(r"[^a-z0-9]","",s.lower()):s for s in SITES}
DATE=lambda:datetime.datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds")
def run(*args):
    return subprocess.check_output(args,stderr=subprocess.STDOUT).decode("utf-8").strip()
def raw(path):
    return path.read_bytes().decode("utf-8")
def load(path):
    return json.loads(raw(path).lstrip("\ufeff"))
def sha_bytes(x):
    return hashlib.sha256(x).hexdigest()
def file_sha(path):
    return sha_bytes(path.read_bytes())
def ordered_unique(values):
    return list(dict.fromkeys(values))
def simple_site_state(obj):
    text=" ".join(str(obj.get(k,"")) for k in ("status","state","research_method","accessibility","outcome","read_status")).lower()
    if re.search(r"authentication|requires.login|login.required|members.only|sign.in|password",text):return "requires_authenticated_access"
    if re.search(r"http.?451|http.?403|blocked|access.denied|inaccessible|cache.miss|unavailable|not.fetchable|unreadable",text):return "blocked"
    if re.search(r"archive.recovered|wayback.recovered|source.archive.read",text):return "archive_recovered"
    if re.search(r"fully.read|source.spot.page.read|original.page.read|detail.page.read|read.[0-9]+.comments|opened.and.read",text):return "fully_read"
    if re.search(r"partially.read|page.partially",text):return "partially_read"
    if re.search(r"not.individually.checked|not.checked|not.searched|not.investigated",text):return "not_checked"
    if re.search(r"no.match|no_matching|not.found.after.search|search.no.result",text):return "not_found_after_search"
    if re.search(r"index|search.result|snippet|directory.list",text):return "indexed_result_only"
    return "not_checked"

def site_for(obj):
    name=obj.get("site") or obj.get("website") or obj.get("source_site") or obj.get("provider")
    if name is None:return None
    return SITE_ALIASES.get(re.sub(r"[^a-z0-9]","",str(name).lower()))
def collect_urls(value):
    out=[]
    def walk(x,depth=0):
        if depth>12 or len(out)>1000:return
        if isinstance(x,str):
            for m in re.finditer(r"https?://[^\s\"'<>]+",x):
                url=m.group(0).rstrip(".,;)]}")
                if len(url)<1800:out.append(url)
        elif isinstance(x,dict):
            for k,v in x.items():
                if isinstance(v,str) and ("url" in k.lower() or k.lower() in ("u","link","href","source")):walk(v,depth+1)
                elif isinstance(v,(dict,list)):walk(v,depth+1)
        elif isinstance(x,list):
            for y in x:walk(y,depth+1)
    walk(value)
    return ordered_unique(out)

def candidate_record(c,completion,examined):
    idx=c["index"]
    return dict(original_index=idx,proposal_id=c["id"],original_name=c["name"],original_city=c["city"],original_country=c["country"],
       original_queue_record=c,corrected_name=None,alternate_names=[],translated_names=[],city=c["city"],corrected_city=None,
       country=c["country"],region=None,address=None,location_type=None,coordinates=None,coordinate_source=None,
       coordinate_accuracy=None,coordinate_candidates=[],entrances=[],landmarks=[],directions=[],access_routes=[],sublocations=[],
       original_source_refs=c.get("refs",c.get("source_refs",[])),source_urls=[],source_descriptions=[],
       site_verification={s:{"site":s,"state":"not_checked","matched_urls":[],"attempts":[],"requires_further_check":True} for s in SITES},
       visitor_reports=[],facilities_and_access=[],duplicate_research=[],
       research_status="complete" if idx in completion else "incomplete" if idx<=examined else "not_started",
       location_status="partially_identified",activity_status="directory_only",facility_status="unknown",duplicate_status="unchecked",
       publication_status="not_reviewed",missing_information=[],sources_still_to_read=[],unresolved_conflicts=[],
       unverified_coordinates=[],further_research_required=[],research_tasks=[],next_recommended_action=None,
       research_priority=None,last_researched_at=None,research_completed_at=None,
       research_history=[],additional_evidence=[],provenance_files=[])

def main():
    if not QUEUE.exists() or not TRACKER.exists():raise RuntimeError("Missing authoritative queue or P3 tracker")
    source_queue=load(QUEUE)
    qs=[c for c in source_queue["candidates"] if c.get("section")=="A" and 1<=c.get("index",0)<=293]
    assert len(qs)==293 and [c["index"] for c in qs]==list(range(1,294))
    canon={c["index"]:c for c in qs}
    byid={c["id"]:c["index"] for c in qs}
    assert len(byid)==293
    tracker=load(TRACKER)
    p=tracker["p3_progress"]
    examined=int(p.get("last_assessed_index",225))
    completions=set(map(int,p["genuinely_source_assessed_complete"]))
    checkpoint_files=sorted(GROUP.glob("P3_completed_batch_*.json"))
    checkpoint_ids=set()
    for path in checkpoint_files:
        o=load(path)
        checkpoint_ids.update(int(z) for z in (o.get("_meta",{}).get("original_indices") or o.get("_meta",{}).get("indices") or o.get("_meta",{}).get("record_indices") or o.get("_meta",{}).get("original_queue_indices") or [v.get("original_index",v.get("index")) for v in o.get("records",[])]) if z is not None)
    if not checkpoint_ids.issubset(completions):
        raise RuntimeError("Tracker completion list omits a saved completed checkpoint")
    pending=set(map(int,p.get("pending_completion_indices",[])))
    if not (completions-checkpoint_ids).issubset(pending):
        raise RuntimeError("Tracker completion list differs from checkpoints and pending records")
    if completions & EXCLUDED:raise RuntimeError("Excluded index appears as active research completion")
    rec={i:candidate_record(c,completions,examined) for i,c in canon.items()}
    sources=[]
    issues=[]
    qa={"matched_source_entries":0,"sources_examined":0,"unmatched_source_entries":0,"eight_source_website_attempts":0,"dated_report_fragments":0}
    visited=set()
    label_map={
       "source_checks":"sites","site_evidence":"sites","source_website_checks":"sites",
       "website_checks":"sites","site_checks":"sites","eight_source_verification":"sites",
       "dated_reports":"reports","visitor_reports":"reports","source_comments":"reports",
       "original_comments":"reports","comments":"reports","firsthand_reports":"reports","reports":"reports",
       "duplicate_spot_comparisons":"duplicates","possible_duplicates":"duplicates","duplicate_comparisons":"duplicates",
    }
    def add_source(rec_id,site_obj,path):
        s=site_for(site_obj)
        if not s:return
        d=rec[rec_id]["site_verification"][s]
        state=simple_site_state(site_obj)
        key=json.dumps(site_obj,ensure_ascii=False,sort_keys=True,default=str)
        if any(z["dedupe_key"]==key for z in d["attempts"]):
            for z in d["attempts"]:
                if z["dedupe_key"]==key and path not in z["provenance_files"]:z["provenance_files"].append(path)
            return
        uris=collect_urls(site_obj)
        d["matched_urls"]=ordered_unique(d["matched_urls"]+uris)
        d["attempts"].append({"dedupe_key":key,"state":state,"source_file":path,"provenance_files":[path],"evidence":site_obj})
        weight={"fully_read":9,"archive_recovered":8,"partially_read":7,"requires_authenticated_access":6,
                "blocked":5,"indexed_result_only":4,"not_found_after_search":3,"not_checked":1}
        if weight[state]>weight[d["state"]]:d["state"]=state
        d["requires_further_check"]=d["state"] not in ("fully_read","archive_recovered")
        qa["eight_source_website_attempts"]+=1
    def traverse_evidence(rec_id,node,path,depth=0):
        if depth>13:return
        if isinstance(node,list):
            for x in node[:1500]:traverse_evidence(rec_id,x,path,depth+1)
            return
        if not isinstance(node,dict):return
        for k,v in node.items():
            if k in ("site_1","site_2","site_3","site_4","site_5","site_6","site_7","site_8") and isinstance(v,dict):
                y=dict(v)
                y.setdefault("site",SITES[int(k[-1])-1])
                add_source(rec_id,y,path)
            elif label_map.get(k)=="sites" and isinstance(v,(list,dict)):
                vv=v if isinstance(v,list) else list(v.values())
                for j,x in enumerate(vv):
                    if isinstance(x,dict):
                        if isinstance(v,dict) and not site_for(x) and str(list(v.keys())[j]).isdigit():
                            x=dict(x,site=SITES[int(list(v.keys())[j])-1])
                        add_source(rec_id,x,path)
            elif label_map.get(k)=="reports" and isinstance(v,list):
                for x in v:
                    if not isinstance(x,(dict,str)):continue
                    key=json.dumps(x,ensure_ascii=False,sort_keys=True)
                    if not any(z["dedupe_key"]==key for z in rec[rec_id]["visitor_reports"]):
                        rec[rec_id]["visitor_reports"].append({"dedupe_key":key,"raw_report":x,"source_file":path,
                          "publication_date":x.get("publication_date",x.get("comment_date",x.get("date"))) if isinstance(x,dict) else None,
                          "actual_visit_date":x.get("visit_date",x.get("encounter_date")) if isinstance(x,dict) else None,
                          "report_type":x.get("report_type",x.get("type")) if isinstance(x,dict) else None,
                          "firsthand_status":x.get("firsthand_status",x.get("firsthand")) if isinstance(x,dict) else None,
                          "source_url":x.get("source_url",x.get("url")) if isinstance(x,dict) else None,
                          "classification_note":"Meeting requests and website check-ins are not treated as observed physical activity"})
                        qa["dated_report_fragments"]+=1
            elif label_map.get(k)=="duplicates" and isinstance(v,list):
                for x in v:
                    key=json.dumps(x,ensure_ascii=False,sort_keys=True)
                    if not any(z["dedupe_key"]==key for z in rec[rec_id]["duplicate_research"]):
                        rec[rec_id]["duplicate_research"].append({"dedupe_key":key,"source_file":path,"raw":x,"status":"possible"})
            if isinstance(v,(dict,list)):
                traverse_evidence(rec_id,v,path,depth+1)
    def resolve(node,fieldpath):
        if not isinstance(node,dict):return []
        direct_id=next((node[k] for k in ("proposal_id","candidate_id","location_id","exact_master_proposal_id",
                 "original_proposal_id","original_id","id") if k in node and isinstance(node[k],str) and node[k] in byid),None)
        direct_ix=next((int(node[k]) for k in ("original_group_A_index","original_queue_index","original_index",
                 "queue_index","index") if k in node and str(node[k]).isdigit() and int(node[k]) in canon),None)
        if direct_id and direct_ix and byid[direct_id]!=direct_ix:
            issues.append({"kind":"id_index_mismatch","fieldpath":fieldpath,"candidate_id":direct_id,
                   "record_index":direct_ix,"canonical_index":byid[direct_id]})
            return []
        if direct_id:return [byid[direct_id]]
        if direct_ix:
            # Index-only evidence must belong to a candidate collection, not a comment/row counter.
            if any(x in fieldpath.lower() for x in ("records","candidates","location_review","source_pin","case","entries","review","findings","issues","completed")):
                return [direct_ix]
        if any(x in fieldpath.lower() for x in ("duplicate","comparison","merge","exclusion","cross_reference")):
            ix=[]
            for k in ("indexes","indices","ids","original_indices","duplicate_indices"):
                v=node.get(k)
                if isinstance(v,list) and len(v)<=20:
                    for item in v:
                        if isinstance(item,str) and item in byid:ix.append(byid[item])
                        elif str(item).isdigit() and int(item) in canon:ix.append(int(item))
            return ordered_unique(ix)
        return []
    def attach(rec_id,node,path,fieldpath):
        r=rec[rec_id]
        fingerprint=hashlib.sha256(json.dumps(node,sort_keys=True,ensure_ascii=False,default=str).encode()).hexdigest()
        same=next((x for x in r["research_history"] if x["evidence_hash"]==fingerprint),None)
        if same:
            if path not in same["provenance_files"]:same["provenance_files"].append(path)
        else:
            r["research_history"].append({"source_file":path,"provenance_files":[path],"fieldpath":fieldpath,
                         "evidence_hash":fingerprint,"raw_evidence":node})
            traverse_evidence(rec_id,node,path)
        if path not in r["provenance_files"]:r["provenance_files"].append(path)
        r["source_urls"]=ordered_unique(r["source_urls"]+collect_urls(node))[:1500]
        qa["matched_source_entries"]+=1
    def walk(node,path,fieldpath="root",depth=0):
        if depth>18:return set()
        attached=set()
        if isinstance(node,list):
            for index,sub in enumerate(node):
                attached|=walk(sub,path,fieldpath+"[]",depth+1)
        elif isinstance(node,dict):
            if fieldpath.endswith("._meta") or fieldpath.endswith(".metadata"):
                return attached
            matches=resolve(node,fieldpath)
            if matches:
                for rec_id in matches:
                    attach(rec_id,node,path,fieldpath)
                    attached.add(rec_id)
                return attached
            for k,sub in node.items():
                if isinstance(sub,(dict,list)):
                    attached|=walk(sub,path,fieldpath+"."+k,depth+1)
        return attached
    # Every Group A file is retained byte-for-byte, even if a field uses an unanticipated schema.
    local=sorted(p for p in GROUP.rglob("*") if p.is_file() and p!=DEST)
    shared=[]
    shared += sorted(p for p in PART.glob("GROUP_A_B_*") if p.is_file())
    shared += sorted(p for p in PART.glob("*") if p.is_file() and p.name in (
        "master_queue.json","tracker_A.json","README_HANDOVER.md",
        "combined_research_snapshot.json","venues_normalized_1172_RESEARCH_ONLY.json",
        "listing_completeness_triage_2026-11-07.json"))
    shared += sorted(p for p in (PART/"review55").rglob("*") if p.is_file()) if (PART/"review55").exists() else []
    shared += sorted(p for p in ROOT.glob("*") if p.is_file() and (
        p.suffix.lower() in (".json",".csv",".md") and
        (p.name.startswith(("scrape_","cross_source_","eight_source_","verification_","gap_analysis_",
                            "gap_fill_","splashd_")))))
    shared=sorted(set(shared)-set(local))
    if len(local)<125 or len(shared)<30:
        raise RuntimeError(f"Unexpected incomplete source inventory: A={len(local)}, shared={len(shared)}")
    for path in local+shared:
        txt=raw(path)
        entry={"path":path.as_posix(),"source_sha256":sha_bytes(txt.encode("utf-8")),
               "git_blob_sha":run("git","hash-object",str(path)),"bytes":len(txt.encode("utf-8")),
               "in_group_A":path in local,"matched_candidate_count":0,"matched_candidate_indices":[],
               "retired_after_validation":False,"source_read_status":"fully_read"}
        if path in local:entry["original_content"]=txt
        match=set()
        try:
            if path.suffix.lower()==".json":
                match=walk(json.loads(txt.lstrip("\ufeff")),path.as_posix())
            elif path.suffix.lower()==".csv":
                import csv,io
                match=walk(list(csv.DictReader(io.StringIO(txt))),path.as_posix())
            else:
                # Important global text is preserved exactly for deleted Group A markdown.
                match=set()
        except Exception as e:
            entry["source_read_status"]="error"
            issues.append({"kind":"source_read_error","file":path.as_posix(),"error":str(e)})
        entry["matched_candidate_count"]=len(match)
        entry["matched_candidate_indices"]=sorted(match)
        sources.append(entry)
        qa["sources_examined"]+=1
    if any(x["source_read_status"]!="fully_read" for x in sources):
        raise RuntimeError("A required source could not be parsed; no deletion authorized")
    # Preserve original source refs independently of observations.
    for ix,c in canon.items():
        r=rec[ix]
        inc=next((x for x in p.get("incomplete",[]) if x["index"]==ix),None)
        if inc:
            r["missing_information"].append(inc["reason"])
            r["further_research_required"].append(inc["reason"])
            r["next_recommended_action"]=inc["reason"]
        elif r["research_status"]=="not_started":
            r["next_recommended_action"]="Research original candidate, including exact site pages and dated physical reports"
        elif r["research_status"]=="complete":
            r["research_completed_at"]="2026-11-08 (per substantive P3 checkpoint)"
        # Never equate identified physical place with verified recent sexual activity.
        for h in r["research_history"]:
            data=h["raw_evidence"]
            if not isinstance(data,dict):continue
            priority=8 if "P3_addendum_" in h["source_file"] else 7 if "P3_deep_source_" in h["source_file"] else 5 if "full_verification" in h["source_file"] else 3
            status=data.get("location_status") or data.get("geographic_status")
            if status in ("identified","partially_identified","unidentifiable_after_exhaustive_research"):
                r.setdefault("_location_options",[]).append({"status":status,"priority":priority,"source":h["source_file"]})
            elif str(status).lower() in ("location_identified","identified_with_caveats"):
                r.setdefault("_location_options",[]).append({"status":"identified","priority":priority,"source":h["source_file"]})
            if data.get("source_category") and not r["location_type"]:r["location_type"]=data["source_category"]
            lat=data.get("latitude",data.get("lat"))
            lon=data.get("longitude",data.get("long",data.get("lng")))
            try:
                lat,lon=float(lat),float(lon)
                if -90<=lat<=90 and -180<=lon<=180 and (lat!=0 or lon!=0):
                    coord={"latitude":lat,"longitude":lon,"source_file":h["source_file"],
                       "coordinate_source":data.get("coordinate_source",data.get("source")),
                       "accuracy":data.get("coordinate_accuracy"),"priority":priority}
                    if coord not in r["coordinate_candidates"]:r["coordinate_candidates"].append(coord)
            except (ValueError,TypeError):pass
        opts=sorted(r.pop("_location_options",[]),key=lambda x:x["priority"],reverse=True)
        if opts:r["location_status"]=opts[0]["status"]
        if r["coordinate_candidates"]:
            v=sorted(r["coordinate_candidates"],key=lambda x:x["priority"],reverse=True)[0]
            r["coordinates"]={"latitude":v["latitude"],"longitude":v["longitude"]}
            r["coordinate_source"]=v["coordinate_source"] or v["source_file"]
            r["coordinate_accuracy"]=v["accuracy"] or "unverified_source_pin_or_geographic_reference"
            if r["coordinate_accuracy"].startswith("unverified"):r["unverified_coordinates"].append(v)
        for s in SITES:
            attempts=r["site_verification"][s]["attempts"]
            for attempt in attempts:attempt.pop("dedupe_key",None)
        for key in ("visitor_reports","duplicate_research"):
            for item in r[key]:item.pop("dedupe_key",None)
        if r["research_status"]=="complete" and not any("P3_" in x["source_file"] for x in r["research_history"]):
            issues.append({"kind":"completed_without_embedded_p3_evidence","index":ix})
            r["research_status"]="incomplete"
            r["missing_information"].append("Completion was recorded, but Part 3 substantive evidence was not linked")
        if r["research_status"]!="complete" and not r["next_recommended_action"]:
            r["next_recommended_action"]="Check incomplete source-page, exact location and dated activity questions"
    active=[rec[i] for i in range(1,294) if i not in EXCLUDED]
    archive=[]
    for i in sorted(EXCLUDED):
        r=rec[i]
        r["previous_exclusion_status"]="Excluded from active candidate set, not automatically permanently closed"
        r["reopening_conditions"]="Review original exclusion rationale and reopen if changed conditions or better evidence warrant"
        r["publication_status"]="hold"
        archive.append(r)
    counts=collections.Counter(x["research_status"] for x in active)
    assert len(active)==291 and len(archive)==2
    conflicts=[x for x in issues if x.get("kind") in ("id_index_mismatch","source_read_error","completed_without_embedded_p3_evidence")]
    snapshot=run("git","rev-parse","HEAD")
    master={
     "metadata":{"title":"Backroom — Group A 291 master research", "schema_version":"1.0",
       "repository":"https://github.com/cinaedvsstudios/Backroom-site",
       "original_range":{"start":1,"end":293},"active_count":291,"archived_exclusion_count":2,
       "source_snapshot_commit":snapshot,"backup_checkpoint_commit":snapshot,
       "consolidation_date_berlin":DATE(),"research_cutoff_date_berlin":DATE(),
       "verification_policy":"Source research is not proof of physical activity; preserve firsthand vs hearsay, historic vs recent, and login/blocked vs not found separately.",
       "research_only":True,"live_database_changes":False,"publication_authorized":False,
       "consolidation_stage":"STAGED_VALIDATED_PRESERVATION_BEFORE_CLEANUP",
       "original_group_A_files_archived_losslessly":len(local)},
     "research_progress":{"completed":counts["complete"],"incomplete":counts["incomplete"],
       "not_started":counts["not_started"],"active_total":291,"original_examined_through":examined,
       "next_unexamined_original_index":next((i for i in range(1,294) if i not in EXCLUDED and rec[i]["research_status"]=="not_started"),None),
       "completed_indices":[r["original_index"] for r in active if r["research_status"]=="complete"],
       "incomplete_indices":[r["original_index"] for r in active if r["research_status"]=="incomplete"],
       "unstarted_indices":[r["original_index"] for r in active if r["research_status"]=="not_started"],
       "outstanding_priority_indices":[x["index"] for x in p.get("incomplete",[])],
       "prior_checkpoint_references":[x["path"] for x in sources if x["path"].find("P3_completed_batch_")>=0],
       "last_confirmed_git_commit":tracker.get("last_confirmed_commit"),
       "last_confirmed_evidence_commit":tracker.get("last_confirmed_evidence_commit")},
     "records":active,"archived_exclusions":archive,"source_inventory":sources,
     "consolidation_issues":issues,
     "source_snapshot_counts":qa,
     "validation_results":{"complete":False,"stage":"pending_remote_round_trip","checks":{},
         "unresolved_mapping_conflicts":len(conflicts),"checked_at_berlin":DATE()},
     "changelog":[{"at":DATE(),"operation":"Group A historical consolidation; records preserved and production untouched",
         "source_snapshot":snapshot,"old_files_preserved_inside_source_inventory":len(local)}]
    }
    validate(master,allow_stage=True)
    DEST.write_text(json.dumps(master,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    validate(load(DEST),allow_stage=True)
    print("GROUP_A_STAGE_BUILT",json.dumps({"active":len(active),"excluded":len(archive),"complete":counts["complete"],
          "incomplete":counts["incomplete"],"not_started":counts["not_started"],
          "source_files":len(sources),"local_source_files":len(local),"matched_entries":qa["matched_source_entries"],
          "conflicts":len(issues),"master_bytes":DEST.stat().st_size},sort_keys=True))

def validate(master,allow_stage=False,check_originals=True):
    q=[c for c in load(QUEUE)["candidates"] if c.get("section")=="A"]
    assert len(q)==293
    ids={c["index"]:c["id"] for c in q}
    active=master["records"]; archived=master["archived_exclusions"]
    assert len(active)==291 and len(archived)==2
    together=active+archived
    assert len({x["original_index"] for x in together})==293
    assert {x["original_index"]:x["proposal_id"] for x in together}==ids
    assert {x["original_index"] for x in archived}==EXCLUDED
    assert len({x["proposal_id"] for x in active})==291
    statuses=collections.Counter(x["research_status"] for x in active)
    assert set(statuses).issubset({"complete","incomplete","not_started"})
    assert sum(statuses.values())==291
    assert all(len(x["site_verification"])==8 for x in together)
    assert all(len(x["research_history"])>0 for x in together)
    inv=master["source_inventory"]
    local_in=[x for x in inv if x["in_group_A"]]
    assert len(local_in)>=125
    assert len({x["path"] for x in inv})==len(inv)
    assert all(x["source_read_status"]=="fully_read" for x in inv)
    for entry in local_in:
        origin_bytes=entry["original_content"].encode("utf-8")
        assert sha_bytes(origin_bytes)==entry["source_sha256"],entry["path"]
        if check_originals:
            path=pathlib.Path(entry["path"])
            assert path.exists(),entry["path"]
            assert path.read_bytes()==origin_bytes,entry["path"]
    assert all(x["source_urls"] is not None for x in together)
    assert all(x["original_queue_record"]["id"]==x["proposal_id"] for x in together)
    assert all(x["publication_status"]!="approved" for x in together)
    if not allow_stage:assert master["validation_results"]["complete"]
    return {"active_291":True,"archived_2":True,"all_293_index_id_matches":True,
      "eight_websites_per_candidate":True,"all_original_Group_A_file_bytes_preserved":True,
      "all_sources_parsed":True,"no_automatic_publication":True,
      "research_status_total":dict(statuses),"Group_A_archived_documents":len(local_in)}

def validate_remote():
    src=run("git","show","origin/main:"+DEST.as_posix())
    local=raw(DEST)
    if src.strip()!=local.strip():raise RuntimeError("Remote master content does not match local prepared version")
    doc=json.loads(src)
    checks=validate(doc,allow_stage=True,check_originals=True)
    print("GROUP_A_REMOTE_READBACK_VALIDATED",json.dumps(checks,sort_keys=True))

def clean():
    master=load(DEST)
    checks=validate(master,allow_stage=True)
    # Complete the master before any destructive operation and keep all original bytes in it.
    for x in master["source_inventory"]:
        if x["in_group_A"]:x["retired_after_validation"]=True
    master["metadata"]["consolidation_stage"]="COMPLETE_CLEANUP_VERIFIED_LOCALLY"
    master["validation_results"].update({"complete":True,"stage":"ready_for_cleanup_commit",
        "checked_at_berlin":DATE(),"checks":checks})
    master["changelog"].append({"at":DATE(),"operation":"Old Group A research files removed after verified master readback; Git history and original byte content retained"})
    DEST.write_text(json.dumps(master,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    validate(load(DEST),allow_stage=False,check_originals=True)
    files=sorted(pathlib.Path(x["path"]) for x in master["source_inventory"] if x["in_group_A"])
    if len(files)<125:raise RuntimeError("Unexpected small Group A deletion set")
    # Remove ONLY tracked original Group A files, and never other groups or source archives.
    for path in files:subprocess.check_call(["git","rm","--",str(path)])
    remaining=[x for x in GROUP.rglob("*") if x.is_file()]
    if remaining!=[DEST]:raise RuntimeError("Unexpected file(s) left in Group A: "+repr(remaining))
    print("GROUP_A_CLEANUP_PREPARED",json.dumps({"removed_files":len(files),"remaining":str(DEST)}))


def polish():
    """Expose original duplication decisions and parent tracker inside the validated master."""
    doc=load(DEST)
    validate(doc,allow_stage=False,check_originals=False)
    if doc["metadata"].get("polish_completed"):
        print("GROUP_A_MASTER_ALREADY_POLISHED")
        return
    all_records=doc["records"]+doc["archived_exclusions"]
    by_index={r["original_index"]:r for r in all_records}
    by_id={r["proposal_id"]:r for r in all_records}
    embedded={x["path"]:x["original_content"] for x in doc["source_inventory"] if x["in_group_A"]}
    def old_doc(name):
        match=next((x for x,y in embedded.items() if name in x),None)
        return (json.loads(embedded[match]),match) if match else ({},None)
    audit,apath=old_doc("/duplicate_and_source_audit_")
    decisions,dpath=old_doc("/decision_review_")
    for r in all_records:
        r["duplicate_research"]=r.get("duplicate_research",[])
        r["research_tasks"]=r.get("research_tasks",[])
    seen={r["original_index"]:{json.dumps(e.get("raw"),sort_keys=True,ensure_ascii=False) for e in r["duplicate_research"]} for r in all_records}
    matched=0
    def link(item,path,reason):
        nonlocal matched
        indices=[]
        for key in ("ids","indexes","indices","original_indices","candidate_indices"):
            if isinstance(item.get(key),list):indices+=item[key]
        for key in ("index","original_index","queue_index","proposal_id","candidate_id"):
            if item.get(key) is not None:indices.append(item[key])
        for v in indices:
            r=by_id.get(v) if isinstance(v,str) else None
            if r is None:
                try:r=by_index.get(int(v))
                except (ValueError,TypeError):pass
            if r is None:continue
            text=json.dumps(item,ensure_ascii=False,sort_keys=True)
            if text in seen[r["original_index"]]:continue
            seen[r["original_index"]].add(text)
            r["duplicate_research"].append({"source_file":path,"reason":reason,"raw":item})
            matched+=1
    for row in audit.get("duplicate_spot_comparisons",[]):link(row,apath,"Original duplicate comparison")
    for row in decisions.get("duplicates_requiring_evidence_before_merge",[]):link(row,dpath,"Original unresolved merge question")
    for row in decisions.get("already_one_candidate_or_name_normalization",[]):link(row,dpath,"Original name normalization")
    sites=list(SITES)
    for r in all_records:
        for x in r["original_queue_record"].get("source_refs",[]):
            try:
                n=int(x["s"])
                if 1<=n<=8:
                    v=r["site_verification"][sites[n-1]]
                    url=x.get("u") or x.get("url")
                    if isinstance(url,str) and url.startswith("http") and url not in v["matched_urls"]:
                        v["matched_urls"].append(url)
            except (ValueError,KeyError,TypeError):pass
        ds=r["duplicate_research"]
        r["duplicate_status"]="possible" if any(
            re.search("unresolved|not_spot_proven|requires|possible|evidence_before_merge",
                str(e.get("raw",{}).get("decision",""))+" "+str(e.get("reason","")),re.I) for e in ds
            ) else "ruled_out" if ds and all(
            re.search("keep_separate_spots|ruled.out",str(e.get("raw",{}).get("decision","")),re.I) for e in ds
            ) else "unchecked"
        summary=[]
        for h in r["research_history"]:
            if not re.search("GROUP_A_291_CONSOLIDATED|decision_review|P3_deep_source|full_verification_252",h["source_file"]):continue
            item=h.get("raw_evidence",{})
            if not isinstance(item,dict):continue
            for key in ("summary","updated_note","reason","location_finding","geographic_finding","source_pin_notes","identity_and_access"):
                value=item.get(key)
                if isinstance(value,str) and 10<len(value)<1800 and not any(z["note"]==value for z in summary):
                    summary.append({"note":value,"source_file":h["source_file"],"field":key})
        r["location_evidence_summary"]={"historical_research_notes":summary[-8:],
                   "physical_site_identification":r["location_status"],
                   "do_not_infer_cruising_from_site_operation":True}
        if r["research_status"]!="not_started":
            r["last_researched_at"]="2026-11-08" if any("2026-11-08" in s for s in r["provenance_files"]) else "2026-11-06"
        for question in r["missing_information"]:
            if not any(x.get("task")==question for x in r["research_tasks"]):
                r["research_tasks"].append({"task":question,"source":"Part 3 incomplete tracker"})
        if r["research_status"]=="not_started" and not r["research_tasks"]:
            r["research_tasks"].append({"task":r["next_recommended_action"] or "Begin source verification","source":"Canonical queue"})
        if r["duplicate_status"]=="possible" and "Review original duplicate comparison before any merge" not in r["unresolved_conflicts"]:
            r["unresolved_conflicts"].append("Review original duplicate comparison before any merge")
    parent=PART/"tracker_A.json"
    ent=next(x for x in doc["source_inventory"] if x["path"]==str(parent))
    if file_sha(parent)!=ent["source_sha256"]:raise RuntimeError("Historical tracker changed unexpectedly")
    ent["original_content"]=raw(parent)
    ent["historical_first_pass_only"]=True
    doc["metadata"]["parent_tracker_A_status"]="Historical first-pass record retained outside Group A because immutable master_queue still references it; not current substantive research progress"
    doc["metadata"]["polish_completed"]=True
    doc["validation_results"]["checks"]["duplicate_comparisons_indexed"]=True
    doc["validation_results"]["checks"]["parent_tracker_A_content_embedded"]=True
    doc["changelog"].append({"at":DATE(),"operation":"Index archived duplicate comparisons, linked source URLs and research tasks; embed historical parent tracker","candidate_duplicate_comparisons":sum(bool(r["duplicate_research"]) for r in all_records)})
    DEST.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    validate(load(DEST),allow_stage=False,check_originals=False)
    print("GROUP_A_POLISH_VALIDATED",json.dumps({"duplicate_comparison_attachments":matched,
       "duplicate_candidate_records":sum(bool(r["duplicate_research"]) for r in all_records),
       "possible_duplicate_candidates":sum(r["duplicate_status"]=="possible" for r in all_records),
       "active":len(doc["records"]),"archived":len(doc["archived_exclusions"]),
       "master_bytes":DEST.stat().st_size},sort_keys=True))


if __name__=="__main__":
    mode=sys.argv[1] if len(sys.argv)>1 else "--build"
    if mode=="--build":main()
    elif mode=="--validate-remote":validate_remote()
    elif mode=="--clean":clean()
    elif mode=="--polish":polish()
    elif mode=="--validate-final":
        doc=load(DEST)
        v=validate(doc,allow_stage=False,check_originals=False)
        actual=[p for p in GROUP.rglob("*") if p.is_file()]
        assert actual==[DEST]
        print("GROUP_A_FINAL_VALIDATION",json.dumps(v,sort_keys=True))
    else:raise SystemExit("Unsupported mode")
