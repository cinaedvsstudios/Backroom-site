/* Backroom Admin Insights Export v0.24.2 — read-only, browser-generated TXT briefing. */
(() => {
'use strict';
if(window.BackroomAdminInsights)return;
const PERIODS=[
 {key:'30',label:'Last 30 days',days:30},
 {key:'60',label:'Last 60 days',days:60},
 {key:'90',label:'Last 90 days',days:90},
 {key:'6m',label:'Last 6 months',months:6},
 {key:'all',label:'All time'}
];
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const missing=v=>v===undefined||v===null||(typeof v==='string'&&!v.trim())||(Array.isArray(v)&&v.length===0);
const fmt=n=>Number(n||0).toLocaleString('en-GB');
const pct=(n,total)=>total?(100*n/total).toFixed(1)+'%':'n/a';
const ukDate=stamp=>new Date(stamp).toLocaleString('en-GB',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'});
const day=stamp=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const readDate=v=>{
 if(missing(v))return null;
 const s=text(v);
 const legacy=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
 if(legacy){
  const d=new Date(Date.UTC(+legacy[3],+legacy[2]-1,+legacy[1],+(legacy[4]||12),+(legacy[5]||0)));
  return d.getUTCFullYear()===+legacy[3]&&d.getUTCMonth()===+legacy[2]-1&&d.getUTCDate()===+legacy[1]?d.getTime():null;
 }
 const result=Date.parse(s);
 return Number.isFinite(result)?result:null;
};
const dateText=v=>{const t=readDate(v);return t===null?'unknown':day(t);};
const status=r=>text(r.Status)||'(missing)';
const cruise=r=>norm(r.Category)==='cruising area';
const fld=(r,...keys)=>keys.map(k=>r[k]).find(v=>!missing(v))||'';
const tally=(items,fn)=>{
 const m=new Map();items.forEach(x=>{const k=text(fn(x))||'(missing)';m.set(k,(m.get(k)||0)+1);});
 return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
};
const counter=(m,k,n=1)=>m.set(k,(m.get(k)||0)+n);
const clean=v=>text(v).replace(/[\t\r\n]+/g,' ').replace(/\s{2,}/g,' ');
const line=(...s)=>s.map(x=>clean(x)).join(' | ');
const metricLines=(items,base)=>items.map(([name,count])=>'  '+name+': '+fmt(count)+(base!==undefined?' ('+pct(count,base)+')':''));
const section=(out,title)=>{out.push('', '============================================================',title,'============================================================');};
const sampleList=(arr,fn)=>arr.map((x,i)=>'  '+(i+1)+'. '+fn(x));
const normalDate=value=>{const t=readDate(value);return t===null?'—':day(t);};
function periodBounds(period,at){
 let start=null;
 if(period.days)start=at-period.days*86400000;
 else if(period.months){const d=new Date(at);d.setUTCMonth(d.getUTCMonth()-period.months);start=d.getTime();}
 return {start,end:at,inWindow:v=>{const t=readDate(v);return t!==null&&(start===null||t>=start)&&t<=at;}};
}
async function optionalResource(path,kind){
 try{
  const response=await fetch(path+'?insights='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  return {ok:true,data:kind==='json'?await response.json():await response.text()};
 }catch(e){return {ok:false,error:e.message||String(e)};}
}
function rowsFromState(){
 const P=window.BRP2;
 if(!P?.state||!Array.isArray(P.state.venues)||!Array.isArray(P.state.events)||!P.state.registry)throw Error('Open Data & Analytics and wait for working records to finish loading.');
 return {venues:P.state.venues,events:P.state.events,registry:P.state.registry};
}
async function readLogs(){
 try{
  if(!window.BackroomAdminReporting?.getHistory)return {logs:[],error:'History API unavailable'};
  const logs=await window.BackroomAdminReporting.getHistory();
  return {logs:Array.isArray(logs)?logs:[],error:null};
 }catch(e){return {logs:[],error:e.message||String(e)};}
}
function getQualityHistory(){
 try{const x=JSON.parse(localStorage.getItem('br_admin_completeness_log_v2')||'[]');return Array.isArray(x)?x:[];}
 catch{return[];}
}
const dateName=(r,linked)=>{
 const country=fld(r,'Country','Event_Country','Venue_Country','Location_Country')||linked?.Country||'(unknown)';
 const city=fld(r,'City','Event_City','Venue_City','Location_City')||linked?.City||'(unknown)';
 return {country:text(country),city:text(city)};
};
function buildIndex(venues){return new Map(venues.map(r=>[text(r.Venue_ID),r]));}
function datasetCompleteness(rows,fields){
 const total=rows.length;
 return fields.map(k=>{
  const found=rows.filter(r=>!missing(r[k])).length;
  return '  '+k.padEnd(28,' ')+' '+String(found).padStart(6,' ')+'/'+String(total).padEnd(6,' ')+' '+pct(found,total)+' present; '+fmt(total-found)+' missing';
 });
}
function keysCompleteness(rows){
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].sort();
 return datasetCompleteness(rows,keys);
}
function sanitizeUrl(v){return text(v).replace(/\s+/g,'');}
function eventDesc(r){return text(r.Event_Name)||'(unnamed event)';}
function venueDesc(r){return text(r.Name)||'(unnamed venue)';}
function exportFile(content,period){
 const stamp=day(Date.now()),filename='backroom_insights_'+period.key+'_'+stamp+'.txt';
 const blob=new Blob(['\ufeff'+content],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
 return filename;
}
async function build(period){
 const source=rowsFromState(),venues=source.venues,events=source.events,registry=source.registry;
 const at=Date.now(),windowed=periodBounds(period,at),forward90=at+90*86400000,windowFrom=windowed.start===null?'earliest recorded date':day(windowed.start);
 const [logResult,picks,festivals,sitemap,robots,home]=await Promise.all([
  readLogs(),optionalResource('picks.json','json'),optionalResource('festivals.json','json'),
  optionalResource('sitemap.xml','text'),optionalResource('robots.txt','text'),optionalResource('index.html','text')
 ]);
 const logs=logResult.logs.slice().sort((a,b)=>(readDate(a.date)||0)-(readDate(b.date)||0));
 const recentLogs=logs.filter(x=>windowed.inWindow(x.date));
 const quality=getQualityHistory(),recentQuality=quality.filter(x=>windowed.inWindow(x.date));
 const venueIndex=buildIndex(venues),allRows=[...venues,...events],realVenues=venues.filter(r=>!cruise(r)),cruising=venues.filter(cruise);
 const eventLoc=r=>dateName(r,venueIndex.get(text(r.Venue_ID)));
 const venueLoc=r=>dateName(r);
 const editedVenues=venues.filter(r=>windowed.inWindow(r.Last_Updated));
 const editedEvents=events.filter(r=>windowed.inWindow(r.Last_Updated));
 const newVenues=venues.filter(r=>windowed.inWindow(r.Created_At));
 const newEvents=events.filter(r=>windowed.inWindow(r.Created_At));
 const occurred=events.filter(r=>windowed.inWindow(r.Event_Date));
 const upcoming=events.filter(r=>{const d=readDate(r.Event_Date);return d!==null&&d>=at&&d<=forward90;});
 const statusCounts=(arr)=>metricLines(tally(arr,status),arr.length);
 const nowYear=day(at).slice(0,4);
 const out=[];
 out.push('BACKROOM — COMPREHENSIVE ADMIN INSIGHTS REPORT',
  'Generated: '+ukDate(at)+' (Europe/Berlin)',
  'Selected historical window: '+period.label+' ('+windowFrom+' to '+day(at)+')',
  'Project: https://cinaedvsstudios.github.io/Backroom-site/',
  'Repository: https://github.com/cinaedvsstudios/Backroom-site',
  'Format: Plain-text analytic briefing for another ChatGPT conversation.',
  '',
  'IMPORTANT METHODOLOGY',
  '- CURRENT SNAPSHOT sections always describe the working records loaded in this browser at export time. They are NOT historical counts.',
  '- PERIOD ACTIVITY includes entries whose own recorded timestamp/date falls in the selected period. Last_Updated is not proof of creation, publication, traffic or independent verification.',
  '- Imported/edited dates may be bulk timestamps or older legacy formats (including DD-MM-YYYY CET). Event_Date reflects stored dates, not necessarily real attendance.',
  '- Reporting history exists locally in this browser; it may be incomplete, and it distinguishes working-draft changes from independently captured published totals.',
  '- Website visits, click-throughs, impressions, search ranking, Instagram reach, follows, engagement, conversions and user demographics are NOT captured by these JSON files or Admin Reporting.',
  '- The Views and Public_Rating fields are placeholders or unverified per-record values, NOT authoritative traffic or public engagement analytics.',
  '- SEO diagnostics below check presence of assets/fields and page metadata only. They do not demonstrate indexation, rankings, search demand, or crawler behavior.',
  '- No original data file has been modified by this export.');
 section(out,'01 | EXECUTIVE SNAPSHOT — ENTIRE CURRENT DATABASE');
 out.push('Venue records: '+fmt(realVenues.length),
  'Cruising area records: '+fmt(cruising.length),
  'Total listings.json rows: '+fmt(venues.length),
  'Event records: '+fmt(events.length),
  'Total venue/area/event records: '+fmt(allRows.length),
  'Countries represented by data: '+fmt(new Set(allRows.map(r=>norm(r.Event_ID?eventLoc(r).country:venueLoc(r).country)).filter(Boolean)).size),
  'Venue categories: '+fmt(new Set(venues.map(r=>norm(r.Category)).filter(Boolean)).size),
  'Current venue/area statuses:');
 out.push(...statusCounts(venues),'Current event statuses:',...statusCounts(events));
 section(out,'02 | ACTIVITY WITHIN SELECTED HISTORICAL WINDOW');
 out.push('Window: '+windowFrom+' through '+day(at),
  'Venues/areas with Last_Updated in window: '+fmt(editedVenues.length)+' / '+fmt(venues.length),
  'Events with Last_Updated in window: '+fmt(editedEvents.length)+' / '+fmt(events.length),
  'Venues/areas with usable Created_At in window: '+fmt(newVenues.length),
  'Events with usable Created_At in window: '+fmt(newEvents.length),
  'Stored event rows with Event_Date in window: '+fmt(occurred.length),
  'Stored event rows scheduled in next 90 days (separate forward-looking period): '+fmt(upcoming.length),
  'NOTE: Edited records are not new-record counts; events with recurrent schedules are counted as stored records only.',
  '',
  'Activity by Last_Updated month:');
 const monthBuckets=new Map();
 for(const [type,list] of [['venues/areas',editedVenues],['events',editedEvents]]){
  for(const r of list){const m=normalDate(r.Last_Updated).slice(0,7),key=m+' | '+type;counter(monthBuckets,key);}
 }
 out.push(...metricLines([...monthBuckets].sort((a,b)=>a[0].localeCompare(b[0]))));
 out.push('Scheduled event dates within selected period (monthly):');
 out.push(...metricLines(tally(occurred,r=>normalDate(r.Event_Date).slice(0,7))));
 section(out,'03 | DATABASE GROWTH, SAVED SNAPSHOTS AND QUERY HISTORY');
 out.push('Saved IndexedDB history entries (all time): '+fmt(logs.length),
  'Saved history entries in selected window: '+fmt(recentLogs.length),
  logResult.error?'History read note: '+logResult.error:'',
  'IMPORTANT: Logged changes are operations, not distinct unique records or verified public site traffic.');
 const operations=recentLogs.filter(r=>r.type==='change');
 const captures=recentLogs.filter(r=>r.type==='snapshot');
 const queries=recentLogs.filter(r=>r.type==='query');
 out.push('Changes in window: '+fmt(operations.length),
 'Published-data captures in window: '+fmt(captures.length),
 'Query/check executions in window: '+fmt(queries.length),
 'Operation totals (may overlap when records are edited repeatedly):');
 out.push('  Added: '+fmt(operations.reduce((s,x)=>s+number(x.added),0)),
 '  Modified: '+fmt(operations.reduce((s,x)=>s+number(x.modified),0)),
 '  Removed: '+fmt(operations.reduce((s,x)=>s+number(x.removed),0)));
 const pub=captures.filter(x=>Number.isFinite(Number(x.after?.venues))&&Number.isFinite(Number(x.after?.events))).sort((a,b)=>readDate(a.date)-readDate(b.date));
 if(pub.length>=2){
  const first=pub[0],last=pub[pub.length-1];
  out.push('PUBLISHED capture-to-capture comparison (two saved observations inside window):',
   '  First ('+ukDate(readDate(first.date))+'): '+fmt(first.after.venues)+' venues / '+fmt(first.after.cruising)+' cruising / '+fmt(first.after.events)+' events',
   '  Last ('+ukDate(readDate(last.date))+'): '+fmt(last.after.venues)+' venues / '+fmt(last.after.cruising)+' cruising / '+fmt(last.after.events)+' events',
   '  Difference: '+(number(last.after.venues)-number(first.after.venues))+' venues; '+(number(last.after.cruising)-number(first.after.cruising))+' cruising; '+(number(last.after.events)-number(first.after.events))+' events');
 }else out.push('Published growth comparison: unavailable; fewer than two published captures inside the selected window.');
 out.push('Chronological operations / captures (selected window):');
 if(!operations.length&&!captures.length)out.push('  No logged operations or captures in this window.');
 for(const x of recentLogs.filter(y=>y.type==='change'||y.type==='snapshot')){
  out.push('  '+line(ukDate(readDate(x.date)||at),x.type,x.mode||'',x.operation||'', 'before '+JSON.stringify(x.before||{}),'after '+JSON.stringify(x.after||{}),'added '+number(x.added),'modified '+number(x.modified),'removed '+number(x.removed)));
 }
 out.push('Executed queries in selected window:');
 if(!queries.length)out.push('  No saved query executions.');
 for(const x of queries)out.push('  '+line(ukDate(readDate(x.date)||at),x.scope||'',x.query||'', 'examined '+fmt(x.examined), 'matched '+fmt(x.matched),'downloaded '+!!x.downloaded));
 out.push('Quality Checks panel run history (localStorage): '+fmt(quality.length)+' all-time / '+fmt(recentQuality.length)+' in selected window');
 for(const x of recentQuality)out.push('  '+line(ukDate(readDate(x.date)||at),x.type,x.check,x.country||'all countries',x.city||'all cities',x.status||'all statuses','examined '+fmt(x.examined),'matched '+fmt(x.matched),'percent '+x.percent,'exported '+!!x.downloaded));
 section(out,'04 | COUNTRY AND CITY COVERAGE — CURRENT SNAPSHOT');
 const countryNames=new Map((registry.countries||[]).map(x=>[x.code,x.name]));
 const countryCode=new Map((registry.countries||[]).map(x=>[norm(x.name),x.code]));
 const aliases=registry.aliases||{};
 Object.entries(aliases).forEach(([name,canonical])=>{const code=countryCode.get(norm(canonical));if(code)countryCode.set(norm(name),code);});
 const eligible=window.BackroomPhase3Presets?.codes||new Set();
 const geo=new Map(),perCountry=new Map();
 const geoKey=(country,city)=>norm(country)+'|'+norm(city);
 const addGeo=(location,kind,registered=false)=>{
  const c=location.country,city=location.city;
  const code=countryCode.get(norm(c))||'';
  const name=countryNames.get(code)||c;
  const names=text(city).split(/[;|]/).map(x=>text(x)).filter(Boolean);
  for(const target of names.length?names:['(city not supplied)']){
   const key=geoKey(name,target);
   let e=geo.get(key);
   if(!e){e={country:name,city:target,code,registered:false,venues:0,cruising:0,events:0};geo.set(key,e);}
   if(registered)e.registered=true;
   else e[kind]++;
  }
 };
 const eligibleSeeds=(registry.cities||[]).filter(x=>eligible.has(x.country_code));
 for(const x of eligibleSeeds)addGeo({country:countryNames.get(x.country_code)||x.country_code,city:x.name},'',true);
 for(const r of venues)addGeo(venueLoc(r),cruise(r)?'cruising':'venues');
 for(const r of events)addGeo(eventLoc(r),'events');
 const geoRows=[...geo.values()].map(x=>({...x,total:x.venues+x.cruising+x.events,eligible:eligible.has(x.code)}));
 for(const x of geoRows){
  const entry=perCountry.get(x.country)||{country:x.country,venues:0,cruising:0,events:0,cities:0,zeros:0,eligible:x.eligible};
  entry.venues+=x.venues;entry.cruising+=x.cruising;entry.events+=x.events;entry.cities++;
  if(!x.total)entry.zeros++;
  perCountry.set(x.country,entry);
 }
 out.push('Eligible geographic scope: '+fmt(eligible.size)+' European/territory + Turkey/Israel country codes.',
  'Eligible registered destinations: '+fmt(eligibleSeeds.length),
  'Distinct destinations across eligible seeds + all loaded records: '+fmt(geoRows.length),
  'Eligible seeded destinations with zero matching stored records: '+fmt(geoRows.filter(x=>x.eligible&&x.registered&&!x.total).length),
  'Out-of-scope destination rows in working records (not removed): '+fmt(geoRows.filter(x=>!x.eligible&&x.total).length),
  'NOTE: A record with multiple cities is counted against each city. Country geographic sums may exceed unique record totals.',
  'Country overview (all countries with data, plus allowed registry countries):');
 const countryRows=[...perCountry.values()].sort((a,b)=>(b.venues+b.cruising+b.events)-(a.venues+a.cruising+a.events)||a.country.localeCompare(b.country));
 for(const x of countryRows)out.push('  '+line(x.country,x.eligible?'in scope':'outside scope','venues '+x.venues,'cruising '+x.cruising,'events '+x.events,'destinations '+x.cities,'zero '+x.zeros));
 out.push('ALL destinations with record counts (includes uncovered registry seeds):');
 for(const x of geoRows.sort((a,b)=>a.country.localeCompare(b.country)||a.city.localeCompare(b.city))){
  out.push('  '+line(x.country,x.city,'venues '+x.venues,'cruising '+x.cruising,'events '+x.events,x.registered?'in registry':'not in registry',x.eligible?'eligible':'outside scope'));
 }
 section(out,'05 | CATEGORIES, AUDIENCE FEATURES AND EDITORIAL TOPICS');
 out.push('Venue/area category distribution:',...metricLines(tally(venues,r=>r.Category),venues.length));
 out.push('Event category distribution:',...metricLines(tally(events,r=>r.Event_Category),events.length));
 const tags=new Map();
 for(const row of allRows){
  const value=row.Vibe_Tags;
  const parts=(Array.isArray(value)?value:text(value).split(',')).map(norm).filter(Boolean);
  for(const k of new Set(parts))counter(tags,k);
 }
 out.push('Tag frequency across current records (a record may have several tags):',
 ...metricLines([...tags].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))));
 const featureKeys=[...new Set(venues.flatMap(x=>Object.keys(x).filter(k=>k.startsWith('Feature_'))))].sort();
 out.push('Venue/area feature counts (true flags only):');
 for(const k of featureKeys)out.push('  '+k+': '+fmt(venues.filter(r=>r[k]===true||norm(r[k])==='true').length)+' / '+fmt(venues.length));
 out.push('Venues with public-facing Instagram URL: '+fmt(venues.filter(r=>!missing(r.Instagram_URL)).length),
  'Venues with Facebook URL: '+fmt(venues.filter(r=>!missing(r.Facebook_URL)).length),
  'Venues with official Website_URL: '+fmt(venues.filter(r=>!missing(r.Website_URL)).length),
  'Events with an Event_URL: '+fmt(events.filter(r=>!missing(r.Event_URL)).length),
  'Events with Ticket_URL: '+fmt(events.filter(r=>!missing(r.Ticket_URL)).length),
  'Events with Price_Info: '+fmt(events.filter(r=>!missing(r.Price_Info)).length));
 section(out,'06 | CURRENT QUALITY / SEO-READINESS AUDIT');
 out.push('These are presence / formatting checks on WORKING DATA, not published SERP results.',
 'Venue and cruising completeness of selected fields:');
 out.push(...datasetCompleteness(venues,['Venue_ID','Name','City','Country','Category','Status','Address','Postcode','Nearest_Station','Latitude','Longitude','Google_Maps_URL','Native_Map_Query','Website_URL','Instagram_URL','Facebook_URL','Source_URLs','Image_URL','Description','Vibe_Tags','Opening_Days','Opening_Open_Time','Last_Updated']));
 out.push('Event completeness of selected fields:');
 out.push(...datasetCompleteness(events,['Event_ID','Event_Name','Venue_ID','Venue_Name','City','Country','Event_Date','Event_Start_Time','Event_End_Time','Status','Event_Description','Event_Category','Event_URL','Ticket_URL','Source_URLs','Vibe_Tags','Price_Info','Last_Updated']));
 const dupIds=(rows,key)=>tally(rows,r=>r[key]).filter(x=>x[0]!=='(missing)'&&x[1]>1);
 const invalidDays=(rows,key)=>rows.filter(r=>missing(r[key])||readDate(r[key])===null);
 const linkIssues=events.filter(r=>!missing(r.Venue_ID)&&!venueIndex.has(text(r.Venue_ID)));
 out.push('Other checks:',
 '  Duplicate Venue_ID values: '+fmt(dupIds(venues,'Venue_ID').length),
 '  Duplicate Event_ID values: '+fmt(dupIds(events,'Event_ID').length),
 '  Events with Venue_ID that cannot be linked to working venue records: '+fmt(linkIssues.length),
 '  Venue/area records with absent or unparseable Last_Updated: '+fmt(invalidDays(venues,'Last_Updated').length),
 '  Event records with absent or unparseable Last_Updated: '+fmt(invalidDays(events,'Last_Updated').length),
 '  Events with absent/unparseable Event_Date: '+fmt(invalidDays(events,'Event_Date').length),
 '  Venue descriptions under 100 characters: '+fmt(venues.filter(x=>text(x.Description).length<100).length),
 '  Event descriptions under 100 characters: '+fmt(events.filter(x=>text(x.Event_Description).length<100).length),
 '  Venues missing both image and official website: '+fmt(venues.filter(x=>missing(x.Image_URL)&&missing(x.Website_URL)).length),
 '  Events without venue link and without Event_Location: '+fmt(events.filter(x=>missing(x.Venue_ID)&&missing(x.Event_Location)).length));
 out.push('FULL observed-field completeness (all keys found anywhere in dataset):',
 'Venue/area fields:',...keysCompleteness(venues),
 'Event fields:',...keysCompleteness(events));
 section(out,'07 | EVENT CALENDAR, SERIES AND CONTENT OPPORTUNITIES');
 out.push('Stored events with dates within selected past window: '+fmt(occurred.length),
 'Stored events in upcoming 90 days: '+fmt(upcoming.length),
 'NOTE: This is not an attendance forecast. Weekly recurrence is not automatically expanded here.',
 'Past-window events by country:',...metricLines(tally(occurred,r=>eventLoc(r).country)),
 'Upcoming 90-day events by country:',...metricLines(tally(upcoming,r=>eventLoc(r).country)),
 'Upcoming 90-day events by month:',...metricLines(tally(upcoming,r=>normalDate(r.Event_Date).slice(0,7))));
 const group=new Map();
 for(const e of events){
  const key=norm(eventLoc(e).country)+'|'+norm(e.Venue_ID)+'|'+norm(e.Event_Series||e.Event_Series_Name||e.Event_Name||'');
  const g=group.get(key)||{name:e.Event_Series||e.Event_Series_Name||e.Event_Name||'(unnamed)',country:eventLoc(e).country,venue:e.Venue_Name||'',count:0};
  g.count++;group.set(key,g);
 }
 const repeated=[...group.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count);
 out.push('Repeated event-name groups (heuristic; not confirmed follows/series): '+fmt(repeated.length),
  ...repeated.map(x=>'  '+line(x.name,x.country,x.venue,x.count+' stored events')));
 out.push('Event recurrence flags:',...metricLines(tally(events,r=>r.Recurrence_Type),events.length));
 out.push('Past-window event rows (exact stored dates and IDs):');
 if(!occurred.length)out.push('  No stored event rows with dates inside this period.');
 for(const e of occurred.slice().sort((a,b)=>(readDate(a.Event_Date)||0)-(readDate(b.Event_Date)||0)))out.push('  '+line(normalDate(e.Event_Date),e.Event_ID,eventDesc(e),eventLoc(e).city,eventLoc(e).country,status(e),e.Venue_Name||'',text(e.Event_URL)||text(e.Ticket_URL)));
 out.push('Upcoming 90-day event rows (stored dates; not independently verified):');
 if(!upcoming.length)out.push('  No dated upcoming event rows in this span.');
 for(const e of upcoming.slice().sort((a,b)=>(readDate(a.Event_Date)||0)-(readDate(b.Event_Date)||0)))out.push('  '+line(normalDate(e.Event_Date),e.Event_ID,eventDesc(e),eventLoc(e).city,eventLoc(e).country,status(e),e.Venue_Name||'',text(e.Event_URL)||text(e.Ticket_URL)));
 section(out,'08 | FEATURED PICKS, FESTIVALS AND WEBSITE SEO ASSETS');
 if(picks.ok&&picks.data&&typeof picks.data==='object'){
  const p=picks.data;
  out.push('Published picks.json: loaded','Picks week start: '+text(p.Week_Start),
   'Picks week end: '+text(p.Week_End),'Last updated: '+text(p.Last_Updated),
   'Featured venues: '+fmt(Array.isArray(p.Venues)?p.Venues.length:0),
   'Featured events: '+fmt(Array.isArray(p.Events)?p.Events.length:0));
  for(const type of ['Venues','Events'])for(const r of (Array.isArray(p[type])?p[type]:[]))out.push('  '+line('Featured '+type,r.Event_ID||r.Venue_ID||r.ID||'',r.Date||r.Event_Date||'',r.Name||r.Event_Name||''));
 }else out.push('picks.json not available: '+(picks.error||'invalid structure'));
 const fest=festivals.ok?(Array.isArray(festivals.data)?festivals.data:[]):[];
 out.push('Published festivals.json records: '+(festivals.ok?fmt(fest.length):'not available ('+festivals.error+')'));
 for(const f of fest)out.push('  '+line(f.Festival_ID,f.Festival_Name,f.Festival_Start_Date,f.Festival_End_Date,f.City||'',f.Country||'',f.Status||''));
 if(sitemap.ok){
  const urls=[...sitemap.data.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(x=>x[1]);
  out.push('Published sitemap.xml URL entries: '+fmt(urls.length),
   'Sitemap venue detail URL entries: '+fmt(urls.filter(x=>/\/venue[s]?\//i.test(x)).length),
   'Sitemap event detail URL entries: '+fmt(urls.filter(x=>/\/event[s]?\//i.test(x)).length),
   'Sitemap sample URLs:',...urls.slice(0,12).map(x=>'  '+x));
 }else out.push('Sitemap check unavailable: '+sitemap.error);
 if(robots.ok)out.push('Published robots.txt text:',robots.data.slice(0,3000));
 else out.push('Robots check unavailable: '+robots.error);
 if(home.ok)out.push('Published index.html static metadata presence:',
  '  Description meta: '+/<meta\s+name=["']description["']/i.test(home.data),
  '  Canonical link: '+/rel=["']canonical["']/i.test(home.data),
  '  Open Graph title: '+/property=["']og:title["']/i.test(home.data),
  '  Open Graph image: '+/property=["']og:image["']/i.test(home.data),
  '  Social/Twitter card meta: '+/(name=["']twitter:card["']|property=["']twitter:card["'])/i.test(home.data),
  '  JSON-LD structured data: '+/application\/ld\+json/i.test(home.data),
  '  html lang attribute: '+/<html[^>]+\blang=/i.test(home.data));
 else out.push('Homepage metadata check unavailable: '+home.error);
 section(out,'09 | MARKETING & INSTAGRAM ANALYSIS — AVAILABLE VS MISSING');
 out.push('Content inventory available: venue/event/festival names, cities, countries, categories, dates, text descriptions, ticket/official URLs, tags, feature flags, editorial picks.',
  'Audience/marketing data NOT available through this export:',
  '  - Website sessions, unique users, referral channels, landing pages, Google Analytics or Search Console results.',
  '  - Search impressions, search clicks, ranking keywords, indexed page counts, SEO conversion rates.',
  '  - Instagram followers, reach, impressions, plays, likes, comments, saves, shares, profile visits or link clicks.',
  '  - Newsletter subscribers, push notification opt-ins or real conversion funnels.',
  '  - Competitor performance, audience geography, demographic behavior or user retention.',
  '  - True page-view metrics (record Views may exist but are not independently verified).',
  '  - Real historical daily database totals unless recorded in local Reporting history.',
  'Analytical use: combine these content and coverage figures with separately exported Instagram Insights, Metricool, Google Search Console or website analytics when assessing actual marketing performance.');
 section(out,'10 | COMPACT CURRENT RECORD INVENTORY — FOR CONTEXT');
 out.push('This section includes every current record identity and essential published-facing fields; it is NOT a substitute for the original full JSON files.',
  'VENUES + CRUISING AREAS (all '+fmt(venues.length)+'):');
 for(const r of venues)out.push('  '+line(r.Venue_ID,venueDesc(r),r.Category,venueLoc(r).city,venueLoc(r).country,status(r),'updated '+text(r.Last_Updated),'website '+(missing(r.Website_URL)?'missing':'present'),'social '+(missing(r.Instagram_URL)?'missing':'present')));
 out.push('EVENTS (all '+fmt(events.length)+'):');
 for(const e of events)out.push('  '+line(e.Event_ID,normalDate(e.Event_Date),eventDesc(e),eventLoc(e).city,eventLoc(e).country,status(e),'venue '+text(e.Venue_ID),'updated '+text(e.Last_Updated)));
 section(out,'11 | HANDOFF BRIEF FOR CHATGPT');
 out.push('Suggested question when uploading this TXT report:',
  '"Please analyze this Backroom Admin Insights Report. First distinguish current database snapshot metrics, recorded historical changes, and missing analytics. Evaluate geographic coverage, event calendar depth, data quality and search-engine readiness. Recommend realistic priorities for on-site SEO, organic discovery, Instagram content planning, promotions and engagement measurement. Ground every claim in these figures and do not interpret JSON record counts as website traffic or Instagram growth."',
  '',
  'End of report. Generated from local working records, available admin history and selected public support files.');
 return out.filter(x=>x!==undefined&&x!==null).join('\n')+'\n';
}
let busy=false;
async function download(periodKey,button,details){
 if(busy)return;
 const period=PERIODS.find(x=>x.key===periodKey);
 if(!period)return;
 busy=true;
 const saved=button.textContent;
 button.disabled=true;button.textContent='Preparing report…';
 try{
  const report=await build(period);
  const filename=exportFile(report,period);
  details.open=false;
  if(typeof showToast==='function')showToast('Downloaded '+filename);
 }catch(error){
  console.error('Backroom Insights export:',error);
  if(typeof showToast==='function')showToast('Insights export failed: '+error.message);
  else alert('Insights export failed: '+error.message);
 }finally{
  button.disabled=false;button.textContent=saved;busy=false;
 }
}
function install(){
 const bar=document.querySelector('#br-phase2-view .br-p2-actions');
 if(!bar||document.getElementById('br-insights-export'))return;
 const details=document.createElement('details');details.id='br-insights-export';
 details.className='br-insights-export';
 const summary=document.createElement('summary');
 summary.className='btn primary-btn pill-btn';
 summary.textContent='⬇ Download Insights Report ▾';
 summary.title='Export an AI-ready TXT report of database content, selected history and SEO/marketing readiness';
 details.appendChild(summary);
 const menu=document.createElement('div');menu.className='br-insights-menu';
 menu.setAttribute('role','group');menu.setAttribute('aria-label','Choose report period');
 for(const period of PERIODS){
  const button=document.createElement('button');
  button.type='button';button.className='br-insights-option';
  button.textContent=period.label;button.dataset.insightsWindow=period.key;
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();download(period.key,button,details);});
  menu.appendChild(button);
 }
 details.appendChild(menu);
 const refresh=bar.querySelector('#br-p2-refresh');
 if(refresh)refresh.insertAdjacentElement('afterend',details);else bar.prepend(details);
 const css=document.createElement('style');css.textContent=[
  '#br-insights-export{position:relative;flex:0 0 auto;min-width:230px;z-index:60}',
  '#br-insights-export summary{display:flex;align-items:center;justify-content:center;list-style:none;cursor:pointer;min-height:37px;padding:10px 14px;font-size:13px;white-space:nowrap}',
  '#br-insights-export summary::-webkit-details-marker{display:none}',
  '#br-insights-export .br-insights-menu{position:absolute;z-index:100;left:0;top:calc(100% + 6px);width:100%;min-width:235px;padding:6px;background:#111725;border:1px solid #2ca8d4;border-radius:10px;box-shadow:0 10px 27px rgba(0,0,0,.5)}',
  '#br-insights-export .br-insights-option{display:block;width:100%;text-align:left;background:transparent;color:#e9f2fc;border:0;border-radius:6px;cursor:pointer;padding:11px 12px;font-family:inherit;font-size:13px}',
  '#br-insights-export .br-insights-option:hover,#br-insights-export .br-insights-option:focus{background:#20516a;color:#fff;outline:1px solid #2ca8d4}',
  '#br-insights-export .br-insights-option:disabled{opacity:.6;cursor:wait}',
  '@media(max-width:600px){#br-insights-export{max-width:100%;width:100%}#br-insights-export .br-insights-menu{width:100%}}'
 ].join('\n');document.head.appendChild(css);
 document.addEventListener('click',event=>{if(details.open&&!details.contains(event.target))details.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')details.open=false;});
}
window.BackroomAdminInsights={install,build,periods:PERIODS,version:'0.24.2'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
})();