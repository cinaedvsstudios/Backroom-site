/* Backroom Admin Phase 1 (v0.21): compact records, selection and results explorer. */
(() => {
'use strict';
if (window.BackroomAdminPhase1) return;
const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt = n => Number(n || 0).toLocaleString('en-GB');
const idField = () => currentMode === 'events' ? 'Event_ID' : 'Venue_ID';
const msg = value => typeof showToast === 'function' ? showToast(value) : window.alert(value);
const compact = {
  mode: (() => { try { return localStorage.getItem('br_admin_table_view') === 'compact' ? 'compact' : 'full'; } catch { return 'full'; } })(),
  filters:{country:'',city:'',status:'',tags:'',from:'',to:''},
  page:1, size:50, rows:[], scopeKey:'',
  selected:{venues:new Set(),events:new Set()}
};
const explorer = {result:null,identity:'',group1:'Country',group2:'',group3:'',filterField:'',filterValue:'',search:'',view:'table',chart:'bar',page:1};
let reportLogs=[], growthView='line', queryHistoryView='line';

function scopedDraftRows() {
  let rows=Array.isArray(draftData)?draftData:[];
  const section=window.BackroomAdminUpgrade?.state?.section;
  if (currentMode==='venues'&&section==='cruising') rows=rows.filter(x=>String(x.Category||'').toLowerCase().trim()==='cruising area');
  else if(currentMode==='venues'&&section==='venues') rows=rows.filter(x=>String(x.Category||'').toLowerCase().trim()!=='cruising area');
  return rows;
}
function compactFilterRows(rows) {
  const f=compact.filters;
  return rows.filter(row=>{
    if(f.country&&String(row.Country||'')!==f.country)return false;
    if(f.city&&!String(row.City||'').split(',').some(x=>x.trim()===f.city))return false;
    if(f.status&&String(row.Status||'')!==f.status)return false;
    if(f.tags&&!String(row.Vibe_Tags||'').toLowerCase().includes(f.tags.toLowerCase()))return false;
    const date=String(currentMode==='events'?(row.Event_Date||''):(row.Last_Updated||'')).slice(0,10);
    if(f.from&&(!date||date<f.from))return false;
    if(f.to&&(!date||date>f.to))return false;
    return true;
  });
}
function optionSelect(key,values,title){
  const chosen=compact.filters[key];
  return '<label>'+esc(title)+'<select data-cf="'+key+'"><option value="">All</option>'+
    values.map(v=>'<option value="'+esc(v)+'" '+(v===chosen?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
}
function compactControls() {
  const host=document.getElementById('br-compact-filters');
  if(!host)return;
  const rows=scopedDraftRows();
  const uniques=(key,selected)=>[...new Set(rows.flatMap(row=>{
    if(key==='City')return String(row.City||'').split(',').map(x=>x.trim()).filter(Boolean);
    return [String(row[key]||'').trim()].filter(Boolean);
  }).filter(x=>!selected||x===selected))].sort((a,b)=>a.localeCompare(b));
  const countries=uniques('Country');
  const currentCountry=compact.filters.country;
  const cities=[...new Set(rows.filter(r=>!currentCountry||r.Country===currentCountry).flatMap(r=>String(r.City||'').split(',').map(x=>x.trim()).filter(Boolean)))].sort();
  if(compact.filters.city&&!cities.includes(compact.filters.city))compact.filters.city='';
  host.innerHTML=optionSelect('country',countries,'Country')+optionSelect('city',cities,'City')+
    optionSelect('status',uniques('Status'),'Status')+
    '<label>Tags<input data-cf="tags" type="search" placeholder="Search vibe tags" value="'+esc(compact.filters.tags)+'"></label>'+
    '<label>'+(currentMode==='events'?'Event from':'Updated from')+'<input data-cf="from" type="date" value="'+esc(compact.filters.from)+'"></label>'+
    '<label>To<input data-cf="to" type="date" value="'+esc(compact.filters.to)+'"></label>'+
    '<button type="button" id="br-compact-clear-filters" class="btn secondary-btn pill-btn">Clear Compact Filters</button>';
}
function selectionSet(){return compact.selected[currentMode==='events'?'events':'venues'];}
function syncCompactUi() {
  const isCompact=compact.mode==='compact';
  document.getElementById('br-compact-filters')?.classList.toggle('hidden',!isCompact);
  document.getElementById('br-compact-toolbar')?.classList.toggle('hidden',!isCompact);
  document.getElementById('br-view-compact')?.classList.toggle('br-p1-active',isCompact);
  document.getElementById('br-view-full')?.classList.toggle('br-p1-active',!isCompact);
  if(isCompact)compactControls();
}
function updateSelectionToolbar(){
  const count=selectionSet().size;
  const label=document.getElementById('br-compact-selected-count');
  if(label)label.textContent=fmt(count)+' selected · '+fmt(compact.rows.length)+' filtered';
  const copy=document.getElementById('br-compact-copy');
  if(copy)copy.disabled=count===0;
}
function renderCompact(rows){
  compact.rows=compactFilterRows(rows);
  compact.page=Math.max(1,Math.min(compact.page,Math.ceil(compact.rows.length/compact.size)||1));
  const start=(compact.page-1)*compact.size;
  const current=compact.rows.slice(start,start+compact.size);
  const selected=selectionSet(),field=idField();
  const html=current.map(row=>{
    const id=String(row[field]??'');
    const name=String(row.Name||row.Event_Name||id);
    const status=String(row.Status||'Unknown');
    const location=[row.City,row.Country].filter(Boolean).join(', ');
    const category=currentMode==='events'?String(row.Venue_ID||'No linked venue'):String(row.Category||'');
    const date=currentMode==='events'?String(row.Event_Date||''):String(row.Last_Updated||'').slice(0,10);
    const times=currentMode==='events'?[row.Event_Start_Time,row.Event_End_Time].filter(Boolean).join('–'):'';
    const tags=String(row.Vibe_Tags||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,4).join(' · ');
    return '<tr data-id="'+esc(id)+'" class="br-p1-row" onmousedown="selectAdminRecord(this.dataset.id)">'+
      '<td class="br-p1-checkbox"><input type="checkbox" aria-label="Select '+esc(id)+'" data-compact-select="'+esc(id)+'" '+(selected.has(id)?'checked':'')+'></td>'+
      '<td><div class="br-p1-row-top"><strong>'+esc(name)+'</strong><span class="br-p1-status '+(status.toLowerCase()==='live'?'br-p1-live':'br-p1-alert')+'">'+esc(status)+'</span></div>'+
      '<div class="br-p1-row-meta">'+[id,location,category,date,times].filter(Boolean).map(esc).join(' · ')+'</div></td>'+
      '<td class="br-p1-tags">'+(tags?esc(tags):'<span class="br-p1-muted">No tags</span>')+'</td></tr>';
  }).join('');
  const pages=Math.max(1,Math.ceil(compact.rows.length/compact.size));
  queueMicrotask(updateSelectionToolbar);
  return '<table class="br-p1-compact-table"><thead><tr><th style="width:46px">✓</th><th>Record</th><th>Tags</th></tr></thead><tbody>'+
    (html||'<tr><td colspan="3" class="br-p1-muted">No matching records. Adjust the filters to see more.</td></tr>')+
    '</tbody></table><div class="br-p1-pagination"><button class="btn secondary-btn pill-btn" data-compact-page="-1" '+(compact.page===1?'disabled':'')+'>Previous</button>'+
    '<span>'+fmt(compact.rows.length)+' records · Page '+compact.page+' of '+pages+'</span>'+
    '<button class="btn secondary-btn pill-btn" data-compact-page="1" '+(compact.page>=pages?'disabled':'')+'>Next</button></div>';
}
function installCompact() {
  const table=document.getElementById('admin-table-container');
  const filterArea=document.getElementById('active-filters');
  if(!table||!filterArea)return;
  const bar=document.createElement('div');bar.id='br-phase1-bar';
  bar.innerHTML='<div class="br-p1-modes"><button type="button" class="btn secondary-btn pill-btn" id="br-view-full">Full Table</button>'+
    '<button type="button" class="btn secondary-btn pill-btn" id="br-view-compact">Compact View</button></div>'+
    '<div id="br-compact-toolbar" class="br-p1-toolbar hidden">'+
    '<span id="br-compact-selected-count" class="br-p1-muted">0 selected</span>'+
    '<button type="button" class="btn secondary-btn pill-btn" id="br-compact-all">Select All Filtered</button>'+
    '<button type="button" class="btn secondary-btn pill-btn" id="br-compact-page">Select Page</button>'+
    '<button type="button" class="btn secondary-btn pill-btn" id="br-compact-none">Clear Selection</button>'+
    '<button type="button" class="btn primary-btn pill-btn" id="br-compact-copy">Copy Selected IDs</button></div>';
  filterArea.before(bar);
  const controls=document.createElement('div');controls.id='br-compact-filters';controls.className='br-p1-filters hidden';
  filterArea.before(controls);
  const oldGenerate=generateTableHTML;
  generateTableHTML=function phaseOneTable(data,isMain){
    if(!isMain||compact.mode!=='compact')return oldGenerate.apply(this,arguments);
    const filtered=window.BackroomAdminUpgrade?.applyFilters ? window.BackroomAdminUpgrade.applyFilters(data) : data;
    return renderCompact(filtered);
  };
  const oldRender=renderTable;
  renderTable=function phaseOneRender(){
    const scope=currentMode+'|'+(window.BackroomAdminUpgrade?.state?.section||'venues');
    if(compact.scopeKey!==scope){compact.scopeKey=scope;compact.page=1;}
    syncCompactUi();
    const result=oldRender.apply(this,arguments);
    updateSelectionToolbar();
    return result;
  };
  bar.addEventListener('click',event=>{
    const id=event.target.closest('button')?.id;
    if(id==='br-view-full'||id==='br-view-compact'){
      compact.mode=id==='br-view-full'?'full':'compact';
      try{localStorage.setItem('br_admin_table_view',compact.mode);}catch{}
      compact.page=1;renderTable();return;
    }
    if(id==='br-compact-all')compact.rows.forEach(r=>selectionSet().add(String(r[idField()]??'')));
    else if(id==='br-compact-page')compact.rows.slice((compact.page-1)*compact.size,compact.page*compact.size).forEach(r=>selectionSet().add(String(r[idField()]??'')));
    else if(id==='br-compact-none')selectionSet().clear();
    else if(id==='br-compact-copy'){copyIDs([...selectionSet()].join('\n'));return;}
    else return;
    renderTable();
  });
  controls.addEventListener('change',event=>{
    const key=event.target.dataset.cf;
    if(!key)return;
    compact.filters[key]=event.target.value;
    if(key==='country')compact.filters.city='';
    compact.page=1;renderTable();
  });
  controls.addEventListener('click',event=>{
    if(event.target.id!=='br-compact-clear-filters')return;
    compact.filters={country:'',city:'',status:'',tags:'',from:'',to:''};
    compact.page=1;renderTable();
  });
  table.addEventListener('mousedown',event=>{
    if(event.target.closest('[data-compact-select]'))event.stopPropagation();
  },true);
  table.addEventListener('change',event=>{
    const target=event.target.closest('[data-compact-select]');
    if(!target)return;
    const id=target.dataset.compactSelect;
    if(target.checked)selectionSet().add(id);
    else selectionSet().delete(id);
    updateSelectionToolbar();
  });
  table.addEventListener('click',event=>{
    const page=event.target.closest('[data-compact-page]');
    if(!page)return;
    compact.page+=Number(page.dataset.compactPage)||0;renderTable();
  });
  syncCompactUi();
}
async function copyIDs(value) {
  if(!value)return;
  try {
    if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);msg('Copied '+selectionSet().size+' selected IDs.');
  }catch(error){
    const modal=document.getElementById('clipboard-text');
    if(modal){modal.value=value;modal.closest('.modal-overlay')?.classList.remove('hidden');modal.select();}
    else{
      const field=document.createElement('textarea');field.value=value;field.style.cssText='position:fixed;left:20px;top:20px;z-index:9999';document.body.appendChild(field);field.select();
      try{document.execCommand('copy');msg('Copied selected IDs.');}catch{window.prompt('Copy selected IDs:',value);}
      field.remove();
    }
  }
}
function fieldNames(rows){
  const keys=new Set(['Record Type','Event Month','Country','City','Status','Category','Vibe_Tags']);
  rows.slice(0,300).forEach(row=>Object.keys(row).forEach(k=>keys.add(k)));
  return [...keys].filter(k=>['Record Type','Event Month'].includes(k)||rows.some(r=>Object.hasOwn(r,k))).sort((a,b)=>a.localeCompare(b));
}
function dimension(row,field){
  if(!field)return'';
  if(field==='Record Type')return row.Event_ID?'Event':String(row.Category||'').toLowerCase()==='cruising area'?'Cruising Area':'Venue';
  if(field==='Event Month')return String(row.Event_Date||'').slice(0,7)||'(Unknown)';
  const value=row[field];
  if(Array.isArray(value))return value.join(', ')||'(Blank)';
  if(value&&typeof value==='object')return JSON.stringify(value);
  return String(value??'').trim()||'(Blank)';
}
function selectOptions(fields,selected,noneLabel){
  return '<option value="">'+esc(noneLabel)+'</option>'+fields.map(f=>'<option value="'+esc(f)+'" '+(f===selected?'selected':'')+'>'+esc(f.replace(/_/g,' '))+'</option>').join('');
}
function exploredRows(){
  if(!explorer.result)return[];
  const f=explorer.filterValue.trim().toLowerCase(),s=explorer.search.trim().toLowerCase();
  return explorer.result.rows.filter(row=>{
    if(f){
      const value=explorer.filterField?dimension(row,explorer.filterField):Object.values(row).map(x=>String(x??'')).join(' ');
      if(!value.toLowerCase().includes(f))return false;
    }
    if(s&&!Object.values(row).some(x=>String(x??'').toLowerCase().includes(s)))return false;
    return true;
  });
}
function grouped(rows){
  const fields=[explorer.group1,explorer.group2,explorer.group3].filter(Boolean),totals=new Map();
  rows.forEach(row=>{
    const names=fields.length?fields.map(key=>dimension(row,key)):['All records'];
    const key=JSON.stringify(names),item=totals.get(key)||{names,count:0};
    item.count++;totals.set(key,item);
  });
  return [...totals.values()].sort((a,b)=>{
    if(['Event Month','Event_Date','Last_Updated'].includes(explorer.group1))return a.names.join(' / ').localeCompare(b.names.join(' / '));
    return b.count-a.count||a.names.join(' / ').localeCompare(b.names.join(' / '));
  });
}
function csv(rows,fields){
  const encode=value=>'"'+String(value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):value).replace(/"/g,'""')+'"';
  return [fields.map(encode).join(','),...rows.map(row=>fields.map(k=>encode(row[k])).join(','))].join('\r\n');
}
function download(content,name,type) {
  const url=URL.createObjectURL(new Blob([content],{type:type||'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function chartMarkup(groups,type){
  const shown=groups.slice(0,20),max=Math.max(1,...shown.map(x=>x.count));
  if(!shown.length)return'<p class="br-p1-muted">No chart data matches these filters.</p>';
  const title=x=>x.names.join(' / ');
  if(type==='pie'){
    const values=shown.slice(0,10),total=values.reduce((n,x)=>n+x.count,0),colors=['#2CA8D4','#D55036','#f0c94c','#58b6a0','#9176dd','#8494a9','#df85bd','#5aa5e9','#df9d68','#b0c97a'];
    let angle=-Math.PI/2;
    const slices=values.map((g,i)=>{
      const fraction=g.count/Math.max(1,total),start=angle,end=angle+fraction*Math.PI*2;angle=end;
      if(fraction>=0.99999)return'<circle cx="140" cy="140" r="110" fill="'+colors[i]+'"><title>'+esc(title(g)+' '+fmt(g.count))+'</title></circle>';
      const x1=140+110*Math.cos(start),y1=140+110*Math.sin(start),x2=140+110*Math.cos(end),y2=140+110*Math.sin(end);
      return '<path fill="'+colors[i]+'" d="M140 140 L'+x1+' '+y1+' A110 110 0 '+(fraction>0.5?1:0)+' 1 '+x2+' '+y2+' Z"><title>'+esc(title(g)+' '+fmt(g.count))+'</title></path>';
    }).join('');
    return '<div class="br-p1-pie"><svg viewBox="0 0 280 280" role="img" aria-label="Grouped records pie chart">'+slices+'</svg><div>'+values.map((g,i)=>'<p><span style="color:'+colors[i]+'">●</span> '+esc(title(g))+' — '+fmt(g.count)+'</p>').join('')+'</div></div><p class="br-p1-muted">Pie chart displays up to 10 groups.</p>';
  }
  if(type==='line'){
    const w=850,h=270,margin=45,points=shown.map((g,i)=>[margin+i*(w-2*margin)/Math.max(1,shown.length-1),h-margin-g.count/max*(h-2*margin)]);
    const poly=points.map(p=>p.join(',')).join(' ');
    return '<svg class="br-p1-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Matching record totals line chart">'+
      '<line x1="'+margin+'" y1="'+(h-margin)+'" x2="'+(w-margin)+'" y2="'+(h-margin)+'" stroke="#969CAE"/>'+
      '<polyline fill="none" stroke="#2CA8D4" stroke-width="3" points="'+poly+'"/>'+
      points.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="#D55036"><title>'+esc(title(shown[i]))+': '+fmt(shown[i].count)+'</title></circle>').join('')+
      '<text x="8" y="18" fill="#969CAE">'+fmt(max)+'</text>'+
      '<text x="'+margin+'" y="'+(h-8)+'" fill="#969CAE">'+esc(title(shown[0]).slice(0,29))+'</text>'+
      '<text x="'+(w-margin)+'" y="'+(h-8)+'" fill="#969CAE" text-anchor="end">'+esc(title(shown[shown.length-1]).slice(0,29))+'</text></svg>';
  }
  const height=shown.length*35+32;
  return '<svg class="br-p1-svg" viewBox="0 0 850 '+height+'" role="img" aria-label="Matching record totals bar chart">'+shown.map((g,i)=>{
    const y=13+i*35,w=Math.max(2,g.count/max*410);
    return '<text x="8" y="'+(y+18)+'" font-size="14" fill="#d3d9e5">'+esc(title(g).slice(0,34))+'</text>'+
      '<rect x="335" y="'+y+'" width="'+w+'" height="24" fill="'+(i%2?'#00547C':'#2CA8D4')+'"><title>'+esc(title(g))+': '+fmt(g.count)+'</title></rect>'+
      '<text x="'+(342+w)+'" y="'+(y+18)+'" fill="#f4f7ff">'+fmt(g.count)+'</text>';
  }).join('')+'</svg><p class="br-p1-muted">Chart displays up to 20 groups; the table/export includes them all.</p>';
}
function renderExplorer(){
  const holder=document.getElementById('br-p1-explorer');
  if(!holder||!explorer.result)return;
  const all=explorer.result.rows,fields=fieldNames(all),rows=exploredRows(),groups=grouped(rows);
  const pages=Math.max(1,Math.ceil(rows.length/100));explorer.page=Math.max(1,Math.min(explorer.page,pages));
  const first=(explorer.page-1)*100;
  holder.innerHTML='<h3>🔎 Results Explorer</h3><p class="br-p1-muted">Explore the executed result without running the query again. Filters never alter the original matches.</p>'+
    '<div class="br-p1-explorer-controls">'+
    '<label>Filter field<select data-explorer="filterField">'+selectOptions(fields,explorer.filterField,'Any field')+'</select></label>'+
    '<label>Contains<input data-explorer="filterValue" value="'+esc(explorer.filterValue)+'" placeholder="Filter current results"></label>'+
    '<label>Search records<input data-explorer="search" value="'+esc(explorer.search)+'" placeholder="Any field"></label>'+
    '<label>Group by<select data-explorer="group1">'+selectOptions(fields,explorer.group1,'All records')+'</select></label>'+
    '<label>Then by<select data-explorer="group2">'+selectOptions(fields,explorer.group2,'None')+'</select></label>'+
    '<label>Then by<select data-explorer="group3">'+selectOptions(fields,explorer.group3,'None')+'</select></label>'+
    '<label>Display<select data-explorer="view"><option value="table" '+(explorer.view==='table'?'selected':'')+'>Table</option><option value="chart" '+(explorer.view==='chart'?'selected':'')+'>Chart</option></select></label>'+
    '<label>Chart type<select data-explorer="chart"><option value="bar" '+(explorer.chart==='bar'?'selected':'')+'>Bar</option><option value="line" '+(explorer.chart==='line'?'selected':'')+'>Line</option><option value="pie" '+(explorer.chart==='pie'?'selected':'')+'>Pie</option></select></label></div>'+
    '<div class="br-p1-explorer-actions"><strong>'+fmt(rows.length)+' / '+fmt(all.length)+' matching records · '+fmt(groups.length)+' groups</strong>'+
    '<button class="btn secondary-btn pill-btn" id="br-p1-explorer-clear">Clear secondary filters</button>'+
    '<button class="btn primary-btn pill-btn" id="br-p1-export-json" '+(!rows.length?'disabled':'')+'>Download filtered JSON</button>'+
    '<button class="btn secondary-btn pill-btn" id="br-p1-export-csv" '+(!rows.length?'disabled':'')+'>Download filtered CSV</button>'+
    '<button class="btn secondary-btn pill-btn" id="br-p1-export-group-csv" '+(!groups.length?'disabled':'')+'>Download grouped CSV</button></div>'+
    (explorer.view==='chart'?chartMarkup(groups,explorer.chart):
      '<div class="br-p1-overflow"><table class="br-table"><thead><tr><th>'+esc([explorer.group1,explorer.group2,explorer.group3].filter(Boolean).join(' / ')||'All records')+'</th><th>Count</th><th>Share</th></tr></thead><tbody>'+
      groups.map(g=>'<tr><td>'+g.names.map(esc).join(' / ')+'</td><td>'+fmt(g.count)+'</td><td>'+((g.count/Math.max(1,rows.length))*100).toFixed(1)+'%</td></tr>').join('')+'</tbody></table></div>')+
    '<h4>Records in this view</h4><div class="br-p1-overflow"><table class="br-table"><thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Status</th><th>Date</th></tr></thead><tbody>'+
    rows.slice(first,first+100).map(r=>'<tr><td>'+esc(r.Event_ID||r.Venue_ID||'')+'</td><td>'+esc(r.Event_Name||r.Name||'')+'</td><td>'+esc([r.City,r.Country].filter(Boolean).join(', '))+'</td><td>'+esc(r.Status||'')+'</td><td>'+esc(r.Event_Date||r.Last_Updated||'')+'</td></tr>').join('')+
    '</tbody></table></div><div class="br-p1-pagination"><button class="btn secondary-btn pill-btn" data-explorer-page="-1" '+(explorer.page===1?'disabled':'')+'>Previous</button><span>Page '+explorer.page+' / '+pages+' (100 records per page)</span><button class="btn secondary-btn pill-btn" data-explorer-page="1" '+(explorer.page===pages?'disabled':'')+'>Next</button></div>';
}
function onResultsRendered(result){
  if(!result)return;
  if(explorer.identity!==result.date){
    explorer.identity=result.date;explorer.result=result;explorer.group1=result.rows.some(r=>r.Country!==undefined)?'Country':'Record Type';
    explorer.group2='';explorer.group3='';explorer.filterField='';explorer.filterValue='';explorer.search='';explorer.page=1;explorer.view='table';explorer.chart='bar';
  }else explorer.result=result;
  const results=document.getElementById('br-results');if(!results)return;
  const section=document.createElement('section');section.id='br-p1-explorer';section.className='br-panel';
  results.appendChild(section);renderExplorer();
}
function applyExplorerControl(target){
  const key=target.dataset.explorer;
  if(!key)return;
  explorer[key]=target.value;explorer.page=1;
  if(key==='group1'&&explorer.group2===explorer.group1)explorer.group2='';
  if(key==='group2'&&explorer.group3===explorer.group2)explorer.group3='';
  renderExplorer();
}
function downloadExplorer(kind){
  const rows=exploredRows(),groups=grouped(rows);
  if(kind==='json'){download(JSON.stringify(rows,null,2),'backroom_filtered_results.json');return;}
  if(kind==='csv'){
    const fields=[...new Set(rows.flatMap(Object.keys))];
    download('\ufeff'+csv(rows,fields),'backroom_filtered_results.csv','text/csv;charset=utf-8');return;
  }
  const headings=['Group 1','Group 2','Group 3','Count'];
  const exportRows=groups.map(g=>({'Group 1':g.names[0]||'','Group 2':g.names[1]||'','Group 3':g.names[2]||'',Count:g.count}));
  download('\ufeff'+csv(exportRows,headings),'backroom_grouped_results.csv','text/csv;charset=utf-8');
}
function historySnapshots(){
  return reportLogs.filter(x=>x.type==='snapshot'&&x.mode==='published'&&x.after).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function renderHistoryBars(snapshots){
  if(!snapshots.length)return'<p class="br-p1-muted">Capture at least one published data point to display grouped historical bars.</p>';
  const shown=snapshots.slice(-10),max=Math.max(1,...shown.flatMap(x=>[x.after.venues||0,x.after.cruising||0,x.after.events||0]));
  const w=850,h=290,left=42,right=28,base=244,bw=(w-left-right)/shown.length;
  const colors=['#2CA8D4','#D55036','#f0c94c'],names=['venues','cruising','events'];
  return '<div class="br-p1-legend">🔵 Venues · 🟠 Cruising Areas · 🟡 Events (published totals)</div><svg class="br-p1-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Published counts by capture date">'+
    '<line x1="'+left+'" y1="'+base+'" x2="'+(w-right)+'" y2="'+base+'" stroke="#969CAE"/>'+
    shown.map((x,i)=>names.map((name,k)=>{
      const value=Number(x.after[name]||0),height=value/max*190,bwOne=Math.max(4,(bw-12)/3),pos=left+i*bw+5+k*bwOne;
      return '<rect x="'+pos+'" y="'+(base-height)+'" width="'+bwOne+'" height="'+height+'" fill="'+colors[k]+'"><title>'+esc(x.date.slice(0,10))+' · '+name+': '+fmt(value)+'</title></rect>';
    }).join('')+'<text x="'+(left+i*bw+bw/2)+'" y="263" text-anchor="middle" fill="#d3d9e5" font-size="10">'+esc(String(x.date||'').slice(5,10))+'</text>').join('')+
    '<text x="5" y="18" fill="#d3d9e5">'+fmt(max)+'</text></svg>';
}
function improveHistoryTotals() {
  const history=reportLogs.filter(x=>x.type==='snapshot'||x.type==='change').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const rows=[...document.querySelectorAll('#br-growth tbody tr')];
  history.slice().reverse().slice(0,50).forEach((entry,i)=>{
    if(entry.type!=='snapshot'||!rows[i]||rows[i].cells.length<8)return;
    const index=history.indexOf(entry);
    const prior=history.slice(0,index).filter(x=>x.type==='snapshot'&&x.mode==='published').slice(-1)[0];
    const add=rows[i].cells[5],modify=rows[i].cells[6],remove=rows[i].cells[7];
    if(!prior){add.textContent='Baseline';remove.textContent='Baseline';modify.textContent='Not tracked';return;}
    const diff=['venues','cruising','events'].map(k=>Number(entry.after?.[k]||0)-Number(prior.after?.[k]||0));
    const gains=diff.reduce((n,d)=>n+Math.max(0,d),0),losses=diff.reduce((n,d)=>n+Math.max(0,-d),0);
    add.textContent='Net +'+fmt(gains);remove.textContent='Net −'+fmt(losses);modify.textContent='Not tracked';
    add.title=remove.title='Changes in published totals since the prior published capture; not unique added/deleted IDs.';
  });
  const growth=document.getElementById('br-growth');if(!growth)return;
  let note=document.getElementById('br-p1-history-note');
  if(!note){note=document.createElement('p');note.id='br-p1-history-note';note.className='br-p1-muted';growth.appendChild(note);}
  note.textContent='For published captures, Net + / Net − represent changes in counts since the previous published capture. Totals alone cannot reveal actual additions, removals or modified records. Admin edit operations retain their recorded actual changes.';
}
function chartHistoryEnhancements(){
  const growth=document.getElementById('br-growth');
  if(growth){
    const tools=document.createElement('div');tools.className='br-p1-history-tools';
    tools.innerHTML='<label>Historical chart <select id="br-p1-growth-type"><option value="line" '+(growthView==='line'?'selected':'')+'>Line (existing history)</option><option value="bar" '+(growthView==='bar'?'selected':'')+'>Bar (published captures)</option></select></label>';
    growth.querySelector('h3')?.after(tools);
    const orig=growth.querySelector('svg.br-chart');
    const legend=growth.querySelector('.br-growth-legend');
    const bar=document.createElement('div');bar.id='br-p1-growth-bars';bar.innerHTML=renderHistoryBars(historySnapshots());
    (orig||growth.querySelector('.br-capture-tools'))?.after(bar);
    if(orig)orig.style.display=growthView==='bar'?'none':'';
    if(legend)legend.style.display=growthView==='bar'?'none':'';
    bar.style.display=growthView==='bar'?'':'none';
  }
  const query=document.getElementById('br-query-history');
  if(query){
    const tools=document.createElement('div');tools.className='br-p1-history-tools';
    tools.innerHTML='<label>Comparison chart <select id="br-p1-query-type"><option value="line" '+(queryHistoryView==='line'?'selected':'')+'>Line</option><option value="bar" '+(queryHistoryView==='bar'?'selected':'')+'>Bar</option></select></label>';
    query.querySelector('h3')?.after(tools);
    const original=query.querySelector('svg.br-chart');
    const active=document.getElementById('br-history-query-select')?.value||'';
    const logs=reportLogs.filter(x=>x.type==='query'&&x.scope+' | '+x.query===active).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const display=document.createElement('div');display.id='br-p1-query-bars';display.innerHTML=chartMarkup(logs.map((x,i)=>({names:[String(x.date||'').slice(0,16).replace('T',' ')||'Run '+(i+1)],count:x.matched||0})),'bar');
    (original||query.querySelector('select'))?.after(display);
    if(original)original.style.display=queryHistoryView==='bar'?'none':'';
    display.style.display=queryHistoryView==='bar'?'':'none';
  }
}
function enhanceQueryRestore(){
  const query=document.getElementById('br-query-history');
  if(!query)return;
  const logs=reportLogs.filter(x=>x.type==='query').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const heading=query.querySelector('thead tr');if(!heading)return;
  const th=document.createElement('th');th.textContent='Reuse';heading.appendChild(th);
  query.querySelectorAll('tbody tr').forEach((row,i)=>{
    const td=document.createElement('td'),entry=logs[i];
    if(entry&&Array.isArray(entry.conditions)){
      const button=document.createElement('button');button.type='button';button.className='btn secondary-btn pill-btn';button.textContent='Restore query';button.dataset.brRestore=String(i);td.appendChild(button);
    }else td.textContent='Unavailable';
    row.appendChild(td);
  });
  const note=document.createElement('p');note.className='br-p1-muted';note.textContent='Restore query loads its saved conditions and dataset, but does not automatically rerun it or replace the displayed results.';
  heading.closest('table')?.after(note);
}
function onHistoryRendered(logs){
  reportLogs=Array.isArray(logs)?logs.slice():[];
  improveHistoryTotals();enhanceQueryRestore();chartHistoryEnhancements();
}
function collapseSelectiveCopy() {
  document.querySelectorAll('h2,h3,h4,summary').forEach(title=>{
    if(title.closest('#br-p1-explorer'))return;
    if(!/selective copy results/i.test(title.textContent||''))return;
    if(title.tagName==='SUMMARY'){title.closest('details')?.removeAttribute('open');return;}
    const parent=title.parentElement;if(!parent||parent.dataset.brP1Collapsed)return;
    const details=document.createElement('details');details.className='br-p1-collapsible';
    const summary=document.createElement('summary');summary.textContent=title.textContent;
    details.appendChild(summary);
    while(parent.firstChild)details.appendChild(parent.firstChild);
    parent.appendChild(details);parent.dataset.brP1Collapsed='true';
  });
}
function install(){
  installCompact();
  const root=document.getElementById('br-reporting-view');
  if(root&&!root.dataset.brPhase1Events){
    root.dataset.brPhase1Events='true';
    root.addEventListener('change',event=>{
      const target=event.target;
      if(target.dataset.explorer)applyExplorerControl(target);
      if(target.id==='br-p1-growth-type'){growthView=target.value;chartHistoryEnhancementsReapply();}
      if(target.id==='br-p1-query-type'){queryHistoryView=target.value;chartHistoryEnhancementsReapply();}
    });
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.brRestore!==undefined){
        const logs=reportLogs.filter(x=>x.type==='query').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
        const item=logs[Number(button.dataset.brRestore)];
        if(item&&window.BackroomAdminReporting?.restoreSavedQuery?.(item))msg('Saved query restored; execute when ready.');
      }else if(button.dataset.explorerPage!==undefined){explorer.page+=Number(button.dataset.explorerPage)||0;renderExplorer();}
      else if(button.id==='br-p1-explorer-clear'){explorer.filterField='';explorer.filterValue='';explorer.search='';explorer.page=1;renderExplorer();}
      else if(button.id==='br-p1-export-json')downloadExplorer('json');
      else if(button.id==='br-p1-export-csv')downloadExplorer('csv');
      else if(button.id==='br-p1-export-group-csv')downloadExplorer('groups');
    });
  }
  document.body.addEventListener('change',event=>{
    if(event.target.closest('#br-p1-explorer')&&event.target.dataset.explorer)applyExplorerControl(event.target);
  });
  // Some earlier releases dynamically insert the selective-copy module after load.
  collapseSelectiveCopy();
  document.addEventListener('click',event=>{
    if(event.target.closest('#nav-reporting,#nav-venues,#nav-events,#nav-cruising'))setTimeout(collapseSelectiveCopy,30);
  });
}
function chartHistoryEnhancementsReapply(){
  const growth=document.getElementById('br-growth'),query=document.getElementById('br-query-history');
  if(growth){
    const orig=growth.querySelector('svg.br-chart'),legend=growth.querySelector('.br-growth-legend'),bars=growth.querySelector('#br-p1-growth-bars');
    if(orig)orig.style.display=growthView==='bar'?'none':'';
    if(legend)legend.style.display=growthView==='bar'?'none':'';
    if(bars)bars.style.display=growthView==='bar'?'':'none';
  }
  if(query){
    const orig=query.querySelector('svg.br-chart'),bars=query.querySelector('#br-p1-query-bars');
    if(orig)orig.style.display=queryHistoryView==='bar'?'none':'';
    if(bars)bars.style.display=queryHistoryView==='bar'?'':'none';
  }
}
window.BackroomAdminPhase1={onResultsRendered,onHistoryRendered,version:'0.21.0'};
const style=document.createElement('style');
style.textContent=[
'#br-phase1-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 10px}#br-phase1-bar .btn,#br-compact-filters .btn{width:auto}',
'.br-p1-modes,.br-p1-toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.br-p1-active{background:#2CA8D4!important;color:#050a12!important;border-color:#2CA8D4!important}',
'.br-p1-toolbar{padding:8px 10px;background:#111725;border:1px solid #313748;border-radius:8px}.br-p1-muted{color:#969CAE;font-size:.88rem}',
'.br-p1-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:0 0 10px;padding:10px;background:#111725;border:1px solid #313748;border-radius:8px}',
'.br-p1-filters label,.br-p1-explorer-controls label,.br-p1-history-tools label{display:flex;flex-direction:column;gap:3px;color:#969CAE;font-size:.84rem}',
'.br-p1-filters select,.br-p1-filters input,.br-p1-explorer-controls select,.br-p1-explorer-controls input,.br-p1-history-tools select{background:#202838;color:#f4f7ff;border:1px solid #506079;border-radius:6px;padding:8px;max-width:260px;min-width:100px}',
'.br-p1-compact-table{width:100%;border-collapse:collapse;background:#111725;color:#e4edf8}.br-p1-compact-table td,.br-p1-compact-table th{padding:10px;border-bottom:1px solid #313748;text-align:left}.br-p1-compact-table th{background:#1F2535;color:#2CA8D4;position:sticky;top:0}.br-p1-compact-table tr:hover{background:#202838}',
'.br-p1-checkbox{width:46px;text-align:center!important}.br-p1-checkbox input{width:19px;height:19px;accent-color:#2CA8D4}.br-p1-row-top{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.br-p1-row-top strong{font-size:1.05rem}.br-p1-row-meta,.br-p1-tags{color:#aab4c5;font-size:.87rem;margin-top:4px}.br-p1-status{font-size:.72rem;border:1px solid currentColor;padding:2px 7px;border-radius:4px}.br-p1-live{color:#2CA8D4}.br-p1-alert{color:#D55036}',
'.br-p1-pagination{display:flex;justify-content:center;align-items:center;gap:13px;flex-wrap:wrap;margin:12px}.br-p1-pagination button{width:auto}',
'.br-p1-explorer-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}.br-p1-explorer-controls input,.br-p1-explorer-controls select{width:100%;max-width:none}',
'.br-p1-explorer-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:12px 0}.br-p1-explorer-actions .btn{width:auto}.br-p1-overflow{max-height:400px;overflow:auto}.br-p1-svg{width:100%;height:auto;max-height:700px;display:block;margin:12px 0}.br-p1-pie{display:grid;grid-template-columns:minmax(170px,310px) 1fr;gap:15px}.br-p1-pie svg{width:100%}.br-p1-pie p{margin:4px 0;font-size:.88rem}.br-p1-history-tools{display:flex;align-items:center;margin:10px 0}.br-p1-legend{color:#969CAE;font-size:.85rem}',
'.br-p1-collapsible{border:1px solid #313748;padding:8px;border-radius:8px}.br-p1-collapsible summary{color:#2CA8D4;cursor:pointer}',
'@media(max-width:650px){.br-p1-compact-table th:last-child,.br-p1-compact-table td:last-child{display:none}.br-p1-pie{grid-template-columns:1fr}.br-p1-filters label{flex:1 1 125px}}'
].join('\n');
document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
