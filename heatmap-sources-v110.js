(() => {
  'use strict';

  const H = window.BRHeat;
  if (!H?.load || !H?.state) return;

  const baseLoad = H.load.bind(H);
  const clean = H.clean || (value => String(value ?? '').trim());

  const VENUE_ZONE_FILES = [
    'scraping/listings_zone_0_germany.json',
    'scraping/listings_zone_1_france_benelux_netherlands.json',
    'scraping/listings_zone_2_uk_ireland.json',
    'scraping/listings_zone_3_iberia_portugal_islands.json',
    'scraping/listings_zone_4_italy_alps_mediterranean_central_europe.json',
    'scraping/listings_zone_5_poland_nordics_baltics.json',
    'scraping/listings_zone_6_other_unassigned.json',
    'scraping/listings_zone_8_cruising_areas.json'
  ];

  const EVENT_ZONE_FILES = [
    'scraping/events_zone_0_germany.json',
    'scraping/events_zone_1_france_benelux_netherlands.json',
    'scraping/events_zone_1_france_benelux_netherlands_corrected.json',
    'scraping/events_zone_2_uk_ireland.json',
    'scraping/events_zone_3_iberia_portugal_islands.json',
    'scraping/events_zone_4_italy_alps_mediterranean_central_europe.json',
    'scraping/events_zone_5_poland_nordics_baltics.json',
    'scraping/events_zone_6_other_unassigned.json'
  ];

  function isBlank(value) {
    return value === null || value === undefined || (typeof value === 'string' && !value.trim());
  }

  function anonymousKey(row, type) {
    if (type === 'venue') {
      return ['venue', row?.Name, row?.City, row?.Country, row?.Address, row?.Postcode]
        .map(clean).join('|').toLowerCase();
    }
    return ['event', row?.Event_Name, row?.Event_Date, row?.Venue_ID, row?.City, row?.Country]
      .map(clean).join('|').toLowerCase();
  }

  function mergeCollections(collections, idField, type) {
    const records = new Map();
    let anonymousIndex = 0;

    collections.forEach(({ rows, exact = false }) => {
      (Array.isArray(rows) ? rows : []).forEach(row => {
        if (!row || typeof row !== 'object') return;
        const id = clean(row[idField]);
        const key = id ? `id:${id}` : `anon:${anonymousKey(row, type) || anonymousIndex++}`;
        const current = records.get(key);

        if (!current) {
          records.set(key, { ...row });
          return;
        }

        if (exact) {
          records.set(key, { ...current, ...row });
          return;
        }

        const merged = { ...current };
        Object.entries(row).forEach(([field, value]) => {
          if (!isBlank(value) || !(field in merged)) merged[field] = value;
        });
        records.set(key, merged);
      });
    });

    return [...records.values()];
  }

  function readDraft(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`Could not read ${storageKey}.`, error);
      return [];
    }
  }

  async function fetchOptional(path, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const joiner = path.includes('?') ? '&' : '?';
      const response = await fetch(`${path}${joiner}v=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) return { path, rows: [], loaded: false, status: response.status };
      const rows = await response.json();
      return { path, rows: Array.isArray(rows) ? rows : [], loaded: Array.isArray(rows), status: response.status };
    } catch (error) {
      if (error?.name !== 'AbortError') console.info(`Optional heat-map source skipped: ${path}`, error);
      return { path, rows: [], loaded: false, status: error?.name === 'AbortError' ? 'timeout' : 'error' };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  H.load = async () => {
    // The original loader initializes the coordinate fallbacks and loads the two
    // root files. Zone files and local admin drafts are then merged over them.
    await baseLoad();

    const rootVenues = Array.isArray(H.state.venues) ? H.state.venues : [];
    const rootEvents = Array.isArray(H.state.events) ? H.state.events : [];

    const [venueResults, eventResults] = await Promise.all([
      Promise.all(VENUE_ZONE_FILES.map(path => fetchOptional(path))),
      Promise.all(EVENT_ZONE_FILES.map(path => fetchOptional(path)))
    ]);

    const venueDraft = readDraft('br_admin_venues_draft');
    const eventDraft = readDraft('br_admin_events_draft');

    H.state.venues = mergeCollections([
      ...venueResults.filter(result => result.loaded).map(result => ({ rows: result.rows })),
      { rows: rootVenues },
      { rows: venueDraft, exact: true }
    ], 'Venue_ID', 'venue');

    H.state.events = mergeCollections([
      ...eventResults.filter(result => result.loaded).map(result => ({ rows: result.rows })),
      { rows: rootEvents },
      { rows: eventDraft, exact: true }
    ], 'Event_ID', 'event');

    H.state.byId = new Map(
      H.state.venues.map(venue => [clean(venue?.Venue_ID), venue]).filter(([id]) => id)
    );

    const loadedVenueZones = venueResults.filter(result => result.loaded);
    const loadedEventZones = eventResults.filter(result => result.loaded);
    H.state.sourceSummary = {
      venues: H.state.venues.length,
      events: H.state.events.length,
      publishedFiles: 2 + loadedVenueZones.length + loadedEventZones.length,
      venueZoneFiles: loadedVenueZones.map(result => result.path),
      eventZoneFiles: loadedEventZones.map(result => result.path),
      localVenueDraft: venueDraft.length,
      localEventDraft: eventDraft.length,
      localDraftCollections: Number(venueDraft.length > 0) + Number(eventDraft.length > 0)
    };

    if (!H.state.venues.length && !H.state.events.length) {
      throw new Error('No venue or event records were found in any Backroom data source.');
    }
  };
})();
