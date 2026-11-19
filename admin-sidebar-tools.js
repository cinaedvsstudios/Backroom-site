/* Backroom Admin v0.24.3 — collapsible sidebar shortcuts.
   Move original tool elements, never clone: existing IDs and listeners are preserved. */
(()=>{
'use strict';
if(window.BackroomAdminSidebarTools)return;
const links=[
 ['🔎','Google Search Console','https://search.google.com/search-console?resource_id=https%3A%2F%2Fcinaedvsstudios.github.io%2FBackroom-site%2F'],
 ['🌐','Bing Webmaster Tools','https://www.bing.com/webmasters/home?siteUrl=https://cinaedvsstudios.github.io/Backroom-site/'],
 ['🤖','Backroom ChatGPT Project','https://chatgpt.com/g/g-p-6a037842e4788191ba71bfdd4c576803/project']
];
const tools=['btn-sidebar-flaghold','btn-sidebar-showall','nav-terminology','nav-avatars','nav-voting-admin'];
function fold(id,emoji,label){
 const details=document.createElement('details');details.id=id;details.className='br-sidebar-fold';
 const summary=document.createElement('summary');
 const icon=document.createElement('span');icon.className='icon';icon.textContent=emoji;icon.setAttribute('aria-hidden','true');
 const name=document.createElement('span');name.className='sidebar-text';name.textContent=label;
 const chevron=document.createElement('span');chevron.className='br-fold-chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');
 summary.append(icon,name,chevron);
 const contents=document.createElement('div');contents.className='br-sidebar-fold-items';
 details.append(summary,contents);return {details,contents};
}
function install(){
 if(document.getElementById('br-sidebar-seo'))return;
 const scrape=document.getElementById('nav-scrape-builder');
 if(!scrape?.parentElement){console.warn('Backroom sidebar: Scrape Builder not ready.');return;}
 const seo=fold('br-sidebar-seo','🔍','SEO');
 seo.contents.setAttribute('aria-label','SEO shortcuts');
 for(const [emoji,label,url] of links){
  const a=document.createElement('a');a.className='br-sidebar-external';
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.title=label+' — opens in a new tab';
  const icon=document.createElement('span');icon.className='icon';icon.textContent=emoji;icon.setAttribute('aria-hidden','true');
  const title=document.createElement('span');title.textContent=label;
  const ext=document.createElement('span');ext.className='br-external-mark';ext.textContent='↗';ext.setAttribute('aria-hidden','true');
  a.append(icon,title,ext);seo.contents.appendChild(a);
 }
 const other=fold('br-sidebar-other','🧰','Other Tools');
 other.contents.setAttribute('aria-label','Other admin tools');
 // Divider after Show All was only separating controls that now move together.
 const originalShowAll=document.getElementById('btn-sidebar-showall');
 const divider=originalShowAll?.nextElementSibling;
 if(divider?.matches('hr.divider'))divider.remove();
 for(const id of tools){
  const el=document.getElementById(id);
  if(el)other.contents.appendChild(el);
  else console.warn('Backroom sidebar missing tool: '+id);
 }
 scrape.insertAdjacentElement('afterend',seo.details);
 seo.details.insertAdjacentElement('afterend',other.details);
 seo.details.addEventListener('toggle',()=>{if(seo.details.open)other.details.open=false;});
 other.details.addEventListener('toggle',()=>{if(other.details.open)seo.details.open=false;});
 other.contents.addEventListener('click',e=>{if(e.target.closest('.sidebar-item'))other.details.open=false;});
}
window.BackroomAdminSidebarTools={install,version:'0.24.3'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();