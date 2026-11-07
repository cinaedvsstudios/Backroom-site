#!/usr/bin/env python3
import json, re, difflib
from pathlib import Path
rows=json.loads(Path("listings.json").read_text())
pairs=[
("Praia 19 (Praia da Bela Vista)","Costa da Caparica",["Praia 19","Bela Vista","Beach 19","Praia 19 Beach"]),
("Parco delle Cascine","Florence",["Cascine","Parco delle Cascine"]),
("Kalngale Nudist Beach","Riga",["Kalngale","Vecaki","Vecāķi"]),
("Luitpoldpark / Scheidplatz","Munich",["Luitpoldpark","Scheidplatz","Luitpold Park"]),
("Donauinsel Nordstrand (FKK Nord)","Vienna",["Donauinsel","Nordstrand","FKK Gelände Nord","Toter Grund"])
]
def n(s):return re.sub(r"[^a-z0-9]+"," ",str(s or "").casefold()).strip()
for name,city,aliases in pairs:
 exact=[]; candidates=[]
 for r in rows:
  rn=r.get("Name","");rc=r.get("City","")
  samecity=(n(rc)==n(city) or (city=="Costa da Caparica" and any(k in n(rc) for k in ("caparica","almada","lisbon"))) or (city=="Riga" and any(k in n(rc) for k in ("riga","kalngale","carnikava"))))
  match=any(n(a) in n(rn) or n(rn) in n(a) for a in aliases if len(n(a))>4 and len(n(rn))>4)
  if match:
   v={"Venue_ID":r.get("Venue_ID"),"Name":rn,"City":rc,"Country":r.get("Country"),"Category":r.get("Category"),"Status":r.get("Status")}
   candidates.append(v)
   if samecity:exact.append(v)
 print(json.dumps({"target":name,"city":city,"same_city_alias_matches":exact,"all_cities_alias_matches":candidates[:10]},ensure_ascii=False))
