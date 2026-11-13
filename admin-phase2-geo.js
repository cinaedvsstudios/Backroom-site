/* Backroom Phase 2 — master city registry, geographic coverage and zone rules. */
(() => {
'use strict';
const P=window.BRP2;if(!P)throw Error('Phase 2 shell missing');
const {state:S,get,esc,fmt,clean,norm,notify,saveLocal,downloadCSV,downloadJSON,options,stat,pagination,location}=P;
const REG_KEY='br_admin_city_registry_working_v1';
const flag=name=>window.BackroomAdminFlags?.flag(name)||'🌐';
const flagHTML=name=>window.BackroomAdminFlags?.html(name)||'<span aria-hidden="true">🌐</span>';
const countryOptions=(items,selected)=>'<option value="">🌐 All countries</option>'+items.map(name=>'<option value="'+esc(name)+'" '+(selected===name?'selected':'')+'>'+esc(name)+'</option>').join('');
const reg={country:'DE',search:'',page:1,edit:-1};
const cov={country:'',search:'',filter:'all',page:1};
let coverageAll=[],coverageVisible=[];
const key=(code,city)=>code+'|'+norm(city);
function country(){return S.registry?.countries.find(c=>c.code===reg.country);}
function duplicateCity(code,name,skip=-1){return S.registry.cities.some((c,i)=>i!==skip&&c.country_code===code&&norm(c.name)===norm(name));}
function saveRegistry(){saveLocal(REG_KEY,S.registry);}
function types(selected){
 return [['secondary','Secondary city'],['tourist','Tourist destination / area'],['capital','Capital']].map(x=>'<option value="'+x[0]+'" '+(selected===x[0]?'selected':'')+'>'+x[1]+'</option>').join('');
}
function ensureCapital(c,capital){
 if(!c)return;
 const old=clean(c.capital),fresh=clean(capital);
 if(old&&norm(old)!==norm(fresh)){
   S.registry.cities.filter(x=>x.country_code===c.code&&norm(x.name)===norm(old)).forEach(x=>x.kinds=(x.kinds||[]).filter(y=>y!=='capital'));
 }
 c.capital=fresh;
 if(fresh){
   const entry=S.registry.cities.find(x=>x.country_code===c.code&&norm(x.name)===norm(fresh));
   if(entry){if(!entry.kinds.includes('capital'))entry.kinds.push('capital');}
   else S.registry.cities.push({country_code:c.code,name:fresh,kinds:['capital'],source:'admin-edited'});
 }
}
function renderRegistry(){
 const h=get('br-p2-registry');if(!h||!S.registry)return;
 const current=country()||S.registry.countries[0];if(!current)return;reg.country=current.code;
 const rows=S.registry.cities.map((row,index)=>({...row,index})).filter(r=>r.country_code===reg.country&&(!reg.search||norm(r.name).includes(norm(reg.search)))).sort((a,b)=>a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(rows.length/100));reg.page=Math.max(1,Math.min(reg.page,pages));
 const editing=S.registry.cities[reg.edit];
 h.innerHTML='<h2>Master City Registry</h2><p class="br-p2-muted">250 country/territory seeds, capitals, secondary cities and tourist destinations. This is a research reference, not a claim that each city has an active venue. Edits are stored in this browser until exported and committed.</p>'+
 '<div class="br-p2-grid">'+stat('Countries / territories',S.registry.countries.length)+stat('Cities / destinations',S.registry.cities.length)+stat('Capital entries',S.registry.cities.filter(x=>(x.kinds||[]).includes('capital')).length)+'</div>'+
 '<div class="br-p2-actions"><button type="button" id="br-reg-export" class="btn primary-btn pill-btn">⬇ Export registry JSON</button>'+
 '<label class="btn secondary-btn pill-btn">Import registry JSON<input type="file" id="br-reg-import" accept=".json" hidden></label>'+
 '<button id="br-reg-reset" class="btn secondary-btn pill-btn">Reset to published registry</button></div>'+
 '<div class="br-p2-filters"><label>Country<select id="br-reg-country">'+S.registry.countries.map(c=>'<option value="'+esc(c.code)+'" '+(reg.country===c.code?'selected':'')+'>'+esc(c.name)+' ('+esc(c.code)+')</option>').join('')+'</select></label>'+
 '<label>City search<input id="br-reg-search" value="'+esc(reg.search)+'" placeholder="City name"></label></div>'+
 '<div class="br-p2-inline"><label>Country name<input id="br-reg-country-name" value="'+esc(current.name)+'"></label>'+
 '<label>Capital / administrative seat<input id="br-reg-country-capital" value="'+esc(current.capital||'')+'"></label>'+
 '<button type="button" id="br-reg-country-save" class="btn primary-btn pill-btn">Save country</button></div>'+
 '<details class="br-p2-details"><summary>Add country / territory</summary><div class="br-p2-inline"><label>Code (2–5 letters)<input id="br-reg-add-code" placeholder="XX"></label>'+
 '<label>Country name<input id="br-reg-add-name"></label><label>Capital<input id="br-reg-add-capital"></label>'+
 '<button id="br-reg-add-country" class="btn primary-btn pill-btn">Add country</button></div></details>'+
 '<div class="br-p2-inline"><label>New city or destination<input id="br-reg-add-city" placeholder="Enter location"></label>'+
 '<label>Classification<select id="br-reg-add-type">'+types('secondary')+'</select></label>'+
 '<button id="br-reg-add-location" class="btn primary-btn pill-btn">Add location</button></div>'+
 (editing&&editing.country_code===reg.country?'<div class="br-p2-inline br-p2-edit"><label>Edit location<input id="br-reg-edit-name" value="'+esc(editing.name)+'"></label>'+
 '<label>Classification<select id="br-reg-edit-type">'+types(editing.kinds?.[0]||'secondary')+'</select></label>'+
 '<button id="br-reg-edit-save" class="btn primary-btn pill-btn">Save edit</button><button id="br-reg-edit-cancel" class="btn secondary-btn pill-btn">Cancel</button></div>':'')+
 '<h3>'+esc(current.name)+' · '+fmt(rows.length)+' destinations</h3><div class="br-p2-scroll"><table class="br-p2-table"><thead><tr><th>City / destination</th><th>Classification</th><th>Origin</th><th>Actions</th></tr></thead><tbody>'+
 rows.slice((reg.page-1)*100,reg.page*100).map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc((c.kinds||[]).join(' + '))+'</td><td>'+esc(c.source||'')+'</td><td>'+
 '<button class="br-p2-link" data-city-edit="'+c.index+'">Edit</button> · <button class="br-p2-link br-p2-danger" data-city-delete="'+c.index+'">Delete</button></td></tr>').join('')+'</tbody></table></div>'+
 pagination('registry',reg.page,pages)+
 '<p class="br-p2-muted">Export the edited registry and commit it to GitHub when you want changes to persist across browsers. No venue/event JSON is changed by editing this list.</p>';
}
function addCountry(){
 const code=clean(get('br-reg-add-code')?.value).toUpperCase(),name=clean(get('br-reg-add-name')?.value),capital=clean(get('br-reg-add-capital')?.value);
 if(!/^[A-Z]{2,5}$/.test(code)||!name){notify('A 2–5-letter code and country name are required.');return;}
 if(S.registry.countries.some(x=>x.code===code||norm(x.name)===norm(name))){notify('Country code/name already exists.');return;}
 const c={code,name,capital:''};S.registry.countries.push(c);S.registry.countries.sort((a,b)=>a.name.localeCompare(b.name));ensureCapital(c,capital);
 reg.country=code;reg.search='';reg.page=1;saveRegistry();renderRegistry();
}
function saveCountry(){
 const c=country(),name=clean(get('br-reg-country-name')?.value),capital=clean(get('br-reg-country-capital')?.value);
 if(!c||!name){notify('Enter a country name.');return;}
 if(S.registry.countries.some(x=>x!==c&&norm(x.name)===norm(name))){notify('That country name already exists.');return;}
 c.name=name;ensureCapital(c,capital);saveRegistry();renderRegistry();notify('Country updated in local registry.');
}
function addCity(){
 const name=clean(get('br-reg-add-city')?.value),kind=get('br-reg-add-type')?.value;
 if(!name||duplicateCity(reg.country,name)){notify('Destination must be named and unique within the country.');return;}
 if(kind==='capital')ensureCapital(country(),name);
 else S.registry.cities.push({country_code:reg.country,name,kinds:[kind],source:'admin-edited'});
 reg.search='';saveRegistry();renderRegistry();notify('Destination added locally.');
}
function saveCity(){
 const item=S.registry.cities[reg.edit],name=clean(get('br-reg-edit-name')?.value),kind=get('br-reg-edit-type')?.value;
 if(!item||!name||duplicateCity(item.country_code,name,reg.edit)){notify('Destination name is empty or duplicated.');return;}
 const c=country();
 if(item.kinds.includes('capital')&&norm(c.capital)===norm(item.name)&&kind!=='capital')c.capital='';
 item.name=name;item.kinds=[kind];item.source='admin-edited';
 if(kind==='capital')ensureCapital(c,name);
 reg.edit=-1;saveRegistry();renderRegistry();notify('Location updated locally.');
}
function deleteCity(index){
 const item=S.registry.cities[index];
 if(!item||!window.confirm('Delete '+item.name+' from the local city registry? No venues or events will be deleted.'))return;
 const c=country();if(c&&norm(c.capital)===norm(item.name))c.capital='';
 S.registry.cities.splice(index,1);reg.edit=-1;saveRegistry();renderRegistry();
}
async function importRegistry(file){
 if(!file)return;
 try{
   const value=JSON.parse(await file.text()),codes=new Set(),names=new Set(),cities=new Set();
   if(!Array.isArray(value.countries)||!Array.isArray(value.cities))throw Error('JSON requires countries and cities arrays.');
   for(const c of value.countries){
     if(!/^[A-Z]{2,5}$/.test(c.code)||!clean(c.name)||codes.has(c.code)||names.has(norm(c.name)))throw Error('Invalid or duplicated country: '+c.name);
     codes.add(c.code);names.add(norm(c.name));
   }
   for(const c of value.cities){
     const id=key(c.country_code,c.name);
     if(!codes.has(c.country_code)||!clean(c.name)||!Array.isArray(c.kinds)||cities.has(id))throw Error('Invalid or duplicated city: '+c.name);
     cities.add(id);
   }
   if(!window.confirm('Replace LOCAL city registry with '+value.countries.length+' countries and '+value.cities.length+' destinations?'))return;
   S.registry=value;reg.country=value.countries[0]?.code||'DE';reg.edit=-1;S.selected.clear();saveRegistry();renderRegistry();notify('Registry imported locally.');
 }catch(e){notify('Registry import failed: '+e.message);}
}
async function resetRegistry(){
 if(!window.confirm('Discard your local city registry edits and reload the published version?'))return;
 try{
   const value=await P.fetchRegistry(true);
   localStorage.removeItem(REG_KEY);S.registry=value;reg.country='DE';reg.edit=-1;S.selected.clear();renderRegistry();notify('Published registry restored.');
 }catch(e){notify('Reset failed: '+e.message);}
}
function registryClick(button){
 if(button.id==='br-reg-export')downloadJSON(S.registry,'admin-city-registry.json');
 else if(button.id==='br-reg-reset')resetRegistry();
 else if(button.id==='br-reg-country-save')saveCountry();
 else if(button.id==='br-reg-add-country')addCountry();
 else if(button.id==='br-reg-add-location')addCity();
 else if(button.id==='br-reg-edit-save')saveCity();
 else if(button.id==='br-reg-edit-cancel'){reg.edit=-1;renderRegistry();}
 else if(button.dataset.cityEdit!==undefined){reg.edit=Number(button.dataset.cityEdit);renderRegistry();}
 else if(button.dataset.cityDelete!==undefined)deleteCity(Number(button.dataset.cityDelete));
 else if(button.dataset.registryPage!==undefined){reg.page+=Number(button.dataset.registryPage);renderRegistry();}
}
function registryChange(input){
 if(input.id==='br-reg-country'){reg.country=input.value;reg.search='';reg.page=1;reg.edit=-1;renderRegistry();}
 else if(input.id==='br-reg-import'){const file=input.files?.[0];importRegistry(file);input.value='';}
}
function registryInput(input){
 if(input.id==='br-reg-search'){
   const caret=input.selectionStart,term=input.value;reg.search=term;reg.page=1;renderRegistry();
   const updated=get('br-reg-search');if(updated){updated.focus();updated.setSelectionRange(caret,caret);}
 }
}
function codeFor(countryName){
 const name=norm(countryName),alias=Object.entries(S.registry.aliases||{}).find(x=>norm(x[0])===name);
 const canonical=alias?norm(alias[1]):name;
 return S.registry.countries.find(c=>norm(c.name)===canonical||norm(c.code)===canonical)?.code||'?'+clean(countryName||'Unknown');
}
function getCoverage(){
 if(!S.registry)return[];
 const result=new Map(),countryNames=new Map(S.registry.countries.map(c=>[c.code,c.name]));
 for(const item of S.registry.cities)result.set(key(item.country_code,item.name),{code:item.country_code,city:item.name,kinds:item.kinds||[],registered:true,venues:0,cruising:0,events:0});
 const venueMap=new Map(S.venues.map(v=>[clean(v.Venue_ID),v]));
 const count=(row,mode)=>{
   const loc=location(row,venueMap),code=codeFor(loc.country);
   for(const city of loc.cities.length?loc.cities:['(City unspecified)']){
     const id=key(code,city);
     const item=result.get(id)||{code,city,kinds:[],registered:false,venues:0,cruising:0,events:0};
     const which=mode==='events'?'events':norm(row.Category)==='cruising area'?'cruising':'venues';
     item[which]++;result.set(id,item);
   }
 };
 S.venues.forEach(row=>count(row,'venues'));S.events.forEach(row=>count(row,'events'));
 return [...result.values()].map(x=>({...x,country:countryNames.get(x.code)||x.code.replace(/^\?/,''),total:x.venues+x.cruising+x.events}))
 .sort((a,b)=>a.country.localeCompare(b.country)||a.city.localeCompare(b.city));
}
function filterCoverage(){
 const f=cov;coverageAll=getCoverage();
 return coverageAll.filter(x=>{
   if(f.country&&x.country!==f.country)return false;
   if(f.search&&!norm(x.city).includes(norm(f.search)))return false;
   if(f.filter==='covered'&&x.total===0)return false;
   if(f.filter==='uncovered'&&x.total!==0)return false;
   if(f.filter==='low'&&x.total>2)return false;
   if(f.filter==='unregistered'&&x.registered)return false;
   return true;
 });
}
function renderCoverage(){
 const h=get('br-p2-coverage');if(!h||!S.registry)return;
 coverageVisible=filterCoverage();
 const countries=[...new Set(coverageAll.map(x=>x.country))].sort();
 const pages=Math.max(1,Math.ceil(coverageVisible.length/100));cov.page=Math.max(1,Math.min(cov.page,pages));
 const showing=coverageVisible.slice((cov.page-1)*100,cov.page*100);
 h.innerHTML='<h2>City Coverage Manager</h2><p class="br-p2-muted">Counts use current working records. Events inherit their linked venue country/city when needed. Zero coverage means no Backroom records — it does not mean there are no venues.</p>'+
 '<div class="br-p2-grid">'+stat('Destinations considered',coverageAll.length)+stat('Without records',coverageAll.filter(x=>!x.total).length)+stat('Outside registry',coverageAll.filter(x=>!x.registered).length)+'</div>'+
 '<div class="br-p2-filters"><label>Country<select data-cover="country">'+countryOptions(countries,cov.country)+'</select></label>'+
 '<label>City contains<input data-cover="search" value="'+esc(cov.search)+'" placeholder="All cities"></label>'+
 '<label>Coverage<select data-cover="filter">'+[['all','All destinations'],['covered','With records'],['uncovered','No records'],['low','2 or fewer records'],['unregistered','Not yet in registry']].map(x=>'<option value="'+x[0]+'" '+(cov.filter===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label></div>'+
 '<div class="br-p2-actions"><span id="br-coverage-selected">'+fmt(coverageVisible.length)+' matching destinations · '+fmt(S.selected.size)+' selected</span>'+
 '<button id="br-cover-page" class="btn secondary-btn pill-btn">Select Page</button><button id="br-cover-all" class="btn secondary-btn pill-btn">Select All Filtered</button>'+
 '<button id="br-cover-clear" class="btn secondary-btn pill-btn">Clear Selection</button><button id="br-cover-copy" class="btn primary-btn pill-btn">Copy Selected Cities</button>'+
 '<button id="br-cover-export" class="btn secondary-btn pill-btn">Download Coverage CSV</button></div>'+
 '<div class="br-p2-scroll"><table class="br-p2-table"><thead><tr><th>✓</th><th>Country</th><th>Destination</th><th>Venues</th><th>Cruising</th><th>Events</th><th>Total</th><th>Registry</th></tr></thead><tbody>'+
 showing.map(x=>'<tr><td><input type="checkbox" data-cover-select="'+esc(key(x.code,x.city))+'" '+(S.selected.has(key(x.code,x.city))?'checked':'')+'></td>'+
 '<td class="br-p3-flag" title="'+esc(x.country)+'" aria-label="'+esc(x.country)+'">'+flagHTML(x.country)+'</td><td>'+esc(x.city)+'</td><td>'+fmt(x.venues)+'</td><td>'+fmt(x.cruising)+'</td><td>'+fmt(x.events)+'</td><td><strong>'+fmt(x.total)+'</strong></td>'+
 '<td>'+(x.registered?esc(x.kinds.join(', ')):'<span class="br-p2-warn">Unregistered</span>')+'</td></tr>').join('')+'</tbody></table></div>'+pagination('coverage',cov.page,pages);
}
function applySelection(mode){
 if(mode==='clear')S.selected.clear();
 else{
   const rows=mode==='page'?coverageVisible.slice((cov.page-1)*100,cov.page*100):coverageVisible;
   rows.forEach(x=>S.selected.add(key(x.code,x.city)));
 }
 renderCoverage();
}
async function copyText(text){
 try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(text);notify('Selected destinations copied.');
 }catch{
   const box=get('clipboard-text');
   if(box){box.value=text;get('clipboard-float')?.classList.remove('hidden');box.dispatchEvent(new Event('input'));box.focus();box.select();notify('Destinations placed in the Admin Clipboard. Use Copy there.');}
   else window.prompt('Copy destinations:',text);
 }
}
function coverageClick(button){
 if(button.id==='br-cover-page')applySelection('page');
 else if(button.id==='br-cover-all')applySelection('all');
 else if(button.id==='br-cover-clear')applySelection('clear');
 else if(button.id==='br-cover-copy'){
   const rows=coverageAll.filter(x=>S.selected.has(key(x.code,x.city)));
   if(!rows.length)notify('Select at least one destination.');else copyText(rows.map(x=>x.country+' — '+x.city).join('\n'));
 }else if(button.id==='br-cover-export'){
   downloadCSV(coverageVisible.map(x=>({Country:x.country,City:x.city,Venues:x.venues,Cruising_Areas:x.cruising,Events:x.events,Total:x.total,In_Registry:x.registered,Classification:x.kinds.join(', ')})),'backroom_city_coverage.csv');
 }else if(button.dataset.coveragePage!==undefined){cov.page+=Number(button.dataset.coveragePage);renderCoverage();}
}
function coverageChange(input){
 const field=input.dataset.cover;
 if(field){cov[field]=input.value;cov.page=1;renderCoverage();}
 if(input.dataset.coverSelect!==undefined){
   if(input.checked)S.selected.add(input.dataset.coverSelect);else S.selected.delete(input.dataset.coverSelect);
   const target=get('br-coverage-selected');if(target)target.textContent=fmt(coverageVisible.length)+' matching destinations · '+fmt(S.selected.size)+' selected';
 }
}
function renderZones(){
 const host=get('br-p2-zones');if(!host)return;
 host.innerHTML='<div class="br-p3-zone-intro"><h2>📚 Zone Splitting & Geographic Research Rules</h2>'+
 '<p>Keep the research structure consistent across the whole Backroom database. The registry is a worldwide list of places worth considering, <strong>not</strong> evidence that a venue or cruising location exists.</p>'+
 '<div class="br-p2-grid">'+stat('Countries / territories in registry',S.registry?.countries?.length||0)+stat('City / destination entries',S.registry?.cities?.length||0)+'</div></div>'+
 '<div class="br-p3-zone-grid">'+
 '<details class="br-p3-zone-card" open><summary>🌍 1. Geographic coverage</summary>'+
 '<p>Start with countries rather than restricting research to Europe. Include capitals, relevant secondary cities and visitor destinations even when they are small.</p>'+
 '<p><strong>Examples:</strong> 🇪🇸 Ibiza, Sitges and Torremolinos; 🇮🇹 Venice; 🇬🇷 Mykonos; 🇭🇷 Hvar; and coastal/island areas with nightlife or travel significance.</p>'+
 '<p>City size by itself must <strong>never</strong> decide whether a location is included or excluded.</p></details>'+
 '<details class="br-p3-zone-card" open><summary>🧩 2. Preserve existing Backroom zones</summary>'+
 '<p>Use the established Backroom zone identifier when one exists. For new research, group by country and logical travel regions, preserving the exact cities included in each group.</p>'+
 '<p>If a country has many candidates, divide it into independently manageable batches (for example Group A, Group B and Group C). Do not silently drop any city.</p></details>'+
 '<details class="br-p3-zone-card"><summary>🗺️ 3. Regional boundaries & duplicate prevention</summary>'+
 '<p>A source may refer to a suburb, island, destination or metro area differently from the registry. Keep its original location text in research notes and match it to the best canonical country/city without inventing a second venue.</p>'+
 '<p>Check accents, translated city names and neighboring administrative boundaries before considering two candidate records separate.</p></details>'+
 '<details class="br-p3-zone-card"><summary>📋 4. Prioritize gaps using City Coverage</summary>'+
 '<p>Open the 🗺️ Coverage tab and use the <strong>No records</strong> or <strong>2 or fewer records</strong> filter. Select cities and copy the country/city list into your research brief.</p>'+
 '<p>Zero Backroom entries means <em>no records currently represented in our database</em>. It does not prove that no venues exist locally.</p></details>'+
 '<details class="br-p3-zone-card"><summary>🔎 5. Research and verification boundaries</summary>'+
 '<p>City Registry is a planning tool, not an approved publication list. Retain source URLs, previous IDs and research notes. Verify new venues and cruising areas against relevant evidence before importing them.</p>'+
 '<p>Keep uncertain candidates separate from existing published records, and do not manufacture venue IDs or events just because a destination was selected.</p></details>'+
 '<details class="br-p3-zone-card"><summary>📦 6. Handover to the Scrape Builder</summary>'+
 '<p>The upcoming Scrape Builder should read this same registry, support selecting entire countries or specific cities, and accept the exact copied list from City Coverage.</p>'+
 '<p>Batch membership, source selection and existing permanent Venue_ID / Event_ID matching must remain explicit and reusable.</p></details>'+
 '</div><p class="br-p2-muted">Everything needed for Zone Splitting is available here; you do not need to open a separate document.</p>';
}
P.register('registry',{render:renderRegistry,click:registryClick,change:registryChange,input:registryInput});
P.register('coverage',{render:renderCoverage,click:coverageClick,change:coverageChange});
P.register('zones',{render:renderZones});
window.BRP2Geo={getCoverage,renderRegistry,renderCoverage,key};
})();
