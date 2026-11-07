#!/usr/bin/env python3
"""Audit of available content for finished Backroom-style cruising listings.
Four exclusive buckets; no website updates, no public imports, no inferred facts.
"""
import json,re,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"research/cruising/part5"
venues=json.loads((root/"venues_normalized_1172_RESEARCH_ONLY.json").read_text(encoding="utf-8"))["venues"]
screener=json.loads((root/"research_screening_counts_2026-11-07.json").read_text(encoding="utf-8"))
byidx={r["index"]:r for r in screener["all_records"]}
assert len(venues)==1172 and len(byidx)==1172
time_pattern=re.compile(r"\b(?:after sunset|after dark|late night|at night|evenings?|afternoons?|mornings?|weekends?|weekdays?|sunset|midnight|after closing|around \d{1,2}(?::\d{2})?|between \d{1,2}|until \d{1,2}|best time|best period|peak hours|summer nights?)\b",re.I)
crowd_pattern=re.compile(r"\b(?:18[-–]\d{2}|20[-–]\d{2}|30[-–]\d{2}|younger men|older men|mixed ages?|all ages|age range|age groups?|men aged|twinks?|bears?|mature men|locals? and tourists?|visitors? (?:tend|are mostly|include)|crowd (?:is|mostly|tends|includes)|mostly (?:men|guys|students|locals|tourists)|guys in their)\b",re.I)
safety_pattern=re.compile(r"\b(?:warning|beware|caution|risk|security|police|CCTV|surveillance|hazard|danger|unsafe|robber|assault|dangerous|tide|cliff|rocks|steep|restricted access|closing time|police patrol|park regulation|nature protection|privacy|public toilets?|current closure)\b",re.I)
negated=re.compile(r"\b(?:no|not|without|unverified|unknown|unconfirmed|unavailable|lacks?|does not|cannot)\b",re.I)
def has_specific_info(text,pattern):
    if not isinstance(text,str) or not text.strip():return False
    for m in pattern.finditer(text):
        lead=text[max(0,m.start()-42):m.start()]
        # Reject "no confirmed evening times" rather than counting negatives as a fact
        if not negated.search(lead):return True
    return False
results=[]
counts=collections.Counter()
for v in venues:
    meta=v["_Research"];idx=meta["queue_index"];screen=byidx[idx]
    d=v.get("Description") or "";words=len(d.split())
    cov=meta["field_coverage"]
    access=bool(cov.get("access_notes_available"))
    when=bool(cov.get("best_visiting_time_explicit")) or has_specific_info(d,time_pattern)
    who=bool(cov.get("crowd_or_age_info_explicit")) or has_specific_info(d,crowd_pattern)
    caution=bool(cov.get("safety_info_explicit")) or has_specific_info(d,safety_pattern)
    sources=meta.get("original_source_count",0)
    recent=bool(screen.get("recent_positive_claim_reports")) or bool(screen.get("explicit_recency_positive_field"))
    stale=bool(screen.get("old_only")) and not bool(screen.get("explicit_recency_positive_field"))
    dated_recent=bool(screen.get("recent_dated_reports_count"))
    if stale:
        bucket="forget_for_now"
        reason="All saved dated reports precede 7 Nov 2025; no newer dated report in assembled evidence."
    elif words>=70 and access and when and who and caution and sources>=2 and recent:
        bucket="almost_complete"
        reason="Substantial description; access, best time, crowd, warnings; multiple source IDs and recent reported activity."
    elif words>=45 and access and sum((when,who,caution,sources>=2,recent))>=2:
        bucket="half_complete"
        reason="Substantive description and access; at least two additional supported evidence dimensions."
    else:
        bucket="quarter_complete"
        reason="Original location and sources present, but still lacks enough of the requested who/when/where/safety detail."
    counts[bucket]+=1
    for k,val in {"has_description":bool(d),"description_45plus":words>=45,"description_70plus":words>=70,
                  "access_info":access,"specific_time_info":when,"crowd_age_info":who,"safety_info":caution,
                  "two_plus_source_sites":sources>=2,"recent_positive_claim_indicator":recent,
                  "recent_dated_report_any":dated_recent,"stale_old_only":stale}.items():
        if val:counts["indicator_"+k]+=1
    results.append({"index":idx,"candidate_id":meta["original_candidate_id"],
                    "name":v["Name"],"city":v["City"],"country":v["Country"],"bucket":bucket,
                    "description_words":words,"dimensions":{"access":access,"when":when,"crowd":who,"safety":caution},
                    "source_sites":sources,"has_recent_dated_report":dated_recent,
                    "recent_positive_indicator_heuristic":recent,"dated_reports_old_only":stale,
                    "reason":reason})
assert sum(counts[k] for k in ["almost_complete","half_complete","quarter_complete","forget_for_now"])==1172
summary={
    "_meta":{"source":"venues_normalized_1172_RESEARCH_ONLY.json + research_screening_counts_2026-11-07.json",
             "cutoff":"2025-11-07","purpose":"Preliminary content-completeness triage, NOT validated recent cruising or publication suitability",
             "warning":"Recent positive indicator is a heuristic and includes false positives. 'Forget for now' means older dated comments only, not proof venue has permanently closed. Unsearched source records are not considered evidence of absence."},
    "total":1172,
    "buckets":{k:counts[k] for k in ["almost_complete","half_complete","quarter_complete","forget_for_now"]},
    "field_indicators":{k.removeprefix("indicator_"):v for k,v in counts.items() if k.startswith("indicator_")},
    "sample_records":{k:[r for r in results if r["bucket"]==k][:12] for k in ["almost_complete","half_complete","quarter_complete","forget_for_now"]},
    "rows":results}
(root/"listing_completeness_triage_2026-11-07.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("TRIAGE_RESULT="+json.dumps({k:v for k,v in summary.items() if k not in ("rows", "sample_records")},ensure_ascii=False))
print("BUCKET_SAMPLES="+json.dumps({k:[{"index":x["index"],"name":x["name"],"words":x["description_words"],"dimensions":x["dimensions"]} for x in a[:5]] for k,a in summary["sample_records"].items()},ensure_ascii=False))
