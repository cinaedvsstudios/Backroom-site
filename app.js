const BACKROOM_VERSION = 'v1.15';
const BACKROOM_EMBEDDED_HASHES = new Set(['#heatmap', '#travel']);
const BACKROOM_INITIAL_EMBEDDED_HASH = BACKROOM_EMBEDDED_HASHES.has(window.location.hash) ? window.location.hash : '';

if (BACKROOM_INITIAL_EMBEDDED_HASH) {
  history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
}

document.write('<link rel="stylesheet" href="event-detail.css?v=1.14">');
document.write('<script src="app-core.js?v=1.11"><\/script>');
document.write('<script src="event-detail.js?v=1.14"><\/script>');

(() => {
  'use strict';

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const key = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  const splitCities = value => (Array.isArray(value) ? value : String(value ?? '').split(/[;,|]+/)).map(clean).filter(Boolean);
  const embeddedPages = {
    heatmap: { src: 'heatmap.html?embed=1&v=1.10.1', title: 'Heat Map' },
    travel: { src: 'travel.html?embed=1&v=1.10.2', title: 'Travel' }
  };

  let coveragePromise = null;
  let activeEmbeddedPage = '';

  function getContentWrapper() {
    return document.querySelector('#main-content .content-wrapper');
  }

  function installEmbeddedStyles() {
    if (document.getElementById('backroom-embedded-pages-style')) return;
    const style = document.createElement('style');
    style.id = 'backroom-embedded-pages-style';
    style.textContent = `
      #main-content .content-wrapper.backroom-embedded-active > :not(.backroom-embedded-page) { display:none !important; }
      .backroom-embedded-page { width:100%; height:calc(100vh - 105px); min-height:620px; background:#000; border:1px solid var(--panel-mid); border-radius:var(--radius-card); overflow:hidden; }
      .backroom-embedded-page iframe { width:100%; height:100%; display:block; border:0; background:#000; }
      #sidebar .sidebar-item.embedded-page-active { background:rgba(44,168,212,.16); color:#fff; }
      @media (max-width:768px) { .backroom-embedded-page { height:calc(100vh - 92px); min-height:560px; border-radius:10px; } }
    `;
    document.head.appendChild(style);
  }

  function ensureEmbeddedPage(pageKey) {
    const config = embeddedPages[pageKey];
    const wrapper = getContentWrapper();
    if (!config || !wrapper) return null;

    let container = document.getElementById(`embedded-${pageKey}-container`);
    if (container) return container;

    container = document.createElement('section');
    container.id = `embedded-${pageKey}-container`;
    container.className = 'backroom-embedded-page hidden';
    container.setAttribute('aria-label', config.title);

    const frame = document.createElement('iframe');
    frame.src = config.src;
    frame.title = `Backroom ${config.title}`;
    frame.loading = 'eager';
    frame.setAttribute('allow', 'geolocation');
    frame.addEventListener('load', () => {
      try {
        const frameDocument = frame.contentDocument;
        if (!frameDocument) return;
        frameDocument.querySelector('.top')?.setAttribute('style', 'display:none !important;');
        frameDocument.documentElement.style.height = '100%';
        if (frameDocument.body) {
          frameDocument.body.style.height = '100%';
          frameDocument.body.style.minHeight = '100%';
        }
        if (pageKey === 'travel') {
          const main = frameDocument.querySelector('main');
          if (main) {
            main.style.maxWidth = 'none';
            main.style.padding = '18px';
          }
        }
        window.setTimeout(() => frame.contentWindow?.dispatchEvent(new Event('resize')), 100);
      } catch (error) {
        console.warn(`Could not prepare embedded ${config.title}:`, error);
      }
    });

    container.appendChild(frame);
    wrapper.appendChild(container);
    return container;
  }

  function setEmbeddedNavigationState(pageKey = '') {
    document.querySelectorAll('#sidebar [data-embedded-page]').forEach(item => {
      item.classList.toggle('embedded-page-active', item.dataset.embeddedPage === pageKey);
    });
  }

  function hideEmbeddedPages() {
    getContentWrapper()?.classList.remove('backroom-embedded-active');
    document.querySelectorAll('.backroom-embedded-page').forEach(page => page.classList.add('hidden'));
    document.body.removeAttribute('data-backroom-embedded-page');
    activeEmbeddedPage = '';
    setEmbeddedNavigationState('');
  }

  function showEmbeddedPage(pageKey, updateHash = true) {
    const wrapper = getContentWrapper();
    const container = ensureEmbeddedPage(pageKey);
    if (!wrapper || !container) return;

    if (updateHash && window.location.hash !== `#${pageKey}`) {
      history.pushState({ backroomEmbeddedPage: pageKey }, '', `#${pageKey}`);
    } else if (!updateHash && window.location.hash !== `#${pageKey}`) {
      history.replaceState({ backroomEmbeddedPage: pageKey }, '', `#${pageKey}`);
    }

    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
    document.querySelectorAll('.backroom-embedded-page').forEach(page => page.classList.add('hidden'));
    container.classList.remove('hidden');
    wrapper.classList.add('backroom-embedded-active');
    document.body.dataset.backroomEmbeddedPage = pageKey;
    activeEmbeddedPage = pageKey;
    setEmbeddedNavigationState(pageKey);
    document.getElementById('sidebar')?.classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function addSidebarLink(afterTitle, title, pageKey, image, fallback) {
    const menu = document.querySelector('#sidebar .sidebar-menu');
    if (!menu || menu.querySelector(`[data-embedded-page="${pageKey}"]`)) return;
    const after = Array.from(menu.querySelectorAll('.sidebar-item')).find(item => clean(item.getAttribute('title')) === afterTitle);
    if (!after) return;

    const item = document.createElement('div');
    item.className = 'sidebar-item tooltip';
    item.title = title;
    item.dataset.extraPage = title;
    item.dataset.embeddedPage = pageKey;
    item.tabIndex = 0;
    item.setAttribute('role', 'link');
    item.innerHTML = `<span class="icon"><img src="${image}" alt="" style="width:25px;height:25px;object-fit:contain;vertical-align:middle;"></span><span class="sidebar-text display-font">${title}</span>`;

    const icon = item.querySelector('img');
    icon.addEventListener('error', () => {
      const replacement = document.createElement('span');
      replacement.textContent = fallback;
      replacement.style.fontSize = '22px';
      icon.replaceWith(replacement);
    }, { once: true });

    const open = event => {
      event?.preventDefault();
      event?.stopPropagation();
      showEmbeddedPage(pageKey, true);
    };
    item.addEventListener('click', open);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') open(event);
    });
    after.insertAdjacentElement('afterend', item);
  }

  function installExtraNavigation() {
    addSidebarLink('Featured', 'Heat Map', 'heatmap', 'Emoji/heatmap.png', '🌈');
    addSidebarLink('Cruising Guide', 'Travel', 'travel', 'train.webp', '🚄');
  }

  function installEmbeddedRouting() {
    const menu = document.querySelector('#sidebar .sidebar-menu');
    if (menu && !menu.dataset.embeddedResetBound) {
      menu.dataset.embeddedResetBound = 'true';
      menu.addEventListener('click', event => {
        if (event.target.closest('[data-embedded-page]') || !activeEmbeddedPage) return;
        hideEmbeddedPages();
      }, true);
    }

    window.addEventListener('popstate', () => {
      const pageKey = window.location.hash.slice(1);
      if (embeddedPages[pageKey]) showEmbeddedPage(pageKey, false);
      else {
        hideEmbeddedPages();
        window.setTimeout(() => window.handleRouting?.(), 0);
      }
    });

    window.addEventListener('hashchange', () => {
      if (!BACKROOM_EMBEDDED_HASHES.has(window.location.hash)) hideEmbeddedPages();
    });
  }

  function applyFilter(filter) {
    if (!filter || ['all', 'all records'].includes(key(filter))) return;
    const wanted = key(filter);
    [100, 300, 700, 1200].forEach(delay => window.setTimeout(() => {
      const chips = Array.from(document.querySelectorAll('#filter-chips .chip'));
      const chip = chips.find(item => key(item.dataset.filter || item.textContent) === wanted)
        || chips.find(item => key(item.dataset.filter || item.textContent).includes(wanted));
      chip?.click();
    }, delay));
  }

  function saveLocation(city, country) {
    const location = city
      ? { city: clean(city), country: clean(country), postcode: '', scope: 'city' }
      : country
        ? { city: '', country: clean(country), postcode: '', scope: 'country' }
        : { city: '', country: '', postcode: '', scope: 'all' };
    localStorage.setItem('br_location', JSON.stringify(location));
  }

  function countCoverage(venueRows, eventRows) {
    const venueMap = new Map();
    const cities = new Set();
    const countries = new Set();

    (Array.isArray(venueRows) ? venueRows : []).forEach(row => {
      const location = { cities: splitCities(row?.City), country: clean(row?.Country) };
      const id = clean(row?.Venue_ID);
      if (id) venueMap.set(id, location);
      location.cities.forEach(city => cities.add(key(city)));
      if (location.country) countries.add(key(location.country));
    });

    (Array.isArray(eventRows) ? eventRows : []).forEach(row => {
      const linked = venueMap.get(clean(row?.Venue_ID)) || { cities: [], country: '' };
      const eventCities = splitCities(row?.City || row?.Event_City || row?.Venue_City || row?.Location_City);
      const eventCountry = clean(row?.Country || row?.Event_Country || row?.Venue_Country || row?.Location_Country);
      (eventCities.length ? eventCities : linked.cities).forEach(city => cities.add(key(city)));
      const country = eventCountry || linked.country;
      if (country) countries.add(key(country));
    });

    return { cities: cities.size, countries: countries.size };
  }

  async function getCoverage() {
    if (coveragePromise) return coveragePromise;
    coveragePromise = (async () => {
      try {
        if (typeof venues !== 'undefined' && typeof events !== 'undefined' && Array.isArray(venues) && Array.isArray(events) && venues.length) {
          return countCoverage(venues, events);
        }
      } catch (_) {}
      const stamp = Date.now();
      const [venueResponse, eventResponse] = await Promise.all([
        fetch(`listings.json?v=${stamp}`),
        fetch(`events.json?v=${stamp}`)
      ]);
      if (!venueResponse.ok || !eventResponse.ok) throw new Error('Coverage files unavailable');
      return countCoverage(await venueResponse.json(), await eventResponse.json());
    })().catch(error => {
      coveragePromise = null;
      throw error;
    });
    return coveragePromise;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  async function hydrateAboutCounts() {
    const container = document.getElementById('about-container');
    if (!container?.querySelector('#country-count, #about-country-count, #city-count, #about-city-count')) return;
    try {
      const counts = await getCoverage();
      const countryText = `${counts.countries} ${counts.countries === 1 ? 'country' : 'countries'}`;
      const cityText = `${counts.cities} ${counts.cities === 1 ? 'city' : 'cities'}`;
      ['country-count','about-country-count'].forEach(id => setText(id, counts.countries));
      ['city-count','about-city-count'].forEach(id => setText(id, counts.cities));
      ['country-count-inline','about-country-count-inline'].forEach(id => setText(id, countryText));
      ['city-count-inline','about-city-count-inline'].forEach(id => setText(id, cityText));
    } catch (error) {
      console.warn('Could not calculate About coverage totals:', error);
    }
  }

  function installAboutRepair() {
    const container = document.getElementById('about-container');
    if (container) new MutationObserver(hydrateAboutCounts).observe(container, { childList: true, subtree: true });
    hydrateAboutCounts();
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#about') [0, 150, 700].forEach(delay => window.setTimeout(hydrateAboutCounts, delay));
    });
  }

  function installVersion() {
    const update = () => {
      const element = document.getElementById('sidebar-version-display');
      if (element && element.textContent !== BACKROOM_VERSION) element.textContent = BACKROOM_VERSION;
    };
    update();
    new MutationObserver(update).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function install() {
    installEmbeddedStyles();
    installExtraNavigation();
    installEmbeddedRouting();
    installAboutRepair();
    installVersion();
    window.openBackroomEmbeddedPage = pageKey => showEmbeddedPage(pageKey, true);

    const initialPage = BACKROOM_INITIAL_EMBEDDED_HASH.slice(1);
    if (embeddedPages[initialPage]) window.setTimeout(() => showEmbeddedPage(initialPage, false), 0);
    window.setTimeout(installExtraNavigation, 500);
  }

  window.openHeatmapRecordResults = function openHeatmapRecordResults(payload = {}) {
    const city = clean(payload.city);
    const country = clean(payload.country);
    const mode = key(payload.mode);
    const category = clean(payload.category);
    saveLocation(city, country);
    hideEmbeddedPages();

    if (mode === 'events') {
      window.location.hash = '#calendar';
      window.setTimeout(() => window.openCalendarScreen?.(), 100);
    } else if (mode === 'cities') {
      window.location.hash = '#results';
      applyFilter(category);
    } else {
      window.location.hash = '#venues';
      applyFilter(mode === 'cruising' ? 'Cruising' : category);
    }
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', install) : install();
})();
