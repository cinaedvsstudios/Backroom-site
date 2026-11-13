/* Backroom Phase 2 UI shell v0.22 — safely extends the existing admin. */
(() => {
'use strict';
if(window.BRP2)return;
const D=window.BackroomPhase2Data;
if(!D)throw Error('Backroom Phase 2 data utilities are missing');
const get=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clean=v=>String(v??'').trim(),norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const fmt=n=>Number(n||0).toLocaleString('en-GB');
const notify=text=>typeof showToast==='function'?showToast(text):alert(text);
const state={active:false,tab:'imports',busy:false,venues:[],events:[],registry:null,history:[],selected:new Set()};
const sections={};
const clone=obj=>JSON.parse(JSON.stringify(obj));
function saveLocal(key,value){localStorage.setItem(key,JSON.stringify(value));}
function readLocal(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback;}catch{return fallback;}}
function download(body,name,type='application/json;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([body],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function downloadCSV(rows,name){download(D.csvSerialize(rows),name,'text/csv;charset=utf-8');}
function downloadJSON(rows,name){download(JSON.stringify(rows,null,2)+'\n',name);}
function options(values,chosen,all='All'){
 return '<option value="">'+esc(all)+'</option>'+values.map(v=>'<option value="'+esc(v)+'" '+(chosen===v?'selected':'')+'>'+esc(v)+'</option>').join('');
}
function stat(name,value){return '<div class="br-p2-stat"><strong>'+fmt(value)+'</strong>'+esc(name)+'</div>';}
function pagination(prefix,page,last){return '<div class="br-p2-pages"><button type="button" class="btn secondary-btn pill-btn" data-'+prefix+'-page="-1" '+(page<=1?'disabled':'')+'>Previous</button>Page '+page+' of '+last+'<button type="button" class="btn secondary-btn pill-btn" data-'+prefix+'-page="1" '+(page>=last?'disabled':'')+'>Next</button></div>';}
function location(row,index){
 let country=clean(row.Country||row.Event_Country||row.Venue_Country||row.Location_Country);
 let city=clean(row.City||row.Event_City||row.Venue_City||row.Location_City);
 if(row.Event_ID&&(!country||!city)){
   const linked=index.get(clean(row.Venue_ID))||{};
   country=country||clean(linked.Country);city=city||clean(linked.City);
 }
 const cities=(norm(city)==='washington, d.c.'?[city]:city.split(/[;,|]/)).map(clean).filter(Boolean);
 return {country,cities};
}
function countriesInUse(){
 const index=new Map(state.venues.map(x=>[clean(x.Venue_ID),x]));
 return [...new Set([...state.venues,...state.events].map(x=>location(x,index).country).filter(Boolean))].sort();
}
async function fetchRows(mode){
 if(currentMode===mode&&Array.isArray(draftData)&&draftData.length)return clone(draftData);
 const key='br_admin_'+mode+'_draft',raw=localStorage.getItem(key);
 if(raw!==null){try{const rows=JSON.parse(raw);if(Array.isArray(rows))return rows;}catch{}}
 const file=mode==='venues'?'listings.json':'events.json';
 const response=await fetch(file+'?phase2='+Date.now(),{cache:'no-store'});
 if(!response.ok)throw Error(file+' returned HTTP '+response.status);
 const records=await response.json();
 if(!Array.isArray(records))throw Error(file+' must be a JSON array');
 return records;
}
async function fetchRegistry(force=false){
 if(!force){const working=readLocal('br_admin_city_registry_working_v1',null);if(working&&Array.isArray(working.countries)&&Array.isArray(working.cities))return working;}
 const response=await fetch('admin-city-registry.json?phase2='+Date.now(),{cache:'no-store'});
 if(!response.ok)throw Error('Registry HTTP '+response.status);
 const value=await response.json();
 if(!Array.isArray(value.countries)||!Array.isArray(value.cities))throw Error('Registry missing countries or cities');
 return value;
}
async function refresh(){
 if(state.busy)return;
 state.busy=true;if(get('br-p2-refresh'))get('br-p2-refresh').disabled=true;
 try{
   const [venues,events,registry]=await Promise.all([fetchRows('venues'),fetchRows('events'),fetchRegistry()]);
   state.venues=venues;state.events=events;state.registry=registry;
   if(get('br-p2-error'))get('br-p2-error').textContent='';
   render();
 }catch(error){console.error(error);if(get('br-p2-error'))get('br-p2-error').textContent=error.message;notify('Phase 2 data load failed: '+error.message);}
 finally{state.busy=false;if(get('br-p2-refresh'))get('br-p2-refresh').disabled=false;}
}
function commitDataset(mode,after,before,operation,counts){
 if(currentMode===mode){
   draftData=clone(after);saveDraftsToLocal();renderTable();
 }else{
   saveLocal('br_admin_'+mode+'_draft',after);
   const total=rows=>mode==='events'?{events:rows.length}:{venues:rows.filter(r=>norm(r.Category)!=='cruising area').length,cruising:rows.filter(r=>norm(r.Category)==='cruising area').length};
   window.BackroomAdminReporting?.recordOperation?.({type:'change',date:new Date().toISOString(),mode,operation,before:total(before),after:total(after),added:counts.added,modified:counts.updated,removed:counts.removed});
 }
 state[mode]=clone(after);
}
function hide(){state.active=false;if(get('br-phase2-view'))get('br-phase2-view').style.display='none';get('nav-data-quality')?.classList.remove('br-nav-active');}
function show(tab){
 if(typeof tab==='string'&&['imports','quality','registry','coverage','zones'].includes(tab))state.tab=tab;
 state.active=true;get('br-phase2-view').style.display='block';
 for(const id of ['view-tables','view-editor','view-terminology','view-avatars','br-reporting-view']){const node=get(id);if(node){node.style.display='none';if(id!=='br-reporting-view')node.classList.add('hidden');}}
 document.querySelectorAll('#nav-venues,#nav-events,#nav-cruising,#nav-reporting').forEach(x=>x.classList.remove('br-nav-active'));
 get('nav-data-quality')?.classList.add('br-nav-active');refresh();
}
function render(){
 if(!state.registry)return;
 const summary=get('br-p2-summary');
 if(summary)summary.textContent=fmt(state.venues.length)+' venue/area records · '+fmt(state.events.length)+' events · '+fmt(state.registry.countries.length)+' countries · '+fmt(state.registry.cities.length)+' destinations';
 for(const tab of ['imports','quality','registry','coverage','zones'])get('br-p2-'+tab)?.classList.toggle('hidden',state.tab!==tab);
 document.querySelectorAll('#br-phase2-nav button').forEach(button=>button.classList.toggle('br-p2-active',button.dataset.p2Tab===state.tab));
 sections[state.tab]?.render?.();
}
function register(name,handlers){sections[name]=handlers;}
function install(){
 const main=document.querySelector('#admin-shell > main.admin-main'),after=get('nav-reporting')||get('nav-events');
 if(!main||!after){console.error('Phase 2 admin shell not found');return;}
 const nav=document.createElement('div');nav.id='nav-data-quality';nav.className='sidebar-item';
 nav.innerHTML='<span class="icon">🗂️</span><span class="sidebar-text">Data Quality & Coverage</span>';after.after(nav);
 nav.addEventListener('click',show);
 document.addEventListener('click',event=>{if(event.target.closest('.sidebar-item')&&!event.target.closest('#nav-data-quality'))hide();},true);
 const root=document.createElement('section');root.id='br-phase2-view';root.style.display='none';
 root.innerHTML='<div class="br-p2-top"><h1>🗂️ Data Management & Geographic Coverage</h1><p class="br-p2-muted">Phase 2 — complete schemas, safer imports, data quality and worldwide coverage. Local drafts only.</p>'+
 '<div class="br-p2-actions"><button type="button" id="br-p2-refresh" class="btn secondary-btn pill-btn">↻ Refresh data</button><span id="br-p2-summary"></span></div></div><p class="br-p2-error" id="br-p2-error"></p>'+
 '<nav id="br-phase2-nav">'+[['imports','Spreadsheet Tools'],['quality','Completeness'],['registry','City Registry'],['coverage','City Coverage'],['zones','Zone Rules']].map(x=>'<button class="btn secondary-btn pill-btn" type="button" data-p2-tab="'+x[0]+'">'+x[1]+'</button>').join('')+'</nav>'+
 '<section id="br-p2-imports"></section><section id="br-p2-quality" class="hidden"></section><section id="br-p2-registry" class="hidden"></section><section id="br-p2-coverage" class="hidden"></section><section id="br-p2-zones" class="hidden"></section>';
 main.appendChild(root);
 // Link the expanded checks back to Reporting's existing completeness overview,
 // keeping one overview and one detailed workflow rather than disconnected tools.
 const summary=get('br-completeness-overview')?.closest('.br-panel-inner');
 if(summary&&!get('br-p2-report-link')){
   const link=document.createElement('button');
   link.id='br-p2-report-link';link.type='button';link.className='btn secondary-btn pill-btn';
   link.style.width='auto';link.textContent='↗ Open detailed data-quality checks';
   link.addEventListener('click',()=>show('quality'));summary.appendChild(link);
 }
 root.addEventListener('click',event=>{
   const btn=event.target.closest('button');if(!btn)return;
   if(btn.dataset.p2Tab){state.tab=btn.dataset.p2Tab;render();return;}
   if(btn.id==='br-p2-refresh'){refresh();return;}
   sections[state.tab]?.click?.(btn,event);
 });
 root.addEventListener('change',event=>sections[state.tab]?.change?.(event.target,event));
 root.addEventListener('input',event=>sections[state.tab]?.input?.(event.target,event));
 // Replace the older CSV export that only used fields in record zero.
 document.addEventListener('click',event=>{
   if(!event.target.closest('#btn-export-csv')||!['venues','events'].includes(currentMode))return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   if(!Array.isArray(draftData)||!draftData.length){notify('No records to export');return;}
   downloadCSV(draftData,'backroom_'+currentMode+'_'+new Date().toISOString().slice(0,10)+'.csv');
 },true);
}
window.BRP2={state,D,get,esc,fmt,clean,norm,notify,saveLocal,readLocal,downloadCSV,downloadJSON,options,stat,pagination,location,countriesInUse,commitDataset,fetchRegistry,refresh,render,register,show,hide};
window.BackroomAdminPhase2={show,hide,refresh,getState:()=>state,version:'0.22.0'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
