// Backroom v1.5: festival groups, featured selections and shared helpers.
(() => {
  'use strict';
  const api = { festivals: [], picks: { Venues: [], Events: [] }, savingBulk: false };
  const clean = value => String(value ?? '').trim();
  const esc = value => clean(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : '';
  api.ready = Promise.all([
    fetch('festivals.json?v=1.5', {cache:'no-store'}).then(r => r.ok ? r.json() : []),
    fetch('picks.json?v=1.5', {cache:'no-store'}).then(r => r.ok ? r.json() : {})
  ]).then(([festivals, picks]) => {
    api.festivals = Array.isArray(festivals) ? festivals.filter(f => f && f.Festival_ID && Array.isArray(f.Event_IDs)) : [];
    api.picks = picks && typeof picks === 'object' ? picks : {Venues:[],Events:[]};
    document.dispatchEvent(new Event('backroom:v15-ready'));
    return api;
  }).catch(error => { console.warn('Backroom v1.5 optional data unavailable',error); return api; });
  api.festivalsForEvent = id => api.festivals.filter(f => f.Event_IDs.includes(id));
  api.festivalForEvent = id => api.festivalsForEvent(id)[0] || null;
  api.isFeaturedVenue = id => (api.picks.Venues || []).some(v => v.Venue_ID === id);
  api.isFeaturedEvent = (id, eventDate) => {
    const now = new Date();
    const today = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    const records = api.picks.Events || [];
    const start = date(api.picks.Week_Start), end = date(api.picks.Week_End);
    if (end && today > end) return false;
    if (start && end && eventDate && (eventDate < start || eventDate > end)) return false;
    return records.some(v => v.Event_ID === id && (!eventDate || v.Event_Date === eventDate));
  };
  api.badge = (type, id, eventDate) => {
    const selected = type === 'venue' ? api.isFeaturedVenue(id) : api.isFeaturedEvent(id,eventDate);
    return selected ? '<img class="backroom-featured-sticker" src="neon_backroom_featured_badge.png?v=1.5" alt="Backroom Featured" title="Backroom Featured">' : '';
  };
  api.promptSave = (eventId, commit) => {
    const festivals = api.festivalsForEvent(eventId);
    if (!festivals.length) { commit([eventId]); return; }
    document.getElementById('v15-save-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'v15-save-overlay';
    overlay.className = 'v15-save-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Save festival event');
    const buttons = festivals.map((festival,index)=>'<button type="button" class="btn primary-btn pill-btn" data-v15-festival="'+index+'">💖 Save entire '+esc(festival.Festival_Name)+'</button>').join('');
    overlay.innerHTML = '<div class="v15-save-dialog"><button class="v15-dismiss" type="button" aria-label="Close">×</button><h2 class="display-font">SAVE TO MY EVENTS</h2><p>This event belongs to a festival. What would you like to save?</p><button class="btn secondary-btn pill-btn" data-v15-single type="button">💖 Save only this event</button>'+buttons+'</div>';
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener('click', e => {if(e.target===overlay)close();});
    overlay.querySelector('.v15-dismiss').addEventListener('click',close);
    overlay.querySelector('[data-v15-single]').addEventListener('click',()=>{close();commit([eventId]);});
    overlay.querySelectorAll('[data-v15-festival]').forEach(button=>button.addEventListener('click',()=>{
      const fest=festivals[Number(button.dataset.v15Festival)];close();commit([...new Set(fest.Event_IDs)]);
    }));
  };
  api.notifySaved = () => document.dispatchEvent(new Event('backroom:v15-saved'));
  window.BackroomV15 = api;
})();