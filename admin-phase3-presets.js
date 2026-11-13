/* Backroom Phase 3 presets — European / Israel / Türkiye research scope and guided selections.
   Tourism selections are editorial coverage choices, not an invented official city-arrival ranking. */
(()=>{'use strict';
if(window.BackroomPhase3Presets)return;
const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uniq=values=>[...new Set(values.filter(Boolean))];
const codes=new Set(('AL AD AT AX BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IL IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH TR UA GB VA').split(' '));
const aliases=new Map([['türkiye','Turkey'],['turkiye','Turkey'],['great britain','United Kingdom'],['england','United Kingdom'],
 ['scotland','United Kingdom'],['wales','United Kingdom'],['northern ireland','United Kingdom'],
 ['bosnia and herzegovina','Bosnia & Herzegovina'],['macedonia','North Macedonia'],
 ['kosovo','Kosovo'],['czech republic','Czechia'],['republic of ireland','Ireland']]);
const touristCities=[
 ['France','Paris'],['United Kingdom','London'],['Italy','Rome'],['Spain','Madrid'],['Spain','Barcelona'],
 ['Italy','Milan'],['Netherlands','Amsterdam'],['Germany','Berlin'],['Turkey','Istanbul'],['Austria','Vienna'],
 ['Czechia','Prague'],['Portugal','Lisbon'],['Greece','Athens'],['Hungary','Budapest'],['Ireland','Dublin'],
 ['Italy','Florence'],['Italy','Venice'],['Germany','Munich'],['United Kingdom','Edinburgh'],['Denmark','Copenhagen'],
 ['Sweden','Stockholm'],['Belgium','Brussels'],['Switzerland','Zurich'],['France','Nice'],['Portugal','Porto'],
 ['Poland','Krakow'],['Poland','Warsaw'],['Austria','Salzburg'],['Switzerland','Geneva'],['Italy','Naples'],
 ['Spain','Seville'],['Spain','Valencia'],['Spain','Malaga'],['Croatia','Dubrovnik'],['Croatia','Split'],
 ['Iceland','Reykjavik'],['Norway','Oslo'],['Finland','Helsinki'],['Estonia','Tallinn'],['Latvia','Riga'],
 ['Slovenia','Ljubljana'],['Bulgaria','Sofia'],['Germany','Cologne'],['Germany','Hamburg'],
 ['Spain','Torremolinos'],['Spain','Maspalomas'],['Spain','Ibiza'],['Greece','Mykonos'],
 ['Israel','Tel Aviv'],['Israel','Jerusalem']
];
const topCountries=['Spain','Italy','Turkey','France','United Kingdom','Greece','Austria','Croatia','Germany','Netherlands'];
const nightlifeCities=[
 ['Germany','Berlin'],['Germany','Cologne'],['Netherlands','Amsterdam'],['Belgium','Brussels'],
 ['United Kingdom','London'],['Spain','Madrid'],['Spain','Barcelona'],['Spain','Maspalomas'],
 ['Spain','Torremolinos'],['France','Paris'],['Italy','Rome'],['Italy','Milan'],
 ['Austria','Vienna'],['Switzerland','Zurich'],['Czechia','Prague'],['Denmark','Copenhagen'],
 ['Sweden','Stockholm'],['Portugal','Lisbon'],['Poland','Warsaw'],['Israel','Tel Aviv']
];
const islandCities=[
 ['Spain','Maspalomas'],['Spain','Playa del Inglés'],['Spain','Las Palmas'],['Spain','Tenerife'],
 ['Spain','Ibiza'],['Spain','Palma de Mallorca'],['Spain','Torremolinos'],['Spain','Sitges'],
 ['Greece','Mykonos'],['Greece','Santorini'],['Croatia','Hvar'],['Croatia','Split'],
 ['Croatia','Dubrovnik'],['Cyprus','Paphos'],['Cyprus','Larnaca'],['Malta','Valletta'],
 ['Turkey','Antalya'],['Portugal','Faro'],['France','Nice'],['United Kingdom','Brighton'],
 ['Faroe Islands','Tórshavn'],['Iceland','Reykjavik']
];
function availableCountries(registry){
 const rows=registry?.countries||[];
 return rows.filter(x=>codes.has(x.code)).sort((a,b)=>a.name.localeCompare(b.name));
}
function standardCountry(raw,registry){
 const lookup=norm(raw),canon=aliases.get(lookup)||raw;
 const record=availableCountries(registry).find(x=>norm(x.name)===norm(canon));
 return record?.name||'';
}
function permittedCountry(raw,registry){return !!standardCountry(raw,registry)}
function standardCity(raw,country,registry){
 const n=norm(raw),match=(registry?.cities||[]).find(x=>norm(x.name)===n&&
  availableCountries(registry).find(c=>c.code===x.country_code&&c.name===country));
 return match?.name||raw;
}
function locationFor(list,registry){
 return uniq(list.map(([country,city])=>{
  const found=standardCountry(country,registry);return found?found+'|'+standardCity(city,found,registry):'';
 }));
}
function liveRecord(row){const s=norm(row.Status);return !s||['live','active','open','published'].includes(s)}
function backroomTop(venues,events,registry,limit=20){
 const byID=new Map((venues||[]).map(r=>[String(r.Venue_ID||''),r])),totals=new Map();
 function add(country,city,type){
  const canonical=standardCountry(country,registry),name=String(city||'').trim();
  if(!canonical||!name||['europe','international','multiple locations','tba'].includes(norm(name)))return;
  const key=canonical+'|'+name;
  const entry=totals.get(key)||{country:canonical,city:name,venues:0,events:0,total:0};
  entry[type]++;entry.total++;totals.set(key,entry);
 }
 for(const r of venues||[]){if(liveRecord(r))add(r.Country,r.City,'venues')}
 for(const r of events||[]){if(!liveRecord(r))continue;const parent=byID.get(String(r.Venue_ID||''))||{};
  add(r.Country||parent.Country,r.City||parent.City,'events');
 }
 return[...totals.values()].sort((a,b)=>b.total-a.total||b.events-a.events||a.city.localeCompare(b.city)).slice(0,limit);
}
function emptyCities(venues,events,registry,limit=35){
 const checked=new Set();
 const byID=new Map((venues||[]).map(x=>[x.Venue_ID,x]));
 for(const r of [...(venues||[]),...(events||[])]){
  const loc=r.Event_ID?byID.get(r.Venue_ID)||{}:{};
  const country=standardCountry(r.Country||loc.Country,registry),city=r.City||loc.City;
  if(country&&city)checked.add(norm(country+'|'+city));
 }
 const countryByCode=new Map(availableCountries(registry).map(c=>[c.code,c.name]));
 return(registry?.cities||[]).filter(x=>countryByCode.has(x.country_code)).filter(x=>
  !checked.has(norm(countryByCode.get(x.country_code)+'|'+x.name)))
  .filter(x=>(x.kinds||[]).some(k=>['capital','secondary','tourist','travel-destination','resort'].some(s=>norm(k).includes(s))))
  .slice(0,limit).map(x=>[countryByCode.get(x.country_code),x.name]);
}
const definitions=[
 {id:'tourist50',name:'50 popular tourist cities',icon:'🌆',description:'Curated European visitor destinations, including Canary Islands, Istanbul and Israel; not a measured 1–50 arrival ranking.',kind:'cities'},
 {id:'countries10',name:'10 major tourist countries',icon:'🌍',description:'2025 international visitor nights (one UK figure is 2024). Selects all cities in these countries.',kind:'countries'},
 {id:'backroom20',name:'Top 20 Backroom cities',icon:'🔥',description:'Calculated live from Backroom venue + event records (active/live entries).',kind:'cities'},
 {id:'nightlife',name:'Gay nightlife & Pride hubs',icon:'🌈',description:'20 established European and Israel-based gay nightlife destinations; editorial selection.',kind:'cities'},
 {id:'islands',name:'Islands & holiday resorts',icon:'🏖️',description:'22 island, coastal and holiday locations, including Maspalomas and the Faroe Islands.',kind:'cities'},
 {id:'capitals',name:'All capital cities',icon:'🏛️',description:'Capital cities in your allowed Europe + Israel/Turkey coverage.',kind:'cities'},
 {id:'gaps',name:'35 uncovered cities',icon:'🔍',description:'Up to 35 relevant cities with no existing venue/event listing; research leads only.',kind:'cities'},
 {id:'all',name:'All eligible countries',icon:'🗺️',description:'All European countries/territories plus Turkey and Israel. Broad research scope.',kind:'countries'}
];
function selection(id,{registry,venues=[],events=[]}={}){
 const valid=availableCountries(registry);
 let cities=[],countries=[],details=[];
 if(id==='tourist50')cities=locationFor(touristCities,registry);
 else if(id==='countries10')countries=topCountries.map(x=>standardCountry(x,registry)).filter(Boolean);
 else if(id==='backroom20'){details=backroomTop(venues,events,registry,20);cities=locationFor(details.map(x=>[x.country,x.city]),registry)}
 else if(id==='nightlife')cities=locationFor(nightlifeCities,registry);
 else if(id==='islands')cities=locationFor(islandCities,registry);
 else if(id==='capitals'){
  const byCode=new Map(valid.map(x=>[x.code,x.name]));cities=locationFor(
   (registry?.cities||[]).filter(x=>byCode.has(x.country_code)&&x.kinds?.includes('capital')).map(x=>[byCode.get(x.country_code),x.name]),registry);
 }else if(id==='gaps')cities=locationFor(emptyCities(venues,events,registry),registry);
 else if(id==='all')countries=valid.map(x=>x.name);
 else throw Error('Unknown preset: '+id);
 if(cities.length)countries=uniq(cities.map(x=>x.split('|')[0]));
 return{id,countries:uniq(countries),cities,details,scope:definitions.find(x=>x.id===id)?.description||''};
}
window.BackroomPhase3Presets={codes,definitions,touristCities,topCountries,availableCountries,permittedCountry,standardCountry,locationFor,backroomTop,emptyCities,selection,version:'0.23.7'};
})();