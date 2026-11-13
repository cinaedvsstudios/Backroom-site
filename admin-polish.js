/* Backroom Admin v0.23 — grouped actions, chart tooltip interactions and UI polish. */
(() => {
'use strict';
if(window.BackroomAdminPolish)return;
const state={toolbarInstalled:false,activeTip:null,tooltip:null};
const get=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function menu(key,icon,label){
 const details=document.createElement('details');
 details.className='br-p3-menu br-p3-menu-'+key;
 details.dataset.actionGroup=key;
 details.innerHTML='<summary aria-label="'+esc(label)+' actions"><span aria-hidden="true">'+icon+'</span><strong>'+esc(label)+'</strong><span class="br-p3-chevron" aria-hidden="true">⌄</span></summary>'+
 '<div class="br-p3-pop" role="group" aria-label="'+esc(label)+' options"></div>';
 return details;
}
function installToolbar(){
 if(state.toolbarInstalled)return;
 const load=get('btn-fetch-live'),toolbar=load?.parentElement;
 if(!toolbar||!get('view-tables'))return;
 state.toolbarInstalled=true;
 const original=Array.from(toolbar.children);
 const wrapper=document.createElement('section');wrapper.id='br-p3-action-panel';
 wrapper.setAttribute('aria-label','Record filters and actions');
 const filters=document.createElement('div');filters.id='br-p3-search-row';
 const controls=document.createElement('div');controls.id='br-p3-action-row';
 const caption=document.createElement('span');caption.className='br-p3-toolbar-caption';caption.textContent='Record actions';
 controls.appendChild(caption);
 wrapper.append(filters,controls);
 toolbar.before(wrapper);
 const grouped=[
  ['load','📂','Load & Clear',['btn-fetch-live','btn-fetch-live-all']],
  ['save','💾','Save & Merge',['btn-export-json','btn-save-json-as','btn-export-csv','file-upload-merge']],
  ['view','👁️','View & Fields',['btn-view-record','btn-show-hidden-fields','unhideColumns']],
  ['remove','🗑️','Delete & Remove',['btn-delete-records','br-remove-json-label','btn-remove-old-events','file-upload-replace']]
 ];
 const moved=new Set();
 const move=(node,into)=>{
   if(!node||moved.has(node))return false;
   moved.add(node);into.appendChild(node);node.classList.add('br-p3-menu-option');
   if(node.tagName==='BUTTON')node.type='button';
   return true;
 };
 const resolve=id=>{
   if(id==='unhideColumns')return get('view-tables')?.querySelector('button[onclick*="unhideAllColumns"]');
   if(id.startsWith('file-upload-'))return get(id)?.closest('label');
   return get(id);
 };
 const searchNodes=['admin-global-search-wrap','admin-json-location-filter-wrap','admin-location-filter-wrap','btn-clear-all-filters'];
 searchNodes.forEach(id=>{
   const node=get(id);
   if(node){moved.add(node);filters.appendChild(node);}
 });
 for(const [key,icon,label,ids] of grouped){
   const node=menu(key,icon,label),body=node.querySelector('.br-p3-pop');controls.appendChild(node);
   for(const id of ids)move(resolve(id),body);
   if(key==='remove'){
     const warning=document.createElement('p');warning.className='br-p3-pop-warning';
     warning.textContent='These actions can replace or remove working records. Existing confirmations still apply.';
     body.prepend(warning);
   }
 }
 const extra=menu('more','⚙️','More');
 for(const child of original){
   if(child.parentElement!==toolbar)continue;
   move(child,extra.querySelector('.br-p3-pop'));
 }
 if(extra.querySelector('.br-p3-pop').children.length)controls.appendChild(extra);
 toolbar.classList.add('br-p3-legacy-empty');
 // Close peer menus on opening a different group; keep input labels in place so
 // existing file-upload handlers and record action listeners continue working.
 controls.addEventListener('toggle',event=>{
   const opened=event.target;
   if(!(opened instanceof HTMLDetailsElement)||!opened.open)return;
   controls.querySelectorAll('details.br-p3-menu').forEach(item=>{if(item!==opened)item.open=false;});
 },true);
 controls.addEventListener('click',event=>{
   const target=event.target,detail=target.closest('.br-p3-menu');
   if(!detail||target.closest('summary')||target.closest('label')||target.closest('input[type=file]'))return;
   if(target.closest('button'))setTimeout(()=>{detail.open=false;},0);
 });
 document.addEventListener('click',event=>{
   if(event.target.closest('#br-p3-action-row'))return;
   controls.querySelectorAll('details[open]').forEach(details=>{details.open=false;});
 });
 document.addEventListener('keydown',event=>{
   if(event.key!=='Escape')return;
   controls.querySelectorAll('details[open]').forEach(details=>{details.open=false;});
 });
 const badge=get('admin-sidebar-version');if(badge)badge.textContent='v0.23.5';
 document.title='Backroom Admin Dashboard — v0.23.5';
}
function tipPosition(x,y){
 const tip=state.tooltip;if(!tip)return;
 const gap=14,margin=12,rect=tip.getBoundingClientRect(),vw=window.innerWidth||1280,vh=window.innerHeight||720;
 let left=x+gap,top=y-rect.height-gap;
 if(left+rect.width>vw-margin)left=Math.max(margin,x-rect.width-gap);
 if(top<margin)top=Math.min(vh-rect.height-margin,y+gap);
 tip.style.left=Math.max(margin,Math.min(vw-margin-rect.width,left))+'px';
 tip.style.top=Math.max(margin,Math.min(vh-margin-rect.height,top))+'px';
}
function activateTip(target,x,y){
 if(!target)return;
 const box=state.tooltip;if(!box)return;
 state.activeTip=target;
 const value=target.getAttribute('data-br-chart-tip')||'';
 box.textContent=value;box.hidden=false;
 target.classList.add('br-p3-point-highlight');
 tipPosition(x,y);
}
function deactivateTip(){
 state.activeTip?.classList?.remove('br-p3-point-highlight');state.activeTip=null;
 if(state.tooltip)state.tooltip.hidden=true;
}
function installTooltips(){
 if(state.tooltip)return;
 const box=document.createElement('div');box.id='br-p3-chart-tooltip';box.setAttribute('role','tooltip');box.hidden=true;document.body.appendChild(box);state.tooltip=box;
 document.addEventListener('pointerover',event=>{
   const point=event.target.closest?.('[data-br-chart-tip]');
   if(!point)return;
   if(state.activeTip&&state.activeTip!==point)deactivateTip();
   activateTip(point,event.clientX,event.clientY);
 });
 document.addEventListener('pointermove',event=>{
   const point=event.target.closest?.('[data-br-chart-tip]');
   if(point&&state.activeTip!==point)activateTip(point,event.clientX,event.clientY);
   if(point&&state.activeTip===point)tipPosition(event.clientX,event.clientY);
 });
 document.addEventListener('pointerout',event=>{
   if(state.activeTip&&event.target===state.activeTip&&!state.activeTip.contains(event.relatedTarget))deactivateTip();
 });
 document.addEventListener('focusin',event=>{
   const point=event.target.closest?.('[data-br-chart-tip]');
   if(!point)return;
   const rect=point.getBoundingClientRect();
   activateTip(point,rect.left+rect.width/2,rect.top);
 });
 document.addEventListener('focusout',event=>{
   if(event.target===state.activeTip)deactivateTip();
 });
 document.addEventListener('scroll',()=>{if(state.activeTip)deactivateTip();},true);
 window.addEventListener('blur',deactivateTip);
}
function install(){
 installToolbar();
 installTooltips();
}
window.BackroomAdminPolish={install,installToolbar,installTooltips,getState:()=>state,version:'0.23.1'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
