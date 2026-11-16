/* Backroom — restore the previous position when returning from a detail view. */
(() => {
  'use strict';
  if (window.__backroomListScrollInstalled) return;
  window.__backroomListScrollInstalled = true;

  const KEY = 'br_list_scroll_v1';
  const listRoute = hash => hash === '#venues' || hash === '#results' || /^#results\?/.test(hash || '') ? hash : '';
  const detailRoute = hash => /^#(venue|event)=/.test(hash || '');
  let previousHash = window.location.hash;
  let lastListRoute = listRoute(previousHash);
  let pendingReturnRoute = '';
  let saved = {};

  try {
    const restored = JSON.parse(sessionStorage.getItem(KEY) || '{}');
    if (restored && typeof restored === 'object') saved = restored;
  } catch (_) {}

  const remember = (hash = window.location.hash) => {
    const route = listRoute(hash);
    if (!route) return;
    lastListRoute = route;
    saved[route] = window.scrollY || window.pageYOffset || 0;
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {}
  };

  window.BackroomRememberListScroll = () => {
    const route = listRoute(window.location.hash);
    if (route) { remember(route); pendingReturnRoute = route; }
  };

  window.addEventListener('scroll', () => {
    if (listRoute(window.location.hash)) remember();
  }, { passive: true });

  document.addEventListener('click', event => {
    // Capture the offset before opening a card, not after its content is replaced.
    const card = event.target.closest?.('#results-container .card');
    if (card && listRoute(window.location.hash)) remember();
  }, true);

  function restore(route) {
    const position = Number(saved[route]);
    if (!Number.isFinite(position) || position < 0) return;
    const apply = () => {
      if (window.location.hash !== route) return;
      window.scrollTo({ top: position, left: 0, behavior: 'instant' });
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
    setTimeout(apply, 100);
  }

  window.addEventListener('hashchange', () => {
    const next = window.location.hash;
    const route = listRoute(next);
    if (detailRoute(next) && listRoute(previousHash)) {
      lastListRoute = previousHash;
      if (!Number.isFinite(saved[previousHash])) remember(previousHash);
    } else if (route && (detailRoute(previousHash) || pendingReturnRoute === route) && lastListRoute === route) {
      restore(route);
      pendingReturnRoute = '';
    }
    previousHash = next;
  });
})();
