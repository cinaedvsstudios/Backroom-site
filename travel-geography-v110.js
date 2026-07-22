(() => {
  'use strict';

  const FLIGHT_FIRST_COUNTRIES = new Set([
    'israel', 'iceland', 'malta', 'cyprus', 'taiwan', 'united states', 'canada',
    'south africa', 'australia', 'new zealand'
  ]);

  const norm = value => String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const selectedCountry = inputId => {
    const value = document.getElementById(inputId)?.value || '';
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    return norm(parts.length > 1 ? parts.at(-1) : '');
  };

  let applying = false;

  function setBadge(card, text, className) {
    const badge = card.querySelector('.badge');
    if (!badge) return;
    const wantedClass = `badge ${className}`;
    if (badge.className !== wantedClass) badge.className = wantedClass;
    if (badge.textContent !== text) badge.textContent = text;
  }

  function setText(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function addWarningNote(card) {
    const note = card.querySelector('.route-note');
    if (!note || note.dataset.flightFirstWarning === 'true') return;
    note.dataset.flightFirstWarning = 'true';
    note.textContent = `A practical continuous surface journey is not available from most Backroom origins. ${note.textContent}`;
  }

  function applyGeographyRules() {
    if (applying) return;
    const routes = document.getElementById('routes');
    if (!routes || !routes.querySelector('.route')) return;

    const fromCountry = selectedCountry('from-input');
    const toCountry = selectedCountry('to-input');
    const crossBorder = fromCountry && toCountry && fromCountry !== toCountry;
    const flightFirst = crossBorder && (
      FLIGHT_FIRST_COUNTRIES.has(fromCountry) || FLIGHT_FIRST_COUNTRIES.has(toCountry)
    );
    if (!flightFirst) return;

    const cards = [...routes.querySelectorAll('.route')];
    if (cards.length && cards.every(card => card.dataset.flightFirstApplied === 'true')) return;

    applying = true;
    try {
      let flightCard = null;

      cards.forEach(card => {
        const mode = norm(card.querySelector('.mode strong')?.textContent);
        const subtitle = card.querySelector('.mode small');
        const isFlight = mode.includes('flight');
        const isOverview = mode.includes('overview');
        card.dataset.flightFirstApplied = 'true';

        if (isFlight) {
          flightCard = card;
          card.classList.remove('caution');
          card.classList.add('preferred', 'recommended');
          setText(subtitle, 'Preferred practical option');
          setBadge(card, 'Best practical option', 'good');
          return;
        }

        card.classList.remove('preferred', 'recommended');
        if (!isOverview) {
          card.classList.add('caution');
          setText(subtitle, 'Flight strongly advised');
          setBadge(card, 'Flight strongly advised', 'danger');
          addWarningNote(card);
        }
      });

      if (flightCard && routes.firstElementChild !== flightCard) routes.prepend(flightCard);
    } finally {
      applying = false;
    }
  }

  const routes = document.getElementById('routes');
  if (routes) new MutationObserver(applyGeographyRules).observe(routes, { childList: true, subtree: true });
  document.getElementById('find-options')?.addEventListener('click', () => setTimeout(applyGeographyRules, 0));
  document.getElementById('sort')?.addEventListener('change', () => setTimeout(applyGeographyRules, 0));
})();
