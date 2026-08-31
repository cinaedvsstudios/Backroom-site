// Backroom event detail routes and modal layer v1.12
(function () {
  'use strict';

  if (window.__backroomEventDetailLoaded) return;
  window.__backroomEventDetailLoaded = true;

  const EVENT_DETAIL_VERSION = 'v1.12';
  const DEFAULT_RETURN_HASH = '#calendar';
  const BACKROOM_ICON_URL = 'https://raw.githubusercontent.com/cinaedvsstudios/Backroom-site/refs/heads/main/backdoorlogo.png';
  let eventReturnHash = DEFAULT_RETURN_HASH;
  let currentEventId = '';
  let originalHandleRouting = null;

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const lower = value => clean(value).toLowerCase();

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function linkifyText(value) {
    const escaped = escapeHTML(value)
      .replace(/!!([\s\S]*?)!!/g, '<strong>$1</strong>')
      .replace(/\|\|([\s\S]*?)\|\|/g, '<strong>$1</strong>');

    return escaped.replace(/(https?:\/\/[^\s<]+)/gi, candidate => {
      const trailingMatch = candidate.match(/[.,;:!?]+$/);
      const trailing = trailingMatch ? trailingMatch[0] : '';
      const url = candidate.slice(0, candidate.length - trailing.length);
      return `<a class="auto-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
    });
  }

  function formatDescription(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (typeof formatAboutText === 'function') return formatAboutText(text);
    return text
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map(paragraph => `<p>${linkifyText(paragraph.replace(/\n/g, '<br>'))}</p>`)
      .join('');
  }

  function getEventsArray() {
    try { return Array.isArray(events) ? events : []; }
    catch (_) { return []; }
  }

  function getVenuesArray() {
    try { return Array.isArray(venues) ? venues : []; }
    catch (_) { return []; }
  }

  function findEvent(eventOrId) {
    if (eventOrId && typeof eventOrId === 'object') return eventOrId;
    const id = clean(eventOrId);
    if (!id) return null;
    return getEventsArray().find(item => clean(item?.Event_ID) === id) || null;
  }

  function findVenueForEvent(event) {
    const id = clean(event?.Venue_ID);
    if (!id) return null;
    return getVenuesArray().find(item => clean(item?.Venue_ID) === id) || null;
  }

  function splitTags(value) {
    return [...new Set(String(value || '')
      .split(',')
      .map(tag => clean(tag))
      .filter(Boolean))];
  }

  function eventTags(event, venue) {
    try {
      if (typeof getEventTags === 'function') return getEventTags(event, venue);
    } catch (_) {}
    return splitTags(event?.Vibe_Tags);
  }

  function venueTags(venue) {
    try {
      if (typeof getVenueTags === 'function') return getVenueTags(venue);
    } catch (_) {}
    return splitTags(venue?.Vibe_Tags);
  }

  function renderPills(tags, extraStyle = '') {
    const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (!list.length) return '';
    try {
      if (typeof renderTagPills === 'function') return renderTagPills(list, extraStyle);
    } catch (_) {}
    return list.map(tag => `<span class="tag-pill" style="${extraStyle}">${escapeHTML(tag)}</span>`).join('');
  }

  function getEventDate(event) {
    try {
      if (typeof getEventDisplayDate === 'function') return getEventDisplayDate(event);
    } catch (_) {}
    return clean(event?.Display_Date || event?.Event_Date || event?.Date);
  }

  function getEventTime(event) {
    const start = clean(event?.Event_Start_Time || event?.Start_Time || event?.Start);
    const end = clean(event?.Event_End_Time || event?.End_Time || event?.End);
    return [start, end].filter(Boolean).join(start && end ? ' – ' : '');
  }

  function getEventMeta(event) {
    try {
      if (typeof getEventDisplayMeta === 'function') return getEventDisplayMeta(event);
    } catch (_) {}
    return [getEventDate(event), getEventTime(event)].filter(Boolean).join(' · ');
  }

  function getEventImage(event, venue) {
    try {
      if (typeof getEventImageSource === 'function') return getEventImageSource(event, venue);
    } catch (_) {}
    const eventImage = clean(event?.Event_Image_URL || event?.Image_URL);
    if (eventImage) return eventImage;
    try {
      if (venue && typeof getVenueImageSource === 'function') return getVenueImageSource(venue);
    } catch (_) {}
    return clean(venue?.Image_URL) || 'placeholder_venue.jpg';
  }

  function getVenueImage(venue) {
    try {
      if (typeof getVenueImageSource === 'function') return getVenueImageSource(venue);
    } catch (_) {}
    return clean(venue?.Image_URL) || 'placeholder_venue.jpg';
  }

  function getFallbackImage(venue) {
    try {
      if (venue && typeof getVenueFallbackImage === 'function') return getVenueFallbackImage(venue);
    } catch (_) {}
    return 'placeholder_venue.jpg';
  }

  function formatLastUpdated(value) {
    try {
      if (typeof formatLastUpdatedDate === 'function') return formatLastUpdatedDate(value);
    } catch (_) {}
    return clean(value);
  }

  function eventStatusClass(event) {
    const status = lower(event?.Status);
    if (/cancel|closed|past/.test(status)) return 'event-detail-status--bad';
    if (/hold|flag/.test(status)) return 'event-detail-status--warn';
    return 'event-detail-status--live';
  }

  function isPublicEvent(event) {
    const status = lower(event?.Status);
    return !['hold', 'flag'].includes(status);
  }

  function infoRow(label, value, extraClass = '') {
    const text = clean(value);
    if (!text) return '';
    return `<div class="event-detail-info-row ${extraClass}"><span>${escapeHTML(label)}</span><strong>${linkifyText(text)}</strong></div>`;
  }

  function buttonLink(label, url, className = 'secondary-btn') {
    const href = clean(url);
    if (!href) return '';
    return `<a class="btn ${className} pill-btn event-detail-link-btn" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function eventShareUrl(event) {
    return `${window.location.origin}${window.location.pathname}#event=${encodeURIComponent(clean(event?.Event_ID))}`;
  }

  function openVenueDirections(venue) {
    if (!venue) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const appleUrl = clean(venue.Apple_Maps_URL);
    const googleUrl = clean(venue.Google_Maps_URL);

    if (isIOS && appleUrl) {
      window.open(appleUrl, '_blank');
      return;
    }
    if (!isIOS && googleUrl) {
      window.open(googleUrl, '_blank');
      return;
    }

    const query = clean(venue.Native_Map_Query || venue.Address || venue.Name);
    if (!query) return;
    const encoded = encodeURIComponent(query);
    window.open(isIOS ? `https://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }

  function ensureEventModal() {
    let modal = document.getElementById('event-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'event-modal';
    modal.className = 'modal hidden backroom-event-modal';
    modal.innerHTML = `
      <div class="modal-content venue-modal-style event-modal-style">
        <div class="modal-header event-modal-header">
          <h2 id="event-modal-title" class="display-font">EVENT</h2>
          <div class="modal-actions-group event-modal-actions">
            <button id="event-modal-save" class="icon-btn tooltip" type="button" title="Save Event">💖</button>
            <button id="event-modal-shortlist" class="icon-btn tooltip" type="button" title="Add Event to Shortlist"><img src="shortlist.png" alt="" aria-hidden="true"></button>
            <button id="event-modal-share" class="icon-btn tooltip" type="button" title="Share Event">📣</button>
            <button id="event-modal-report" class="icon-btn tooltip" type="button" title="Report Event"><img src="report.png" alt="" aria-hidden="true"></button>
          </div>
          <button id="close-event-modal" class="btn-close" type="button">❌</button>
        </div>
        <div class="modal-body body-font">
          <div id="event-modal-dynamic-layout"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('close-event-modal')?.addEventListener('click', closeEventModalToPreviousView);
    return modal;
  }

  function renderVenueSummary(event, venue) {
    if (!venue) {
      return `
        <section class="event-venue-section event-venue-section--missing">
          <h3 class="display-font">WHERE IT'S HAPPENING</h3>
          <div class="event-detail-warning">Venue not listed for this event yet. Use the event description or ticket/source link to verify the location before travelling.</div>
        </section>`;
    }

    const image = getVenueImage(venue);
    const fallback = getFallbackImage(venue);
    const tags = venueTags(venue);
    const opening = [
      clean(venue.Opening_Days),
      [clean(venue.Opening_Open_Time), clean(venue.Opening_Close_Time)].filter(Boolean).join(' – '),
      clean(venue.Opening_Notes)
    ].filter(Boolean).join(' · ');
    const lastUpdated = formatLastUpdated(venue.Last_Updated);

    return `
      <section class="event-venue-section">
        <div class="event-section-heading">
          <h3 class="display-font">WHERE IT'S HAPPENING</h3>
          <button type="button" class="btn primary-btn pill-btn" id="event-open-full-venue">Open Full Venue</button>
        </div>
        <div class="event-venue-summary">
          <div class="event-venue-image-wrap">
            <img class="event-venue-image" src="${escapeHTML(image)}" onerror="this.onerror=null;this.src='${escapeHTML(fallback)}';" alt="${escapeHTML(venue.Name || 'Venue')}">
          </div>
          <div class="event-venue-body">
            <h4 class="display-font">${escapeHTML(venue.Name || 'Venue')}</h4>
            <p class="event-venue-meta">${escapeHTML([venue.Category, venue.City, venue.Country].filter(Boolean).join(' · '))}</p>
            ${infoRow('Address', venue.Address)}
            ${infoRow('Station', venue.Nearest_Station)}
            ${opening ? infoRow('Opening', opening) : ''}
            <div class="event-venue-actions">
              <button type="button" class="btn secondary-btn pill-btn" id="event-venue-directions">🗺️ Directions</button>
              ${buttonLink('Website', venue.Website_URL)}
              ${buttonLink('Instagram', venue.Instagram_URL)}
              ${buttonLink('Facebook', venue.Facebook_URL)}
            </div>
            ${venue.Description ? `<div class="event-venue-description">${formatDescription(venue.Description)}</div>` : ''}
            ${tags.length ? `<div class="feature-chips event-venue-tags">${renderPills(tags, 'font-size:0.72rem; padding:3px 8px;')}</div>` : ''}
            ${lastUpdated ? `<p class="event-detail-updated">⌛ Last updated: ${escapeHTML(lastUpdated)}</p>` : ''}
          </div>
        </div>
      </section>`;
  }

  function renderEventDetail(event, venue) {
    const eventImage = getEventImage(event, venue);
    const fallback = getFallbackImage(venue);
    const tags = eventTags(event, venue);
    const status = clean(event.Status || 'Live');
    const recurrence = clean(event.Recurrence_Label || event.Recurrence_Type || event.Recurrence_Day);
    const location = [venue?.Name || event.Venue_Name || event.Venue, venue?.City || event.City, venue?.Country || event.Country]
      .filter(Boolean)
      .join(' · ');

    const ticketUrl = clean(event.Ticket_URL || event.Tickets_URL || event.RSVP_URL || event.Event_URL);
    const sourceUrls = clean(event.Source_URLs);
    const lastUpdated = formatLastUpdated(event.Last_Updated);

    return `
      <div class="event-detail-layout">
        <section class="event-detail-top">
          <div class="event-detail-image-wrap">
            <img class="event-detail-image" src="${escapeHTML(eventImage)}" onerror="this.onerror=null;this.src='${escapeHTML(fallback)}';" alt="${escapeHTML(event.Event_Name || 'Event')}">
          </div>
          <div class="event-detail-main-card">
            <div class="event-detail-status ${eventStatusClass(event)}">${escapeHTML(status)}</div>
            <h3 class="display-font">${escapeHTML(event.Event_Name || 'Event')}</h3>
            ${location ? `<p class="event-detail-location">${escapeHTML(location)}</p>` : ''}
            <div class="event-detail-info-grid">
              ${infoRow('Date', getEventDate(event))}
              ${infoRow('Time', getEventTime(event))}
              ${infoRow('Venue', venue?.Name || event.Venue_Name || event.Venue)}
              ${infoRow('Dress code', event.Dresscode_Info)}
              ${infoRow('Price', event.Price_Info)}
              ${recurrence ? infoRow('Repeats', recurrence) : ''}
            </div>
            <div class="event-detail-action-row">
              ${buttonLink('🎟️ Tickets / Info', ticketUrl, 'primary-btn')}
              ${buttonLink('Source', sourceUrls)}
            </div>
            ${tags.length ? `<div class="feature-chips event-detail-tags">${renderPills(tags, 'font-size:0.76rem; padding:4px 9px;')}</div>` : ''}
            ${lastUpdated ? `<p class="event-detail-updated">⌛ Last updated: ${escapeHTML(lastUpdated)}</p>` : ''}
          </div>
        </section>
        ${event.Event_Description ? `<section class="event-detail-description"><h3 class="display-font">EVENT INFO</h3>${formatDescription(event.Event_Description)}</section>` : ''}
        ${renderVenueSummary(event, venue)}
      </div>`;
  }

  function updateSaveButton(event) {
    const button = document.getElementById('event-modal-save');
    if (!button) return;
    let saved = false;
    try {
      saved = Array.isArray(userEvents) && userEvents.includes(event.Event_ID);
    } catch (_) {}
    button.className = `icon-btn tooltip fav-btn ${saved ? 'active-star' : ''}`;
    button.title = saved ? 'Remove from My Events' : 'Save Event';
    button.textContent = '💖';
  }

  function updateShortlistButton(event) {
    const button = document.getElementById('event-modal-shortlist');
    if (!button) return;
    let inAny = false;
    try {
      inAny = typeof hasItemInAnyShortlist === 'function' && hasItemInAnyShortlist('event', event.Event_ID);
    } catch (_) {}
    button.className = `icon-btn tooltip fav-btn ${inAny ? 'active-star' : ''}`;
    button.title = inAny ? 'Add Event to another Shortlist' : 'Add Event to Shortlist';
    button.innerHTML = '<img src="shortlist.png" alt="" aria-hidden="true">';
  }

  function bindEventModalActions(event, venue) {
    const saveButton = document.getElementById('event-modal-save');
    if (saveButton) saveButton.onclick = () => {
      if (typeof window.toggleEventFavorite === 'function') {
        window.toggleEventFavorite(event.Event_ID, saveButton, false);
        updateSaveButton(event);
      }
    };

    const shortlistButton = document.getElementById('event-modal-shortlist');
    if (shortlistButton) shortlistButton.onclick = () => {
      window.promptAddEventToShortlist?.(event.Event_ID);
      window.setTimeout(() => updateShortlistButton(event), 250);
    };

    const shareButton = document.getElementById('event-modal-share');
    if (shareButton) shareButton.onclick = () => {
      if (typeof window.shareURL === 'function') window.shareURL(eventShareUrl(event), event.Event_Name || 'Backroom Event');
      else navigator.clipboard?.writeText(eventShareUrl(event));
    };

    const reportButton = document.getElementById('event-modal-report');
    if (reportButton) reportButton.onclick = () => {
      window.flagListing?.(event.Event_ID, event.Event_Name || 'Event', 'Event Report');
    };

    document.getElementById('event-open-full-venue')?.addEventListener('click', () => {
      if (!venue?.Venue_ID) return;
      try { venueReturnHash = `#event=${event.Event_ID}`; } catch (_) {}
      window.location.hash = `#venue=${encodeURIComponent(venue.Venue_ID)}`;
    });

    document.getElementById('event-venue-directions')?.addEventListener('click', () => openVenueDirections(venue));
  }

  function openEventModal(eventOrId, options = {}) {
    const event = findEvent(eventOrId);
    if (!event) {
      window.showToast?.('Event not available');
      return false;
    }
    if (!isPublicEvent(event)) {
      window.showToast?.('Event is not public yet');
      return false;
    }

    const venue = findVenueForEvent(event);
    const modal = ensureEventModal();
    const title = document.getElementById('event-modal-title');
    const body = document.getElementById('event-modal-dynamic-layout');
    if (!body) return false;

    currentEventId = clean(event.Event_ID);
    eventReturnHash = options.returnHash || eventReturnHash || DEFAULT_RETURN_HASH;

    document.querySelectorAll('.modal').forEach(other => {
      if (other.id !== 'event-modal' && other.id !== 'add-to-shortlist-modal') other.classList.add('hidden');
    });

    if (title) title.textContent = event.Event_Name || 'Event';
    body.innerHTML = renderEventDetail(event, venue);
    updateSaveButton(event);
    updateShortlistButton(event);
    bindEventModalActions(event, venue);
    modal.classList.remove('hidden');
    return true;
  }

  function closeEventModalToPreviousView() {
    document.getElementById('event-modal')?.classList.add('hidden');
    const target = eventReturnHash || DEFAULT_RETURN_HASH;
    if (window.location.hash === target) {
      try { handleRouting(); } catch (_) {}
    } else {
      window.location.hash = target;
    }
  }

  function isEventHash(hash = window.location.hash) {
    return String(hash || '').startsWith('#event=');
  }

  function eventIdFromHash(hash = window.location.hash) {
    if (!isEventHash(hash)) return '';
    return decodeURIComponent(String(hash).replace('#event=', '')).trim();
  }

  function getCurrentEventReturnHash() {
    const hash = window.location.hash || DEFAULT_RETURN_HASH;
    if (hash.startsWith('#event=')) return eventReturnHash || DEFAULT_RETURN_HASH;
    if (hash === '#calendar' || hash.startsWith('#calendar?') || hash === '#myevents' || hash.startsWith('#sharedlist?') || hash === '#results' || hash === '#venues') return hash;
    return DEFAULT_RETURN_HASH;
  }

  function openEventFromRoute() {
    const id = eventIdFromHash();
    if (!id) return false;

    const rows = getEventsArray();
    if (!rows.length) {
      window.setTimeout(openEventFromRoute, 250);
      return true;
    }

    const event = findEvent(id);
    if (!event) {
      window.showToast?.('Event not available');
      window.location.hash = DEFAULT_RETURN_HASH;
      return true;
    }

    eventReturnHash = eventReturnHash || DEFAULT_RETURN_HASH;
    return openEventModal(event, { returnHash: eventReturnHash });
  }

  function installLegacyEventQueryRoute() {
    const params = new URLSearchParams(window.location.search || '');
    const eventId = clean(params.get('event'));
    if (!eventId || isEventHash()) return;

    const oldHash = window.location.hash || '';
    eventReturnHash = oldHash && !oldHash.startsWith('#event=') ? oldHash : DEFAULT_RETURN_HASH;
    params.delete('event');
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ''}#event=${encodeURIComponent(eventId)}`;
    history.replaceState(history.state, '', next);
  }

  function patchRouting() {
    try {
      if (typeof handleRouting === 'function' && !handleRouting.__backroomEventDetailWrapped) {
        originalHandleRouting = handleRouting;
        const wrapped = function (...args) {
          if (isEventHash()) {
            if (openEventFromRoute()) return;
          }
          return originalHandleRouting.apply(this, args);
        };
        wrapped.__backroomEventDetailWrapped = true;
        handleRouting = wrapped;
        window.handleRouting = wrapped;
      }
    } catch (error) {
      console.warn('Backroom event routing patch failed:', error);
    }
  }

  function decorateCalendarEventCards() {
    document.querySelectorAll('.calendar-event-card').forEach(card => {
      const idButton = card.querySelector('[data-calendar-save], [data-calendar-shortlist]');
      const eventId = clean(idButton?.dataset?.calendarSave || idButton?.dataset?.calendarShortlist);
      const media = card.querySelector('.calendar-event-media');
      if (!eventId || !media || media.querySelector('[data-backroom-open-event]')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn primary-btn pill-btn calendar-action backroom-open-event-btn';
      button.dataset.backroomOpenEvent = eventId;
      button.textContent = 'Open Event';
      media.insertBefore(button, media.querySelector('.calendar-action') || null);
    });
  }

  function installCalendarOpenButtons() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-backroom-open-event]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const id = clean(button.dataset.backroomOpenEvent);
      if (!id) return;
      window.openBackroomEvent(id, { returnHash: getCurrentEventReturnHash() });
    }, true);

    const observer = new MutationObserver(() => decorateCalendarEventCards());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    decorateCalendarEventCards();
  }

  function installVersionRepair() {
    const patchToast = () => {
      try {
        if (typeof showToast === 'function' && !showToast.__backroomVersionWrapped) {
          const original = showToast;
          const wrapped = function (message, ...rest) {
            const fixed = String(message ?? '')
              .replace(/Backroom\s+v1\.09/g, `Backroom ${EVENT_DETAIL_VERSION}`)
              .replace(/Backroom\s+v1\.10/g, `Backroom ${EVENT_DETAIL_VERSION}`)
              .replace(/Backroom\s+v1\.11/g, `Backroom ${EVENT_DETAIL_VERSION}`);
            return original.call(this, fixed, ...rest);
          };
          wrapped.__backroomVersionWrapped = true;
          showToast = wrapped;
          window.showToast = wrapped;
        }
      } catch (_) {}
    };

    const updateDisplay = () => {
      const element = document.getElementById('sidebar-version-display');
      if (element && element.textContent !== EVENT_DETAIL_VERSION) element.textContent = EVENT_DETAIL_VERSION;
    };

    patchToast();
    updateDisplay();
    new MutationObserver(() => {
      patchToast();
      updateDisplay();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  function installFavicon() {
    const ensureLink = (rel, href) => {
      let link = document.head.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
      link.type = 'image/png';
    };

    ensureLink('icon', BACKROOM_ICON_URL);
    ensureLink('shortcut icon', BACKROOM_ICON_URL);
    ensureLink('apple-touch-icon', BACKROOM_ICON_URL);
  }

  function installEventHashCapture() {
    window.addEventListener('hashchange', event => {
      if (isEventHash()) {
        event.stopImmediatePropagation();
        openEventFromRoute();
      } else {
        document.getElementById('event-modal')?.classList.add('hidden');
      }
    }, true);
  }

  window.openBackroomEvent = function openBackroomEvent(eventId, options = {}) {
    const id = clean(eventId);
    if (!id) return;
    eventReturnHash = options.returnHash || getCurrentEventReturnHash();
    const target = `#event=${encodeURIComponent(id)}`;
    if (window.location.hash !== target) {
      history.pushState({ backroomEvent: id }, '', target);
    }
    openEventFromRoute();
  };

  window.closeBackroomEvent = closeEventModalToPreviousView;
  window.backroomOpenEventModal = openEventModal;

  installLegacyEventQueryRoute();
  patchRouting();
  installEventHashCapture();
  installCalendarOpenButtons();
  installVersionRepair();
  installFavicon();

  document.addEventListener('DOMContentLoaded', () => {
    ensureEventModal();
    decorateCalendarEventCards();
    installFavicon();
    if (isEventHash()) window.setTimeout(openEventFromRoute, 0);
  });
})();
