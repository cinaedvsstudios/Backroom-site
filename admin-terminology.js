/* Backroom admin terminology change-request editor. Browser drafts only. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const key='br_admin_terms_draft_v2';
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const clone=x=>JSON.parse(JSON.stringify(x));
const state={base:null,data:null,hash:'',active:'all',query:'',loaded:false,busy:false};
const category=id=>state.data?.categories.find(c=>c.id===id);
const baseCategory=id=>state.base?.categories.find(c=>c.id===id);
function checksum(obj){const s=JSON.stringify(obj);let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619)}return (n>>>0).toString(16)}
function imgPath(x){return x._removedImage?'':String(x.image||'')}
function fileUrl(path){
 const p=String(path||'').split('/'),dir=p.length===2?p[0]:'Profile_images',name=p[p.length-1];
 return ['kinkthumb','Profile_images'].includes(dir)&&/^[A-Za-z0-9_().-]+\.png$/i.test(name)?dir+'/'+encodeURIComponent(name):'';
}
function display(msg,bad=false){const e=$('term-admin-message');if(e){e.textContent=msg;e.style.color=bad?'#ffabab':'#c0e2d6'}}
function differences(){
 if(!state.base||!state.data)return [];
 const changes=[];
 for(const c of state.data.categories){
  c.items.forEach((item,i)=>{
   const old=baseCategory(c.id)?.items[i];
   if(item._deleted){if(old)changes.push({action:'remove',category:c.id,originalIndex:i,originalTerm:old.term});return}
   if(!old){changes.push({action:'add',category:c.id,term:item.term,description:item.description,image:imgPath(item)||null});return}
   const proposed={term:item.term,description:item.description,image:imgPath(item)||null};
   const original={term:old.term,description:old.description,image:old.image||null};
   if(JSON.stringify(proposed)!==JSON.stringify(original))changes.push({action:'update',category:c.id,originalIndex:i,originalTerm:old.term,original,proposed});
  });
 }
 return changes;
}
function count(){
 const n=differences().length;
 const btn=$('term-admin-copy');if(btn)btn.disabled=n===0;
 display(n?n+' unsent change'+(n===1?'':'s')+' · Draft saved in this browser':'No unsent changes · Live database unchanged');
}
function save(){
 try{localStorage.setItem(key,JSON.stringify({hash:state.hash,data:state.data}))}catch(_){display('Browser storage unavailable. Copy your changes before leaving.',true)}
 count();
}
function tabs(){
 const el=$('term-admin-tabs');if(!el)return;
 const all=state.data.categories.reduce((n,c)=>n+c.items.filter(x=>!x._deleted).length,0);
 el.innerHTML=[{id:'all',label:'All',accent:'#dde5ed',n:all},...state.data.categories.map(c=>({id:c.id,label:c.label,accent:c.accent,n:c.items.filter(x=>!x._deleted).length}))].map(c=>'<button type="button" class="term-editor-tab" data-cat="'+esc(c.id)+'" aria-pressed="'+(state.active===c.id)+'" style="--cat:'+esc(c.accent)+'">'+esc(c.label)+'<span>'+c.n+'</span></button>').join('');
}
function card(c,x,i){
 const original=baseCategory(c.id)?.items[i],path=imgPath(x),url=fileUrl(path);
 const changed=!original||x.term!==original.term||x.description!==original.description||path!==(original.image||'');
 const isKink=path.startsWith('kinkthumb/'),filename=isKink?path.slice(10):'';
 return '<article class="term-editor-card'+(changed?' is-changed':'')+'" data-group="'+esc(c.id)+'" data-index="'+i+'" style="--cat:'+esc(c.accent)+'"><div class="term-editor-body"><div class="term-editor-fields">'+
  '<input class="term-editor-name" data-field="term" aria-label="Edit term name" value="'+esc(x.term)+'">'+
  '<textarea class="term-editor-description" data-field="description" aria-label="Edit definition" rows="4">'+esc(x.description)+'</textarea></div>'+
  '<button class="term-editor-image" type="button" data-preview="1" '+(!url?'hidden':'')+' title="Enlarge example image"><img loading="lazy" src="'+url+'" alt="'+esc(x.term)+' illustration"></button></div>'+
  '<div class="term-editor-path"><label>IMAGE FILENAME (KINKTHUMB FOLDER)</label><div class="term-editor-path-entry"><span>kinkthumb/</span><input data-field="imageFile" type="text" value="'+esc(filename)+'" placeholder="example.png" spellcheck="false" autocomplete="off"></div>'+
  '<p class="term-editor-current">Current: <span data-current-image>'+esc(path||'No image')+'</span>'+(!isKink&&path?' · leave blank to keep existing profile image':'')+'</p></div>'+
  '<div class="term-editor-footer"><button type="button" class="term-editor-delete" data-remove-term="1">Remove term</button>'+
  '<label class="term-editor-remove-image"><input type="checkbox" data-field="removeImage" '+(x._removedImage?'checked':'')+'> Remove image</label>'+
  (changed?'<span class="term-editor-pill">Edited</span>':'')+'</div></article>';
}
function render(reset=false){
 const root=$('term-admin-results');if(!root||!state.data)return;
 let hits=0;const q=state.query.trim().toLowerCase();
 let html=state.data.categories.filter(c=>state.active==='all'||state.active===c.id).map(c=>{
  const rows=c.items.map((item,i)=>({item,i})).filter(r=>!r.item._deleted&&(!q||[r.item.term,r.item.description,c.label].some(v=>String(v||'').toLowerCase().includes(q))));
  if(!rows.length)return '';hits+=rows.length;
  return '<section class="term-editor-section" style="--cat:'+esc(c.accent)+'"><div class="term-editor-section-head"><h4>'+esc(c.label)+' ('+rows.length+')</h4><button class="term-editor-add" type="button" data-add="'+esc(c.id)+'">+ Add term</button></div><div class="term-editor-grid">'+rows.map(r=>card(c,r.item,r.i)).join('')+'</div></section>';
 }).join('');
 if(state.active!=='all'&&!q)html+='<button type="button" class="term-editor-add" data-add="'+esc(state.active)+'">+ Add new term</button>';
 root.innerHTML=html||'<p class="term-editor-empty">No matches. Try another term or select All.</p>';
 $('term-admin-match-count').textContent=hits+' terms displayed';
 if(reset)root.scrollTop=0;
}
function buildShell(){
 $('term-admin-editor').innerHTML='<div class="term-editor-top"><div class="term-editor-intro"><h3>⛓️ TERMINOLOGY & DRESS CODES</h3><p>Click any name or description to edit it. Use the image filename box for files in kinkthumb/.</p></div><div class="term-editor-search"><label>FIND A TERM</label><input id="term-admin-search" type="search" placeholder="Search terms or descriptions…"></div><nav id="term-admin-tabs" class="term-editor-tabs" aria-label="Terminology categories"></nav></div>'+
 '<div id="term-admin-match-count" class="term-admin-message"></div><div id="term-admin-results" class="term-editor-results" tabindex="0"></div>'+
 '<div id="term-admin-lightbox" class="term-admin-preview" hidden role="dialog" aria-modal="true"><div class="term-admin-preview-inner"><button type="button" data-close-preview="1" aria-label="Close">×</button><img alt=""><p></p></div></div>';
}
function updateImage(el,x){
 const img=el.querySelector('.term-editor-image img'),btn=el.querySelector('.term-editor-image'),path=imgPath(x);
 if(img){img.src=fileUrl(path);img.alt=x.term+' illustration';}
 if(btn)btn.hidden=!fileUrl(path);
 const text=el.querySelector('[data-current-image]');if(text)text.textContent=path||'No image';
}
function edit(input){
 const cardEl=input.closest('.term-editor-card');if(!cardEl)return;
 const i=+cardEl.dataset.index,cid=cardEl.dataset.group;
 const x=category(cid)?.items[i],original=baseCategory(cid)?.items[i];
 if(!x)return;
 const field=input.dataset.field;
 if(field==='term'||field==='description')x[field]=input.value;
 if(field==='imageFile'){
  const name=input.value.trim().replace(/^kinkthumb\//i,'');
  x.image=name?'kinkthumb/'+name:(original?.image||'');
  x._removedImage=false;
  const checkbox=cardEl.querySelector('[data-field="removeImage"]');if(checkbox)checkbox.checked=false;
 }
 if(field==='removeImage'){
  x._removedImage=input.checked;
  x.image=input.checked?'':(cardEl.querySelector('[data-field="imageFile"]')?.value.trim()?'kinkthumb/'+cardEl.querySelector('[data-field="imageFile"]').value.trim():(original?.image||''));
 }
 if(field==='imageFile'||field==='removeImage')updateImage(cardEl,x);
 cardEl.classList.add('is-changed');save();
}
function add(categoryId){
 const c=category(categoryId);if(!c)return;
 c.items.push({term:'New term',description:'Type your description here.',image:''});
 state.active=categoryId;state.query='';save();tabs();render(true);
 const all=$('term-admin-results').querySelectorAll('.term-editor-name'),last=all[all.length-1];if(last){last.focus();last.select();}
 const find=$('term-admin-search');if(find)find.value='';
}
function remove(cardEl){
 const x=category(cardEl.dataset.group)?.items[+cardEl.dataset.index];if(!x)return;
 if(!confirm('Include deletion of "'+x.term+'" in the copied change prompt?'))return;
 x._deleted=true;save();tabs();render();
}
function zoom(cardEl){
 const src=cardEl.querySelector('.term-editor-image img')?.getAttribute('src');if(!src)return;
 const dlg=$('term-admin-lightbox');dlg.querySelector('img').src=src;
 dlg.querySelector('p').textContent=cardEl.querySelector('.term-editor-name')?.value||'Illustration';
 dlg.hidden=false;dlg.querySelector('[data-close-preview]')?.focus();
}
function closeZoom(){const dlg=$('term-admin-lightbox');if(dlg)dlg.hidden=true;}
async function copy(){
 const changes=differences();if(!changes.length)return;
 const ticks=String.fromCharCode(96).repeat(3);
 const request={repository:'cinaedvsstudios/Backroom-site',file:'dress-codes-data.json',baseVersion:state.base.version,changes};
 const prompt='Please implement these edits on the latest main branch of the Backroom GitHub website. Update only the specified entries in dress-codes-data.json; preserve everything else. Image filenames refer to the existing kinkthumb/ folder. Verify the referenced files before publishing, check the age gate and glossary in a browser, and report the release commit. Do not remove unrelated entries.\n\nCHANGE REQUEST:\n'+ticks+'json\n'+JSON.stringify(request,null,2)+'\n'+ticks;
 try{await navigator.clipboard.writeText(prompt);display('Copied '+changes.length+' changes. Paste the prompt into ChatGPT.');}
 catch(_){
  const box=$('clipboard-text');
  if(box){box.value=prompt;document.getElementById('clipboard-float')?.classList.remove('hidden');box.focus();box.select();display('Clipboard permission blocked; prompt selected in admin clipboard. Press Ctrl+C.',true);}
  else{const t=document.createElement('textarea');t.value=prompt;document.body.appendChild(t);t.select();const copied=document.execCommand('copy');t.remove();display(copied?'Prompt copied.':'Browser refused clipboard access.',!copied);}
 }
}
async function open(){
 if(state.loaded){count();return}
 if(state.busy)return;
 state.busy=true;display('Loading glossary…');
 try{
  const response=await fetch('dress-codes-data.json?v=1.5.7',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  state.base=await response.json();if(!Array.isArray(state.base.categories))throw Error('Invalid glossary data');
  state.hash=checksum(state.base);
  let saved=null;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}
  state.data=saved?.hash===state.hash?saved.data:clone(state.base);
  buildShell();tabs();render(true);state.loaded=true;count();
  if(differences().length)display('Unsent edits restored from this browser.');
 }catch(e){display('Could not load glossary: '+e.message,true)}
 finally{state.busy=false}
}
document.addEventListener('DOMContentLoaded',()=>{
 const editor=$('term-admin-editor');
 editor?.addEventListener('input',e=>{
  if(e.target.id==='term-admin-search'){state.query=e.target.value;render(true);}
  else if(e.target.matches('[data-field]:not([data-field="removeImage"])'))edit(e.target);
 });
 editor?.addEventListener('change',e=>{if(e.target.matches('[data-field="removeImage"]'))edit(e.target)});
 editor?.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.cat){state.active=b.dataset.cat;tabs();render(true);return}
  if(b.dataset.add){add(b.dataset.add);return}
  if(b.dataset.removeTerm){remove(b.closest('.term-editor-card'));return}
  if(b.dataset.preview){zoom(b.closest('.term-editor-card'));return}
  if(b.dataset.closePreview)closeZoom();
 });
 editor?.addEventListener('click',e=>{if(e.target.id==='term-admin-lightbox')closeZoom();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeZoom()});
 $('term-admin-copy')?.addEventListener('click',copy);
 $('term-admin-reload')?.addEventListener('click',()=>{
  if(!confirm('Discard all your local terminology edits?'))return;
  localStorage.removeItem(key);state.data=clone(state.base);state.active='all';state.query='';
  buildShell();tabs();render(true);count();
 });
});
window.BackroomTerminologyAdmin={open};
})();