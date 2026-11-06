/* Backroom 1.5.25 — desktop Events layout and mobile navigation helpers */
(() => {
  'use strict';

  function apply(container, festivalsMode) {
    // Direct calendar/festival navigation can bypass the normal hash-route handler.
    // Clear Venues-only sticky mode before rendering either calendar screen.
    document.getElementById('main-content')?.classList.remove('br-venues-sticky');
    if (festivalsMode || !container) return;
    const page = container.querySelector('.calendar-page');
    const row = page?.querySelector('.calendar-title-row');
    const strip = row?.querySelector('.calendar-filter-shell');
    const layout = page?.querySelector('.calendar-layout');
    const month = layout?.querySelector('.calendar-selector');
    const panel = layout?.querySelector('.calendar-event-panel');
    if (!page || !row || !strip || !layout || !month || !panel) return;

    page.classList.add('calendar-page--events');
    const chips = [...strip.querySelectorAll('[data-calendar-filter]')];
    const quickNames = new Set(['all', 'today', 'week', 'featured']);
    const top = document.createElement('div');
    top.className = 'br-event-filter-top';
    const quick = document.createElement('div');
    quick.className = 'br-event-quick-filters';
    quick.setAttribute('aria-label', 'Quick event filters');
    chips.filter(c => quickNames.has(c.dataset.calendarFilter))
      .forEach(c => quick.appendChild(c.cloneNode(true)));
    const mobile = document.createElement('div');
    mobile.className = 'br-event-mobile-filters';
    row.replaceChild(top, strip);
    mobile.appendChild(strip);
    top.append(quick, mobile);

    const sidebar = document.createElement('div');
    sidebar.className = 'br-event-control-sidebar';
    const categoryPanel = document.createElement('section');
    categoryPanel.className = 'br-event-category-panel';
    categoryPanel.setAttribute('aria-label', 'Event categories');
    const heading = document.createElement('h2');
    heading.className = 'display-font';
    heading.textContent = 'FILTER BY CATEGORY';
    const scroll = document.createElement('div');
    scroll.className = 'br-event-category-scroll';
    chips.filter(c => !quickNames.has(c.dataset.calendarFilter))
      .forEach(c => scroll.appendChild(c.cloneNode(true)));
    categoryPanel.append(heading, scroll);
    layout.insertBefore(sidebar, month);
    sidebar.append(categoryPanel, month);

    const cards = [...panel.children].filter(el =>
      el.matches('.calendar-event-card, .v15-festival-card'));
    if (cards.length) {
      const grid = document.createElement('div');
      grid.className = 'br-event-card-grid';
      panel.appendChild(grid);
      cards.forEach(card => grid.appendChild(card));
    }
  }

  window.BackroomCalendarLayout = { apply };

  function init() {
    const main = document.getElementById('main-content');
    const heading = document.getElementById('context-header');
    const button = document.getElementById('br-mobile-back-to-top');
    if (!button) return;
    function syncHeight() {
      if (!main || !heading) return;
      const h = Math.ceil(heading.getBoundingClientRect().height);
      if (h > 0) main.style.setProperty('--br-venue-header-height', h + 'px');
    }
    if (heading && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(syncHeight).observe(heading);
    }
    window.addEventListener('resize', syncHeight, { passive:true });
    syncHeight();

    let touching = false, moving = false, idle = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function update() {
      button.classList.toggle('is-visible',
        window.scrollY > Math.max(360, window.innerHeight * 0.7));
      button.classList.toggle('is-transparent', touching || moving);
    }
    window.addEventListener('scroll', () => {
      moving = true;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => { moving = false; update(); }, 180);
      update();
    }, { passive:true });
    window.addEventListener('touchstart', () => { touching = true; update(); }, { passive:true });
    window.addEventListener('touchend', e => { touching = e.touches.length > 0; update(); }, { passive:true });
    window.addEventListener('touchcancel', () => { touching = false; update(); }, { passive:true });
    button.addEventListener('click', () => {
      window.scrollTo({ top:0, behavior:reduceMotion ? 'instant' : 'smooth' });
    });
    update();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();