/* Backroom Phase 3 — URL inventory, zone batching, research-only packets. */
(()=>{'use strict';if(window.BackroomPhase3Data)return;
const clean=x=>String(x??'').trim(),norm=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uniq=items=>[...new Set(items.filter(Boolean))];
function validURL(v){try{if(clean(v).length>3000)return null;const u=new URL(clean(v));return /^https?:$/.test(u.protocol)&&u.hostname?u.href:null}catch{return null}}
function keyOf(v){const url=validURL(v);if(!url)return null;const u=new URL(url);u.hostname=u.hostname.toLowerCase().replace(/^www\./,'');u.protocol='https:';u.searchParams.forEach((_,key)=>{if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key.toLowerCase()))u.searchParams.delete(key)});return u.href.replace(/\/$/,'')}
function classify(url){let host='';try{host=new URL(url).hostname}catch{};if(/instagram|facebook|tiktok|youtube|twitter|threads/.test(host))return'social';if(/maps\.|openstreetmap/.test(host))return'map';if(/eventbrite|pretix|ticket|dice\.fm|ra\.co|eventim/.test(host))return'ticket-event';if(/cruisinggays|gays-cruising|gay-szene|squirt|popcorn\.dating/.test(host))return'cruising-directory';if(/travelgay|gaycities|patroc|nighttours|nomadicboys|gaytravel4u|gaymap|spartacus|thegaypassport/.test(host))return'directory';return'website'}
function library(){
 const byKey=new Map(),errors=[];
 function add(url,c={}){
  const exact=validURL(url),key=keyOf(url);if(!exact||!key)return false;
  let v=byKey.get(key);const fresh=!v;
  if(!v){v={key,url:exact,name:clean(c.name)||new URL(exact).hostname,kind:c.kind||classify(exact),verification:'Source not live-rechecked',enabled:true,variants:[],origins:[],record_ids:[],countries:[],cities:[],workflows:[],notes:[],source_references:[]};byKey.set(key,v)}
  if(c.kind&&v.kind==='website')v.kind=c.kind;
  if(c.name&&v.name===new URL(v.url).hostname)v.name=c.name;
  if(c.verification)v.verification=c.verification;
  if(typeof c.enabled==='boolean')v.enabled=c.enabled;
  for(const [prop,values] of [['variants',[exact]],['origins',[c.provenance]],['record_ids',[c.record_id]],['countries',[c.country]],['cities',[c.city]],['workflows',c.workflows||[]],['notes',[c.note]]]){
   for(const x of values){const t=clean(x);if(t&&!v[prop].includes(t)&&(prop!=='notes'||v.notes.length<25))v[prop].push(t.slice(0,450))}
  }
  const reference=c.source_reference;
  if(reference&&typeof reference==='object'&&clean(reference.id)&&!v.source_references.some(r=>r.id===reference.id)){
   v.source_references.push({...reference});
  }
  return fresh;
 }
 return{byKey,errors,add,all:()=>[...byKey.values()],size:()=>byKey.size};
}
function urlsFrom(v){const s=clean(v);if(!s||s.length>120000)return[];const separated=s.replace(/[|,;](?=https?:\/\/)/gi,' ');return uniq([...separated.matchAll(/https?:\/\/[^\s<>"'|]+/gi)].map(m=>m[0].replace(/[),;\]}]+$/,'')).filter(validURL))}
function ingest(lib,data,origin,workflow='all'){
 const stats={origin,objects:0,occurrences:0,newUrls:0};let nodes=0;
 function walk(v,ctx={},field='',depth=0){
  if(++nodes>160000||depth>25||v==null)return;
  if(typeof v==='string'){for(const url of urlsFrom(v)){
   stats.occurrences++;if(lib.add(url,{record_id:ctx.id,country:ctx.country,city:ctx.city,workflows:[workflow],provenance:origin,
    kind:/Website_URL|Official_URL/.test(field)?'official':/Instagram_URL|Facebook_URL/.test(field)?'social':/Map.*URL/.test(field)?'map':undefined,
    note:[ctx.id,field].filter(Boolean).join(' · ')}))stats.newUrls++;
  }return}
  if(Array.isArray(v)){for(const x of v)walk(x,ctx,field,depth+1);return}
  if(typeof v!=='object')return;stats.objects++;
  const next={id:clean(v.Venue_ID||v.Event_ID||ctx.id),country:clean(v.Country||v.country||ctx.country),city:clean(v.City||v.city||ctx.city)};
  if(typeof v.url==='string'&&validURL(v.url))lib.add(v.url,{name:v.name,kind:v.kind,country:next.country,city:next.city,record_id:next.id,
    provenance:origin,workflows:Array.isArray(v.workflows)?v.workflows:[workflow],verification:v.verification,enabled:v.enabled});
  for(const [k,entry] of Object.entries(v))walk(entry,next,k,depth+1);
 }
 walk(data);return stats;
}
function ingestSeed(lib,seed){
 for(const x of seed?.sources||[]){
  lib.add(x.url,{...x,provenance:x.provenance||'Base source catalogue'});
  const refs=Array.isArray(x.source_references)&&x.source_references.length?x.source_references:[x];
  for(const ref of refs){
   lib.add(ref.url,{
    name:x.name,kind:x.kind,verification:x.verification,enabled:x.enabled,
    workflows:Array.isArray(ref.workflows)?ref.workflows:x.workflows||[],
    provenance:ref.provenance||x.provenance||'Base source catalogue',
    source_reference:{id:ref.id,url:ref.url,name:ref.name,kind:ref.kind,
      workflows:ref.workflows||[],regions:ref.regions||[],provenance:ref.provenance||'',
      verification:ref.verification||'',enabled:ref.enabled!==false},
    note:'Original seed '+(ref.id||'unidentified')+(ref.kind&&ref.kind!==x.kind?' · '+ref.kind:'')
   });
  }
 }
}
function normalizeImport(data){
 const list=Array.isArray(data)?data:data?.sources||data?.urls||data?.entries||data?.records;
 if(!Array.isArray(list))throw Error('Expected array, or sources/urls/entries/records array.');
 return list.map(v=>typeof v==='string'?{url:v}:v).filter(v=>v&&typeof v==='object'&&!Array.isArray(v))
   .map(v=>({...v,url:v.url||v.URL||v.source_url||v.Website_URL||v.Source_URL||v.link||''}));
}
function zone(country,kind){
 if(kind==='cruising')return 8;
 const c=norm(country);
 const values={0:['germany','de','deutschland'],1:['france','belgium','netherlands','luxembourg','switzerland'],2:['united kingdom','uk','ireland','england','scotland','wales','northern ireland'],
 3:['spain','portugal'],4:['italy','austria','greece','czechia','czech republic','hungary','slovakia','slovenia'],
 5:['poland','denmark','sweden','finland','estonia','latvia','lithuania']};
 return Number(Object.keys(values).find(x=>values[x].includes(c))??6);
}
const kindOf=flow=>flow.startsWith('event')?'events':flow.startsWith('venue')?'venues':flow.startsWith('cruising')?'cruising':'all';
const cruise=row=>norm(row.Category)==='cruising area';
function location(row,venues){const host=venues.get(clean(row.Venue_ID))||{};return{country:clean(row.Country||host.Country),city:clean(row.City||host.City)}}
function selected(config,venues,events){
 const type=kindOf(config.workflow),host=new Map(venues.map(x=>[clean(x.Venue_ID),x]));
 const all=type==='events'?events:type==='venues'?venues.filter(r=>!cruise(r)):type==='cruising'?venues.filter(cruise):[...venues,...events];
 const ids=new Set(config.ids||[]),countries=new Set((config.countries||[]).map(norm)),cities=new Set((config.cities||[]).map(norm));
 const query=norm(config.text),status=norm(config.status);
 return all.filter(r=>{const id=clean(r.Venue_ID||r.Event_ID),loc=location(r,host),date=clean(r.Event_Date);
  if(ids.size&&!ids.has(id))return false;
  if(countries.size&&!countries.has(norm(loc.country)))return false;
  if(cities.size&&!cities.has(norm(loc.country+'|'+loc.city)))return false;
  if(status&&norm(r.Status)!==status)return false;
  if(query&&!Object.values(r).some(v=>norm(v).includes(query)))return false;
  if(r.Event_ID&&date&&(config.from&&date<config.from||config.to&&date>config.to))return false;
  return true;
 });
}
function keys(rows){return uniq(rows.flatMap(x=>Object.keys(x||{})))}
function build(config,venues,events,sources,instructions){
 const flow=config.workflow||'venue_updates',type=kindOf(flow),host=new Map(venues.map(r=>[clean(r.Venue_ID),r]));
 const existing=selected(config,venues,events);
 const tasks=existing.map(record=>{const loc=location(record,host);return{record,id:clean(record.Event_ID||record.Venue_ID),
  country:loc.country,city:loc.city,zone:config.zone==='auto'?zone(loc.country,record.Event_ID?'events':cruise(record)?'cruising':'venues'):Number(config.zone)}});
 const found=new Set(tasks.map(x=>norm(x.country+'|'+x.city)));
 for(const loc of config.cities||[]){
  const [country,...rest]=loc.split('|'),city=rest.join('|');
  if(!found.has(norm(loc)))tasks.push({country,city,id:'',record:null,zone:config.zone==='auto'?zone(country,type):Number(config.zone)});
 }
 if(!tasks.length)for(const country of config.countries||[])tasks.push({country,city:'(country-wide)',id:'',record:null,zone:config.zone==='auto'?zone(country,type):Number(config.zone)});
 const size=Math.max(1,Math.min(300,Number(config.batchSize)||25)),limit=Math.max(1,Math.min(300,Number(config.sourceLimit)||60));
 const rules=(instructions||[]).filter(x=>x.id==='COMMON_RULES'||x.id==='WORLDWIDE_ZONES').map(x=>x.body).join('\n\n');
 const instruction=(instructions||[]).find(x=>x.id===flow.toUpperCase())?.body||'';
 const allow=src=>src.enabled!==false&&(!config.sourceKinds?.length||config.sourceKinds.includes(src.kind))&&
   (!config.sourceKeys?.length||config.sourceKeys.includes(src.key))&&
   (!src.workflows.length||type==='all'||src.workflows.includes('all')||src.workflows.includes(type)||src.workflows.includes(flow));
 const candidates=sources.filter(allow),chunks=[];
 tasks.sort((a,b)=>a.zone-b.zone||a.country.localeCompare(b.country)||a.city.localeCompare(b.city)||a.id.localeCompare(b.id));
 let current=[],bucketKey='';
 for(const row of tasks){
  const nextKey=row.zone+'|'+row.country;
  if(current.length&&(nextKey!==bucketKey||current.length>=size)){chunks.push(current);current=[];}
  current.push(row);bucketKey=nextKey;
 }
 if(current.length)chunks.push(current);
 const batches=chunks.map((part,i)=>{
  const ids=uniq(part.map(x=>x.id)),countries=uniq(part.map(x=>x.country)),cities=uniq(part.map(x=>x.country+'|'+x.city));
  const included=candidates.filter(src=>(config.sourceKeys?.length&&config.sourceKeys.includes(src.key))||
   !src.record_ids.length||src.record_ids.some(id=>ids.includes(id))||
   src.origins.some(p=>/seed|source catalogue|recovered original/i.test(p))||
   src.countries.some(c=>countries.map(norm).includes(norm(c))));
  return{batch:i+1,zone:uniq(part.map(x=>String(x.zone))).join(', '),countries,cities,record_ids:ids,
   existing_records:part.filter(x=>x.record).map(x=>({...x.record})),
   research_locations:part.filter(x=>!x.record).map(x=>({country:x.country,city:x.city,zone:x.zone,status:'discovery_target_unverified'})),
   sources:included.slice(0,limit).map(x=>({url:x.url,kind:x.kind,record_ids:x.record_ids.filter(id=>ids.includes(id)),provenance:x.origins.slice(0,10)}))};
 });
 const packet={format:'backroom-phase3-research-packet',status:'RESEARCH_ONLY_NOT_PUBLISHED',version:1,created_at:new Date().toISOString(),
  workflow:flow,zone:config.zone,date_window:{from:config.from||'',to:config.to||''},
  selection:{countries:config.countries||[],cities:config.cities||[],ids:config.ids||[],status:config.status||'',batch_size:size},
  schemas:{venue_fields:keys(venues),event_fields:keys(events)},sources_available:sources.length,
  instructions:{workflow:instruction,common:rules},batches};
 const md=['# Backroom research brief — '+flow.replaceAll('_',' '),'Status: RESEARCH ONLY — do not publish automatically',
  'Window: '+(config.from||'?')+' to '+(config.to||'?'),'Zone: '+config.zone,'Countries: '+(config.countries||[]).join(', '),'',
  '## Workflow instructions',instruction,'','## Shared editorial rules',rules,''];
 for(const batch of batches)md.push('## Batch '+batch.batch+'/'+batches.length,
  'Countries: '+batch.countries.join(', '),'Cities: '+batch.cities.map(x=>x.replace('|',' — ')).join('; '),
  'Zone: '+batch.zone,'Existing IDs: '+(batch.record_ids.join(', ')||'none — discovery'),
  'Uncovered cities: '+(batch.research_locations.map(x=>x.country+' / '+x.city).join('; ')||'none'),
  '### Research URLs',...batch.sources.map(x=>'- '+x.url+' ['+x.kind+']'),
  '### Required output','Provide source-backed proposed edits/new candidates with evidence dates and uncertainty. Preserve original IDs and all schema fields. Use the accompanying JSON packet for complete original records.','');
 return{packet,markdown:md.join('\n'),batches};
}
window.BackroomPhase3Data={clean,norm,uniq,validURL,keyOf,classify,library,urlsFrom,ingest,ingestSeed,normalizeImport,zone,kindOf,cruise,location,selected,keys,build};
})();