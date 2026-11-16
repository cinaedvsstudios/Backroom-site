/* Backroom — local-only venue follows & in-site event updates (2026-11-16).
   Never registers browser push notifications or uploads follows to a server. */
(() => {
  'use strict';
  if (window.BackroomFollow) return;

  const KEY = 'br_venue_follows_v1';
  const MAX_NOTIFICATIONS = 300;
  const empty = () => ({ follows: {}, notifications: [], lastCheckedAt: null });
  const safeString = value => String(value == null ? '' : value).trim();
  const validId = id => safeString(id).slice(0, 160);
  const safeTime = value => {
    const time = Date.parse(safeString(value));
    return Number.isFinite(time) ? time : null;
  };
  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!stored || typeof stored !== 'object') return empty();
      return {
        follows: stored.follows && typeof stored.follows === 'object' && !Array.isArray(stored.follows) ? stored.follows : {},
        notifications: Array.isArray(stored.notifications) ? stored.notifications.slice(0, MAX_NOTIFICATIONS) : [],
        lastCheckedAt: safeString(stored.lastCheckedAt) || null
      };
    } catch (_) { return empty(); }
  };
  let state = read();
  let manageDraft = null;
  let isChecking = false;
  const store = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (_) { /* Private browsing or disabled storage: actions still work for this session. */ }
  };

  const svgBell = '<svg viewBox="0 0 24 24" aria-hidden="true" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
  const byId = id => document.getElementById(id);
  const venueList = () => typeof venues !== 'undefined' && Array.isArray(venues) ? venues : [];
  const venueName = id => venueList().find(v => safeString(v.Venue_ID) === id)?.Name || id;
  const getFollows = () => Object.keys(state.follows).filter(id => Boolean(state.follows[id]));
  const isFollowing = venueId => Boolean(state.follows[validId(venueId)]);
  const signal = () => {
    document.dispatchEvent(new CustomEvent('backroom:follow-changed'));
    updateBadge();
    syncButtons();
  };

  function toggle(venueId, desired) {
    const id = validId(venueId);
    if (!id) return false;
    const follow = typeof desired === 'boolean' ? desired : !isFollowing(id);
    if (follow) {
      if (!isFollowing(id)) state.follows[id] = new Date().toISOString();
    } else {
      delete state.follows[id];
    }
    store();
    signal();
    if (!byId('br-follow-panel')?.hidden) renderPanel();
    return follow;
  }

  function updateBadge() {
    const badge = byId('br-follow-count');
    const bell = byId('btn-notifications');
    if (!badge || !bell) return;
    const count = state.notifications.filter(n => !n.read).length;
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    bell.setAttribute('aria-label', count ? 'Notifications: ' + count + ' unread' : 'Notifications');
    bell.title = count ? count + ' unread notifications' : 'Notifications';
  }

  function syncButtons(root = document) {
    root.querySelectorAll?.('.br-follow-toggle[data-br-follow-venue]').forEach(button => {
      const id = validId(button.dataset.brFollowVenue);
      const followed = isFollowing(id);
      const icon = button.dataset.brFollowStyle === 'icon';
      button.classList.toggle('is-following', followed);
      button.setAttribute('aria-pressed', String(followed));
      button.disabled = !id;
      button.title = followed ? 'Unfollow ' + venueName(id) : 'Follow ' + venueName(id) + ' for event updates';
      button.setAttribute('aria-label', button.title);
      if (icon) {
        button.innerHTML = svgBell;
      } else {
        button.innerHTML = svgBell + '<span>' + (followed ? 'Following' : 'Follow') + '</span>';
      }
    });
  }

  const el = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const makeButton = (text, action, cls = 'br-follow-panel-button') => {
    const button = el('button', cls, text);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
  };
  const format = timestamp => {
    const time = safeTime(timestamp);
    return time ? new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  };

  function renderPanel() {
    const panel = byId('br-follow-panel');
    if (!panel) return;
    panel.replaceChildren();
    const header = el('div', 'br-follow-panel-header');
    header.append(el('h2', '', manageDraft ? 'MANAGE NOTIFICATIONS' : 'NOTIFICATIONS'));
    header.append(makeButton('×', () => { panel.hidden = true; manageDraft = null; }, 'br-follow-close'));
    panel.append(header);

    if (manageDraft) {
      const note = el('p', 'br-follow-panel-note', 'Follow or unfollow venues below, then save your changes.');
      panel.append(note);
      const list = el('div', 'br-follow-manage-list');
      for (const id of Object.keys(manageDraft)) {
        const row = el('div', 'br-follow-manage-row');
        row.append(el('span', 'br-follow-venue-name', venueName(id)));
        const choice = makeButton(manageDraft[id] ? 'Follow' : 'Unfollow', () => {
          manageDraft[id] = !manageDraft[id];
          choice.textContent = manageDraft[id] ? 'Follow' : 'Unfollow';
          choice.classList.toggle('is-unfollowed', !manageDraft[id]);
        }, 'br-follow-panel-button');
        choice.classList.toggle('is-unfollowed', !manageDraft[id]);
        row.append(choice);
        list.append(row);
      }
      if (!Object.keys(manageDraft).length) list.append(el('p', 'br-follow-panel-note', 'You are not following any venues yet. Use the bell on a venue or event to follow it.'));
      panel.append(list);
      const footer = el('div', 'br-follow-panel-actions');
      footer.append(makeButton('Back', () => { manageDraft = null; renderPanel(); }, 'br-follow-panel-button br-follow-secondary'));
      footer.append(makeButton('Save Changes', () => {
        for (const [id, follow] of Object.entries(manageDraft)) {
          if (!follow) delete state.follows[id];
          else if (!isFollowing(id)) state.follows[id] = new Date().toISOString();
        }
        manageDraft = null;
        store(); signal(); renderPanel();
      }, 'br-follow-panel-button br-follow-primary'));
      panel.append(footer);
      return;
    }

    const toolbar = el('div', 'br-follow-panel-actions');
    toolbar.append(makeButton('Manage Notifications', () => {
      manageDraft = Object.fromEntries(getFollows().map(id => [id, true]));
      renderPanel();
    }));
    toolbar.append(makeButton('Mark All Read', () => {
      state.notifications.forEach(n => { n.read = true; });
      store(); updateBadge(); renderPanel();
    }, 'br-follow-panel-button br-follow-secondary'));
    panel.append(toolbar);
    const notices = el('div', 'br-follow-notices');
    for (const notice of state.notifications) {
      const button = makeButton('', () => {
        notice.read = true;
        store(); updateBadge();
        panel.hidden = true;
        if (['cancelled', 'canceled', 'closed'].includes(notice.status)) {
          window.showToast?.('This event is cancelled or no longer listed.');
        } else if (notice.eventId) window.openBackroomEvent?.(notice.eventId);
      }, 'br-follow-notice' + (notice.read ? ' is-read' : ' is-unread'));
      const headline = el('strong', '', notice.eventName || 'Event updated');
      const info = el('span', '', (notice.venueName || venueName(notice.venueId)) + ' · Updated ' + format(notice.updatedAt));
      button.append(headline, info);
      notices.append(button);
    }
    if (!state.notifications.length) notices.append(el('p', 'br-follow-panel-note', 'No event updates yet. Follow a venue to see its updates when you return to Backroom.'));
    panel.append(notices);
    const clear = makeButton('Clear All Notifications', () => {
      state.notifications = [];
      store(); updateBadge(); renderPanel();
    }, 'br-follow-panel-button br-follow-clear');
    clear.disabled = state.notifications.length === 0;
    panel.append(clear);
    panel.append(el('p', 'br-follow-privacy', 'Saved only in this browser. Updates are checked when Backroom opens.'));
  }

  function makePanel() {
    if (byId('br-follow-panel')) return;
    const panel = el('section', 'br-follow-panel');
    panel.id = 'br-follow-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Backroom notifications');
    document.body.append(panel);
    const button = byId('btn-notifications');
    if (button) {
      button.addEventListener('click', event => {
        event.stopPropagation();
        manageDraft = null;
        panel.hidden = !panel.hidden;
        if (!panel.hidden) renderPanel();
      });
    }
    document.addEventListener('click', event => {
      if (panel.hidden || panel.contains(event.target) || byId('btn-notifications')?.contains(event.target)) return;
      panel.hidden = true;
      manageDraft = null;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { panel.hidden = true; manageDraft = null; }
    });
  }

  async function check() {
    if (isChecking || !getFollows().length) return;
    isChecking = true;
    const startedAt = Date.now();
    try {
      const response = await fetch('events.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Events unavailable');
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('Unexpected events format');
      const previous = safeTime(state.lastCheckedAt) || 0;
      const seen = new Set(state.notifications.map(n => n.key));
      for (const event of items) {
        const id = validId(event?.Venue_ID);
        const eventId = validId(event?.Event_ID);
        if (!id || !eventId || !isFollowing(id)) continue;
        const status = safeString(event.Status).toLowerCase();
        if (['hold', 'flag'].includes(status)) continue;
        const updated = safeTime(event.Last_Updated);
        if (!updated || updated > startedAt) continue;
        const followingSince = safeTime(state.follows[id]) || startedAt;
        if (updated <= Math.max(previous, followingSince)) continue;
        const key = eventId + '|' + new Date(updated).toISOString();
        if (seen.has(key)) continue;
        state.notifications.unshift({
          key, eventId, venueId: id,
          eventName: (['cancelled', 'canceled', 'closed'].includes(status) ? 'Cancelled: ' : '') + (safeString(event.Event_Name) || 'Event updated'),
          venueName: venueName(id) === id ? (safeString(event.Venue_Name || event.Venue) || id) : venueName(id),
          status,
          updatedAt: new Date(updated).toISOString(), read: false
        });
        seen.add(key);
      }
      state.notifications.sort((a, b) => (safeTime(b.updatedAt) || 0) - (safeTime(a.updatedAt) || 0));
      state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
      // Check time is captured BEFORE fetching, so changes published mid-request
      // cannot disappear between this check and the following visit.
      state.lastCheckedAt = new Date(startedAt).toISOString();
      store();
      updateBadge();
      if (byId('br-follow-panel') && !byId('br-follow-panel').hidden) renderPanel();
    } catch (error) {
      console.warn('Backroom follow check postponed:', error);
      // Never advance the checkpoint when offline or when data fails to load.
    } finally { isChecking = false; }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.br-follow-toggle[data-br-follow-venue]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(button.dataset.brFollowVenue);
  }, true);

  function start() {
    makePanel();
    syncButtons();
    updateBadge();
    // Re-use current visits only: no push messages, service workers or background alarms.
    check();
  }
  document.addEventListener('backroom:follow-changed', () => syncButtons());
  window.BackroomFollow = { isFollowing, toggle, syncButtons, check };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
