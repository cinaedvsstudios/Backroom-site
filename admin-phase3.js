/* Backroom Phase 3 — in-admin Scrape Builder, Source Library & Instructions. */
(()=>{'use strict';
const P=window.BRP2,D=window.BackroomPhase3Data,W=window.BackroomPhase3Presets;
if(!P||!D||!W)throw Error('Phase 3 requires Phase 2, Phase 3 data and coverage presets.');
if(window.BackroomAdminPhase3)return;
const {esc,fmt,get,notify,downloadJSON,saveLocal,readLocal}=P;
const KEY='br_admin_phase3_v1',SOURCE_KEY='br_admin_phase3_custom_sources_v1',EDIT_KEY='br_admin_phase3_source_edits_v1',RULE_KEY='br_admin_phase3_instruction_edits_v1';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const after6=()=>{const d=new Date(today()+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+6);return d.toISOString().slice(0,10)};
const workflows=[['event_discovery','📅 Event discovery'],['event_updates','📅 Event updates'],['venue_discovery','📍 Venue discovery'],['venue_updates','📍 Venue updates'],['cruising_updates','🗺️ Cruising area updates'],['combined','🔄 Combined venue + event research']];
const zones=[['auto','Auto by country/workflow'],['0','0 · Germany'],['1','1 · France / Benelux / Switzerland'],['2','2 · UK & Ireland'],['3','3 · Iberia & Islands'],['4','4 · Italy / Austria / Central / Mediterranean'],['5','5 · Nordics / Baltics / Poland'],['6','6 · Other European / Touring'],['8','8 · Public-space cruising only']];
const configDefault={workflow:'venue_updates',countries:[],cities:[],zone:'auto',from:today(),to:after6(),status:'',text:'',ids:[],batchSize:25,sourceLimit:60,sourceKinds:[],sourceKeys:[]};
const S={active:false,tab:'wizard',wizardPreset:'',loading:false,ready:false,loadedResearch:false,lib:D.library(),seeds:null,rules:[],baseRules:[],
 selected:new Set(),custom:readLocal(SOURCE_KEY,[]),edits:readLocal(EDIT_KEY,{}),ruleEdits:readLocal(RULE_KEY,{}),config:{...configDefault,...readLocal(KEY,{})},
 citySearch:'',sourceSearch:'',sourceKind:'',sourceCountry:'',sourceOrigin:'',sourcePage:1,sourceEditing:'',sourceStatus:[],
 fileReports:[],packet:null,markdown:'',countryChoice:'',selectedCountryChoice:'',error:'',countrySearch:'',sourceChosen:[]};
if(!Array.isArray(S.config.countries))S.config.countries=[];
if(!Array.isArray(S.config.cities))S.config.cities=[];
if(!Array.isArray(S.config.ids))S.config.ids=[];
if(!Array.isArray(S.config.sourceKinds))S.config.sourceKinds=[];
if(!Array.isArray(S.config.sourceKeys))S.config.sourceKeys=[];
function remember(){saveLocal(KEY,S.config)}
const opt=(v,selected,label)=>'<option value="'+esc(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+esc(label??v)+'</option>';
const group=(id,title,body)=>'<section class="br3-card" id="'+id+'"><h2>'+title+'</h2>'+body+'</section>';
const buttons=parts=>parts.map(([id,text,cls])=>'<button type="button" id="'+id+'" class="btn '+(cls||'secondary-btn')+' pill-btn">'+text+'</button>').join('');
function setMessage(value){const node=get('br3-message');if(node)node.textContent=value||'';}
function saveFile(content,name,mime='text/plain'){
 const url=URL.createObjectURL(new Blob([content],{type:mime+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function copyText(s){
 try{await navigator.clipboard.writeText(s);notify('Copied to clipboard.');}
 catch{const input=get('br3-output');if(input){input.select();document.execCommand('copy');notify('Text selected for copying.');}}
}
function fetchData(path){
 return fetch(path+'?v=0.23.4&t='+Date.now(),{cache:'no-store'}).then(async r=>{
 if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json();
 });
}
function sourceOverride(item){
 const v=S.edits[item.key];if(v){Object.assign(item,v);if(v.disabled===true)item.enabled=false;}
 return item;
}
function rebuildSources(){
 S.lib=D.library();D.ingestSeed(S.lib,S.seeds);
 D.ingest(S.lib,P.state.venues||[],'listings.json','venues');
 D.ingest(S.lib,P.state.events||[],'events.json','events');
 for(const row of S.custom||[])S.lib.add(row.url,{...row,provenance:row.provenance||'Manual / imported'});
 for(const item of S.lib.all())sourceOverride(item);
}
async function init(){
 if(S.ready)return;
 if(S.loading)return;
 S.loading=true;setMessage('Loading existing records, city registry and source instructions…');
 try{
  await P.refresh();
  const [seeds,rulePack]=await Promise.all([fetchData('admin-phase3-sources.json'),fetchData('admin-phase3-instructions.json')]);
  S.seeds=seeds;S.baseRules=rulePack.instructions||[];
  S.rules=S.baseRules.map(x=>({...x,body:S.ruleEdits[x.id]??x.body}));
  S.config.countries=D.uniq(S.config.countries.map(name=>W.standardCountry(name,P.state.registry)).filter(Boolean));
  S.config.cities=D.uniq(S.config.cities.map(value=>{
   const [country,...rest]=String(value).split('|');const standard=W.standardCountry(country,P.state.registry);
   return standard&&rest.length?standard+'|'+rest.join('|'):'';
  }).filter(Boolean));
  rebuildSources();S.ready=true;S.error='';
 }catch(e){S.error=e.message;console.error('Backroom Phase 3 load failed',e);setMessage(e.message)}
 finally{S.loading=false;}
}
let researchPromise=null;
async function researchSources(){
 if(S.loadedResearch)return;
 if(researchPromise)return researchPromise;
 researchPromise=(async()=>{
  S.loading=true;setMessage('Reading cruising research registry and January venue-URL audit…');
  const targets=[['research/CRUISING_SOURCE_REGISTRY.json','Cruising source registry','cruising'],
   ['research/events/2027-01/venue_url_audit.json','January venue URL audit','events']];
  try{
   const completed=await Promise.allSettled(targets.map(async([path,label,kind])=>{
    const payload=await fetchData(path);return D.ingest(S.lib,payload,path,kind);
   }));
   S.fileReports=completed.map((r,i)=>r.status==='fulfilled'?r.value:{origin:targets[i][0],error:String(r.reason?.message||r.reason)});
   S.loadedResearch=completed.every(x=>x.status==='fulfilled');
   for(const item of S.lib.all())sourceOverride(item);
   if(S.active){render();setMessage(S.fileReports.some(x=>x.error)?'Some archives could not load; available URLs were retained. Retry or import a local copy.':'Research registries loaded. Original source files are unchanged.');}
  }finally{S.loading=false;researchPromise=null;}
 })();
 return researchPromise;
}
function countries(){
 return W.availableCountries(P.state.registry).map(x=>x.name);
}
function cityRows(){
 const reg=P.state.registry||{countries:[],cities:[]};
 const names=new Map(W.availableCountries(reg).map(x=>[x.code,x.name]));
 const pool=new Map();
 for(const item of reg.cities||[]){
  const country=names.get(item.country_code);if(!country)continue;
  const id=country+'|'+item.name;pool.set(D.norm(id),{country,city:item.name,id,kind:item.kinds?.join(', ')||''});
 }
 const venues=P.state.venues||[],events=P.state.events||[],index=new Map(venues.map(x=>[x.Venue_ID,x]));
 for(const row of [...venues,...events]){
  const {country,city}=D.location(row,index);if(!country||!city||!W.permittedCountry(country,reg))continue;
  const id=country+'|'+city;if(!pool.has(D.norm(id)))pool.set(D.norm(id),{country,city,id,kind:'Existing Backroom record'});
 }
 for(const chosen of S.config.cities||[]){
  const [country,...parts]=chosen.split('|'),city=parts.join('|');
  if(W.permittedCountry(country,reg)&&city&&!pool.has(D.norm(chosen)))pool.set(D.norm(chosen),{country,city,id:chosen,kind:'Preset city'});
 }
 return[...pool.values()].sort((a,b)=>a.country.localeCompare(b.country)||a.city.localeCompare(b.city));
}
function filteredCities(){
 const selected=new Set(S.config.countries.map(D.norm)),needle=D.norm(S.citySearch);
 return cityRows().filter(x=>(!selected.size||selected.has(D.norm(x.country)))&&(!needle||D.norm(x.city+' '+x.country).includes(needle)));
}
function cityHTML(){
 const full=filteredCities(),limit=110,chosen=new Set(S.config.cities);
 return '<div class="br3-city-count">'+fmt(full.length)+' matching cities · '+fmt(chosen.size)+' selected'+(full.length>limit?' · showing first '+limit:'')+'</div>'+
  '<div class="br3-city-list">'+full.slice(0,limit).map(x=>
   '<label class="br3-choice"><input type="checkbox" data-br3-city="'+esc(x.id)+'" '+(chosen.has(x.id)?'checked':'')+'> '+
   (window.BackroomAdminFlags?.html(x.country)||'🌍')+' '+esc(x.city)+' <small>'+esc(x.country)+'</small></label>').join('')+'</div>';
}
function filtersHTML(){
 const c=S.config,selectedCountries=new Set(c.countries||[]);
 return group('br3-scope','🧭 Scrape Builder — Research Scope',
  '<p class="br3-muted">Build research briefs and schema-compatible review packets. Nothing here runs a crawler, changes the live site or publishes records.</p>'+
  '<div class="br3-grid">'+
  '<label>Research workflow<select id="br3-workflow">'+workflows.map(x=>opt(x[0],c.workflow,x[1])).join('')+'</select></label>'+
  '<label>Zone<select id="br3-zone">'+zones.map(x=>opt(x[0],c.zone,x[1])).join('')+'</select></label>'+
  '<label>From date<input type="date" id="br3-from" value="'+esc(c.from||'')+'"></label>'+
  '<label>Until date<input type="date" id="br3-to" value="'+esc(c.to||'')+'"></label>'+
  '<label>Status<select id="br3-status">'+[['','All'],['Live','Live'],['Hold','Hold'],['Flag','Flag'],['Closed','Closed'],['Cancelled','Cancelled']].map(x=>opt(x[0],c.status,x[1])).join('')+'</select></label>'+
  '<label>Batch size<input type="number" id="br3-batch" min="1" max="300" value="'+esc(c.batchSize)+'"></label>'+
  '</div>'+
  '<h3>🌍 Countries and cities</h3>'+
  '<div class="br3-inline"><select id="br3-country-pick" aria-label="Add country">'+opt('','','Select a country')+countries().map(x=>opt(x,'',x)).join('')+'</select>'+
  buttons([['br3-add-country','➕ Add country'],['br3-clear-countries','Clear countries']])+'</div>'+
  '<div class="br3-chips">'+(c.countries.length?c.countries.map(country=>'<button type="button" class="br3-chip" data-br3-remove-country="'+esc(country)+'">'+(window.BackroomAdminFlags?.html(country)||'🌐')+' '+esc(country)+' <span>×</span></button>').join(''):'<span class="br3-muted">No country selected — all eligible European countries + Israel/Turkey</span>')+'</div>'+
  '<div class="br3-inline"><input id="br3-city-search" type="search" placeholder="Find a city or island town" value="'+esc(S.citySearch)+'">'+
  buttons([['br3-all-cities','✓ Select all filtered'],['br3-clear-cities','Clear selected cities']])+'</div>'+
  '<div id="br3-city-results">'+cityHTML()+'</div>'+
  '<h3>🎯 Existing IDs / content filters</h3>'+
  '<div class="br3-grid br3-grid-2"><label>Filter existing records<input id="br3-text" value="'+esc(c.text||'')+'" placeholder="Name, tag, city or phrase"></label>'+
  '<label>Paste selected IDs from Compact View (spaces, commas or new lines)<textarea id="br3-ids" rows="3" placeholder="BER-LAB-01, EVT-BER-132…">'+esc(c.ids.join('\n'))+'</textarea></label></div>'+
  buttons([['br3-copy-ids','📋 Copy matching IDs'],['br3-preview','🔍 Preview matching records','primary-btn']])+
  '<div id="br3-scope-preview" class="br3-preview"></div>');
}

function scopedConfig(){return {...S.config,allowedCountries:countries()};}
function wizardHTML(){
 const c=S.config,info=W.definitions.find(x=>x.id===S.wizardPreset);
 const rows=D.selected(scopedConfig(),P.state.venues,P.state.events);
 const locations=c.cities.length,chosenCountry=c.countries.length;
 const details=S.wizardPreset==='backroom20'?W.backroomTop(P.state.venues,P.state.events,P.state.registry,20):[];
 const sortedCities=c.cities.slice(0,18).map(x=>x.replace('|',' — ')).join(' · ');
 return group('br3-wizard-intro','✨ Quick Setup — research wizard',
  '<p class="br3-muted">Three simple steps: choose what you want researched, pick a preset of countries or cities, and generate a reviewable research brief. Advanced filtering is optional.</p>'+
  '<div class="br3-wizard-steps"><span>① What to research</span><span>② Where to look</span><span>③ Generate a brief</span></div>')+
 group('br3-wizard-workflow','① What do you want to research?',
  '<label>Choose the research task<select id="br3-wizard-workflow">'+workflows.map(x=>opt(x[0],c.workflow,x[1])).join('')+'</select></label>'+
  '<p class="br3-muted">Discovery looks for new records; Updates checks existing records. Combined checks venues and their upcoming events together. Cruising Area Updates uses the separate Zone 8 rules.</p>')+
 group('br3-wizard-places','② Choose a ready-made coverage preset',
  '<p class="br3-muted">Click one preset to replace the current country/city selection. City presets search specific cities; country presets cover those whole countries. The <strong>Top 20 Backroom</strong> option is calculated from active listings, not estimated.</p>'+
  '<div class="br3-preset-grid">'+W.definitions.map(item=>
   '<button type="button" class="br3-preset '+(S.wizardPreset===item.id?'br3-preset-active':'')+'" data-br3-preset="'+esc(item.id)+'" aria-pressed="'+String(S.wizardPreset===item.id)+'">'+
   '<span class="br3-preset-name">'+item.icon+' '+esc(item.name)+'</span><small>'+esc(item.description)+'</small></button>').join('')+'</div>'+
  '<div class="br3-inline">'+buttons([['br3-wizard-clear','Clear geography'],['br3-wizard-advanced','⚙ Advanced country / city selection']])+'</div>'+
  '<div class="br3-wizard-selected"><strong>'+(info?esc(info.name):'Custom selection')+'</strong><p>'+
  (chosenCountry||locations?fmt(chosenCountry)+' countries · '+fmt(locations)+' selected cities.':'No selection yet. Choose a preset or open Advanced Builder.')+'</p>'+
  (locations?'<div class="br3-preview-cities">'+esc(sortedCities)+(locations>18?' · … +'+fmt(locations-18)+' more':'')+'</div>':
   chosenCountry?'<div class="br3-preview-cities">'+esc(c.countries.slice(0,18).join(' · '))+(chosenCountry>18?' · …':'')+'</div>':'')+
  (details.length?'<p class="br3-muted">Backroom counts: '+esc(details.slice(0,6).map(x=>x.city+' '+x.total).join(' · '))+' …</p>':'')+
  '</div>')+
 group('br3-wizard-time','③ Research period and batch size',
  '<div class="br3-grid br3-grid-3">'+
  '<label>From date<input type="date" id="br3-wizard-from" value="'+esc(c.from||'')+'"></label>'+
  '<label>Until date<input type="date" id="br3-wizard-to" value="'+esc(c.to||'')+'"></label>'+
  '<label>Records / cities per batch<select id="br3-wizard-batch">'+[10,25,50,100].map(x=>opt(x,c.batchSize,x+' per batch')).join('')+'</select></label>'+
  '</div>'+
  '<p class="br3-muted">All applicable directory, record and cruising-research URLs are available automatically. The source limit and individual source choices can be changed in Advanced Builder and Source Library.</p>'+
  '<div class="br3-inline">'+buttons([['br3-wizard-preview','🔍 Preview scope'],['br3-wizard-generate','🧪 Generate research brief','primary-btn'],['br3-wizard-guide','❓ How it works']])+'</div>'+
  '<div id="br3-scope-preview" class="br3-preview"><span class="br3-pill"><strong>'+fmt(rows.length)+'</strong> matching existing records</span><span class="br3-pill"><strong>'+fmt(locations||chosenCountry)+'</strong> location targets</span></div>'+
  '<p class="br3-muted"><strong>Important:</strong> Generating prepares a prompt and an evidence-oriented JSON packet. It does not automatically visit websites, independently verify sources or publish records.</p>')+
 outputHTML();
}
function helpHTML(){
 return group('br3-help','❓ How the research studio works',
  '<p class="br3-muted">The Research Studio prepares work for a separate research run. It does not operate an automatic web crawler, check each URL by itself, or write to the public database.</p>'+
  '<div class="br3-help-flow">'+
  '<article><h3>① Choose a workflow</h3><p><strong>Discovery</strong> finds candidates not already in Backroom. <strong>Updates</strong> reviews records already listed. <strong>Combined</strong> checks venues and their event dates together. <strong>Cruising updates</strong> reviews public-space cruising areas under the stricter Zone 8 evidence rules.</p></article>'+
  '<article><h3>② Choose geography</h3><p><strong>Country</strong> means the entire selected country. <strong>City</strong> means only that city. A preset replaces the selection; Advanced Builder can add or remove individual cities. Only Europe and its territories, plus Israel and Turkey, are offered for new research jobs. The Canary Islands remain under Spain.</p></article>'+
  '<article><h3>③ Select a period</h3><p><strong>From/Until</strong> control which existing dated events are in scope and which future months the brief asks the researcher to verify. For venue and cruising-area updates, the dates are research context; they do not mean a venue opened on those dates.</p></article>'+
  '<article><h3>④ Preview, then generate</h3><p><strong>Preview scope</strong> counts the existing records that match, without researching anything. <strong>Generate research brief</strong> creates instructions, a source list, original record snapshots and batches. Batches limit how many records or cities are handled together.</p></article>'+
  '<article><h3>⑤ Carry out research separately</h3><p><strong>Copy brief</strong> gives you the human-readable instructions for a research chat. <strong>Markdown brief</strong> downloads the same instructions. <strong>Full JSON packet</strong> downloads complete existing records plus research sources. <strong>Download each batch</strong> saves separate smaller packets. None of these buttons scrapes or publishes.</p></article>'+
  '<article><h3>⑥ Source Library and Instructions</h3><p><strong>Source Library</strong> combines known links with original record URLs, the cruising registry and audit files; use its search/filters to locate or manually select URLs. <strong>Instructions</strong> holds editable research rules. <strong>Advanced Builder</strong> adds status filters, exact IDs, country/city editing and source limits.</p></article>'+
  '</div>'+
  '<p class="br3-muted">Suggested routine: Quick Setup → pick “Combined venue + event research” → choose “Top 20 Backroom cities” → set the date range → Preview → Generate → Copy brief into a research chat. When the research produces verified updates, review them using Data & Analytics before publishing.</p>'+
  '<div class="br3-inline">'+buttons([['br3-guide-wizard','✨ Open Quick Setup','primary-btn'],['br3-guide-advanced','⚙ Advanced Builder']])+'</div>');
}
function sourceKinds(){
 return D.uniq(S.lib.all().flatMap(x=>x.kinds?.length?x.kinds:[x.kind])).sort();
}
function sourceConfigHTML(){
 const c=S.config;return group('br3-brief-controls','🔗 Sources & Brief Output',
  '<p class="br3-muted">Known directories, original record URLs, the cruising source registry and January venue audit can be combined. Original URL paths and record relationships are retained.</p>'+
  '<div class="br3-grid">'+
  '<label>Maximum source URLs per batch<input type="number" id="br3-source-limit" value="'+esc(c.sourceLimit)+'" min="1" max="300"></label>'+
  '<label>Source types to include<select id="br3-source-kinds" multiple size="6">'+sourceKinds().map(kind=>'<option value="'+esc(kind)+'" '+(c.sourceKinds.includes(kind)?'selected':'')+'>'+esc(kind)+'</option>').join('')+'</select><small>Use Ctrl to select multiple. None means all types.</small></label></div>'+
  '<p class="br3-muted">For a specific set of sources, select them under Source Library. Otherwise the builder chooses all applicable sources up to your batch limit.</p>'+
  buttons([['br3-generate','🧪 Generate research briefs','primary-btn'],['br3-load-sources','↻ Load research registries']])+
  '<div id="br3-load-note" class="br3-muted">'+(S.loadedResearch?'Research registry loading completed.': 'Large research archives load on demand or when generating a brief.')+'</div>');
}
function outputHTML(){
 return group('br3-result','📦 Research Packets',
  '<p class="br3-muted">Copy the brief into your research workflow or download the complete JSON packet. The packet contains all selected original records and fields, plus proposed research tasks. There is no publish button.</p>'+
  '<div class="br3-inline">'+buttons([['br3-copy-brief','📋 Copy brief'],['br3-save-brief','⬇ Markdown brief'],['br3-save-packet','⬇ Full JSON packet'],['br3-save-batches','⬇ Download each batch']])+'</div>'+
  '<div id="br3-result-summary">'+(S.packet?'<strong>'+S.packet.batches.length+' batches · '+S.packet.batches.reduce((a,b)=>a+b.record_ids.length,0)+' records</strong>':'No research packet generated yet.')+'</div>'+
  '<textarea readonly id="br3-output" rows="12" placeholder="Your source-backed research brief will appear here.">'+esc(S.markdown||'')+'</textarea>');
}
function renderBuilder(){
 get('br3-panel').innerHTML=filtersHTML()+sourceConfigHTML()+outputHTML();
 if(S.packet)get('br3-result-summary').textContent=S.packet.batches.length+' research batches · '+S.packet.batches.reduce((a,b)=>a+b.record_ids.length,0)+' linked records';
}
function allSources(){
 const q=D.norm(S.sourceSearch),kind=S.sourceKind,country=D.norm(S.sourceCountry),origin=D.norm(S.sourceOrigin);
 return S.lib.all().filter(x=>(!q||D.norm([x.name,x.url,x.kind,x.record_ids.join(' '),x.countries.join(' ')].join(' ')).includes(q))&&
  (!kind||x.kind===kind||x.kinds?.includes(kind))&&(!country||x.countries.some(v=>D.norm(v)===country))&&(!origin||x.origins.some(v=>D.norm(v).includes(origin))))
  .sort((a,b)=>a.url.localeCompare(b.url));
}
function sourceHTML(){
 const filtered=allSources(),pages=Math.max(1,Math.ceil(filtered.length/70));S.sourcePage=Math.min(S.sourcePage,pages);
 const visible=filtered.slice((S.sourcePage-1)*70,S.sourcePage*70);
 const picked=new Set(S.config.sourceKeys||[]);
 const origins=S.fileReports.map(x=>'<span class="br3-pill '+(x.error?'br3-warning':'')+'">'+esc(x.origin.split('/').pop())+': '+(x.error?'unavailable':fmt(x.newUrls)+' new URLs')+'</span>').join('');
 return group('br3-library','🌐 Master Source Library',
  '<p class="br3-muted">Exact individual URLs are deduplicated, while original variants, record IDs and file provenance remain attached. Archive links are research leads — not proof of a live venue or recent cruising activity.</p>'+
  '<div class="br3-chips">'+[['Source URLs',S.lib.size()],['Unique seed URLs',S.seeds?.sources?.length||0],['Original seed references',S.seeds?.deduplication?.source_entries_before||0],['Production venues',P.state.venues.length],['Production events',P.state.events.length]].map(x=>'<span class="br3-pill"><strong>'+fmt(x[1])+'</strong> '+x[0]+'</span>').join('')+'</div>'+
  '<div class="br3-chips">'+origins+'</div>'+
  '<div class="br3-inline">'+buttons([['br3-load-sources','↻ Load cruising + January research','primary-btn'],['br3-export-sources','⬇ Export all sources JSON'],['br3-export-csv','⬇ CSV'],['br3-import-sources-btn','⬆ Import URL list'],['br3-add-source','＋ Add source'],['br3-use-all-sources','Use all sources']])+
  '<input type="file" id="br3-source-file" accept=".json,.csv,.tsv,.txt" hidden></div>'+
  '<div class="br3-grid br3-grid-3"><label>Find URL, record ID or domain<input id="br3-src-search" type="search" value="'+esc(S.sourceSearch)+'" placeholder="e.g. patroc / BER-LAB"></label>'+
  '<label>Type<select id="br3-src-kind">'+opt('','','All types')+sourceKinds().map(x=>opt(x,S.sourceKind)).join('')+'</select></label>'+
  '<label>Country<input id="br3-src-country" placeholder="All countries" value="'+esc(S.sourceCountry)+'"></label>'+
  '<label>Origin contains<input id="br3-src-origin" placeholder="Archive, seed, events..." value="'+esc(S.sourceOrigin)+'"></label></div>'+
  '<div class="br3-muted">'+fmt(filtered.length)+' matching URLs · page '+S.sourcePage+'/'+pages+' · '+fmt(picked.size)+' explicitly selected for briefs. When none are selected, all eligible sources are considered.</div>'+
  '<div class="br3-overflow"><table class="br3-table"><thead><tr><th>Use</th><th>Source / Website</th><th>Type</th><th>Research references</th><th>Actions</th></tr></thead><tbody>'+
  visible.map(x=>'<tr><td><input type="checkbox" aria-label="Include source in builder" data-br3-source-pick="'+esc(x.key)+'" '+(picked.has(x.key)?'checked':'')+'></td><td><strong>'+esc(x.name)+'</strong><div class="br3-url"><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.url)+'</a></div>'+
   (x.enabled===false?'<span class="br3-warning">Disabled</span>':'')+'</td><td>'+esc(x.kind)+'</td><td>'+
   '<span title="'+esc(x.origins.join('; ').slice(0,400))+'">'+fmt(x.record_ids.length)+' IDs · '+fmt(x.origins.length)+' origins · '+fmt(x.source_references?.length||0)+' original references</span>'+
   '<details><summary>Provenance & original URL variants</summary><p>'+esc(x.origins.join(' · ').slice(0,1000))+'</p><p>'+esc(x.record_ids.slice(0,40).join(', '))+'</p>'+
   (x.source_references?.length?'<ul class="br3-provenance-list">'+x.source_references.map(r=>'<li><strong>'+esc(r.id)+'</strong> · <a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.url)+'</a> <small>('+esc(r.kind||'')+')</small></li>').join('')+'</ul>':'')+
   '</details></td><td>'+
   '<button type="button" class="br3-action" data-br3-edit="'+esc(x.key)+'">Edit</button><button type="button" class="br3-action" data-br3-toggle="'+esc(x.key)+'">'+(x.enabled===false?'Enable':'Disable')+'</button></td></tr>').join('')+
  '</tbody></table></div>'+
  '<div class="br3-inline">'+buttons([['br3-prev-sources','← Previous'],['br3-next-sources','Next →']])+'</div>'+
  '<div id="br3-source-editor">'+sourceEditorHTML()+'</div>'+
  '<p class="br3-muted">The original <strong>102-URL Collect Scraping URLs list</strong> is now included in this source library, with each URL linked to its original line number. The verbatim file is archived in <code>scraping/Backroom_scraping_source_URLs_102_2026-11-06.txt</code>. The 192 original source entries are now grouped into 122 distinct seed URLs; all original links, source IDs and provenance remain accessible in the per-source details and deduplication audit. Venue/event URLs, the cruising registry and January audit load alongside it.</p>'+ 
  '<p class="br3-muted">Only user edits and small imported lists are saved in this browser. The large cruising registry and original research remain in their GitHub files; export a full library if you need a portable combined copy.</p>');
}
function sourceEditorHTML(){
 if(!S.sourceEditing)return'';
 const edit=S.sourceEditing==='new'?{name:'',url:'',kind:'website',verification:'Not independently verified',enabled:true}:S.lib.byKey.get(S.sourceEditing);
 if(!edit)return'';
 return '<div class="br3-edit"><h3>'+('new'===S.sourceEditing?'Add research URL':'Edit source details')+'</h3>'+
 '<div class="br3-grid br3-grid-2">'+
 '<label>Name<input id="br3-edit-name" value="'+esc(edit.name)+'"></label>'+
 '<label>URL<input id="br3-edit-url" value="'+esc(edit.url)+'"></label>'+
 '<label>Category<select id="br3-edit-kind">'+D.uniq([...sourceKinds(),'official','directory','events-directory','cruising-directory','travel-guide','social','ticket-event','map','website']).map(k=>opt(k,edit.kind)).join('')+'</select></label>'+
 '<label>Verification note<input id="br3-edit-note" value="'+esc(edit.verification)+'"></label></div>'+
 buttons([['br3-save-source','💾 Save source','primary-btn'],['br3-cancel-source','Cancel']])+'</div>';
}
function instructionHTML(){
 const selected=S.selectedRule||S.rules[0]?.id;S.selectedRule=selected;
 const item=S.rules.find(x=>x.id===selected)||S.rules[0];
 return group('br3-instructions','📜 Instruction Library',
  '<p class="br3-muted">Reusable editable prompts based on current Backroom rules. These are consolidated instructions, not verbatim archival copies of historic prompts. You can import an original instruction pack and export your revisions.</p>'+
  '<div class="br3-inline">'+buttons([['br3-export-rules','⬇ Export instructions JSON'],['br3-import-rules','⬆ Import instructions JSON'],['br3-reset-rules','↺ Restore default instructions']])+
  '<input type="file" id="br3-rule-file" accept=".json" hidden></div>'+
  '<div class="br3-grid br3-grid-2"><label>Instruction set<select id="br3-rule-picker">'+S.rules.map(x=>opt(x.id,selected,x.title)).join('')+'</select></label>'+
  '<label>Applies to<input readonly value="'+esc(item?.workflow||'')+'"></label></div>'+
  '<textarea id="br3-rule-body" rows="25">'+esc(item?.body||'')+'</textarea>'+
  '<div class="br3-inline">'+buttons([['br3-save-rule','💾 Save instruction edits','primary-btn'],['br3-copy-rule','📋 Copy instruction']])+'</div>');
}
function render(){
 if(!S.ready){get('br3-panel').innerHTML='<div class="br3-card">Loading the Phase 3 workspace…</div>';return;}
 for(const key of ['builder','sources','instructions'])get('br3-'+key)?.classList.toggle('br3-active',S.tab===key);
 if(S.tab==='builder')renderBuilder();
 if(S.tab==='sources')get('br3-panel').innerHTML=sourceHTML();
 if(S.tab==='instructions')get('br3-panel').innerHTML=instructionHTML();
 setMessage(S.error||'');
}
function selectTab(tab){
 if(!['builder','sources','instructions'].includes(tab))return;
 S.tab=tab;render();
 if(tab==='sources'&&!S.loadedResearch)researchSources();
}
function saveConfigInputs(){
 const values=[['workflow','br3-workflow'],['zone','br3-zone'],['from','br3-from'],['to','br3-to'],['status','br3-status'],['text','br3-text']];
 for(const [key,id] of values){const n=get(id);if(n)S.config[key]=n.value;}
 for(const [key,id,min,max] of [['batchSize','br3-batch',1,300],['sourceLimit','br3-source-limit',1,300]]){
  const n=get(id);if(n)S.config[key]=Math.min(max,Math.max(min,Number(n.value)||min));
 }
 if(get('br3-ids'))S.config.ids=D.uniq(String(get('br3-ids').value||'').split(/[\s,;]+/).map(D.clean));
 if(get('br3-source-kinds'))S.config.sourceKinds=[...get('br3-source-kinds').selectedOptions].map(x=>x.value);
 remember();
}
function updateCityResults(){const el=get('br3-city-results');if(el)el.innerHTML=cityHTML()}
function preview(){
 saveConfigInputs();
 const rows=D.selected(S.config,P.state.venues,P.state.events),count=D.kindOf(S.config.workflow);
 const node=get('br3-scope-preview');
 if(node)node.innerHTML='<span class="br3-pill"><strong>'+fmt(rows.length)+'</strong> existing '+esc(count)+' records selected</span>'+
  '<span class="br3-pill"><strong>'+fmt(S.config.cities.length)+'</strong> target cities selected</span>'+
  '<span class="br3-pill">Zone: '+esc(S.config.zone)+'</span>';
 return rows;
}
async function generate(){
 const rows=preview();
 if(S.config.from&&S.config.to&&S.config.from>S.config.to){notify('From date must be on or before Until date.');return;}
 if(S.config.zone==='8'&&S.config.workflow!=='cruising_updates'){notify('Zone 8 is reserved for public-space cruising areas. Use Auto or another zone for venue/event research.');return;}
 if(S.config.countries.some(c=>['united states','united states of america','usa','u.s.'].includes(D.norm(c)))){notify('The current European Zone 6 campaign excludes US locations. Remove the United States from this research scope.');return;}
 if(S.config.workflow==='cruising_updates'&&S.config.zone!=='auto'&&S.config.zone!=='8'){notify('Cruising areas belong in Zone 8. Choose Auto or Zone 8.');return;}
 if(!rows.length&&!S.config.countries.length&&!S.config.cities.length){notify('Select at least one country, city or record ID for this brief.');return;}
 if(!S.loadedResearch)await researchSources();
 const built=D.build(S.config,P.state.venues,P.state.events,S.lib.all(),S.rules);
 S.packet=built.packet;S.markdown=built.markdown;
 const out=get('br3-output');if(out)out.value=S.markdown;
 const node=get('br3-result-summary');if(node)node.innerHTML='<strong>'+built.batches.length+' batches · '+built.batches.reduce((a,b)=>a+b.record_ids.length,0)+' existing records · '+built.batches.reduce((a,b)=>a+b.sources.length,0)+' batch source references</strong>';
 notify('Created '+built.batches.length+' research batches. Nothing was published.');
}
function storeCustom(){
 try{saveLocal(SOURCE_KEY,S.custom);return true;}
 catch(e){notify('List exceeds browser storage. Export the source library JSON; current changes remain in this session.');return false;}
}
function persistEdit(item,details){
 if(S.sourceEditing==='new'||D.keyOf(details.url)!==item?.key){
  if(item){S.edits[item.key]={disabled:true};saveLocal(EDIT_KEY,S.edits);}
  S.custom.push({...details,provenance:'Manual / imported',workflows:['all']});storeCustom();
  S.lib.add(details.url,{...details,provenance:'Manual / imported',workflows:['all']});
 }else{
  S.edits[item.key]={...details};
  Object.assign(item,details);saveLocal(EDIT_KEY,S.edits);
 }
}
async function importSources(file){
 const text=await file.text();if(text.length>12000000)throw Error('Import limit 12 MB. Import large registries through the built-in research loader.');
 let payload;
 if(/\.csv$|\.tsv$/i.test(file.name))payload=P.D.csvParse(text).rows;
 else if(/\.txt$/i.test(file.name))payload=D.urlsFrom(text).map(url=>({url}));
 else payload=JSON.parse(text.replace(/^\ufeff/,''));
 let rows;
 try{rows=D.normalizeImport(payload);if(!rows.some(x=>D.validURL(x.url)))throw Error('No flat URL entries found')}
 catch{if(typeof payload==='object'){const report=D.ingest(S.lib,payload,'Imported '+file.name,'all');S.sourceStatus.push(report);render();notify('Imported nested research references: '+report.newUrls+' new URLs. Save a library export to keep this large imported file.');return;}throw Error('Import does not contain URLs.')}
 let added=0;
 for(const item of rows){
  const url=D.validURL(item.url);if(!url)continue;
  const source={url,name:D.clean(item.name||item.Name||new URL(url).hostname),kind:item.kind||D.classify(url),
   verification:item.verification||'Imported; not live-checked',enabled:item.enabled!==false,workflows:item.workflows||['all'],provenance:'Imported '+file.name};
  if(S.lib.add(url,source)){S.custom.push(source);added++;}
 }
 storeCustom();render();notify('Imported '+added+' new distinct URLs from '+file.name+'.');
}
async function importRules(file){
 const value=JSON.parse(await file.text());const incoming=Array.isArray(value)?value:value.instructions;
 if(!Array.isArray(incoming)||!incoming.every(x=>x&&x.id&&typeof x.body==='string'))throw Error('Expected an array of {id, body} instruction entries.');
 for(const item of incoming){
  const existing=S.rules.find(x=>x.id===item.id);
  if(existing)existing.body=item.body;
  else S.rules.push({id:D.clean(item.id),title:D.clean(item.title||item.id),workflow:D.clean(item.workflow||'all'),body:item.body,source:'Imported instruction pack'});
  S.ruleEdits[item.id]=item.body;
 }
 saveLocal(RULE_KEY,S.ruleEdits);render();notify('Imported '+incoming.length+' instruction entries.');
}
async function handleClick(button){
 const id=button.id;
 if(button.dataset.br3RemoveCountry){
  const country=button.dataset.br3RemoveCountry;S.config.countries=S.config.countries.filter(x=>x!==country);
  S.config.cities=S.config.cities.filter(x=>!x.startsWith(country+'|'));remember();renderBuilder();return;
 }
 if(button.dataset.br3Edit){S.sourceEditing=button.dataset.br3Edit;get('br3-source-editor').innerHTML=sourceEditorHTML();return;}
 if(button.dataset.br3Toggle){
  const item=S.lib.byKey.get(button.dataset.br3Toggle);if(item){item.enabled=!item.enabled;S.edits[item.key]={...S.edits[item.key],enabled:item.enabled};saveLocal(EDIT_KEY,S.edits);render();}return;
 }
 if(button.dataset.br3RemoveCity){S.config.cities=S.config.cities.filter(x=>x!==button.dataset.br3RemoveCity);remember();updateCityResults();return;}
 if(id==='br3-add-country'){
  const value=get('br3-country-pick')?.value;if(value&&!S.config.countries.includes(value))S.config.countries.push(value);remember();renderBuilder();return;
 }
 if(id==='br3-clear-countries'){S.config.countries=[];S.config.cities=[];remember();renderBuilder();return;}
 if(id==='br3-all-cities'){S.config.cities=D.uniq([...S.config.cities,...filteredCities().map(x=>x.id)]);remember();updateCityResults();return;}
 if(id==='br3-clear-cities'){S.config.cities=[];remember();updateCityResults();return;}
 if(id==='br3-copy-ids'){const rows=preview();await copyText(rows.map(x=>x.Event_ID||x.Venue_ID).join('\n'));return;}
 if(id==='br3-preview'){preview();return;}
 if(id==='br3-generate'){await generate();return;}
 if(id==='br3-load-sources'){await researchSources();return;}
 if(id==='br3-copy-brief'){if(S.markdown)await copyText(S.markdown);return;}
 if(id==='br3-save-brief'){if(S.markdown)saveFile(S.markdown,'backroom_research_brief_'+today()+'.md');return;}
 if(id==='br3-save-packet'){if(S.packet)downloadJSON(S.packet,'backroom_research_packets_'+today()+'.json');return;}
 if(id==='br3-save-batches'){if(S.packet)for(const batch of S.packet.batches)downloadJSON({...S.packet,batches:[batch]},'backroom_research_batch_'+String(batch.batch).padStart(3,'0')+'.json');return;}
 if(id==='br3-export-sources'){downloadJSON({format:'backroom-phase3-sources',generated_at:new Date().toISOString(),sources:S.lib.all()},'backroom_master_source_library_'+today()+'.json');return;}
 if(id==='br3-export-csv'){P.downloadCSV(S.lib.all().map(x=>({Name:x.name,URL:x.url,Type:x.kind,Verification:x.verification,Enabled:x.enabled,Country:x.countries.join('; '),City:x.cities.join('; '),Record_IDs:x.record_ids.join('; '),Origins:x.origins.join('; '),Variants:x.variants.join('; '),Original_Reference_IDs:(x.source_references||[]).map(r=>r.id).join('; '),Original_Source_URLs:(x.source_references||[]).map(r=>r.url).join('; '),Original_References_JSON:JSON.stringify(x.source_references||[])})),'backroom_source_library_'+today()+'.csv');return;}
 if(id==='br3-import-sources-btn'){get('br3-source-file')?.click();return;}
 if(id==='br3-use-all-sources'){S.config.sourceKeys=[];remember();render();return;}
 if(id==='br3-add-source'){S.sourceEditing='new';get('br3-source-editor').innerHTML=sourceEditorHTML();return;}
 if(id==='br3-cancel-source'){S.sourceEditing='';get('br3-source-editor').innerHTML='';return;}
 if(id==='br3-save-source'){
  const url=D.validURL(get('br3-edit-url')?.value);if(!url){notify('Enter a valid HTTP(S) URL.');return;}
  const item=S.lib.byKey.get(S.sourceEditing);const details={url,name:D.clean(get('br3-edit-name')?.value)||new URL(url).hostname,
   kind:get('br3-edit-kind')?.value||'website',verification:D.clean(get('br3-edit-note')?.value)||'Not live-checked',enabled:true};
  persistEdit(item,details);S.sourceEditing='';render();notify('Source saved in local changes.');return;
 }
 if(id==='br3-prev-sources'||id==='br3-next-sources'){S.sourcePage=Math.max(1,S.sourcePage+(id==='br3-prev-sources'?-1:1));render();return;}
 if(id==='br3-export-rules'){downloadJSON({format:'backroom-phase3-instructions',instructions:S.rules},'backroom_research_instructions_'+today()+'.json');return;}
 if(id==='br3-import-rules'){get('br3-rule-file')?.click();return;}
 if(id==='br3-reset-rules'){if(!confirm('Restore original Phase 3 instruction seeds? Local edits will be reset.'))return;S.ruleEdits={};saveLocal(RULE_KEY,{});S.rules=S.baseRules.map(x=>({...x}));render();return;}
 if(id==='br3-save-rule'){
  const item=S.rules.find(x=>x.id===S.selectedRule);if(!item)return;
  item.body=get('br3-rule-body')?.value||'';S.ruleEdits[item.id]=item.body;saveLocal(RULE_KEY,S.ruleEdits);notify('Instruction edits saved locally.');return;
 }
 if(id==='br3-copy-rule'){await copyText(get('br3-rule-body')?.value||'');return;}
}
function handleChange(target){
 const id=target.id;
 if(target.dataset.br3SourcePick){const key=target.dataset.br3SourcePick;const set=new Set(S.config.sourceKeys||[]);if(target.checked)set.add(key);else set.delete(key);S.config.sourceKeys=[...set];remember();return;}
 if(target.dataset.br3City){
  const city=target.dataset.br3City;
  S.config.cities=target.checked?D.uniq([...S.config.cities,city]):S.config.cities.filter(x=>x!==city);
  remember();return;
 }
 if(id==='br3-rule-picker'){S.selectedRule=target.value;render();return;}
 if(['br3-workflow','br3-zone','br3-from','br3-to','br3-status','br3-batch','br3-source-limit','br3-source-kinds'].includes(id)){saveConfigInputs();if(id==='br3-workflow'){if(S.config.workflow==='cruising_updates')S.config.zone='8';else if(S.config.zone==='8')S.config.zone='auto';renderBuilder();}return;}
 if(id==='br3-src-kind'){S.sourceKind=target.value;S.sourcePage=1;render();return;}
}
function handleInput(target){
 const id=target.id;
 if(id==='br3-city-search'){S.citySearch=target.value;updateCityResults();return;}
 if(id==='br3-src-search'||id==='br3-src-country'||id==='br3-src-origin'){
  S[{ 'br3-src-search':'sourceSearch','br3-src-country':'sourceCountry','br3-src-origin':'sourceOrigin'}[id]]=target.value;
  const pos=target.selectionStart;S.sourcePage=1;render();const input=get(id);if(input){input.focus();input.setSelectionRange(pos,pos);}return;
 }
 if(id==='br3-ids'||id==='br3-text'){saveConfigInputs();return;}
}
async function show(tab){
 S.active=true;
 for(const id of ['view-tables','view-editor','view-terminology','view-avatars','br-reporting-view']){
  const n=get(id);if(n){n.style.display='none';if(id!=='br-reporting-view')n.classList.add('hidden');}
 }
 P.hide();document.querySelectorAll('.sidebar-item.br-nav-active').forEach(n=>n.classList.remove('br-nav-active'));
 get('nav-scrape-builder')?.classList.add('br-nav-active');
 get('br3-view').style.display='block';
 if(tab)S.tab=tab;
 if(!S.ready)await init();
 render();
 if(S.tab==='sources'&&!S.loadedResearch)researchSources();
}
function hide(){
 S.active=false;const root=get('br3-view');if(root)root.style.display='none';
 get('nav-scrape-builder')?.classList.remove('br-nav-active');
}
function install(){
 const navTarget=get('nav-data-quality')||get('nav-cruising');const main=document.querySelector('#admin-shell > main.admin-main');
 if(!navTarget||!main)return;
 const nav=document.createElement('div');nav.id='nav-scrape-builder';nav.className='sidebar-item';
 nav.innerHTML='<span class="icon">🧭</span><span class="sidebar-text">Scrape Builder</span>';
 navTarget.after(nav);nav.addEventListener('click',()=>show());
 const view=document.createElement('section');view.id='br3-view';view.style.display='none';
 view.innerHTML='<header class="br3-header"><div><h1>🧭 Backroom Research Studio</h1><p>Generate source-backed research packets from the existing database and retained research files.</p></div><span class="br3-status">Phase 3 · Research-only</span></header>'+
 '<nav class="br3-tabs" aria-label="Research studio tabs">'+
 '<button id="br3-builder" type="button" class="br3-active">🧭 Scrape Builder</button>'+
 '<button id="br3-sources" type="button">🌐 Source Library</button>'+
 '<button id="br3-instructions" type="button">📜 Instructions</button></nav>'+
 '<div id="br3-message" class="br3-message" role="status"></div><div id="br3-panel"></div>';
 main.appendChild(view);
 view.addEventListener('click',async e=>{
  const btn=e.target.closest('button');if(!btn)return;
  if(btn.id==='br3-builder')return selectTab('builder');
  if(btn.id==='br3-sources')return selectTab('sources');
  if(btn.id==='br3-instructions')return selectTab('instructions');
  try{await handleClick(btn)}catch(err){console.error(err);notify('Phase 3 action failed: '+err.message);}
 });
 view.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='br3-source-file'&&t.files?.[0]){try{await importSources(t.files[0]);}catch(err){notify('URL import failed: '+err.message);}t.value='';return;}
  if(t.id==='br3-rule-file'&&t.files?.[0]){try{await importRules(t.files[0]);}catch(err){notify('Instruction import failed: '+err.message);}t.value='';return;}
  handleChange(t);
 });
 view.addEventListener('input',e=>handleInput(e.target));
 document.addEventListener('click',e=>{if(e.target.closest('.sidebar-item')&&!e.target.closest('#nav-scrape-builder'))hide();},true);
}
window.BackroomAdminPhase3={show,hide,getState:()=>S,researchSources,render,version:'0.23.6'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();