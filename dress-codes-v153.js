/* Backroom v1.5.8 - searchable, illustrated glossary */
(function () {
  'use strict';
  // Resolve either the profile avatars or the specialist kink images.
  const imageURL=file=>{
    const parts=String(file||'').split('/');
    const dir=parts.length===2?parts[0]:'Profile_images';
    const name=parts.length===2?parts[1]:parts[0];
    if(!['Profile_images','kinkthumb'].includes(dir)||!/^[a-zA-Z0-9_().-]+\.png$/i.test(name))return '';
    return dir+'/'+encodeURIComponent(name);
  };
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  let pending=null;
  const fetchData=()=>pending||(pending=fetch('dress-codes-data.json?v=1.5.10',{cache:'no-store'}).then(response=>{
    if(!response.ok)throw new Error('Guide data unavailable ('+response.status+')');
    return response.json();
  }).catch(error=>{pending=null;throw error;}));
  function mount(root) {
    if(!root)return;
    const input=root.querySelector('#br-guide-search');
    const tabs=root.querySelector('#br-guide-tabs');
    const results=root.querySelector('#br-guide-results');
    const scroll=root.querySelector('#br-guide-scroll');
    const summary=root.querySelector('#br-guide-summary');
    const clear=root.querySelector('#br-guide-clear');
    const zoom=root.querySelector('#br-guide-zoom');
    if(!input||!tabs||!results||!scroll || results.dataset.brGuideBound === 'true')return;
    results.dataset.brGuideBound='true';
    const state={active:'all',query:'',data:null};
    const images = new Set();
    function closeZoom() { if(zoom) { zoom.hidden=true;const im=zoom.querySelector('img');if(im)im.src=''; } }
    function openZoom(file,label) {
      if(!zoom||!images.has(file))return;
      const im=zoom.querySelector('#br-guide-zoom-image');
      im.src=imageURL(file);
      im.alt=label;
      zoom.querySelector('#br-guide-zoom-caption').textContent=label;
      zoom.hidden=false;
      zoom.querySelector('#br-guide-zoom-close')?.focus();
    }
    zoom?.querySelector('#br-guide-zoom-close')?.addEventListener('click',closeZoom);
    zoom?.addEventListener('click',event=>{if(event.target===zoom)closeZoom();});
    root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!zoom?.hidden){closeZoom();input.focus();}});
    results.addEventListener('click',event=>{
      const thumb=event.target.closest('[data-guide-preview]');
      if(!thumb)return;
      openZoom(thumb.dataset.guidePreview,thumb.dataset.guideLabel||'Avatar preview');
    });
    function tabMarkup(id,label,accent,count){
      return '<button type="button" class="br-guide-tab'+(state.active===id?' is-active':'')+'" data-guide-filter="'+esc(id)+'" aria-pressed="'+(state.active===id)+'" style="--cat:'+esc(accent)+'">'+esc(label)+' <span>'+count+'</span></button>';
    }
    function renderTabs(){
      if(!state.data)return;
      let total=state.data.categories.reduce((count,category)=>count+category.items.length,0);
      tabs.innerHTML=tabMarkup('all','All','#dee7f3',total)+state.data.categories.map(category=>tabMarkup(category.id,category.label,category.accent,category.items.length)).join('');
    }
    function renderItem(item,category){
      const image=item.image&&images.has(item.image)?'<button class="br-guide-thumb" data-guide-preview="'+esc(item.image)+'" data-guide-label="'+esc(item.term)+'" type="button" title="Enlarge '+esc(item.term)+' example"><img loading="lazy" src="'+imageURL(item.image)+'" alt="Illustrated '+esc(item.term)+' example" onerror="this.parentElement.hidden=true"></button>':'';
      const swatch=item.swatch?'<span class="br-guide-swatch" style="background:'+esc(item.swatch)+'" aria-hidden="true"></span>':'';
      const extended=item.kind==='extended'?'<span class="br-guide-extended">Extended / varies</span>':item.kind==='core'?'<span class="br-guide-core">Historical core</span>':'';
      return '<article class="br-guide-term" style="--cat:'+esc(category.accent)+'">'+
        '<div class="br-guide-term-info"><h3>'+swatch+esc(item.term)+'</h3>'+extended+'<p>'+esc(item.description)+'</p></div>'+image+'</article>';
    }
    function renderResults(resetScroll=false){
      if(!state.data)return;
      const q=state.query.toLocaleLowerCase().trim();
      let shown=0;
      const sections=state.data.categories.filter(c=>state.active==='all'||c.id===state.active).map(category=>{
        const items=category.items.filter(item=>(item.term+' '+item.description+' '+category.label).toLocaleLowerCase().includes(q));
        if(!items.length)return '';
        shown+=items.length;
        const hanky=category.id==='hanky'?'<div class="br-guide-hanky-explainer"><strong>HANKY CODE:</strong> Traditionally the <strong>left pocket</strong> suggested an active/top role and the <strong>right pocket</strong> a receptive/bottom role. Many colours have multiple meanings; these are historical examples, not universal rules or consent.</div>':'';
        return '<section class="br-guide-section" style="--cat:'+esc(category.accent)+'"><h2>'+esc(category.label)+' <small>'+items.length+'</small></h2>'+hanky+'<div class="br-guide-grid">'+items.map(item=>renderItem(item,category)).join('')+'</div></section>';
      }).filter(Boolean).join('');
      summary.textContent=shown+' term'+(shown===1?'':'s')+(q?' matching “'+state.query.trim()+'”':'');
      results.innerHTML=sections||'<div class="br-guide-empty">No terms match that search. Try fewer words, or select All categories.</div>';
      if(resetScroll)scroll.scrollTop=0;
    }
    tabs.addEventListener('click',event=>{
      const btn=event.target.closest('[data-guide-filter]');
      if(!btn)return;
      state.active=btn.dataset.guideFilter;
      renderTabs();renderResults(true);
    });
    input.addEventListener('input',()=>{state.query=input.value;renderResults(true);});
    clear?.addEventListener('click',()=>{input.value='';state.query='';input.focus();renderResults(true);});

    // Reuse the site's existing Contact/Report modal. The standalone glossary
    // forwards the request to the full site where that modal is available.
    root.querySelector('#br-guide-contact')?.addEventListener('click',()=>{
      if(typeof window.flagListing==='function'){
        window.flagListing('N/A','Terminology & Dress Codes Feedback','General Support');
        const msg=document.querySelector('#formsubmit-modal textarea[name="message"]');
        if(msg && (!msg.value.trim() || msg.value.trim()==='Type your message here')){
          msg.value='Terminology & Dress Codes feedback:\n';
          msg.focus();
          msg.setSelectionRange(msg.value.length,msg.value.length);
        }
      }else{
        try{sessionStorage.setItem('br_glossary_feedback_pending','1');}catch(_){}
        window.location.assign('index.html#dress-codes');
      }
    });

    fetchData().then(data=>{
      if(!data||!Array.isArray(data.categories))throw new Error('Invalid glossary data');
      state.data=data;
      data.categories.forEach(c=>c.items.forEach(item=>{if(item.image)images.add(item.image);}));
      const sources=root.querySelector('#br-guide-sources-list');
      if(sources) sources.innerHTML=(data.sources||[]).map(source=>'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+'</a>').join('');
      renderTabs();renderResults(true);
    }).catch(error=>{
      results.textContent='Unable to load guide: '+error.message;
      tabs.innerHTML='<span>Guide temporarily unavailable</span>';
    });
  }
  window.BackroomGuide={mount};
  if(document.getElementById('backroom-guide-main')){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mount(document.getElementById('backroom-guide-main')),{once:true});
    else mount(document.getElementById('backroom-guide-main'));
  }
})();