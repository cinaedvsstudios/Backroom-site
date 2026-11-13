/* Backroom Phase 2 — spreadsheet import and completeness tools. */
(() => {
'use strict';
const P=window.BRP2;if(!P)throw Error('Phase 2 shell missing');
const {state:S,D,get,esc,fmt,clean,norm,notify,saveLocal,readLocal,downloadCSV,downloadJSON,options,stat,pagination,location}=P;
const upload={mode:'venues',operation:'add',parsed:null,plan:null,error:''};
const HIST_KEY='br_admin_completeness_log_v2';
const flag=name=>window.BackroomAdminFlags?.flag(name)||'🌐';
const flagHTML=name=>window.BackroomAdminFlags?.html(name)||'<span aria-hidden="true">🌐</span>';
const countryOptions=(items,selected)=>'<option value="">🌐 All countries</option>'+items.map(name=>'<option value="'+esc(name)+'" '+(selected===name?'selected':'')+'>'+esc(name)+'</option>').join('');
const q={type:'all',check:'any',country:'',city:'',status:'',page:1};
let qResult=null;let history=readLocal(HIST_KEY,[]);
function renderImports(){
 const host=get('br-p2-imports');if(!host)return;
 const m=upload.mode,op=upload.operation,plan=upload.plan,rows=S[m];
 let html='<h2>CSV / JSON Import & Export</h2><p class="br-p2-muted">Reads every field found anywhere in your current JSON, including later or unusual fields. Imports are staged locally, never pushed directly to live listings.</p>'+
 '<div class="br-p2-grid">'+stat('Current records',rows.length)+stat('Available fields',D.allKeys(rows).length)+stat('Upload records',upload.parsed?.rows?.length||0)+'</div>'+
 '<div class="br-p2-filters"><label>Database<select id="br-p2-upload-mode"><option value="venues" '+(m==='venues'?'selected':'')+'>Venues & Cruising Areas</option><option value="events" '+(m==='events'?'selected':'')+'>Events</option></select></label>'+
 '<label>Mode<select id="br-p2-upload-operation">'+[['add','Update / Add'],['replace','Replace All'],['remove','Remove by ID']].map(x=>'<option value="'+x[0]+'" '+(op===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
 '<label>Upload CSV / TSV / JSON<input type="file" id="br-p2-upload-file" accept=".csv,.tsv,.json"></label></div>'+
 '<p class="br-p2-muted">'+(op==='add'?'Existing rows: only supplied nonblank fields change. Use __CLEAR__ to clear deliberately. New rows require their required fields.':op==='replace'?'Destructive full-dataset replacement. Missing IDs are removed from the draft; a typed warning and preview are required.':'Provide an ID-only list. Matched records are removed only after review and typed confirmation.')+'</p>'+
 '<div class="br-p2-actions"><button id="br-p2-csv-export" class="btn secondary-btn pill-btn">⬇ Complete CSV</button>'+
 '<button id="br-p2-json-export" class="btn secondary-btn pill-btn">⬇ '+(m==='venues'?'listings.json':'events.json')+'</button></div>';
 if(upload.error)html+='<div class="br-p2-error">'+esc(upload.error)+'</div>';
 if(plan){
   html+='<h3>Import preview — not yet applied</h3><div class="br-p2-grid">'+[['Existing',plan.counts.existing],['Uploaded',plan.counts.uploaded],['After',plan.counts.after],['New',plan.counts.added],['Modified',plan.counts.updated],['Removed',plan.counts.removed]].map(x=>stat(x[0],x[1])).join('')+'</div>'+
   '<p class="br-p2-muted">'+fmt(plan.changes.length)+' changes, '+fmt(plan.errors.length)+' errors, '+fmt(plan.warnings.length)+' warnings.</p>'+
   (plan.errors.length?'<div class="br-p2-error">Blocking problems:<ul>'+plan.errors.slice(0,35).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+
   (plan.warnings.length?'<details class="br-p2-details"><summary>Review warnings ('+fmt(plan.warnings.length)+')</summary><ul>'+plan.warnings.slice(0,45).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'')+
   (op==='replace'&&plan.counts.removed?'<div class="br-p2-error">WARNING: This would delete '+fmt(plan.counts.removed)+' records in your '+m+' working draft.</div>':'')+
   '<div class="br-p2-scroll"><table class="br-p2-table"><thead><tr><th>Action</th><th>ID</th><th>Current</th><th>After</th><th>Fields</th></tr></thead><tbody>'+
   plan.changes.slice(0,100).map(x=>'<tr><td>'+esc(x.kind)+'</td><td>'+esc(x.id)+'</td><td>'+esc(x.before?.Name||x.before?.Event_Name||'—')+'</td><td>'+esc(x.after?.Name||x.after?.Event_Name||'—')+'</td><td>'+esc(x.fields.join(', '))+'</td></tr>').join('')+'</tbody></table></div>'+
   '<p class="br-p2-muted">First '+Math.min(100,plan.changes.length)+' changes shown. All rows were checked.</p>'+
   '<div class="br-p2-actions"><button id="br-p2-upload-apply" class="btn primary-btn pill-btn" '+(plan.errors.length||!plan.changes.length?'disabled':'')+'>Apply reviewed changes to local draft</button><button id="br-p2-upload-discard" class="btn secondary-btn pill-btn">Discard preview</button></div>';
 }
 host.innerHTML=html;
}
function clearUpload(){upload.parsed=null;upload.plan=null;upload.error='';}
async function processFile(file){
 clearUpload();if(!file)return;
 try{
   const parsed=D.readFile(await file.text(),file.name);
   upload.parsed=parsed;
   upload.plan=D.makePlan(S[upload.mode],parsed.rows,parsed.fields,upload.mode,upload.operation,S.venues);
 }catch(e){upload.error=e.message;}renderImports();
}
function applyUpload(){
 const plan=upload.plan;if(!plan||plan.errors.length||!plan.changes.length)return;
 const m=upload.mode;
 if(upload.operation==='replace'){
   if(window.prompt('This replaces ALL '+m+' records and deletes '+plan.counts.removed+' missing IDs. Type REPLACE ALL to apply.')!=='REPLACE ALL')return;
 }else if(upload.operation==='remove'){
   if(window.prompt('This deletes '+plan.counts.removed+' '+m+' records from the working draft. Type REMOVE to apply.')!=='REMOVE')return;
 }else if(!window.confirm('Apply '+plan.changes.length+' reviewed additions/updates to the '+m+' local working draft?'))return;
 const before=S[m];P.commitDataset(m,plan.output,before,'Phase 2 '+upload.operation,plan.counts);
 clearUpload();renderImports();notify('Applied to '+m+' local draft. Download JSON to publish.');
}
function importClick(button){
 if(button.id==='br-p2-csv-export')downloadCSV(S[upload.mode],'backroom_'+upload.mode+'_'+new Date().toISOString().slice(0,10)+'.csv');
 else if(button.id==='br-p2-json-export')downloadJSON(S[upload.mode],upload.mode==='venues'?'listings.json':'events.json');
 else if(button.id==='br-p2-upload-apply')applyUpload();
 else if(button.id==='br-p2-upload-discard'){clearUpload();renderImports();}
}
function importChange(input){
 if(input.id==='br-p2-upload-mode'){upload.mode=input.value;clearUpload();renderImports();}
 if(input.id==='br-p2-upload-operation'){upload.operation=input.value;clearUpload();renderImports();}
 if(input.id==='br-p2-upload-file'){const file=input.files?.[0];processFile(file);input.value='';}
}
const CHECKS=[
 {id:'any',name:'Any missing / invalid information',scope:'all'},
 {id:'id',name:'Missing ID',scope:'all'},
 {id:'duplicate',name:'Duplicate ID',scope:'all'},
 {id:'status',name:'Missing or unknown status',scope:'all'},
 {id:'description',name:'Missing description',scope:'all'},
 {id:'short',name:'Description shorter than 100 characters',scope:'all'},
 {id:'sources',name:'Missing source URLs',scope:'all'},
 {id:'tags',name:'Missing tags (Vibe_Tags)',scope:'all'},
 {id:'image',name:'Missing image URL',scope:'all'},
 {id:'website',name:'Missing official website',scope:'venues'},
 {id:'address',name:'Missing venue address/location',scope:'venues'},
 {id:'gps',name:'Missing GPS coordinates',scope:'venues'},
 {id:'coordinates',name:'Invalid GPS coordinates',scope:'venues'},
 {id:'map',name:'Missing usable map location',scope:'venues'},
 {id:'rating',name:'Missing or invalid general rating',scope:'venues'},
 {id:'url',name:'Malformed URL',scope:'all'},
 {id:'date',name:'Missing or invalid event date',scope:'events'},
 {id:'time',name:'Missing event start time',scope:'events'},
 {id:'linked',name:'Unknown linked Venue_ID',scope:'events'}
];
const isCruise=row=>norm(row.Category)==='cruising area';
const allowedStatus=new Set(['live','hold','closed','flag','review','cancelled','canceled','expired','archived','draft','tba','pending']);
const applies=(check,mode)=>check.scope==='all'||check.scope===mode;
function checkedRecords(){
 const venueIndex=new Map(S.venues.map(r=>[clean(r.Venue_ID),r])),counts={venues:new Map(),events:new Map()};
 for(const mode of ['venues','events'])for(const row of S[mode]){
   const id=clean(row[D.idField(mode)]);counts[mode].set(id,(counts[mode].get(id)||0)+1);
 }
 const records=[...S.venues.map(r=>({row:r,mode:'venues',type:isCruise(r)?'cruising':'venues',loc:location(r,venueIndex)})),...S.events.map(r=>({row:r,mode:'events',type:'events',loc:location(r,venueIndex)}))];
 return records.map(item=>{
   const {row:r,mode}=item,ev=mode==='events',id=clean(r[D.idField(mode)]),issues=[],description=clean(ev?r.Event_Description:r.Description);
   if(!id)issues.push('id');
   if(id&&(counts[mode].get(id)||0)>1)issues.push('duplicate');
   if(!allowedStatus.has(norm(r.Status)))issues.push('status');
   if(!description)issues.push('description');
   if(description.length<100)issues.push('short');
   if(!r.Source_URLs)issues.push('sources');
   if(r.Vibe_Tags==null||String(Array.isArray(r.Vibe_Tags)?r.Vibe_Tags.join(''):r.Vibe_Tags).trim()==='')issues.push('tags');
   if(!(ev?r.Event_Image_URL:r.Image_URL))issues.push('image');
   if(!ev){
     if(!r.Website_URL)issues.push('website');
     if(!r.Address)issues.push('address');
     if(r.Latitude===null||r.Latitude===undefined||r.Latitude===''||r.Longitude===null||r.Longitude===undefined||r.Longitude==='')issues.push('gps');
     if((r.Latitude!==undefined&&r.Latitude!==null&&r.Latitude!==''&&(!Number.isFinite(Number(r.Latitude))||Math.abs(Number(r.Latitude))>90))||
        (r.Longitude!==undefined&&r.Longitude!==null&&r.Longitude!==''&&(!Number.isFinite(Number(r.Longitude))||Math.abs(Number(r.Longitude))>180)))issues.push('coordinates');
     if(!r.Google_Maps_URL&&!r.Native_Map_Query&&(!r.Latitude||!r.Longitude)&&!(Array.isArray(r.Map_Points)&&r.Map_Points.length))issues.push('map');
     if(!Number.isFinite(Number(r.Rating_General))||Number(r.Rating_General)<=0)issues.push('rating');
   }
   if(Object.entries(r).some(([key,v])=>/_URL$/.test(key)&&!['Image_URL','Event_Image_URL','Share_URL','Source_URLs'].includes(key)&&v!==null&&v!==undefined&&v!==''&&!/^https?:\/\/\S+/i.test(String(v))))issues.push('url');
   if(ev){
     const date=clean(r.Event_Date);
     if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||!Number.isNaN(Date.parse(date))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)issues.push('date');
     if(!r.Event_Start_Time)issues.push('time');
     if(!r.Venue_ID||!venueIndex.has(clean(r.Venue_ID)))issues.push('linked');
   }
   return {...item,issues};
 });
}
function checkResult(){
 const records=checkedRecords();
 const selected=records.filter(item=>{
   if(q.type!=='all'&&item.type!==q.type)return false;
   if(q.country&&norm(item.loc.country)!==norm(q.country))return false;
   if(q.city&&!item.loc.cities.some(x=>norm(x).includes(norm(q.city))))return false;
   if(q.status&&norm(item.row.Status)!==norm(q.status))return false;
   return true;
 });
 const matching=selected.filter(item=>{
   const available=item.issues.filter(id=>applies(CHECKS.find(c=>c.id===id),item.mode));
   return q.check==='any'?available.length>0:available.includes(q.check);
 });
 return {examined:selected.length,rows:matching};
}
function runCheck(){
 const value=checkResult(),date=new Date().toISOString();
 qResult={...value,date};
 history.push({date,type:q.type,check:q.check,country:q.country,city:q.city,status:q.status,examined:value.examined,matched:value.rows.length,percent:value.examined?Math.round(value.rows.length/value.examined*1000)/10:0,downloaded:false});
 history=history.slice(-120);saveLocal(HIST_KEY,history);q.page=1;renderQuality();
}
function exportQuality(type){
 if(!qResult?.rows.length)return;
 const records=qResult.rows.map(x=>x.row);
 if(type==='json')downloadJSON(records,'backroom_completeness_matches.json');
 else downloadCSV(records,'backroom_completeness_matches.csv');
 const logged=history.find(x=>x.date===qResult.date);if(logged)logged.downloaded=true;
 saveLocal(HIST_KEY,history);renderQuality();
}
function renderQuality(){
 const host=get('br-p2-quality');if(!host)return;
 const mode=q.type==='events'?'events':'venues';
 const available=CHECKS.filter(check=>check.id==='any'||q.type==='all'||applies(check,mode));
 const index=new Map(S.venues.map(x=>[clean(x.Venue_ID),x]));
 const countries=[...new Set([...S.venues,...S.events].map(x=>location(x,index).country).filter(Boolean))].sort();
 const statuses=[...new Set([...S.venues,...S.events].map(x=>clean(x.Status)).filter(Boolean))].sort();
 let html='<h2>Data Quality & Completeness</h2><p class="br-p2-muted">Filter and run checks on working records. Only the timestamp, filters, examined/matching counts, percentage and download state are kept in history.</p>'+
 '<div class="br-p2-filters"><label>Record type<select data-quality="type">'+[['all','All records'],['venues','Venues'],['cruising','Cruising Areas'],['events','Events']].map(x=>'<option value="'+x[0]+'" '+(q.type===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
 '<label>Check<select data-quality="check">'+available.map(x=>'<option value="'+x.id+'" '+(q.check===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'+
 '<label>Country<select data-quality="country">'+countryOptions(countries,q.country)+'</select></label>'+
 '<label>City contains<input data-quality="city" value="'+esc(q.city)+'"></label>'+
 '<label>Status<select data-quality="status">'+options(statuses,q.status,'Any status')+'</select></label></div>'+
 '<div class="br-p2-actions"><button id="br-p2-check-run" class="btn primary-btn pill-btn">▶ Run check</button><button id="br-p2-open-jql" class="btn secondary-btn pill-btn">🔎 Open Query / JQL Maker</button>'+
 '<button id="br-p2-check-json" class="btn secondary-btn pill-btn" '+(!qResult?.rows.length?'disabled':'')+'>Export matching JSON</button>'+
 '<button id="br-p2-check-csv" class="btn secondary-btn pill-btn" '+(!qResult?.rows.length?'disabled':'')+'>Export matching CSV</button></div>';
 if(qResult){
   const total=qResult.rows.length,pages=Math.max(1,Math.ceil(total/100));q.page=Math.max(1,Math.min(q.page,pages));
   html+='<h3>'+fmt(total)+' matches / '+fmt(qResult.examined)+' examined ('+(qResult.examined?(total/qResult.examined*100).toFixed(1):'0.0')+'%)</h3>'+
   '<p class="br-p2-muted">Results are from the last executed check. Filter changes require running again. Exports contain complete matching records.</p>'+
   '<div class="br-p2-scroll"><table class="br-p2-table"><thead><tr><th>ID</th><th>Name</th><th>City / Country</th><th>Status</th><th>Issues</th></tr></thead><tbody>'+
   qResult.rows.slice((q.page-1)*100,q.page*100).map(x=>'<tr><td>'+esc(x.row.Event_ID||x.row.Venue_ID||'Missing')+'</td><td>'+esc(x.row.Event_Name||x.row.Name||'')+'</td><td>'+(x.loc.country?flagHTML(x.loc.country)+' ':'')+esc(x.loc.cities.join(', '))+'</td><td>'+esc(x.row.Status||'')+'</td><td>'+esc(x.issues.map(id=>CHECKS.find(c=>c.id===id)?.name||id).join('; '))+'</td></tr>').join('')+'</tbody></table></div>'+pagination('quality',q.page,pages);
 }
 html+='<details class="br-p2-details"><summary>Check history ('+history.length+')</summary><div class="br-p2-scroll"><table class="br-p2-table"><thead><tr><th>Executed</th><th>Filter</th><th>Examined</th><th>Matches</th><th>Percent</th><th>JSON/CSV exported</th></tr></thead><tbody>'+
 history.slice().reverse().slice(0,40).map(x=>'<tr><td>'+esc(x.date.slice(0,16).replace('T',' '))+'</td><td>'+esc(x.type+' · '+x.check)+'</td><td>'+fmt(x.examined)+'</td><td>'+fmt(x.matched)+'</td><td>'+x.percent+'%</td><td>'+(x.downloaded?'Yes':'No')+'</td></tr>').join('')+'</tbody></table></div></details>';
 host.innerHTML=html;
}
function qualityChange(element){
 const key=element.dataset.quality;if(!key)return;
 q[key]=element.value;q.page=1;
 const mode=q.type==='events'?'events':'venues';
 if(q.check!=='any'&&!applies(CHECKS.find(x=>x.id===q.check),mode))q.check='any';
 renderQuality();
}
function qualityClick(button){
 if(button.id==='br-p2-open-jql')get('br-phase2-nav')?.querySelector('[data-p2-tab="jql"]')?.click();
 else if(button.id==='br-p2-check-run')runCheck();
 else if(button.id==='br-p2-check-json')exportQuality('json');
 else if(button.id==='br-p2-check-csv')exportQuality('csv');
 else if(button.dataset.qualityPage){q.page+=Number(button.dataset.qualityPage);renderQuality();}
}
P.register('imports',{render:renderImports,click:importClick,change:importChange});
P.register('quality',{render:renderQuality,click:qualityClick,change:qualityChange});
window.BRP2Quality={checkResult,checkedRecords,renderQuality};
})();
