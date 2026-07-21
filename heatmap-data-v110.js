(() => {
  'use strict';

  const H = window.BRHeat = {};
  const clean = H.clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const norm = H.norm = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const toNumber = value => {
    const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  };

  const CITY_ALIASES = {
    koln: 'cologne', koeln: 'cologne', munchen: 'munich', wien: 'vienna',
    praha: 'prague', bruxelles: 'brussels', brussel: 'brussels', milano: 'milan',
    roma: 'rome', firenze: 'florence', lisboa: 'lisbon', sevilla: 'seville',
    goteborg: 'gothenburg', kobenhavn: 'copenhagen', 'playa del ingles': 'maspalomas',
    'maspalomas / playa del ingles': 'maspalomas', 'maspalomas playa del ingles': 'maspalomas',
    'san bartolome de tirajana': 'maspalomas'
  };
  const COUNTRY_ALIASES = {
    uk: 'united kingdom', 'great britain': 'united kingdom', england: 'united kingdom',
    scotland: 'united kingdom', 'northern ireland': 'united kingdom', usa: 'united states',
    us: 'united states', 'czech republic': 'czechia', 'the netherlands': 'netherlands'
  };

  const cityKey = value => CITY_ALIASES[norm(value)] || norm(value);
  const countryKey = value => COUNTRY_ALIASES[norm(value)] || norm(value);
  const locationKey = (city, country) => `${cityKey(city)}|${countryKey(country)}`;
  const splitCities = value => (Array.isArray(value) ? value : clean(value).split(/[;,|]+/)).map(clean).filter(Boolean);
  const firstCity = row => splitCities(row?.City)[0] || '';
  const rowCountry = row => clean(row?.Country);
  const coords = row => {
    const lat = toNumber(row?.Latitude ?? row?.Event_Latitude ?? row?.Venue_Latitude);
    const lng = toNumber(row?.Longitude ?? row?.Event_Longitude ?? row?.Venue_Longitude);
    return lat === null || lng === null ? null : { lat, lng };
  };
  const parseDate = value => {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
  };
  const startOfDay = value => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const isLive = row => !['hold','flag','closed','removed','inactive','cancelled'].includes(norm(row?.Status));

  H.state = { venues: [], events: [], byId: new Map(), fallbackByLocation: new Map(), fallbackByCity: new Map() };
  H.escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));

  function eventLocation(event) {
    const venue = H.state.byId.get(clean(event?.Venue_ID)) || null;
    return {
      event,
      venue,
      city: splitCities(event?.City || event?.Event_City || event?.Venue_City || venue?.City)[0] || '',
      country: clean(event?.Country || event?.Event_Country || event?.Venue_Country || venue?.Country),
      location: coords(event) || coords(venue)
    };
  }

  function searchText(row, linkedVenue = null) {
    return norm([row?.Category,row?.Event_Category,row?.Vibe_Tags,row?.Event_Name,row?.Event_Description,row?.Name,linkedVenue?.Category,linkedVenue?.Vibe_Tags].join(' '));
  }

  function categoryMatches(row, linkedVenue, category) {
    const wanted = norm(category);
    if (!wanted || wanted === 'all') return true;
    const text = searchText(row, linkedVenue);
    if (wanted === 'party') return /party|club|dancefloor/.test(text);
    if (wanted === 'fetish') return /fetish|gear|leather|rubber|pup|puppy/.test(text);
    if (wanted === 'cruising') return /cruis/.test(text) || row?.Feature_Cruise_Focused === true || linkedVenue?.Feature_Cruise_Focused === true;
    return text.includes(wanted);
  }

  function isCruisingArea(venue) {
    const category = norm(venue?.Category);
    return category === 'cruising area' || category === 'public cruising area';
  }

  function getDateRange(rangeName) {
    const from = startOfDay(new Date());
    const to = new Date(from);
    if (rangeName === 'today') return [from, to];
    if (rangeName === 'week') to.setDate(to.getDate() + 6);
    else if (rangeName === 'weekend') {
      to.setDate(to.getDate() + ((6 - to.getDay() + 7) % 7));
      const friday = new Date(to);
      friday.setDate(to.getDate() - 1);
      return [friday, to];
    } else if (rangeName === 'month') to.setDate(to.getDate() + 29);
    else to.setFullYear(to.getFullYear() + 10);
    return [from, to];
  }

  function eventOccursInRange(event, from, to) {
    const eventDate = parseDate(event?.Event_Date);
    if (eventDate && eventDate >= from && eventDate <= to) return true;
    const recurrence = norm(event?.Recurrence_Type);
    const until = parseDate(event?.Recurrence_Until);
    if (!recurrence.includes('week') || !eventDate || eventDate > to || (until && until < from)) return false;
    const dayIndex = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].findIndex(day => norm(event?.Recurrence_Day).includes(day));
    if (dayIndex < 0) return false;
    const next = new Date(from);
    next.setDate(next.getDate() + ((dayIndex - next.getDay() + 7) % 7));
    return next <= to && next >= startOfDay(eventDate) && (!until || next <= until);
  }

  function buildFallbackMaps() {
    H.state.fallbackByLocation.clear();
    H.state.fallbackByCity.clear();
    (window.BRHeatCityCoordinates || []).forEach(entry => {
      const point = { lat: Number(entry.lat), lng: Number(entry.lng) };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
      H.state.fallbackByLocation.set(locationKey(entry.city, entry.country), point);
      const key = cityKey(entry.city);
      if (!H.state.fallbackByCity.has(key)) H.state.fallbackByCity.set(key, point);
    });
  }

  function buildObservedCentroids() {
    const centroids = new Map();
    const add = (city, country, point) => {
      if (!city || !point) return;
      const key = locationKey(city, country);
      if (!centroids.has(key)) centroids.set(key, { lat: 0, lng: 0, count: 0 });
      const item = centroids.get(key);
      item.lat += point.lat;
      item.lng += point.lng;
      item.count += 1;
    };
    H.state.venues.filter(isLive).forEach(venue => add(firstCity(venue), rowCountry(venue), coords(venue)));
    H.state.events.filter(isLive).map(eventLocation).forEach(item => add(item.city, item.country, item.location));
    return centroids;
  }

  function resolveCityCenter(city, country, observed) {
    const key = locationKey(city, country);
    const known = observed.get(key);
    if (known?.count) return { lat: known.lat / known.count, lng: known.lng / known.count, source: 'record-centroid' };
    const exact = H.state.fallbackByLocation.get(key);
    if (exact) return { ...exact, source: 'local-city-centre' };
    const loose = H.state.fallbackByCity.get(cityKey(city));
    return loose ? { ...loose, source: 'local-city-centre' } : null;
  }

  function makeRecordPoint(record, name, city, country, exactLocation, kind, observed) {
    const location = exactLocation || resolveCityCenter(city, country, observed);
    if (!location || !city) return null;
    return { name: clean(name) || city, city, country, count: 1, lat: location.lat, lng: location.lng, kind, approximate: !exactLocation, source: exactLocation ? 'record' : location.source, record };
  }

  function aggregate(records, getCity, getCountry, getLocation, observed) {
    const groups = new Map();
    records.forEach(record => {
      const city = clean(getCity(record));
      const country = clean(getCountry(record));
      if (!city) return;
      const key = locationKey(city, country);
      if (!groups.has(key)) groups.set(key, { name: city, city, country, count: 0, lat: 0, lng: 0, located: 0, items: [] });
      const group = groups.get(key);
      group.count += 1;
      group.items.push(record);
      const point = getLocation(record);
      if (point) { group.lat += point.lat; group.lng += point.lng; group.located += 1; }
    });

    return [...groups.values()].map(group => {
      const location = group.located ? { lat: group.lat / group.located, lng: group.lng / group.located, source: 'record-centroid' } : resolveCityCenter(group.city, group.country, observed);
      if (!location) return null;
      return { ...group, lat: location.lat, lng: location.lng, kind: 'city', approximate: !group.located, source: location.source };
    }).filter(Boolean);
  }

  H.build = ({ mode, category, range }) => {
    const observed = buildObservedCentroids();
    let records = [];
    let points = [];
    let cityGroups = [];

    if (mode === 'venues' || mode === 'cruising') {
      records = H.state.venues.filter(isLive).filter(venue => mode !== 'cruising' || isCruisingArea(venue)).filter(venue => categoryMatches(venue, null, category));
      points = records.map(venue => makeRecordPoint(venue, venue?.Name || (mode === 'cruising' ? 'Cruising area' : 'Venue'), firstCity(venue), rowCountry(venue), coords(venue), mode === 'cruising' ? 'cruising' : 'venue', observed)).filter(Boolean);
      cityGroups = aggregate(records, firstCity, rowCountry, coords, observed);
    } else if (mode === 'events') {
      const [from, to] = getDateRange(range);
      records = H.state.events.filter(isLive).map(eventLocation).filter(item => eventOccursInRange(item.event, from, to)).filter(item => categoryMatches(item.event, item.venue, category));
      points = records.map(item => makeRecordPoint(item.event, item.event?.Event_Name || 'Event', item.city, item.country, item.location, 'event', observed)).filter(Boolean);
      cityGroups = aggregate(records, item => item.city, item => item.country, item => item.location, observed);
    } else {
      const venueRows = H.state.venues.filter(isLive).filter(venue => categoryMatches(venue, null, category)).map(venue => ({ city: firstCity(venue), country: rowCountry(venue), location: coords(venue), record: venue }));
      const eventRows = H.state.events.filter(isLive).map(eventLocation).filter(item => categoryMatches(item.event, item.venue, category)).map(item => ({ city: item.city, country: item.country, location: item.location, record: item.event }));
      records = [...venueRows, ...eventRows];
      cityGroups = aggregate(records, item => item.city, item => item.country, item => item.location, observed);
      points = cityGroups;
    }

    return {
      mode, records, points, cityGroups,
      exactCount: points.filter(point => !point.approximate).length,
      fallbackCount: points.filter(point => point.approximate).length
    };
  };

  async function fetchJSON(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`${url.split('?')[0]} returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`${url.split('?')[0]} took too long to load`);
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  H.load = async () => {
    buildFallbackMaps();
    const stamp = Date.now();
    const [venues, events] = await Promise.all([fetchJSON(`listings.json?v=${stamp}`), fetchJSON(`events.json?v=${stamp}`)]);
    H.state.venues = Array.isArray(venues) ? venues : [];
    H.state.events = Array.isArray(events) ? events : [];
    H.state.byId = new Map(H.state.venues.map(venue => [clean(venue?.Venue_ID), venue]).filter(([id]) => id));
  };
})();
