/* Backroom Admin Reporting v1: local metrics, advanced queries, exports and backups. */
(() => {
'use strict';
const DB_NAME='backroom_admin_reporting_v1', DB_VERSION=1;
let database=null;
const state={data:{venues:[],events:[]},scope:{events:true,venues:false,cruising:false},conditions:[{op:'OR',key:'status:Live'}],results:null,lastQueryId:null,groupCount:1,logs:[],opened:false,capturing:false,countrySort:'total',countryAsc:false};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt=n=>Number(n||0).toLocaleString('en-GB');
const isCruising=r=>String(r?.Category||'').trim().toLowerCase()==='cruising area';
const blank=v=>v===undefined||v===null||String(v).trim()==='';
const now=()=>new Date().toISOString();
const typeLabel=()=>state.scope.events?'Events':state.scope.venues&&state.scope.cruising?'Venues + Cruising Areas':state.scope.venues?'Venues':state.scope.cruising?'Cruising Areas':'None';
const writeFile=(content,name,type='application/json')=>{
    const url=URL.createObjectURL(new Blob([content],{type:type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
function openDB(){
    if(database)return Promise.resolve(database);
    return new Promise((resolve,reject)=>{
        if(!window.indexedDB)return reject(Error('IndexedDB unavailable'));
        const request=indexedDB.open(DB_NAME,DB_VERSION);
        request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('logs'))db.createObjectStore('logs',{keyPath:'id',autoIncrement:true});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});};
        request.onsuccess=()=>{database=request.result;resolve(database);};
        request.onerror=()=>reject(request.error);
    });
}
async function storeAction(store,mode,value){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
        const tx=db.transaction(store,'readwrite');const req=tx.objectStore(store)[mode](value);
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
}
async function getAllLogs(){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
        const req=db.transaction('logs','readonly').objectStore('logs').getAll();
        req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
    });
}
async function getMeta(key){
    const db=await openDB();return new Promise((resolve,reject)=>{
        const req=db.transaction('meta','readonly').objectStore('meta').get(key);
        req.onsuccess=()=>resolve(req.result?.value);req.onerror=()=>reject(req.error);
    });
}
const setMeta=(key,value)=>storeAction('meta','put',{key,value});
async function touchChanged(){const change=now();await setMeta('lastChangeAt',change);if(!await getMeta('firstChangeAt'))await setMeta('firstChangeAt',change);}
async function writeLog(entry){
    try{const id=await storeAction('logs','add',entry);await touchChanged();return id;}
    catch(err){console.error('Backroom Reporting log failed:',err);return null;}
}
async function updateLog(entry){
    try{await storeAction('logs','put',entry);await touchChanged();}
    catch(err){console.error('Backroom Reporting update failed:',err);}
}
async function recordOperation(entry){
    const id=await writeLog(entry);
    if(state.opened)refreshLogViews();
    return id;
}
async function obtain(mode){
    const key=mode==='events'?'br_admin_events_draft':'br_admin_venues_draft';
    try{const parsed=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(parsed)&&parsed.length)return parsed;}catch{}
    if(typeof currentMode!=='undefined'&&currentMode===mode&&Array.isArray(draftData)&&draftData.length)return draftData.slice();
    const response=await fetch((mode==='events'?'events.json':'listings.json')+'?r='+Date.now());
    if(!response.ok)throw Error('Unable to read '+mode+' (HTTP '+response.status+')');
    const rows=await response.json();if(!Array.isArray(rows))throw Error(mode+' JSON is not an array');return rows;
}
function scopedRows(){
    if(state.scope.events)return state.data.events;
    if(!state.scope.venues&&!state.scope.cruising)return[];
    if(state.scope.venues&&state.scope.cruising)return state.data.venues;
    return state.data.venues.filter(r=>state.scope.cruising?isCruising(r):!isCruising(r));
}
function checkList(){
    const common=[
        ['status:Live','Status is Live'],['status:Hold','Status is Hold'],['status:Flag','Status is Flagged'],
        ['status:Closed','Status is Closed'],['status:Review','Status is Review'],['status:!Live','Status is not Live']
    ];
    const e=[
        ['event-month','Event date is'],
        ['empty:Event_Start_Time','Missing start time'],['empty:Event_End_Time','Missing end time'],['empty:Event_Date','Missing event date'],
        ['empty:Event_URL','Missing event URL'],['empty:Ticket_URL','Missing ticket URL'],['empty:Source_URLs','Missing source URLs'],
        ['empty:Price_Info','Missing price information'],['empty:Dresscode_Info','Missing dress code'],
        ['empty:Event_Description','Missing description'],['short:Event_Description:100','Description under 100 characters'],
        ['short:Event_Description:200','Description under 200 characters'],['broken:Venue_ID','Unlinked venue ID'],
        ['recurrence','Weekly event missing recurrence day'],['invalid:Event_Date','Invalid date']
    ];
    const v=[
        ['empty:Website_URL','Missing website'],['empty:Instagram_URL','Missing Instagram'],
        ['empty:Source_URLs','Missing source URLs'],['empty:Image_URL','Missing image'],
        ['empty:Address','Missing address'],['empty:Google_Maps_URL','Missing Google Maps URL'],
        ['maps','Missing usable map location'],['gps','Missing GPS coordinates'],
        ['empty:Opening_Days','Missing opening days'],['empty:Opening_Open_Time','Missing opening time'],
        ['empty:Opening_Notes','Missing opening notes'],['empty:Description','Missing description'],
        ['short:Description:100','Description under 100 characters'],['short:Description:200','Description under 200 characters'],
        ['empty:Category','Missing category'],['rating:Rating_General','Missing overall rating'],
        ['rating:Rating_Age_Range','Missing age-range rating'],['rating:Rating_Darkroom','Missing darkroom rating'],
        ['rating:Rating_Size','Missing size rating'],['rating:Rating_Cost','Missing cost rating'],
        ['rating:Rating_Location','Missing location rating'],['rating:Rating_Busyness','Missing popularity rating']
    ];
    const c=[
        ['empty:Source_URLs','Missing source URLs'],['maps','Missing usable map location'],['gps','Missing GPS coordinates'],
        ['empty:Google_Maps_URL','Missing Google Maps URL'],['empty:Opening_Notes','Missing access / opening notes'],
        ['empty:Description','Missing description'],['short:Description:100','Description under 100 characters'],
        ['short:Description:200','Description under 200 characters'],['rating:Rating_General','Missing overall rating'],
        ['rating:Rating_Age_Range','Missing age-range rating'],['rating:Rating_Location','Missing location rating'],
        ['rating:Rating_Busyness','Missing popularity rating']
    ];
    const applicable=state.scope.events?e:state.scope.venues&&state.scope.cruising?v.filter(x=>c.some(y=>y[0]===x[0])):state.scope.venues?v:state.scope.cruising?c:[];
    const records=scopedRows();
    const countries=[...new Set(records.map(r=>String(r.Country||'').trim()).filter(Boolean))].sort();
    const cities=[...new Set(records.flatMap(r=>String(r.City||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort();
    return [...applicable,...common,...countries.map(x=>['country:'+x,'Country is '+x]),...cities.map(x=>['city:'+x,'City is '+x])].map(([key,label])=>({key,label}));
}
function monthValue(value) {
    const match=String(value||'').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if(!match)return null;
    return {year:Number(match[1]),month:Number(match[2])};
}
function defaultMonth(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function monthTitle(value){
    const selected=monthValue(value);
    if(!selected)return 'Select a month';
    return new Date(selected.year,selected.month-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
}
function conditionLabel(key,value){
    if(key==='event-month')return 'Event date is '+monthTitle(value);
    return checkList().find(c=>c.key===key)?.label||key;
}
function occursInMonth(row,value){
    const month=monthValue(value);
    if(!month)return false;
    const startDate=dateOnly(row.Event_Date);
    if(!startDate)return false;
    const toUtc=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
    const start=toUtc(startDate);
    const monthStart=Date.UTC(month.year,month.month-1,1);
    const monthEnd=Date.UTC(month.year,month.month,1);
    if(String(row.Recurrence_Type||'').trim().toLowerCase()!=='weekly'){
        return start>=monthStart&&start<monthEnd;
    }
    const finalDate=dateOnly(row.Recurrence_Until);
    const last=finalDate?toUtc(finalDate):Infinity;
    if(start>=monthEnd||last<monthStart||last<start)return false;
    const step=7*86400000;
    const first=start>=monthStart?start:start+Math.ceil((monthStart-start)/step)*step;
    return first<monthEnd&&first<=last;
}
function predicate(row,key,value){
    if(key==='event-month')return occursInMonth(row,value);
    if(key.startsWith('empty:'))return blank(row[key.slice(6)]);
    if(key.startsWith('short:')){const s=key.split(':');return String(row[s[1]]||'').trim().length<Number(s[2]);}
    if(key.startsWith('rating:')){const v=row[key.slice(7)];return blank(v)||Number(v)<=0||!Number.isFinite(Number(v));}
    if(key.startsWith('status:')){const value=String(row.Status||'').trim().toLowerCase(),sel=key.slice(7).toLowerCase();return sel==='!live'?value!=='live':value===sel;}
    if(key.startsWith('country:'))return String(row.Country||'').trim().toLowerCase()===key.slice(8).toLowerCase();
    if(key.startsWith('city:'))return String(row.City||'').toLowerCase().split(',').some(v=>v.trim()===key.slice(5).toLowerCase());
    if(key==='gps')return !(Number.isFinite(Number(row.Latitude))&&Number.isFinite(Number(row.Longitude))&&!blank(row.Latitude)&&!blank(row.Longitude));
    if(key==='maps'){
        const point=Array.isArray(row.Map_Points)&&row.Map_Points.some(p=>p.Google_Maps_URL||(!blank(p.Latitude)&&!blank(p.Longitude)));
        return !point&&blank(row.Google_Maps_URL)&&(!row.Latitude||!row.Longitude)&&blank(row.Native_Map_Query);
    }
    if(key==='recurrence')return String(row.Recurrence_Type||'').trim().toLowerCase()==='weekly'&&blank(row.Recurrence_Day);
    if(key==='invalid:Event_Date')return blank(row.Event_Date)||Number.isNaN(Date.parse(String(row.Event_Date)));
    if(key==='broken:Venue_ID')return !state.data.venues.some(v=>String(v.Venue_ID||'')===String(row.Venue_ID||''));
    return false;
}
function generatedQuery(conditions=state.conditions){
    if(!conditions.length)return'';
    let q='('+conditionLabel(conditions[0].key,conditions[0].value)+')';
    conditions.slice(1).forEach(c=>{
        q=c.op==='EXCLUDE'?'('+q+' AND NOT ('+conditionLabel(c.key,c.value)+'))':'('+q+' '+c.op+' ('+conditionLabel(c.key,c.value)+'))';
    });
    return q;
}
function match(row,conditions){
    if(!conditions.length)return false;
    let value=predicate(row,conditions[0].key,conditions[0].value);
    for(const c of conditions.slice(1)){const next=predicate(row,c.key,c.value);if(c.op==='AND')value=value&&next;else if(c.op==='EXCLUDE')value=value&&!next;else value=value||next;}
    return value;
}
function renderScope(){
    const wrap=document.getElementById('br-report-scopes');if(!wrap)return;
    wrap.innerHTML=['events','venues','cruising'].map(k=>'<label><input type="checkbox" data-scope="'+k+'" '+(state.scope[k]?'checked ':'')+((k==='events'&&(state.scope.venues||state.scope.cruising))||(k!=='events'&&state.scope.events)?'disabled ':'')+'>'+({events:'Events',venues:'Venues',cruising:'Cruising Areas'}[k])+'</label>').join('');
}
function resetInvalidConditions(){
    const list=checkList();
    state.conditions=state.conditions.filter(c=>list.some(o=>o.key===c.key));
    if(!state.conditions.length&&list.length)state.conditions=[{op:'OR',key:list[0].key}];
    state.conditions.forEach(c=>{if(c.key==='event-month'&&!monthValue(c.value))c.value=defaultMonth();});
    state.results=null;
}
function renderBuilder(){
    renderScope();const list=checkList(),wrap=document.getElementById('br-condition-rows');
    wrap.innerHTML=state.conditions.map((c,i)=>'<div class="br-condition-row" data-row="'+i+'">'+
        '<select data-operator="'+i+'" aria-label="Operator '+(i+1)+'">'+['OR','AND','EXCLUDE'].map(op=>'<option '+(c.op===op?'selected ':'')+'value="'+op+'">'+op+'</option>').join('')+'</select>'+
        '<div class="br-condition-controls"><select data-condition="'+i+'" aria-label="Condition '+(i+1)+'">'+list.map(x=>'<option '+(x.key===c.key?'selected ':'')+'value="'+esc(x.key)+'">'+esc(x.label)+'</option>').join('')+'</select>'+
        (c.key==='event-month'?'<input type="month" class="br-month-choice" data-condition-value="'+i+'" aria-label="Event month and year" value="'+esc(monthValue(c.value)?c.value:defaultMonth())+'">':'')+'</div>'+
        (state.conditions.length>1?'<button class="btn secondary-btn" type="button" data-remove-condition="'+i+'" title="Remove condition">×</button>':'')+'</div>').join('');
    const target=document.getElementById('br-query-preview');
    target.textContent=generatedQuery()||'Select a dataset and condition to begin.';
    document.getElementById('br-execute').disabled=!state.conditions.length||!scopedRows().length;
    const resultPanel=document.getElementById('br-results');
    if(!state.results)resultPanel.innerHTML='<p class="br-muted">Set your conditions, then press Execute Query. No filtering occurs until you execute.</p>';
}
function refreshScopeStats(){
    const v=state.data.venues,e=state.data.events;
    const stat=document.getElementById('br-stats');
    stat.innerHTML=[['Venues',v.filter(r=>!isCruising(r)).length],['Cruising Areas',v.filter(isCruising).length],['Events',e.length]].map(([label,count])=>'<div class="br-stat"><strong>'+fmt(count)+'</strong><span>'+label+'</span></div>').join('');
    const countries=new Map();
    v.forEach(r=>{const country=r.Country||'(Missing country)';const cur=countries.get(country)||{venue:0,cruise:0,events:0};cur[isCruising(r)?'cruise':'venue']++;countries.set(country,cur);});
    e.forEach(r=>{const country=r.Country||'(Missing country)';const cur=countries.get(country)||{venue:0,cruise:0,events:0};cur.events++;countries.set(country,cur);});
    const table=document.getElementById('br-country-table');
    const entries=[...countries.entries()].sort((a,b)=>{
        const field=state.countrySort;
        const ax=field==='country'?a[0]:(field==='total'?a[1].venue+a[1].cruise+a[1].events:a[1][field]);
        const bx=field==='country'?b[0]:(field==='total'?b[1].venue+b[1].cruise+b[1].events:b[1][field]);
        const result=field==='country'?String(ax).localeCompare(String(bx)):Number(ax)-Number(bx);
        return state.countryAsc?result:-result;
    });
    table.innerHTML='<thead><tr><th data-country-sort="country">Country ↕</th><th data-country-sort="venue">Venues ↕</th><th data-country-sort="cruise">Cruising ↕</th><th data-country-sort="events">Events ↕</th><th data-country-sort="total">Total ↕</th></tr></thead><tbody>'+
      entries.map(([country,n])=>'<tr><td>'+esc((window.BackroomAdminFlags?.flag(country)||'🌍')+' '+country)+'</td><td>'+fmt(n.venue)+'</td><td>'+fmt(n.cruise)+'</td><td>'+fmt(n.events)+'</td><td>'+fmt(n.venue+n.cruise+n.events)+'</td></tr>').join('')+'</tbody>';
    renderMonths();
}
function dateOnly(v){if(!v)return null;const s=String(v).trim(),d=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);const t=d?new Date(Number(d[3]),Number(d[2])-1,Number(d[1])):new Date(s);return Number.isNaN(t.getTime())?null:t;}
function renderMonths(){
    const out=document.getElementById('br-months');const e=state.data.events,nowDate=new Date();
    const months=Array.from({length:8},(_,i)=>{const d=new Date(nowDate.getFullYear(),nowDate.getMonth()+i,1);return {key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}),records:0,occurrences:0};});
    const end=new Date(nowDate.getFullYear(),nowDate.getMonth()+8,1);
    e.forEach(row=>{
        const start=dateOnly(row.Event_Date);if(!start)return;
        const stamp=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
        const home=months.find(m=>m.key===stamp(start));if(home)home.records++;
        if(String(row.Recurrence_Type||'').toLowerCase()==='weekly'){
            const until=dateOnly(row.Recurrence_Until)||end;
            let d=new Date(start.getFullYear(),start.getMonth(),start.getDate());
            let iterations=0;
            while(d<end&&d<=until&&iterations++<500){
                const target=months.find(m=>m.key===stamp(d));if(target)target.occurrences++;
                d.setDate(d.getDate()+7);
            }
        } else {if(home)home.occurrences++;}
    });
    const max=Math.max(1,...months.map(m=>m.occurrences));
    out.innerHTML='<table class="br-table"><thead><tr><th>Month</th><th>Stored records</th><th>Event occurrences</th></tr></thead><tbody>'+
      months.map(m=>'<tr><td>'+m.label+'</td><td>'+fmt(m.records)+'</td><td><div class="br-bar" style="width:'+Math.max(1,Math.round(100*m.occurrences/max))+'%"></div>'+fmt(m.occurrences)+'</td></tr>').join('')+'</tbody></table>'+
      '<p class="br-muted">Weekly recurrences are projected within these eight months using Event_Date and Recurrence_Until; open-ended recurring events continue within the displayed period. Counts include all statuses.</p>';
}
function overview(){
    const holder=document.getElementById('br-completeness-overview'),rows=scopedRows();
    const list=checkList().filter(o=>o.key!=='event-month'&&!o.key.startsWith('status:')&&!o.key.startsWith('country:')&&!o.key.startsWith('city:'));
    if(!rows.length){holder.innerHTML='<p class="br-muted">Select a dataset to view completeness counts.</p>';return;}
    const sorted=list.map(x=>({...x,count:rows.filter(r=>predicate(r,x.key)).length})).sort((a,b)=>b.count-a.count);
    holder.innerHTML='<table class="br-table"><thead><tr><th>Check (click to add)</th><th>Matching</th><th>Percent</th></tr></thead><tbody>'+
      sorted.map(x=>'<tr><td><button class="br-link" data-add-check="'+esc(x.key)+'">'+esc(x.label)+'</button></td><td>'+fmt(x.count)+'</td><td>'+((x.count/rows.length)*100).toFixed(1)+'%</td></tr>').join('')+'</tbody></table>';
}
async function execute(){
    const rows=scopedRows(),conditions=state.conditions.map(c=>({...c}));const matched=rows.filter(r=>match(r,conditions));
    const counts=conditions.map(c=>({condition:conditionLabel(c.key,c.value),matching:rows.filter(r=>predicate(r,c.key,c.value)).length}));
    const query=generatedQuery(conditions);
    state.results={rows:matched,examined:rows.length,query,counts,scope:typeLabel(),date:now()};state.groupCount=1;
    const log={type:'query',date:state.results.date,scope:state.results.scope,query,conditions,examined:rows.length,matched:matched.length,conditionCounts:counts,downloaded:false,groups:0};
    state.lastQueryId=await writeLog(log);renderResults();refreshLogViews();
}
function groupName(i){let str='',n=i+1;while(n>0){n--;str=String.fromCharCode(65+n%26)+str;n=Math.floor(n/26);}return 'Group '+str;}
function renderResults(){
    const x=state.results,box=document.getElementById('br-results');if(!x)return;
    const n=x.rows.length;state.groupCount=Math.max(1,Math.min(state.groupCount,Math.max(1,n)));
    const groups=state.groupCount,base=Math.floor(n/groups),extra=n%groups;
    box.innerHTML='<h3>Executed results</h3><p class="br-query">'+esc(x.query)+'</p>'+
      '<div class="br-stats"><div class="br-stat"><strong>'+fmt(x.examined)+'</strong><span>Records examined</span></div><div class="br-stat"><strong>'+fmt(n)+'</strong><span>Unique matches</span></div></div>'+
      '<table class="br-table"><thead><tr><th>Condition</th><th>Individual matches</th></tr></thead><tbody>'+
      x.counts.map(c=>'<tr><td>'+esc(c.condition)+'</td><td>'+fmt(c.matching)+'</td></tr>').join('')+'</tbody></table>'+
      '<div class="br-actions"><button type="button" class="btn primary-btn pill-btn" id="br-download-results" '+(!n?'disabled':'')+'>⬇ Download JSON of Identified Records</button></div>'+
      '<div class="br-group-box"><h3>Split into Groups</h3><label>Number of groups <input id="br-group-count" type="number" min="1" max="'+Math.max(1,n)+'" value="'+groups+'"></label>'+
      '<p>Total records: <strong>'+fmt(n)+'</strong></p><div id="br-group-preview">'+
      Array.from({length:groups},(_,i)=>'<div>'+groupName(i)+' — '+fmt(base+(i<extra?1:0))+' records</div>').join('')+'</div>'+
      '<button type="button" class="btn primary-btn pill-btn" id="br-download-groups" '+(!n?'disabled':'')+'>⬇ Choose Folder & Save '+groups+' JSON '+(groups===1?'File':'Files')+'</button></div>'+
      '<p class="br-muted">Each file contains complete matching records. Records are not duplicated or modified.</p>';
    window.BackroomAdminPhase1?.onResultsRendered?.(state.results);
}
async function markDownloaded(groups){
    if(!state.lastQueryId)return;
    try{const logs=await getAllLogs();const item=logs.find(x=>x.id===state.lastQueryId);if(item){item.downloaded=true;item.groups=groups;await updateLog(item);refreshLogViews();}}catch{}
}
async function saveGroups(){
    const x=state.results;if(!x||!x.rows.length)return;
    const count=Math.max(1,Math.min(Number(state.groupCount)||1,x.rows.length));
    const base=Math.floor(x.rows.length/count),extra=x.rows.length%count;
    const files=[];let offset=0;for(let i=0;i<count;i++){const size=base+(i<extra?1:0);files.push({name:groupName(i)+'.json',content:JSON.stringify(x.rows.slice(offset,offset+size),null,2)});offset+=size;}
    try{
        if(!window.showDirectoryPicker) {
            if(!window.confirm('Your browser does not support choosing a download folder. Download each separate JSON file to your browser’s normal download location instead?'))return;
            files.forEach((file,i)=>setTimeout(()=>writeFile(file.content,file.name),i*180));
        } else {
            const folder=await window.showDirectoryPicker({mode:'readwrite'});
            for(const file of files){const handle=await folder.getFileHandle(file.name,{create:true});const writer=await handle.createWritable();await writer.write(file.content);await writer.close();}
        }
        await markDownloaded(count);message('Saved '+count+' separate JSON '+(count===1?'file':'files')+'.');
    } catch(error){if(error.name!=='AbortError'){message('Group download failed: '+error.message);console.error(error);}}
}
function message(value){if(typeof showToast==='function')showToast(value);else alert(value);}
function chartSvg(series){
  if(series.length<2)return'<p class="br-muted">More history points will appear here after subsequent changes.</p>';
  const w=800,h=274,left=68,right=20,top=20,bottom=52;
  const values=series.map(p=>Number(p.y)||0),lowest=Math.min(0,...values),highest=Math.max(...values,lowest+1);
  const max=Math.max(4,Math.ceil(highest/4)*4),chartH=h-top-bottom;
  const xy=series.map((item,i)=>({x:left+(w-left-right)*i/Math.max(1,series.length-1),y:top+(max-item.y)/(max-lowest)*chartH}));
  const points=xy.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const ticks=Array.from({length:5},(_,i)=>{
    const value=lowest+(max-lowest)*i/4,y=top+chartH-(i/4)*chartH;
    return '<line x1="'+left+'" y1="'+y+'" x2="'+(w-right)+'" y2="'+y+'" stroke="#33455e" stroke-dasharray="3 5"/>'+
      '<text x="'+(left-10)+'" y="'+(y+5)+'" fill="#c1d0de" text-anchor="end" font-size="13">'+fmt(Math.round(value))+'</text>';
  }).join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Query result history, vertical axis shows matching records" class="br-chart br-p3-chart">'+
    '<text x="17" y="'+(top+chartH/2)+'" fill="#a8c2dc" font-size="13" text-anchor="middle" transform="rotate(-90 17 '+(top+chartH/2)+')">Matches</text>'+ticks+
    '<line x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(h-bottom)+'" stroke="#a3b8ce"/>'+
    '<polyline fill="none" stroke="#49d2ff" stroke-width="3" points="'+points+'"/>'+
    xy.map((point,i)=>{
      const date=String(series[i].date||'Run '+(i+1)).replace('T',' ').slice(0,19);
      return '<circle cx="'+point.x+'" cy="'+point.y+'" r="7" fill="#49d2ff" stroke="#151b29" stroke-width="2" tabindex="0" data-br-chart-tip="'+esc(date+' · '+fmt(values[i])+' matches')+'"></circle>';
    }).join('')+
    '<text x="'+left+'" y="'+(h-15)+'" fill="#b8c9df" font-size="12">'+esc(String(series[0].date||'First run').slice(0,10))+'</text>'+
    '<text x="'+(w-right)+'" y="'+(h-15)+'" text-anchor="end" fill="#b8c9df" font-size="12">'+esc(String(series[series.length-1].date||'Latest run').slice(0,10))+'</text></svg>';
}
async function captureDataPoint(){
    if(state.capturing)return;
    state.capturing=true;
    const button=document.getElementById('br-capture-point');
    if(button){button.disabled=true;button.textContent='Reading published JSON…';}
    try{
        // A manual capture must read the currently published files, not possibly stale Admin drafts.
        // Query strings and no-store bypass browser caching; both files must load before logging.
        const stamp=Date.now();
        const readPublished=async filename=>{
            const response=await fetch(filename+'?report_capture='+stamp,{cache:'no-store'});
            if(!response.ok)throw Error(filename+' returned HTTP '+response.status);
            const rows=await response.json();
            if(!Array.isArray(rows))throw Error(filename+' does not contain a JSON array.');
            return rows;
        };
        const [venues,events]=await Promise.all([readPublished('listings.json'),readPublished('events.json')]);
        const counts={
            venues:venues.filter(row=>!isCruising(row)).length,
            cruising:venues.filter(isCruising).length,
            events:events.length
        };
        const entry={type:'snapshot',mode:'published',operation:'Capture Data Point',source:'Published JSON (GitHub Pages)',date:now(),after:counts};
        const id=await writeLog(entry);
        if(id===null)throw Error('Could not save the data point in Reporting history.');
        await refreshLogViews();
        message('Captured published totals: '+fmt(counts.venues)+' venues, '+fmt(counts.cruising)+' cruising areas and '+fmt(counts.events)+' events.');
    }catch(error){
        console.error('Backroom Reporting capture failed:',error);
        message('Capture failed; nothing was recorded. '+(error?.message||String(error)));
    }finally{
        state.capturing=false;
        const refreshed=document.getElementById('br-capture-point');
        if(refreshed){refreshed.disabled=false;refreshed.textContent='📌 Capture Data Point';}
    }
}
function buildGrowthSeries(history){
    const v=state.data.venues;
    // Seed each line with its earliest observed count, not a later pre-merge value.
    const earliestCount=(field,fallback)=>{
        for(const entry of history){
            if(entry.type==='snapshot'&&Number.isFinite(entry.after?.[field]))return entry.after[field];
            if(entry.type==='change'&&Number.isFinite(entry.before?.[field]))return entry.before[field];
        }
        return fallback;
    };
    const baseline={
        venues:earliestCount('venues',v.filter(r=>!isCruising(r)).length),
        cruising:earliestCount('cruising',v.filter(isCruising).length),
        events:earliestCount('events',state.data.events.length)
    };
    const points=[{...baseline,date:history[0]?.date||now(),type:'baseline'}];
    let totals={...baseline};
    history.forEach(entry=>{
        totals={...totals,...entry.after};
        points.push({...totals,date:entry.date,type:entry.type,operation:entry.operation,entry});
    });
    return points;
}
function growthChart(points){
  if(points.length<2)return '<p class="br-muted">Capture a data point to establish a published baseline, or change the data through Admin to begin the history.</p>';
  const drawn=points.slice(-80),w=850,h=315,left=73,right=22,top=25,bottom=61,chartH=h-top-bottom;
  const rawMax=Math.max(1,...drawn.flatMap(x=>[x.venues||0,x.cruising||0,x.events||0]));
  const ceiling=Math.max(4,Math.ceil(rawMax/4)*4);
  const lines=[['venues','Venues','#49d2ff'],['cruising','Cruising Areas','#ef6957'],['events','Events','#f0c94c']];
  const xy=(point,index,key)=>({
    x:left+(w-left-right)*index/Math.max(1,drawn.length-1),
    y:top+(ceiling-(Number(point[key])||0))/ceiling*chartH
  });
  const series=key=>drawn.map((point,i)=>{const pos=xy(point,i,key);return pos.x.toFixed(2)+','+pos.y.toFixed(2);}).join(' ');
  const grid=Array.from({length:5},(_,i)=>{
    const v=ceiling*i/4,y=top+chartH-i/4*chartH;
    return '<line x1="'+left+'" y1="'+y+'" x2="'+(w-right)+'" y2="'+y+'" stroke="#354359" stroke-dasharray="3 5"/>'+
      '<text x="'+(left-12)+'" y="'+(y+4)+'" text-anchor="end" font-size="13" fill="#cad9e8">'+fmt(Math.round(v))+'</text>';
  }).join('');
  const tooltip=point=>{
    const date=String(point.date||'').replace('T',' ').slice(0,19);
    const source=point.type==='snapshot'?'Published JSON capture':point.operation||'Historical totals';
    return date+' · '+source+'\nVenues: '+fmt(point.venues||0)+'\nCruising areas: '+fmt(point.cruising||0)+'\nEvents: '+fmt(point.events||0);
  };
  const markers=drawn.map((point,i)=>lines.map(([key,label,color])=>{
    const p=xy(point,i,key),published=point.type==='snapshot';
    return '<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="'+(published?7:5)+'" fill="'+color+'" stroke="#151b29" stroke-width="2" tabindex="0" data-br-chart-tip="'+esc(tooltip(point))+'"></circle>';
  }).join('')).join('');
  const first=String(drawn[0].date||'').slice(0,10);
  const last=String(drawn[drawn.length-1].date||'').slice(0,10);
  return '<div class="br-growth-legend">'+lines.map(x=>'<span style="color:'+x[2]+'">● '+x[1]+'</span>').join('')+'</div>'+
    '<svg class="br-chart br-p3-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Venues, cruising areas and events over time with labelled vertical axis">'+
    '<text x="18" y="'+(top+chartH/2)+'" font-size="14" fill="#a8c2dc" text-anchor="middle" transform="rotate(-90 18 '+(top+chartH/2)+')">Total records</text>'+grid+
    '<line x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(h-bottom)+'" stroke="#a3b8ce"/>'+
    lines.map(x=>'<polyline fill="none" stroke="'+x[2]+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="'+series(x[0])+'"/>').join('')+
    markers+
    '<text x="'+left+'" y="'+(h-19)+'" font-size="12" fill="#b8c9df">'+esc(first)+'</text>'+
    '<text x="'+(w-right)+'" y="'+(h-19)+'" font-size="12" fill="#b8c9df" text-anchor="end">'+esc(last)+'</text></svg>'+
    '<p class="br-muted">Hover over or focus a chart point to see its date and exact totals. Published captures are recorded independently of working-draft changes.</p>';
}
async function refreshLogViews(){
    try{state.logs=await getAllLogs();}catch(error){console.error(error);state.logs=[];}
    const logs=state.logs.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const history=state.logs.filter(x=>x.type==='change'||x.type==='snapshot').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const points=buildGrowthSeries(history);
    const growth=document.getElementById('br-growth');
    if(growth)growth.innerHTML='<h3>Database Growth History</h3>'+
      '<div class="br-capture-tools"><button type="button" id="br-capture-point" class="btn primary-btn pill-btn" '+(state.capturing?'disabled':'')+'>📌 Capture Data Point</button>'+
      '<span class="br-muted">Reads current published listings.json and events.json; saves the three totals and capture date locally. No record IDs or copies are stored.</span></div>'+
      growthChart(history.length?points:[])+
      '<div class="br-scroll"><table class="br-table"><thead><tr><th>Date</th><th>Operation</th><th>Venues</th><th>Cruising</th><th>Events</th><th>Added</th><th>Modified</th><th>Removed</th></tr></thead><tbody>'+
      points.slice(1).reverse().slice(0,50).map(point=>{
          const entry=point.entry;
          const snapshot=entry.type==='snapshot';
          const action=snapshot?'📌 Published · Capture Data Point':(entry.mode+' · '+entry.operation);
          return '<tr><td>'+esc(new Date(entry.date).toLocaleString('en-GB'))+'</td><td>'+esc(action)+'</td>'+
            '<td>'+fmt(point.venues)+'</td><td>'+fmt(point.cruising)+'</td><td>'+fmt(point.events)+'</td>'+
            '<td>'+(snapshot?'—':fmt(entry.added))+'</td><td>'+(snapshot?'—':fmt(entry.modified))+'</td><td>'+(snapshot?'—':fmt(entry.removed))+'</td></tr>';
      }).join('')+'</tbody></table></div>';
    const queryLogs=logs.filter(x=>x.type==='query');
    const qbox=document.getElementById('br-query-history');
    if(qbox){
        const selected=document.getElementById('br-history-query-select')?.value||'';
        const queries=[...new Set(queryLogs.map(x=>x.scope+' | '+x.query))].sort();
        const chosen=queries.includes(selected)?selected:queries[0]||'';
        const comparison=queryLogs.filter(x=>x.scope+' | '+x.query===chosen).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        qbox.innerHTML='<h3>Completeness Check History</h3><label>Compare identical queries</label>'+
          '<select id="br-history-query-select">'+queries.map(q=>'<option value="'+esc(q)+'" '+(q===chosen?'selected':'')+'>'+esc(q)+'</option>').join('')+'</select>'+
          chartSvg(comparison.map(x=>({y:x.matched,date:x.date})))+
          '<table class="br-table"><thead><tr><th>Executed</th><th>Dataset / Query</th><th>Examined</th><th>Matched</th><th>JSON saved</th></tr></thead><tbody>'+
          queryLogs.slice(0,60).map(x=>'<tr><td>'+esc(new Date(x.date).toLocaleString('en-GB'))+'</td><td>'+esc(x.scope+' — '+x.query)+'</td><td>'+fmt(x.examined)+'</td><td>'+fmt(x.matched)+'</td><td>'+(x.downloaded?'Yes ('+fmt(x.groups)+')':'No')+'</td></tr>').join('')+'</tbody></table>';
    }
    window.BackroomAdminPhase1?.onHistoryRendered?.(state.logs);
}
async function backupHistory(){
    try{
        const logs=await getAllLogs();
        const payload={format:'backroom-admin-reporting',version:1,exportedAt:now(),logs};
        const content=JSON.stringify(payload,null,2);
        let handle=await getMeta('backupHandle');
        if(!window.showSaveFilePicker){writeFile(content,'backroom_admin_history.json');}
        else{
            if(handle){try{const permission=await handle.queryPermission({mode:'readwrite'});if(permission!=='granted'){const granted=await handle.requestPermission({mode:'readwrite'});if(granted!=='granted')handle=null;}}catch{handle=null;}}
            if(!handle)handle=await window.showSaveFilePicker({suggestedName:'backroom_admin_history.json',types:[{description:'JSON',accept:{'application/json':['.json']}}]});
            const writer=await handle.createWritable();await writer.write(content);await writer.close();await setMeta('backupHandle',handle);
        }
        await setMeta('lastBackupAt',now());message('Reporting history saved.');document.getElementById('br-backup-reminder')?.classList.add('hidden');
    }catch(error){if(error.name!=='AbortError'){message('Reporting backup failed: '+error.message);console.error(error);}}
}
async function restoreHistory(file){
    if(!file)return;try{
        const data=JSON.parse(await file.text());
        if(data.format!=='backroom-admin-reporting'||!Array.isArray(data.logs))throw Error('Not a valid Backroom reporting backup.');
        if(!confirm('Replace local Reporting history with the '+data.logs.length+' entries in this backup?'))return;
        const db=await openDB();
        await new Promise((resolve,reject)=>{const tx=db.transaction('logs','readwrite');tx.objectStore('logs').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
        for(const item of data.logs){const clean={...item};delete clean.id;await storeAction('logs','add',clean);}
        await setMeta('lastBackupAt',now());await setMeta('lastChangeAt',now());
        state.lastQueryId=null;await refreshLogViews();message('Restored '+data.logs.length+' Reporting history entries.');
    }catch(error){message('Could not restore history: '+error.message);}
}
async function backupReminder(){
    try{const change=await getMeta('lastChangeAt'),backup=await getMeta('lastBackupAt'),first=await getMeta('firstChangeAt');
        if(!change)return;
        const anchor=backup||first;
        if(anchor&&Date.now()-Date.parse(anchor)>7*86400000&&(!backup||Date.parse(change)>Date.parse(backup))){
            document.getElementById('br-backup-reminder')?.classList.remove('hidden');
        }
    }catch{}
}
async function open(){
    state.opened=true;
    const root=document.getElementById('br-reporting-view');if(root)root.style.display='block';
    try{
        const [v,e]=await Promise.all([obtain('venues'),obtain('events')]);
        state.data={venues:v,events:e};
        refreshScopeStats();resetInvalidConditions();renderBuilder();overview();
        await refreshLogViews();await backupReminder();
    }catch(error){message('Unable to load Reporting data: '+error.message);}
}
function install(){
    const main=document.querySelector('#admin-shell > main.admin-main');
    if(!main) { console.error('Backroom Reporting: main admin container missing'); return; }
    const root=document.createElement('section');root.id='br-reporting-view';root.style.display='none';
    root.innerHTML=[
    '<div class="br-report-head"><h1>📊 Reporting & Statistics</h1><p>Working-draft statistics, research queries and history. Capture Data Point reads the published JSON files independently.</p></div>',
    '<div id="br-backup-reminder" class="br-notice hidden">Reporting history has unsaved changes older than seven days. <button class="btn primary-btn pill-btn" id="br-reminder-save">Save Report</button></div>',
    '<div id="br-stats" class="br-stats"></div>',
    '<details class="br-panel"><summary>🌍 Country Statistics</summary><div class="br-scroll"><table id="br-country-table" class="br-table"></table></div></details>',
    '<details class="br-panel" open><summary>📅 Monthly Event Coverage</summary><div id="br-months"></div></details>',
    '<div class="br-panel"><h2>🔎 Advanced Query & Results Explorer</h2><p class="br-muted">Select datasets, build conditions, then Execute. Only the executed result is logged and available for export.</p>',
    '<div id="br-report-scopes" class="br-scopes"></div>',
    '<div class="br-panel-inner"><h3>Quick Missing-Field Overview</h3><details><summary>Show summary checks</summary><div id="br-completeness-overview" class="br-scroll"></div></details></div>',
    '<div class="br-builder"><div class="br-headrow"><span>Operator</span><span>Condition</span></div><div id="br-condition-rows"></div>',
    '<button id="br-add-condition" class="btn secondary-btn pill-btn">+ Add Another Condition</button>',
    '<label class="br-query-label">Generated Query</label><div id="br-query-preview" class="br-query"></div>',
    '<button id="br-execute" class="btn primary-btn pill-btn" disabled>▶ Execute Query</button></div>',
    '<div id="br-results" class="br-results"><p class="br-muted">Execute a query to see matching records and export options.</p></div></div>',
    '<div class="br-panel" id="br-growth"></div><div class="br-panel" id="br-query-history"></div>',
    '<div class="br-panel br-actions"><h2>💾 Reporting History Backup</h2><button class="btn primary-btn pill-btn" id="br-backup">Save Report</button><label class="btn secondary-btn pill-btn">Restore Report <input type="file" id="br-restore" class="hidden" accept=".json"></label><p class="br-muted">History is stored locally in this browser. Export a backup at least every seven days.</p></div>'
    ].join('');
    main.appendChild(root);
    const style=document.createElement('style');style.textContent=[
    '#br-reporting-view{padding:18px;overflow:auto;color:#f4f7ff;max-height:100vh;min-height:0;flex:1;line-height:1.4}',
    '#br-reporting-view h1,#br-reporting-view h2,#br-reporting-view h3{font-family:Antonio,Arial,sans-serif;margin:4px 0 12px}',
    '.br-report-head h1{color:var(--primary-blue)}.br-report-head p,.br-muted{color:#aab4c5;font-size:.94rem}',
    '.br-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}',
    '.br-stat{padding:15px;background:#202838;border:1px solid #394359;border-radius:10px;display:flex;flex-direction:column;gap:5px;text-align:center}',
    '.br-stat strong{font-size:1.65rem;color:#49d2ff}.br-stat span{color:#d3d9e5}',
    '.br-panel{margin:13px 0;padding:17px;background:#151b29;border:1px solid #394359;border-radius:12px}',
    '.br-panel summary{cursor:pointer;font-weight:bold;color:#49d2ff;padding:6px}.br-panel-inner{padding:12px;background:#0b0f19;border-radius:8px;margin:12px 0}',
    '.br-scroll{max-height:400px;overflow:auto}.br-table{width:100%;border-collapse:collapse;font-size:.95rem;margin:10px 0}',
    '.br-table td,.br-table th{padding:8px;text-align:left;border-bottom:1px solid #354156}.br-table th{color:#49d2ff;background:#202838;position:sticky;top:0}#br-country-table th{cursor:pointer}',
    '.br-bar{height:9px;background:#49d2ff;border-radius:6px;margin:3px 8px 3px 0;display:inline-block;max-width:55%;min-width:2px}',
    '.br-scopes{display:flex;gap:20px;flex-wrap:wrap;margin:15px 0}.br-scopes label{display:flex;gap:8px;align-items:center;cursor:pointer}',
    '.br-builder{margin-top:16px}.br-headrow,.br-condition-row{display:grid;grid-template-columns:125px minmax(180px,1fr) 36px;gap:10px;margin:7px 0}.br-condition-controls{display:flex;gap:10px;align-items:center;min-width:0}.br-condition-controls select{flex:1;min-width:140px}.br-condition-controls input[type=month]{flex:0 0 170px;max-width:38%;background:#202838;color:#fff;border:1px solid #506079;border-radius:7px;padding:9px;min-width:130px}',
    '.br-condition-row select,.br-group-box input,.br-panel select{background:#202838;color:#fff;border:1px solid #506079;border-radius:7px;padding:9px;min-width:0}',
    '.br-headrow{font-size:.85rem;color:#aab4c5}.br-query-label{display:block;margin-top:17px;font-size:.8rem;text-transform:uppercase;color:#aab4c5}',
    '.br-query{padding:13px;white-space:normal;overflow-wrap:anywhere;background:#0b0f19;border:1px solid #384155;border-radius:7px;color:#eef5ff}',
    '.br-builder .btn{width:auto;margin:12px 0}.br-results{margin-top:14px}.br-group-box{padding:15px;border:1px solid #384155;border-radius:8px;margin-top:15px}',
    '.br-group-box label{display:flex;gap:9px;align-items:center}.br-group-box input{width:90px}',
    '#br-group-preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:5px;margin:10px 0;max-height:250px;overflow:auto}',
    '#br-group-preview div{padding:7px;background:#202838;border-radius:4px}.br-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.br-actions .btn,.br-group-box .btn{width:auto}.br-link{border:0;background:none;color:#49d2ff;text-decoration:underline;cursor:pointer;text-align:left}',
    '.br-growth-legend{display:flex;gap:15px;flex-wrap:wrap;font-size:.9rem;margin:10px 0}.br-capture-tools{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:10px 0 16px}.br-capture-tools .btn{width:auto;flex-shrink:0}.br-capture-tools .br-muted{max-width:780px}',
    '.br-chart{width:100%;height:auto;max-height:205px}.br-notice{border:1px solid #f0c94c;padding:12px;margin:10px 0;border-radius:8px;color:#f0c94c}',
    '@media(max-width:720px){.br-stats{grid-template-columns:1fr}.br-headrow,.br-condition-row{grid-template-columns:85px minmax(120px,1fr) 30px}}'
    ].join('\n');document.head.appendChild(style);
    root.addEventListener('change',event=>{
        const target=event.target;
        if(target.dataset.scope){
            const type=target.dataset.scope;
            if(type==='events'){state.scope.events=target.checked;if(target.checked){state.scope.venues=false;state.scope.cruising=false;}}
            else {state.scope[type]=target.checked;if(target.checked)state.scope.events=false;}
            resetInvalidConditions();renderBuilder();overview();
        }
        if(target.dataset.operator!==undefined){state.conditions[Number(target.dataset.operator)].op=target.value;state.results=null;renderBuilder();}
        if(target.dataset.condition!==undefined){
            const row=state.conditions[Number(target.dataset.condition)];
            row.key=target.value;
            if(row.key==='event-month'&&!monthValue(row.value))row.value=defaultMonth();
            else if(row.key!=='event-month')delete row.value;
            state.results=null;renderBuilder();
        }
        if(target.dataset.conditionValue!==undefined){
            const row=state.conditions[Number(target.dataset.conditionValue)];
            if(row&&row.key==='event-month'){row.value=target.value;state.results=null;renderBuilder();}
        }
        if(target.id==='br-group-count'&&state.results){state.groupCount=Math.max(1,Math.min(Number(target.value)||1,state.results.rows.length||1));renderResults();}
        if(target.id==='br-history-query-select')refreshLogViews();
        if(target.id==='br-restore'){restoreHistory(target.files?.[0]);target.value='';}
    });
    root.addEventListener('click',event=>{
        const th=event.target.closest('[data-country-sort]');
        if(!th)return;
        const field=th.dataset.countrySort;
        if(state.countrySort===field)state.countryAsc=!state.countryAsc;
        else {state.countrySort=field;state.countryAsc=field==='country';}
        refreshScopeStats();
    });
    root.addEventListener('input',event=>{
        if(event.target.id!=='br-group-count'||!state.results)return;
        const n=state.results.rows.length;
        const count=Math.max(1,Math.min(Number(event.target.value)||1,Math.max(1,n)));
        state.groupCount=count;
        const base=Math.floor(n/count),extra=n%count;
        const preview=document.getElementById('br-group-preview');
        if(preview)preview.innerHTML=Array.from({length:count},(_,i)=>'<div>'+groupName(i)+' — '+fmt(base+(i<extra?1:0))+' records</div>').join('');
        const button=document.getElementById('br-download-groups');
        if(button)button.textContent='⬇ Choose Folder & Save '+count+' JSON '+(count===1?'File':'Files');
    });
    root.addEventListener('click',event=>{
        const target=event.target.closest('button');if(!target)return;
        if(target.id==='br-add-condition'){const list=checkList();if(list.length){state.conditions.push({op:'OR',key:list[0].key});state.results=null;renderBuilder();}}
        if(target.dataset.removeCondition!==undefined){state.conditions.splice(Number(target.dataset.removeCondition),1);state.results=null;renderBuilder();}
        if(target.dataset.addCheck){if(state.conditions.length===1&&state.conditions[0].key==='status:Live'&&!state.results)state.conditions[0]={op:'OR',key:target.dataset.addCheck};else state.conditions.push({op:'OR',key:target.dataset.addCheck});state.results=null;renderBuilder();document.getElementById('br-query-preview')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
        if(target.id==='br-execute')execute();
        if(target.id==='br-download-results'&&state.results){writeFile(JSON.stringify(state.results.rows,null,2),'identified_records.json');markDownloaded(1);}
        if(target.id==='br-download-groups')saveGroups();
        if(target.id==='br-backup'||target.id==='br-reminder-save')backupHistory();
        if(target.id==='br-capture-point')captureDataPoint();
    });
    backupReminder();
}
function restoreSavedQuery(entry){
    if(!entry || entry.type!=='query' || !Array.isArray(entry.conditions))return false;
    const scope=String(entry.scope||'');
    const requested=scope==='Events'?{events:true,venues:false,cruising:false}:
        scope==='Venues + Cruising Areas'?{events:false,venues:true,cruising:true}:
        scope==='Cruising Areas'?{events:false,venues:false,cruising:true}:
        scope==='Venues'?{events:false,venues:true,cruising:false}:null;
    if(!requested)return false;
    state.scope=requested;
    const allowed=new Set(checkList().map(x=>x.key));
    const conditions=entry.conditions.filter(x=>x&&allowed.has(x.key)).map(x=>({
        op:['OR','AND','EXCLUDE'].includes(x.op)?x.op:'OR',
        key:x.key,
        ...(x.key==='event-month'?{value:monthValue(x.value)?x.value:defaultMonth()}:{})
    }));
    if(!conditions.length){message('That saved query no longer has compatible conditions.');return false;}
    state.conditions=conditions;
    // Keep the last executed results visible until the newly configured query is executed.
    renderBuilder();
    overview();
    const preview=document.getElementById('br-query-preview');
    if(preview){
        const note=document.createElement('p');
        note.id='br-restore-notice';
        note.className='br-muted';
        note.textContent='Saved conditions restored. Previous results remain unchanged until you press Execute Query.';
        document.getElementById('br-restore-notice')?.remove();
        preview.after(note);
        preview.scrollIntoView({behavior:'smooth',block:'center'});
    }
    return true;
}
window.BackroomAdminReporting={open,recordOperation,execute,generatedQuery,predicate,restoreSavedQuery};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
