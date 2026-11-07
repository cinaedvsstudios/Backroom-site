#!/usr/bin/env python3
"""Read-only classification of Part 5 source-completeness and dated visitor evidence."""
import collections, json, re
from pathlib import Path
from datetime import date,datetime
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"research/cruising/part5"
data=json.loads((BASE/"combined_research_snapshot.json").read_text(encoding="utf-8"))
CUTOFF=date(2025,11,7)
CHECK_KEYS=("source_checks","site_checks","per_source_checks","eight_source_checks","site_evidence")
ACTIVITY_KEYS=("dated_reports","dated_evidence","dated_source_reports","dated_comments","dated_user_reports","evidence_timeline","reports","activity_evidence","recent_activity","recent_activity_since_2025_11_06","activity_evidence_since_2025_11_06","postcutoff_activity","activity_freshness","activity_window","recency","source_evidence","dated_activity_reports")
FALSE_STATUS=("not_checked","not_individually","not_directly","no_original_cross_source_alignment","unavailable_blocked","unknown")
NO_CHECK=("not_checked","not_individually","not_directly","no_original_cross_source_alignment")
NEG_WORDS=("question","inquir","ask whether","asking","anyone there","anyone around","plan to","planned","intention","on the way","contact only","online_meetup","meetup_question","no one","nobody","nothing happening","negative","unsuccessful","no activity","unverified")
POS_WORDS=("encounter","sex","sexual activity","firsthand positive","first_person_claim","first_person_style_positive","firstperson_positive","firsthand_cruising","first_person_cruising","visited and saw","visited and met","cruising after","positive firsthand","self_report_claims_current_presence","firsthand activity","positive experience","men seeking sex","men and sexual","multiple men","group sexual","cruising with","regular visits and encounters","recount")
NOT_PHYSICAL=("online","meeting request","meeting question","future","planned","question","2026 guide","editorial","guide claims","checking whether","unverified observation","official","police","news","access closure")
def dates(s):
    out=[]
    for m in re.finditer(r"(?<!\d)(20[012]\d)[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])(?!\d)",str(s)):
        try:out.append(date(int(m[1]),int(m[2]),int(m[3])))
        except ValueError:pass
    return out
def get_checks(d):
    for k in CHECK_KEYS:
        entries=d.get(k)
        if isinstance(entries,list) and len(entries)>0 and isinstance(entries[0],dict):
            return k,entries
    for k in ("sources",):
        entries=d.get(k)
        if isinstance(entries,list) and 6<=len(entries)<=10 and isinstance(entries[0],dict) and any("status" in y for y in entries):
            return k,entries
    return None,[]
def status(e):
    return str(e.get("status") or e.get("state") or e.get("result") or e.get("site_status") or e.get("archive_state") or e.get("spot_url_status") or "unknown").lower()
def eval_check(e):
    s=status(e)
    alltext=" ".join(str(e.get(k,"")) for k in ("archive_state","spot_url_status","research_method","inspection"))
    is_unchecked=any(t in s for t in NO_CHECK) or any(t in alltext for t in ("not_aligned_in_archived_sources","not_individually","no direct per-place check"))
    is_unavailable=any(t in s for t in ("unavailable","blocked","cache_miss","http_451"))
    is_direct=any(t in s for t in ("direct_spot_page_read","specific_spot_page_read","primary_spot_page_read","original_spot_page_read","public_spot_page_read","direct_spot_page_opened","primary_spot_page_")) or "direct" in str(e.get("research_method","")).lower() and "source" in s
    is_indexed="searched_no_match" in s or "targeted_indexed" in s or "indexed_search" in s
    return is_unchecked,is_unavailable,is_direct,is_indexed
def nested(x,key=""):
    if isinstance(x,list):
        for v in x:yield from nested(v,key+"[]")
    elif isinstance(x,dict):
        if any(k in x for k in ("date","posted","date_berlin","datetime","timestamp")):
            yield key,x
        for k,v in x.items():
            if isinstance(v,(list,dict)):yield from nested(v,key+"."+k)
def get_reports(d):
    rows=[]
    for k in ACTIVITY_KEYS:
        v=d.get(k)
        if isinstance(v,(list,dict)):
            for path,x in nested(v,k):
                rawdate=x.get("date", x.get("posted",x.get("datetime",x.get("timestamp",""))))
                ds=dates(rawdate)
                if not ds:continue
                summary=" ".join(str(v) for ky,v in x.items() if ky not in ("url","source_url"))
                typ=str(x.get("type",x.get("kind",x.get("category","")))).lower()
                low=summary.lower()
                if any(bad in typ for bad in ("official_news","news_article","government_report","2026_editorial","operator_notice","safety_context","police_report")):continue
                # dated user comments, source reports, or entries in an explicit dated-report list
                entry_type="none"
                if any(w in low for w in NEG_WORDS):entry_type="question_negative_or_unverified"
                if any(w in low for w in POS_WORDS) and not any(w in typ for w in ("negative","question","only_online","planned","future","guide","undated")):
                    if not any(w in typ for w in ("news_report","historical_news","official","police")):
                        entry_type="positive_claim"
                if entry_type=="none":
                    entry_type="dated_report_ambiguous"
                for dt in ds:rows.append({"date":dt.isoformat(),"class":entry_type,"type":typ,"summary":summary[:210],"field":path})
    # stable dedup across nested activity data
    seen=set();out=[]
    for r in rows:
        key=(r["date"],r["summary"],r["type"])
        if key not in seen:out.append(r);seen.add(key)
    return out

records=[]
counts=collections.Counter()
by_worker=collections.defaultdict(collections.Counter)
status_count=collections.Counter()
unsearched_statuses=collections.Counter()
unsearched_samples=[]
report_samples={"positive":[],"old_only":[],"recent_not_positive":[],"no_date":[]}
for rec in data["records"]:
    d=rec["data"];w=rec["worker"];index=rec["index"]
    key,checks=get_checks(d)
    n=len(checks)
    unknown_count=max(0,8-n)
    metrics=[eval_check(c) for c in checks]
    unchecked=sum(int(z[0]) for z in metrics)
    unavailable=sum(int(z[1]) for z in metrics)
    direct=sum(int(z[2]) for z in metrics)
    indexed=sum(int(z[3]) for z in metrics)
    status_count.update(status(c) for c in checks)
    unsearched_statuses.update(status(c) for c,z in zip(checks,metrics) if z[0])
    # Explicit "not checked" without assuming unknown/missing = not checked
    any_unchecked=unchecked>0
    any_incomplete=(unchecked+unknown_count+unavailable)>0
    all8_live=n>=8 and all(z[2] for z in metrics)
    report=get_reports(d)
    recent=[x for x in report if date.fromisoformat(x["date"])>=CUTOFF]
    older=[x for x in report if date.fromisoformat(x["date"])<CUTOFF]
    positive=[x for x in recent if x["class"]=="positive_claim"]
    nonpos=[x for x in recent if x["class"]!="positive_claim"]
    old_only=bool(older) and not recent
    flag_positive=False
    for p in ("credible_physical_activity_since_2025_11_06","credible_recent_activity","credible_recent_physical_cruising_activity_verified","latest_physical_activity_2025_11_06_or_later_verified","credible_recent_physical_cruising_report","verified_recent_activity","recent_verified","verified_recent","independently_verified_recent_cruising","recent_positive_first_person_report_present"):
        if d.get(p) is True:flag_positive=True
    for k in ("activity_evidence","activity_freshness"):
        if isinstance(d.get(k),dict) and (d[k].get("verified_recent_specific_activity") is True or d[k].get("has_recent_claim") is True):
            flag_positive=True
    flags= [str(x).lower() for x in d.get("review_flags",[]) if isinstance(x,str)]
    positive_supported=bool(positive) or flag_positive
    recout={"index":index,"id":rec["id"],"worker":w,"name":d.get("name"),"city":d.get("city"),"country":d.get("country"),"checks_field":key,"check_entries":n,"explicit_not_checked_sources":unchecked,"missing_source_statuses":unknown_count,"unavailable_source_checks":unavailable,"direct_spot_page_checks":direct,"indexed_source_search_checks":indexed,"any_explicit_unsearched":any_unchecked,"all_eight_direct_spot_pages":all8_live,"recent_dated_reports_count":len(recent),"recent_positive_claim_reports":len(positive),"old_dated_reports_count":len(older),"old_only":old_only,"possible_recent_positive":positive_supported,"recent_reports":recent[:8],"older_reports":older[:3],"explicit_recency_positive_field":flag_positive,"flags":flags}
    records.append(recout)
    for tag,yes in [
        ("records",True),("explicit_unsearched_record",any_unchecked),("unsearched_or_missing_or_unavailable_record",any_incomplete),("missing_eight_status_record",unknown_count>0),("no_source_check_array",n==0),("eight_direct_spot_pages",all8_live),
        ("has_some_direct_spot_read",direct>0),("has_recent_dated_report",bool(recent)),("has_recent_positive_claim",bool(positive)),("has_some_recent_positive_indicator",positive_supported),
        ("old_dated_reports_only",old_only),("has_old_dated_report",bool(older)),("no_dated_reports",not bool(report)),("recent_dated_nonpositive_only",bool(recent) and not positive),("no_dated_recent_report",not bool(recent)),("no_recent_dated_report_or_positive_indicator",not bool(recent) and not flag_positive)
    ]:
        if yes:counts[tag]+=1;by_worker[w][tag]+=1
    counts["explicit_unsearched_source_checks"]+=unchecked
    counts["missing_source_status_slots"]+=unknown_count
    counts["unavailable_source_checks"]+=unavailable
    counts["direct_spot_page_checks"]+=direct
    counts["indexed_source_search_checks"]+=indexed
    if any_unchecked and len(unsearched_samples)<18:
        unsearched_samples.append({"index":index,"name":d.get("name"),"worker":w,"unchecked":unchecked,"check_field":key})
    if positive_supported and len(report_samples["positive"])<45:
        report_samples["positive"].append({"index":index,"name":d.get("name"),"worker":w,"recent_positive_claim_reports":positive[:3],"flag":flag_positive,"recent_reports_count":len(recent)})
    if old_only and len(report_samples["old_only"])<22:
        report_samples["old_only"].append({"index":index,"name":d.get("name"),"worker":w,"oldest_report":min(x["date"] for x in older),"most_recent_report":max(x["date"] for x in older)})
    if recent and not positive and len(report_samples["recent_not_positive"])<20:
        report_samples["recent_not_positive"].append({"index":index,"name":d.get("name"),"recent":recent[:2]})

out={
    "_meta":{
        "as_of_berlin":datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds"),
        "cutoff_inclusive":CUTOFF.isoformat(),
        "scope":"1,172 archived records, based on source-check statuses and dated activity fields only",
        "warning":"A question/check-in is not a positive visit; dates without firsthand encounter information do not prove a place is active. Explicit not-checked statuses show gaps, while blank source status is unknown. The textual first-person detection is heuristic and reviewable, not a substitute for manual validation."
    },
    "counts":dict(counts),
    "by_worker":{w:dict(v) for w,v in by_worker.items()},
    "source_check_status_frequencies":dict(status_count.most_common()),
    "unsearched_status_frequencies":dict(unsearched_statuses.most_common()),
    "samples":{"explicit_unsearched":unsearched_samples,**report_samples},
    "all_records":records
}
p=BASE/"research_screening_counts_2026-11-07.json"
p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SCREENING_SUMMARY_BEGIN")
print(json.dumps({"counts":dict(counts),"by_worker":{w:dict(v) for w,v in by_worker.items()},"positive_samples":report_samples["positive"][:10],"old_only_examples":report_samples["old_only"][:10]},ensure_ascii=False))
print("SCREENING_SUMMARY_END")
