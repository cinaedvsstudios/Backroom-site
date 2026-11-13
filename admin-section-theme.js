/* Backroom Admin v0.23.3: consistent, accessible section accent selection. */
(() => {
'use strict';
if(window.BackroomAdminSectionTheme)return;
const $=id=>document.getElementById(id);
const sections=new Set(['venues','events','cruising','analytics','other']);
function visible(node){
 if(!node||node.classList.contains('hidden'))return false;
 return node.style.display!=='none';
}
function detect(){
 const analytics=$('br-phase2-view');
 if(visible(analytics)&&($('nav-data-quality')?.classList.contains('br-nav-active')||analytics.style.display==='block'))return 'analytics';
 if(!visible($('view-tables')))return 'other';
 const selected=window.BackroomAdminUpgrade?.state?.section;
 if(selected==='cruising'||$('nav-cruising')?.classList.contains('br-nav-active'))return 'cruising';
 if(selected==='events'||$('nav-events')?.classList.contains('br-nav-active'))return 'events';
 if(selected==='venues'||$('nav-venues')?.classList.contains('br-nav-active'))return 'venues';
 const heading=String($('summary-title')?.textContent||'').toUpperCase();
 if(heading.includes('CRUISING'))return 'cruising';
 if(heading.includes('EVENT'))return 'events';
 if(heading.includes('VENUE'))return 'venues';
 return 'venues';
}
function sync(){
 const shell=$('admin-shell');if(!shell)return;
 const section=detect();
 if(!sections.has(section))return;
 if(shell.dataset.brSection!==section)shell.dataset.brSection=section;
 for(const [id,type] of [['nav-venues','venues'],['nav-events','events'],['nav-cruising','cruising'],['nav-data-quality','analytics']]){
  const node=$(id);if(!node)continue;
  if(type===section)node.setAttribute('aria-current','page');
  else node.removeAttribute('aria-current');
 }
}
function install(){
 const shell=$('admin-shell');if(!shell)return;
 sync();
 let queued=false;
 const schedule=()=>{
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;sync();});
 };
 const ids=['view-tables','br-phase2-view','nav-venues','nav-events','nav-cruising','nav-data-quality'];
 const observer=new MutationObserver(mutations=>{
  if(mutations.some(x=>x.attributeName==='class'||x.attributeName==='style'))schedule();
 });
 for(const id of ids){const node=$(id);if(node)observer.observe(node,{attributes:true,attributeFilter:['class','style']});}
 const heading=$('summary-title');
 if(heading)observer.observe(heading,{childList:true,characterData:true,subtree:true});
 // Covers the existing sidebar's capture-phase switch, the original switchView
 // handler and switching the new analytics tabs, without modifying those handlers.
 document.addEventListener('click',event=>{
  if(event.target.closest?.('#nav-venues,#nav-events,#nav-cruising,#nav-data-quality,#br-phase2-nav,#nav-editor,#nav-terminology,#nav-avatars,#nav-voting-admin')){
   queueMicrotask(sync);
  }
 },false);
 window.addEventListener('pageshow',schedule);
}
window.BackroomAdminSectionTheme={sync,detect,version:'0.23.3'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
})();
