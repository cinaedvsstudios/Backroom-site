/* Backroom Admin upgrade: navigation, draft tracking, complete-data search and record editing. */
(() => {
'use strict';
if (window.BackroomAdminUpgrade) return;
const state = { section:'venues', sortField:'', sortDir:'', logOperation:'', locationTimer:0 };
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const idFor = mode => mode === 'events' ? 'Event_ID' : 'Venue_ID';
const isCruising = r => String(r?.Category || '').trim().toLowerCase() === 'cruising area';
const empty = v => v === null || v === undefined || String(v).trim() === '';
const sourceKey = mode => mode === 'events' ? 'br_admin_events_draft' : 'br_admin_venues_draft';
const readStored = mode => { try { const r=JSON.parse(localStorage.getItem(sourceKey(mode))||'[]'); return Array.isArray(r)?r:[]; } catch { return []; } };
const dateNow = () => new Date().toISOString();
const stripDate = row => { const copy={...row}; delete copy.Last_Updated; return JSON.stringify(copy); };
const totals = rows => ({venues:rows.filter(r=>!isCruising(r)).length,cruising:rows.filter(isCruising).length});
function changes(previous, next, mode) {
    const key=idFor(mode), prev=new Map(previous.map(r=>[String(r?.[key]||''),r])), after=new Map(next.map(r=>[String(r?.[key]||''),r]));
    let added=0,modified=0,removed=0;
    next.forEach(r => {const old=prev.get(String(r?.[key]||'')); if(!old)added++; else if(stripDate(old)!==stripDate(r))modified++;});
    previous.forEach(r=>{if(!after.has(String(r?.[key]||'')))removed++;});
    return {added,modified,removed};
}
function stampChanges(previous, next, mode) {
    const previousById=new Map(previous.map(r=>[String(r?.[idFor(mode)]||''),r]));
    const stamp=dateNow();
    next.forEach(r=>{
        const old=previousById.get(String(r?.[idFor(mode)]||''));
        if(!old || stripDate(old)!==stripDate(r)) r.Last_Updated=stamp;
    });
}
function logChange(mode,oldRows,newRows,operation) {
    const result=changes(oldRows,newRows,mode);
    if(!(result.added||result.modified||result.removed))return;
    const before=mode==='events'?{events:oldRows.length}:totals(oldRows);
    const after=mode==='events'?{events:newRows.length}:totals(newRows);
    window.BackroomAdminReporting?.recordOperation({type:'change',date:dateNow(),mode,operation, before,after,...result});
}
function showSection(section) {
    state.section=section;
    const report=document.getElementById('br-reporting-view');
    if(report) report.style.display=section==='reporting'?'block':'none';
    if(section==='reporting'){
        ['view-tables','view-editor','view-terminology','view-avatars'].forEach(id=>{const el=document.getElementById(id);if(el){el.style.display='none';el.classList.add('hidden');}});
        window.BackroomAdminReporting?.open();
    }
    document.querySelectorAll('#nav-venues,#nav-events,#nav-cruising,#nav-reporting').forEach(el=>el.classList.toggle('br-nav-active',el.id==='nav-'+section));
}
function addSidebar() {
    const venues=document.getElementById('nav-venues'),events=document.getElementById('nav-events');
    if(!venues||!events)return;
    const cruise=document.createElement('div');cruise.id='nav-cruising';cruise.className='sidebar-item';cruise.innerHTML='<span class="icon">🗺️</span><span class="sidebar-text">Cruising Areas</span>';events.after(cruise);
    const report=document.createElement('div');report.id='nav-reporting';report.className='sidebar-item';report.innerHTML='<span class="icon">📊</span><span class="sidebar-text">Reporting & Statistics</span>';cruise.after(report);
    const archived=document.createElement('details');archived.id='br-archived';archived.innerHTML='<summary>📦 Archived Functions</summary><div class="br-archive-inner"></div>';
    const parent=document.querySelector('.sidebar-menu');parent?.appendChild(archived);
    const archive=archived.querySelector('.br-archive-inner');
    ['btn-sidebar-pending','sidebar-pending-list','btn-sidebar-old','sidebar-old-list','nav-editor'].forEach(id=>{const el=document.getElementById(id);if(el)archive.appendChild(el);});
    const previewButton=[...document.querySelectorAll('.sidebar-item')].find(x=>x.querySelector('.sidebar-text')?.textContent.trim()==='Preview Import');
    if(previewButton)archive.appendChild(previewButton);
    const scrape=[...document.querySelectorAll('.sidebar-item')].find(x=>x.querySelector('.sidebar-text')?.textContent.trim()==='Scrape Info');
    scrape?.remove();
    ['btn-export-csv','btn-save-json-as'].forEach(id=>{const el=document.getElementById(id);if(el)archive.appendChild(el);});
    const audit=document.getElementById('btn-audit-event-venue-ids');
    if(audit) archive.appendChild(audit);
    // A link to the existing audit button if the enhancement adds it later.
    cruise.addEventListener('click',()=>{
        window.__backroomAdminResetDashboard?.();
        for (const filter of [window.__backroomAdminV109?.state,window.__backroomAdminJsonLocations?.state]) {
            if(filter){filter.country='';filter.city='';}
        }
        state.sortField='';state.sortDir='';
        showSection('cruising');
        switchView('venues');
        const title=document.getElementById('summary-title');if(title)title.textContent='CRUISING AREAS';
        renderTable();
    });
    report.addEventListener('click',()=>showSection('reporting'));
    ['nav-venues','nav-events'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>showSection(id.slice(4)),true));
    ['nav-editor','nav-avatars','nav-terminology'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>showSection('other'),true));
    document.getElementById('btn-view-record')?.replaceChildren(document.createTextNode('👁️ View / Edit Record'));
    const version=document.getElementById('admin-sidebar-version'); if(version)version.textContent='v0.23.4';
}
function allDataFilter(rows){
    if(state.section==='cruising')rows=rows.filter(isCruising);
    else if(state.section==='venues' && currentMode==='venues')rows=rows.filter(r=>!isCruising(r));
    const input=document.getElementById('admin-global-search');
    const q=String(input?.value||'').trim().toLowerCase();
    if(q)rows=rows.filter(row=>Object.values(row).some(v=>String(v??'').toLowerCase().includes(q)));
    const controls=window.__backroomAdminJsonLocations?.state || {};
    const extra=window.__backroomAdminV109?.state || {};
    const country=String(controls.country||extra.country||'').trim().toLowerCase();
    const city=String(controls.city||extra.city||'').trim().toLowerCase();
    if(country)rows=rows.filter(r=>String(r.Country||'').trim().toLowerCase()===country);
    if(city)rows=rows.filter(r=>String(r.City||'').toLowerCase().split(',').some(c=>c.trim()===city));
    if(state.sortField&&state.sortDir) {
        const field=state.sortField;
        rows=rows.slice().sort((a,b)=>{
            const av=a?.[field],bv=b?.[field],an=Number(av),bn=Number(bv);
            let result=(!empty(av)&&!empty(bv)&&Number.isFinite(an)&&Number.isFinite(bn))?an-bn:
              String(av??'').localeCompare(String(bv??''),undefined,{numeric:true,sensitivity:'base'});
            if(empty(av)!==empty(bv))result=empty(av)?1:-1;
            return state.sortDir==='asc'?result:-result;
        });
    }
    return rows;
}
async function fetchOther(mode) {
    const local=readStored(mode);if(local.length)return local;
    try{const res=await fetch((mode==='events'?'events.json':'listings.json')+'?v='+Date.now());if(!res.ok)throw Error('HTTP '+res.status);const result=await res.json();return Array.isArray(result)?result:[];}catch{return [];}
}
async function openPreview() {
    if(!['venues','events'].includes(currentMode))return;
    const id=String(selectedAdminRecordId||'');const key=idFor(currentMode);
    const record=draftData.find(r=>String(r[key]??'')===id);
    if(!record){showToast('Select a record in the table first.');return;}
    const mode=currentMode;
    const popup=window.open('','backroom-record-preview','popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes');
    if(!popup){showToast('Allow popups to view the record.');return;}
    popup.document.title='Preparing Backroom Preview…';
    popup.document.body.innerHTML='<div style="background:#0b0f19;color:white;padding:50px;font:20px Arial">Preparing record preview…</div>';
    try{
        const related=await fetchOther(mode==='venues'?'events':'venues');
        const other=mode==='venues'?{events:related.filter(e=>String(e?.Venue_ID||'')===id).slice(0,100),venues:[]}:
          {events:[],venues:related.filter(v=>String(v?.Venue_ID||'')===String(record.Venue_ID||'')).slice(0,2)};
        const token=Date.now()+'-'+Math.random().toString(36).slice(2);
        const payload={token,mode,record:JSON.parse(JSON.stringify(record)),...other,generatedAt:dateNow()};
        localStorage.setItem('br_admin_record_preview_payload',JSON.stringify(payload));
        popup.location.replace('admin-record-preview.html?token='+encodeURIComponent(token));
    }catch(error){
        popup.document.body.textContent='Unable to open preview: '+error.message;
        showToast('Record preview failed: '+error.message);
    }
}
function savePreview(mode,id,updates) {
    if(currentMode!==mode)throw Error('Please switch back to the '+mode+' tab before saving.');
    const key=idFor(mode),index=draftData.findIndex(r=>String(r?.[key]||'')===String(id));
    if(index<0)throw Error('Record no longer exists in the working data.');
    const existing=draftData[index],updated={...existing};
    Object.keys(updates||{}).forEach(field=>{
        if(field===key||field==='Last_Updated'||!Object.prototype.hasOwnProperty.call(existing,field))return;
        const value=updates[field];
        if(typeof existing[field]==='boolean')updated[field]=Boolean(value);
        else if(typeof existing[field]==='number')updated[field]=Number(value)||0;
        else if(Array.isArray(existing[field])||existing[field]&&typeof existing[field]==='object') updated[field]=typeof value==='string'?JSON.parse(value):value;
        else updated[field]=String(value??'');
    });
    if(stripDate(existing)!==stripDate(updated)){
        draftData[index]=updated;
        state.logOperation='Edit Record';
        saveDraftsToLocal();renderTable();
    }
    return JSON.parse(JSON.stringify(draftData[index]));
}
function install() {
    addSidebar();
    const oldSave=saveDraftsToLocal;
    saveDraftsToLocal=function trackedDraftSave(){
        const mode=currentMode==='events'?'events':'venues', previous=readStored(mode);
        if(Array.isArray(draftData)&&['venues','events'].includes(currentMode))stampChanges(previous,draftData,mode);
        const result=oldSave.apply(this,arguments);
        if(Array.isArray(draftData)&&['venues','events'].includes(currentMode))logChange(mode,previous,draftData,state.logOperation||'Update Working Data');
        state.logOperation='';
        return result;
    };
    const oldTable=generateTableHTML;
    generateTableHTML=function filteredTable(data,isMain){
        return oldTable.call(this,isMain?allDataFilter(data):data,isMain);
    };
    const table=document.getElementById('admin-table-container');
    table?.addEventListener('click',event=>{
        const button=event.target.closest('.admin-sort-button');if(!button)return;
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        const field=button.dataset.sortColumn;
        if(state.sortField!==field){state.sortField=field;state.sortDir='asc';}
        else if(state.sortDir==='asc')state.sortDir='desc';
        else{state.sortDir='';state.sortField='';}
        renderTable();
    },true);
    document.getElementById('admin-global-search')?.addEventListener('input',()=>{
        clearTimeout(state.locationTimer);state.locationTimer=setTimeout(()=>renderTable(),230);
    });
    document.body.addEventListener('change',event=>{
        if(['admin-json-country-filter','admin-json-city-filter','admin-country-filter','admin-city-filter'].includes(event.target.id))setTimeout(()=>renderTable(),30);
    });
    document.body.addEventListener('click',event=>{
        if(event.target.closest('#btn-apply-merge'))state.logOperation='Merge JSON';
        if(event.target.closest('#btn-delete-old-events, #btn-remove-old, #btn-remove-old-events'))state.logOperation='Remove Old';
        if(event.target.closest('#br-remove-json-apply'))state.logOperation='Remove JSON';
        if(event.target.closest('#btn-delete-records'))state.logOperation='Delete Record';
    },true);
    window.openAdminRecordPreview=openPreview;
    window.BackroomAdminUpgrade.savePreview=savePreview;
    const oldUpdateViewButton=updateViewRecordButton;
    updateViewRecordButton=function upgradedViewButton(){
        const result=oldUpdateViewButton.apply(this,arguments);
        const button=document.getElementById('btn-view-record');
        if(button)button.textContent='👁️ View / Edit Record';
        return result;
    };
    const note=document.createElement('style');note.textContent=[
        '#br-archived{margin:13px 10px;border:1px solid var(--panel-mid);border-radius:10px;padding:8px;color:#eee}',
        '#br-archived summary{cursor:pointer;padding:10px;font-weight:bold;color:var(--primary-blue)}',
        '#br-archived .br-archive-inner{display:flex;flex-direction:column;gap:6px}',
        '#br-archived .btn{width:100%!important;white-space:normal}',
        '#nav-cruising,#nav-reporting{cursor:pointer}',
        '.br-nav-active{border-left:3px solid var(--primary-blue)!important;background:var(--panel-dark)}'
    ].join('\n');document.head.appendChild(note);
    if(currentMode==='venues'&&Array.isArray(draftData)&&draftData.length)renderTable();
}
function getScopeRows(rows) {
    if (!Array.isArray(rows)) return [];
    if (currentMode !== 'venues') return rows;
    if (state.section === 'cruising') return rows.filter(isCruising);
    if (state.section === 'venues') return rows.filter(row => !isCruising(row));
    return rows;
}
function getScopeTotal() {
    return getScopeRows(Array.isArray(draftData) ? draftData : []).length;
}
window.BackroomAdminUpgrade={state,savePreview,readStored,esc,totals,isCruising,openPreview,getScopeRows,getScopeTotal,applyFilters:allDataFilter};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
