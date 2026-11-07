#!/usr/bin/env python3
"""One lossless, normalized, 51-field Backroom venue table from all four Part 5 workers.

STAGING ONLY: no changes to listings.json and no publication approval.
The original, unmodified research object is retained in _Research on every row.
"""
import collections
import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

REPO=Path(__file__).resolve().parents[1]
ROOT=REPO/"research/cruising/part5"
SOURCE=ROOT/"combined_research_snapshot.json"
TARGET=ROOT/"venues_normalized_1172_RESEARCH_ONLY.json"
FIELD_NAMES=[
"Venue_ID","Name","City","Country","Category","Status","Address","Postcode","Nearest_Station",
"Latitude","Longitude","Google_Maps_URL","Apple_Maps_URL","Native_Map_Query","Website_URL",
"Instagram_URL","Facebook_URL","Other_URL","Source_URLs","Share_URL","Image_URL",
"Description","Vibe_Tags","Last_Updated","Opening_Days","Opening_Open_Time",
"Opening_Close_Time","Opening_Notes","Event_Date","Event_Time",
"Feature_Darkroom","Feature_Dresscode","Feature_Men_Only","Feature_Dancefloor",
"Feature_Smoking_Area","Feature_Cocktails","Feature_Cruise_Focused","Feature_Sauna",
"Feature_Playroom","Public_Rating","Rating_General","Rating_Darkroom",
"Rating_Age_Range","Rating_Cost","Rating_Size","Rating_Location",
"Rating_Busyness","Views","Emoji_Override","Created_At","Flag_Reason"
]
FEATURE_KEYS=[x for x in FIELD_NAMES if x.startswith("Feature_")]
RATING_KEYS=[x for x in FIELD_NAMES if x.startswith("Rating_")]
DESCRIPTION_FIELDS=[
"description_rewritten","research_description","source_description_paraphrase",
"description_paraphrase","description","place_summary","source_description_rewritten",
"place_assessment","identity_summary","description_rewrite","place_identity_and_access",
"identity_and_access","location_identity_and_access","identity_and_access_notes",
"research_note","location_and_access","identity_access_and_cruising_history",
"place_identity_access_assessment","access_and_activity_notes",
"area_and_access","identity_and_activity","original_description"
]
ACCESS_FIELDS=[
"access_conditions","access_information","access_notes","access_and_safety",
"access_and_restrictions","access_hours_or_conditions","access",
"location_and_access","place_identity_and_access","identity_and_access",
"geography","location","place_identity","place_identity_and_access",
"practical_directions","identity_summary","opening_hours","best_time","opening_notes"
]
RESEARCH_FIELDS=[
"dated_reports","dated_evidence","dated_source_reports","dated_comments","dated_user_reports",
"evidence_timeline","recent_activity","recent_activity_since_2025_11_06",
"activity_evidence","activity_freshness","postcutoff_activity","reports",
"recent_online_reports_not_physical_activity","dated_physical_activity_reports_since_2025_11_06"
]
SOURCE_CHECK_KEYS=[
"eight_source_checks","source_checks","site_checks","site_evidence","per_source_checks",
"sources"
]
DUPLICATE_KEYS=[
"possible_duplicates","possible_aliases","possible_duplicates_or_aliases",
"duplicates_or_aliases","duplicates_and_concerns","possible_duplicates_and_flags",
"duplicate_candidates","duplicate_and_safety_flags",
"possible_aliases_or_duplicates","possible_aliases_and_flags",
"aliases_risks"
]
TIME_FIELDS=["best_times","best_time","best_visiting_times","recommended_hours","visiting_times","busyness","activity_hours","time_of_day","peak_times"]
CROWD_FIELDS=["crowd","crowd_description","typical_crowd","age_range","ages","visitor_profile","visitor_types","demographics","age_profile"]
SAFETY_FIELDS=["safety","safety_notes","security","warnings","access_and_safety","access_and_restrictions","safety_concerns","review_flags","original_access_review_flags"]
DATE_FIELDS=["checked_berlin","researched_berlin","research_date_berlin","checked_date_berlin","reviewed_berlin","date_checked_berlin","last_checkpoint_berlin"]
def clean_text(v):
    if not isinstance(v,str):
        return ""
    return re.sub(r"\s+"," ",v).strip()
def unique(seq):
    return list(dict.fromkeys(x for x in seq if x))
def get_text(d,keys):
    for key in keys:
        v=d.get(key)
        s=clean_text(v)
        if s:return s
    return ""
def collect_urls(value,key=""):
    out=[]
    if isinstance(value,dict):
        for k,v in value.items():
            if isinstance(v,str) and (k.lower() in {"url","source_url","detail_url","spot_url","primary_url","source_country_url","source_city_url","website","website_url","official_url","primary_direct_url","original_spot_url","primary_detail_url","original_source_url","source_index_url","index_url","source_detail_url","url_link"} or k.lower().endswith("_url")):
                if v.startswith("http://") or v.startswith("https://"):out.append(v.strip())
            elif isinstance(v,(dict,list)):
                out+=collect_urls(v,k)
    elif isinstance(value,list):
        for el in value:out+=collect_urls(el,key)
    return out
def coerce_coordinate(value,lat):
    if value is None or isinstance(value,bool):return ""
    if isinstance(value,(int,float)) or isinstance(value,str):
        try:
            f=float(str(value).strip().replace(",","."))
            if -(90 if lat else 180)<=f<=(90 if lat else 180):
                return str(value).strip()
        except (TypeError,ValueError):pass
    return ""
def get_scalar(d,keynames):
    for key in keynames:
        v=d.get(key)
        if isinstance(v,(str,int,float)) and not isinstance(v,bool) and str(v).strip():
            return str(v).strip()
    return ""
def nested_scalar(d,keynames):
    s=get_scalar(d,keynames)
    if s:return s
    for key in ("location","geography","address_details","place_identity","identity"):
        v=d.get(key)
        if isinstance(v,dict):
            t=get_scalar(v,keynames)
            if t:return t
    return ""
def existing_lists(d,keys):
    return {k:copy.deepcopy(d[k]) for k in keys if k in d and d[k] not in (None,[],"",{})}
def normalized_checks(d):
    for k in SOURCE_CHECK_KEYS:
        v=d.get(k)
        if isinstance(v,list) and len(v)>0 and isinstance(v[0],dict):
            # "sources" sometimes is URLs, not checks; require source result fields.
            if k!="sources" or any("status" in e or "site" in e for e in v):
                return k,v
    return "",[]
def source_ids(d,raw,checks):
    found=[]
    for f in ("original_source_refs","original_queue_refs","archive_refs","source_refs"):
        r=d.get(f)
        if isinstance(r,list):
            for item in r:
                if isinstance(item,dict):
                    id=item.get("s",item.get("source_id"))
                    if id is not None:found.append(str(id))
    # supplement with original cross-source identifiers, but never invent a distinct source.
    if not found:
        for item in checks:
            if isinstance(item,dict) and str(item.get("status","")).lower().startswith(("linked","archived_source_record")):
                id=item.get("source_id",item.get("s"))
                if id is not None:found.append(str(id))
    return unique(found)
def original_source_urls(d,checks):
    priority=[]
    for f in ("original_source_refs","original_queue_refs","archive_refs","source_refs"):
        for item in d.get(f,[]) if isinstance(d.get(f),list) else []:
            if isinstance(item,dict):
                url=item.get("u",item.get("url"))
                if isinstance(url,str) and url.startswith("http"):priority.append(url)
    for item in checks:
        if not isinstance(item,dict):continue
        for key in ("url","source_url","source_urls","urls"):
            v=item.get(key)
            if isinstance(v,str) and v.startswith("http"):priority.append(v)
            if isinstance(v,list):
                priority.extend(x for x in v if isinstance(x,str) and x.startswith("http"))
    priority+=collect_urls(d)
    # URLs may recur across source-archive extracts; unique and retain all.
    return unique(priority)
def date_stamp(d):
    # A research date means date data was saved, NOT last observed cruising.
    for key in DATE_FIELDS:
        v=d.get(key)
        if isinstance(v,str):
            match=re.match(r"^(20\d\d-\d\d-\d\d)",v)
            if match:return match.group(1)
    return ""
def maybe_extra(d,names):
    texts=[]
    for k in names:
        v=d.get(k)
        if isinstance(v,str) and v.strip():
            texts.append(clean_text(v))
    return unique(texts)
def make_description(d):
    result=get_text(d,DESCRIPTION_FIELDS)
    # No new statements: use the existing research language, optionally add separately
    # stored access information when not already covered. Do not concatenate raw directory
    # text, inaccessible opinions, or contradictory time/age estimates into a public claim.
    if len(result)<90:
        access=get_text(d,["identity_and_access","place_identity_and_access","location_identity",
                           "place_identity","location_and_access","access_information"])
        if access and access not in result:
            result=(result+". "+access).strip(". ").strip()
    return result
def make_tags(d):
    candidates=[]
    for k in ("source_category","location_type","place_type","category","source_type","original_source_category","place_kind"):
        v=d.get(k)
        if isinstance(v,str) and v.strip():
            candidates.append(v.strip())
    # Avoid guessing tags. The category field stays fixed as requested.
    return ", ".join(unique(candidates[:3]))
def detect_flags(d):
    flags=[]
    for key in ("review_flags","flags","original_access_review_flags","duplicate_and_safety_flags","possible_duplicates_or_safety_flags"):
        v=d.get(key)
        if isinstance(v,list):
            flags.extend(str(x) for x in v if isinstance(x,str))
        elif isinstance(v,str) and v.strip(): flags.append(v.strip())
    return "; ".join(unique(flags))[:1000]
def default_row():
    v={k:"" for k in FIELD_NAMES}
    for k in FEATURE_KEYS:v[k]=None
    for k in RATING_KEYS:v[k]=None
    v["Views"]=0
    return v
def main():
    obj=json.loads(SOURCE.read_text(encoding="utf-8"))
    raw=obj.get("records")
    queue={q["index"]:q for q in json.loads((ROOT/"master_queue.json").read_text(encoding="utf-8"))["candidates"]}
    if not isinstance(raw,list):raise ValueError("combined snapshot lacks records")
    if len(raw)!=1172:raise ValueError(f"expected 1172 original candidates, got {len(raw)}")
    now=datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds")
    assembled=[]
    seen=set()
    description_counter=collections.Counter()
    fields_covered=collections.Counter()
    source_stats=collections.Counter()
    workers=collections.Counter()
    for entry in sorted(raw,key=lambda r:r["index"]):
        idx=entry["index"];orig=entry["data"];q=queue[idx]
        original_id=entry["id"]
        if idx in seen:raise ValueError(f"duplicate index {idx}")
        seen.add(idx)
        workers[entry["worker"]]+=1
        check_key,checks=normalized_checks(orig)
        urls=original_source_urls(orig,checks)
        source_nums=source_ids(orig,entry,checks)
        row=default_row()
        row.update({
            "Venue_ID":"RESEARCH-"+original_id,
            "Name":str(orig.get("name") or q.get("name") or "").strip(),
            "City":str(orig.get("city") or q.get("city") or "").strip(),
            "Country":str(orig.get("country") or q.get("country") or "").strip(),
            "Category":"Cruising Area",
            "Status":"Research",
            "Native_Map_Query":", ".join(x for x in [str(orig.get("name") or "").strip(),str(orig.get("city") or "").strip(),str(orig.get("country") or "").strip()] if x),
            "Source_URLs":" | ".join(urls),
            "Description":make_description(orig),
            "Vibe_Tags":make_tags(orig),
            "Opening_Notes":get_text(orig,["opening_notes","access_conditions","access_notes","access_information",
                                           "access_and_safety","access_and_restrictions"]),
            "Flag_Reason":detect_flags(orig)
        })
        row["Address"]=nested_scalar(orig,["address","Address","street_address","formatted_address"])
        row["Postcode"]=nested_scalar(orig,["postcode","postal_code","zip","zip_code"])
        row["Nearest_Station"]=nested_scalar(orig,["nearest_station","station","nearest_transit","public_transport"])
        row["Latitude"]=coerce_coordinate(nested_scalar(orig,["latitude","lat"]),True)
        row["Longitude"]=coerce_coordinate(nested_scalar(orig,["longitude","lon","lng","long"]),False)
        row["Opening_Days"]=nested_scalar(orig,["opening_days","open_days","days_open"])
        row["Opening_Open_Time"]=nested_scalar(orig,["opening_open_time","opening_time","opens_at"])
        row["Opening_Close_Time"]=nested_scalar(orig,["opening_close_time","closing_time","closes_at"])
        row["Website_URL"]=nested_scalar(orig,["official_website","official_website_url","website_url"])
        row["Instagram_URL"]=nested_scalar(orig,["instagram_url"])
        row["Facebook_URL"]=nested_scalar(orig,["facebook_url"])
        row["Image_URL"]=nested_scalar(orig,["image_url"])
        checked=date_stamp(orig)
        if checked:
            # This is a research revision date, not evidence of a recent physical visit.
            row["Last_Updated"]=checked+"T00:00:00Z"
        field_notes={
            "description_available":bool(row["Description"]),
            "detailed_description_90_plus_words":len(row["Description"].split())>=90,
            "address_explicit":bool(row["Address"]),
            "coordinates_explicit":bool(row["Latitude"] and row["Longitude"]),
            "source_url_available":bool(urls),
            "access_notes_available":bool(row["Opening_Notes"] or maybe_extra(orig,ACCESS_FIELDS)),
            "best_visiting_time_explicit":bool(maybe_extra(orig,TIME_FIELDS)),
            "crowd_or_age_info_explicit":bool(maybe_extra(orig,CROWD_FIELDS)),
            "safety_info_explicit":bool(maybe_extra(orig,SAFETY_FIELDS)),
            "dated_evidence_recorded":bool(existing_lists(orig,RESEARCH_FIELDS)),
            "source_check_statuses_recorded":bool(checks),
            "eight_distinct_source_check_rows":len(checks)==8,
        }
        for k,v in field_notes.items():
            if v:fields_covered[k]+=1
        description_counter[len(row["Description"].split())>=90]+=1
        source_stats[len(source_nums)]+=1
        row["_Research"]={
            "queue_index":idx,
            "original_candidate_id":original_id,
            "temporary_research_venue_id":True,
            "assigned_worker":entry["worker"],
            "original_batch_file":entry.get("source_batch"),
            "original_source_count":len(source_nums),
            "original_source_ids":source_nums,
            "all_source_urls":urls,
            "research_last_saved_date":checked or None,
            "source_check_field":check_key or None,
            "source_checks":copy.deepcopy(checks),
            "original_descriptions":existing_lists(orig,DESCRIPTION_FIELDS),
            "directions_access_notes":existing_lists(orig,ACCESS_FIELDS),
            "time_information":existing_lists(orig,TIME_FIELDS),
            "crowd_age_information":existing_lists(orig,CROWD_FIELDS),
            "safety_information":existing_lists(orig,SAFETY_FIELDS),
            "dated_comments_and_activity":existing_lists(orig,RESEARCH_FIELDS),
            "duplicates_and_aliases":existing_lists(orig,DUPLICATE_KEYS),
            "field_coverage":field_notes,
            "not_yet_checked_for_import":True,
            "publication_approved":False,
            "original_research_record":copy.deepcopy(orig)
        }
        # Protect schema: exact 51 template fields plus the single _Research evidence field.
        if set(row)!=(set(FIELD_NAMES)|{"_Research"}):
            raise ValueError(f"row #{idx}: field set mismatch")
        if not row["Name"] or not row["City"] or not row["Country"]:
            raise ValueError(f"row #{idx}: missing required queue identity")
        assembled.append(row)
    if seen!=set(range(1,1173)):
        raise ValueError(f"Missing indexes: {sorted(set(range(1,1173))-seen)[:10]}")
    result={
        "_meta":{
            "title":"Backroom Part 5 — all 1,172 research candidates mapped to the exact venue template",
            "generated_berlin":now,
            "source_snapshot":"research/cruising/part5/combined_research_snapshot.json",
            "venue_template":"venue TEMPLATE.json (user supplied; 51 fields)",
            "count":len(assembled),
            "workers":dict(workers),
            "field_names":FIELD_NAMES,
            "status":"RESEARCH_ONLY_NOT_FOR_PUBLICATION",
            "description":"Each record has all 51 venue template fields plus _Research, which preserves every original worker field and extracted sources. No missing values are invented. This is the unified staging table, not an import into listings.json.",
            "do_not_import_as_live":True,
            "original_location_count":len(seen),
            "original_records_preserved":len(assembled),
            "coverage_counts":dict(fields_covered),
            "original_source_site_count_distribution":dict(source_stats),
            "notes":{
                "Status":"Research, never Live",
                "Venue_ID":"Temporary RESEARCH- original candidate ID, not a production Venue_ID; existing site aliases have not been reconciled",
                "Last_Updated":"Research revision day, NOT proof of current cruising",
                "Feature_*":"Null means unknown/unverified, not false",
                "Rating_*":"Null means not scored",
                "Description":"Uses existing worker-written descriptive material, not fabricated age ranges or times. Longer verified listing copy still requires original-site enrichment.",
                "Source_URLs":"Distinct saved URLs; official, archival and directory sources are mixed and need evidence classification",
                "_Research":"Contains the original full research record unchanged for lossless recovery"
            },
        },
        "venues":assembled
    }
    TARGET.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("NORMALIZED_STATUS_BEGIN")
    print(json.dumps({"file":str(TARGET.relative_to(REPO)),"count":len(assembled),"workers":dict(workers),"fields_per_record":len(FIELD_NAMES),"source_sites_histogram":dict(source_stats),"coverage":dict(fields_covered),"size_bytes":TARGET.stat().st_size,"sample":[{"index":r["_Research"]["queue_index"],"name":r["Name"],"description_words":len(r["Description"].split()),"source_count":r["_Research"]["original_source_count"],"sources_urls":len(r["_Research"]["all_source_urls"])} for r in [assembled[0],assembled[395],assembled[626],assembled[-1]]]},ensure_ascii=False))
    print("NORMALIZED_STATUS_END",flush=True)
if __name__=="__main__":
    main()
