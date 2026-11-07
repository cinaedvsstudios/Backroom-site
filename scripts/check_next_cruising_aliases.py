import json,re
from pathlib import Path
rows=json.loads(Path("listings.json").read_text())
spots=[
("Verona Uno","Verona",["Verona Uno","San Giovanni Lupatoto"]),
("Aquadrom Pool","Katowice",["Aquadrom","Ruda Slaska","Ruda Śląska"]),
("Zeleni Venac market toilet","Belgrade",["Zeleni Venac"]),
("Terazije public toilet","Belgrade",["Terazije","Palata Albanija"]),
("A5 Ausfahrt Efringen-Kirchen","Kembs",["Efringen-Kirchen","Kleinkems","Fischergrund"]),
("Parco delle Cascine","Florence",["Cascine"]),
("Donauinsel Nordstrand","Vienna",["Donauinsel","Nordstrand","Toter Grund"])
]
def n(s):return re.sub(r"[^a-z0-9]+"," ",str(s or "").casefold()).strip()
for name,city,aliases in spots:
 found=[]
 for r in rows:
  original=n(r.get("Name",""))
  if any(n(a) in original or original in n(a) for a in aliases if len(n(a))>4 and len(original)>4):
   found.append({k:r.get(k) for k in ("Venue_ID","Name","City","Country","Category","Status","Description","Source_URLs")})
 print(json.dumps({"target":name,"city":city,"matches":found[:8]},ensure_ascii=False))
