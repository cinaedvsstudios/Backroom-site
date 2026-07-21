(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const norm = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const num = value => {
    const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const CITY_ALIASES = {
    koln: 'cologne', koeln: 'cologne', munchen: 'munich', wien: 'vienna',
    praha: 'prague', bruxelles: 'brussels', brussel: 'brussels', milano: 'milan',
    roma: 'rome', firenze: 'florence', lisboa: 'lisbon', sevilla: 'seville',
    goteborg: 'gothenburg', kobenhavn: 'copenhagen',
    'playa del ingles': 'maspalomas', 'maspalomas / playa del ingles': 'maspalomas',
    'maspalomas playa del ingles': 'maspalomas', 'san bartolome de tirajana': 'maspalomas'
  };
  const COUNTRY_ALIASES = {
    'Czech Republic': 'Czechia', UK: 'United Kingdom', England: 'United Kingdom',
    Scotland: 'United Kingdom', 'Northern Ireland': 'United Kingdom', USA: 'United States',
    'The Netherlands': 'Netherlands'
  };
  const FLIGHT_ACCESS_CITIES = new Set([
    'maspalomas', 'las palmas', 'funchal', 'reykjavik', 'valletta', 'st julians',
    'sliema', 'nicosia', 'limassol', 'larnaca', 'paphos'
  ]);
  const REMOTE_COUNTRIES = new Set([
    'iceland', 'malta', 'cyprus', 'taiwan', 'united states', 'canada',
    'south africa', 'australia', 'new zealand'
  ]);

  const S = {
    venues: [], events: [], providers: null, byId: new Map(), cities: [], byCity: new Map(),
    selected: { from: null, to: null }, routes: [], curated: false, distance: null,
    fallbackByLocation: new Map(), fallbackByCity: new Map()
  };

  const alias = value => S.providers?.aliases?.[clean(value)] || COUNTRY_ALIASES[clean(value)] || clean(value);
  const cityNorm = value => CITY_ALIASES[norm(value)] || norm(value);
  const countryNorm = value => norm(alias(value));
  const key = (city, country) => `${cityNorm(city)}|${countryNorm(country)}`;
  const tokens = value => (Array.isArray(value) ? value : clean(value).split(/[;|]+/)).map(clean).filter(Boolean);
  const coords = row => {
    const lat = num(row?.Latitude ?? row?.Event_Latitude ?? row?.Venue_Latitude);
    const lng = num(row?.Longitude ?? row?.Event_Longitude ?? row?.Venue_Longitude);
    return lat === null || lng === null ? null : { lat, lng };
  };
  const live = row => !['hold','flag','closed','removed','inactive','cancelled'].includes(norm(row?.Status));
  const date = value => {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
  };
  const day = value => {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  function buildFallbackCoordinates() {
    S.fallbackByLocation.clear();
    S.fallbackByCity.clear();
    (window.BRHeatCityCoordinates || []).forEach(entry => {
      const point = { lat: Number(entry.lat), lng: Number(entry.lng) };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
      S.fallbackByLocation.set(key(entry.city, entry.country), point);
      const cityKey = cityNorm(entry.city);
      if (!S.fallbackByCity.has(cityKey)) S.fallbackByCity.set(cityKey, point);
    });
  }

  function fallbackCoords(city, country) {
    return S.fallbackByLocation.get(key(city, country)) || S.fallbackByCity.get(cityNorm(city)) || null;
  }

  function eventLoc(event) {
    const venue = S.byId.get(clean(event?.Venue_ID));
    return {
      city: tokens(event?.City || event?.Event_City || event?.Venue_City || venue?.City)[0] || '',
      country: alias(event?.Country || event?.Event_Country || event?.Venue_Country || venue?.Country),
      xy: coords(event) || coords(venue)
    };
  }

  function buildCities() {
    const map = new Map();
    const add = (city, country, xy, type) => {
      city = clean(city);
      country = alias(country);
      if (!city) return;
      const cityKey = key(city, country);
      if (!map.has(cityKey)) {
        map.set(cityKey, { key: cityKey, city, country, venueCount: 0, eventCount: 0, latSum: 0, lngSum: 0, n: 0 });
      }
      const item = map.get(cityKey);
      item[`${type}Count`] += 1;
      if (xy) {
        item.latSum += xy.lat;
        item.lngSum += xy.lng;
        item.n += 1;
      }
    };

    S.venues.filter(live).forEach(venue => {
      tokens(venue?.City).forEach((city, index) => add(city, venue?.Country, index ? null : coords(venue), 'venue'));
    });
    S.events.filter(live).forEach(event => {
      const location = eventLoc(event);
      add(location.city, location.country, location.xy, 'event');
    });

    S.cities = [...map.values()].map(item => {
      const fallback = fallbackCoords(item.city, item.country);
      const lat = item.n ? item.latSum / item.n : fallback?.lat ?? null;
      const lng = item.n ? item.lngSum / item.n : fallback?.lng ?? null;
      return {
        ...item,
        label: item.country ? `${item.city}, ${item.country}` : item.city,
        search: norm(`${item.city} ${item.country}`),
        lat,
        lng,
        total: item.venueCount + item.eventCount,
        approximateCoordinate: !item.n && !!fallback
      };
    }).sort((a, b) => a.city.localeCompare(b.city) || a.country.localeCompare(b.country));

    S.byCity = new Map(S.cities.map(city => [city.key, city]));
  }

  const config = country => S.providers.countries[alias(country)] || {
    hubs: [], rail: [], coach: [], ferry: [], air: [], notes: 'No dedicated provider entry has been added yet.'
  };

  function providerMap() {
    const map = new Map();
    const add = provider => provider?.name && !map.has(norm(provider.name)) && map.set(norm(provider.name), provider);
    Object.values(S.providers.globals).flat().forEach(add);
    Object.values(S.providers.countries).forEach(country => {
      ['rail','coach','ferry','air'].forEach(mode => (country[mode] || []).forEach(add));
    });
    return map;
  }

  const getProvider = name => providerMap().get(norm(name)) || {
    name,
    url: `https://www.google.com/search?q=${encodeURIComponent(`${name} official booking`)}`,
    label: 'Search official provider'
  };

  const uniq = list => {
    const map = new Map();
    list.filter(Boolean).forEach(item => {
      const provider = typeof item === 'string' ? getProvider(item) : item;
      if (provider?.name && !map.has(norm(provider.name))) map.set(norm(provider.name), provider);
    });
    return [...map.values()];
  };

  function km(a, b) {
    if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
    const radians = value => value * Math.PI / 180;
    const dLat = radians(b.lat - a.lat);
    const dLng = radians(b.lng - a.lng);
    const haversine = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  }

  const routeKey = (a, b) => `${norm(a.city)}|${norm(b.city)}`;

  function curated(a, b) {
    const direct = S.providers.majorRoutes[routeKey(a, b)];
    if (direct) return direct.map(route => ({ ...route, curated: true }));
    const reverse = S.providers.majorRoutes[routeKey(b, a)];
    return reverse ? reverse.map(route => ({ ...route, path: [...route.path].reverse(), curated: true })) : null;
  }

  function path(a, b, mode) {
    const fromConfig = config(a.country);
    const toConfig = config(b.country);
    const result = [a.city];
    const add = city => city && norm(result.at(-1)) !== norm(city) && norm(city) !== norm(b.city) && result.push(city);

    if (countryNorm(a.country) !== countryNorm(b.country)) {
      const fromHub = fromConfig.hubs.find(city => norm(city) !== norm(a.city));
      const toHub = toConfig.hubs.find(city => norm(city) !== norm(b.city));
      if (mode === 'rail') {
        if (a.total < 8) add(fromHub);
        if (b.total < 8) add(toHub);
      } else {
        if (a.total < 4) add(fromHub);
        if (b.total < 4) add(toHub);
      }
    } else if (a.total < 3 || b.total < 3) {
      add(fromConfig.hubs.find(city => ![norm(a.city), norm(b.city)].includes(norm(city))));
    }

    result.push(b.city);
    return [...new Set(result)];
  }

  function estimate(mode, distance, changes) {
    if (!distance) return 'Check provider';
    let hours = mode === 'Rail' ? distance / 115 + .75
      : mode === 'Coach' ? distance / 75 + 1
      : mode === 'Flight' ? distance / 700 + 3.3
      : distance / 42 + 1.5;
    hours += changes * .75;
    const low = Math.max(1, Math.floor(hours));
    const high = Math.max(low + 1, Math.ceil(hours + Math.max(1, hours * .15)));
    return `Approx. ${low}–${high} h`;
  }

  function generic(a, b) {
    const fromConfig = config(a.country);
    const toConfig = config(b.country);
    const globals = S.providers.globals;
    const distance = km(a, b);
    const sameCountry = countryNorm(a.country) === countryNorm(b.country);
    const routes = [];
    const make = (mode, icon, routePath, changes, providers, note, recommended = false) => routes.push({
      mode, icon, path: routePath, changes, direct: 'check', estimate: estimate(mode, distance, changes),
      providers: uniq(providers).map(provider => provider.name), note, curated: false, recommended
    });

    const rail = uniq([...(fromConfig.rail || []), ...(sameCountry ? [] : toConfig.rail || []), ...(globals.rail || [])]);
    if ((fromConfig.rail.length || toConfig.rail.length) && ![a.country, b.country].some(country => ['Malta','Iceland','Cyprus'].includes(country))) {
      const routePath = path(a, b, 'rail');
      make('Rail', 'train', routePath, Math.max(0, routePath.length - 2), rail,
        'Check direct trains first. For smaller cities, compare the national operators and the suggested interchange hubs.',
        distance ? distance <= 900 : true);
    }

    const coach = uniq([...(fromConfig.coach || []), ...(sameCountry ? [] : toConfig.coach || []), ...(globals.coach || [])]);
    if (coach.length) {
      const routePath = path(a, b, 'coach');
      make('Coach', 'bus', routePath, Math.max(0, routePath.length - 2), coach,
        'Search direct coaches first. Smaller destinations may need a change at the nearest regional hub.',
        !routes.length || (distance && distance < 550));
    }

    if ((fromConfig.ferry.length || toConfig.ferry.length) && !sameCountry) {
      routes.push({
        mode: 'Ferry + surface', icon: 'ferry', path: [a.city, 'relevant ferry port', b.city],
        changes: 2, direct: false, estimate: 'Check sailing and connections',
        providers: uniq([...(fromConfig.ferry || []), ...(toConfig.ferry || []), ...(globals.ferry || [])]).map(provider => provider.name),
        note: 'Ferry availability is route- and season-specific. Confirm the sailing before arranging surface connections.',
        curated: false, recommended: false
      });
    }

    if (!sameCountry || !distance || distance > 300 || [a.country, b.country].some(country => [
      'Malta','Iceland','Cyprus','Taiwan','United States','Canada','South Africa','Australia','New Zealand'
    ].includes(country))) {
      make('Flight', 'flight', [`${a.city} area airport`, `${b.city} area airport`], 0,
        [...(fromConfig.air || []), ...(sameCountry ? [] : toConfig.air || []), ...(globals.flight || [])],
        'Search the whole metropolitan area where possible and compare airport transfers.', distance ? distance > 1000 : false);
    }

    routes.push({
      mode: 'Route overview', icon: 'overview', path: [a.city, b.city], changes: 0, direct: 'check',
      estimate: 'Compare all modes', providers: (globals.overview || []).map(provider => provider.name),
      note: 'Use this as a broad cross-check, then book with the official operator where possible.',
      curated: false, recommended: false
    });

    if (!routes.some(route => route.recommended) && routes[0]) routes[0].recommended = true;
    return routes;
  }

  function journeyRule(a, b, distance) {
    const fromCity = cityNorm(a.city);
    const toCity = cityNorm(b.city);
    const differentCountries = countryNorm(a.country) !== countryNorm(b.country);
    const specialAccess = FLIGHT_ACCESS_CITIES.has(fromCity) || FLIGHT_ACCESS_CITIES.has(toCity);
    const remoteCountry = differentCountries && (REMOTE_COUNTRIES.has(countryNorm(a.country)) || REMOTE_COUNTRIES.has(countryNorm(b.country)));
    const flightPriority = !!distance && (distance > 1800 || specialAccess || (remoteCountry && distance > 700));
    return { distance, flightPriority, longSurface: !!distance && distance > 900 };
  }

  function applyPracticality(routes, a, b, distance) {
    const rule = journeyRule(a, b, distance);
    const classified = routes.map(route => {
      const mode = norm(route.mode);
      const isFlight = mode.includes('flight');
      const isOverview = mode.includes('overview');
      const isRailOrCoach = /rail|coach|bus/.test(mode);
      let practicality = 'normal';
      let practicalityLabel = '';
      let practicalityNote = '';

      if (!isOverview && !isFlight && rule.flightPriority) {
        practicality = 'avoid';
        practicalityLabel = 'Flight strongly advised';
        practicalityNote = 'This surface option is technically searchable, but the distance or geography makes it impractical for most travellers.';
      } else if (!isOverview && isRailOrCoach && rule.longSurface) {
        practicality = 'long';
        practicalityLabel = 'Very long surface trip';
        practicalityNote = 'This journey is more than 900 km in a straight line, so rail or coach is flagged as a long-distance option.';
      } else if (isFlight && (rule.flightPriority || rule.longSurface)) {
        practicality = 'preferred';
        practicalityLabel = rule.flightPriority ? 'Best practical option' : 'Fastest practical option';
      }

      return { ...route, practicality, practicalityLabel, practicalityNote };
    });

    if (rule.flightPriority || rule.longSurface) {
      classified.forEach(route => { route.recommended = false; });
      const flight = classified.find(route => route.practicality === 'preferred');
      const fallback = classified.find(route => route.practicality === 'normal' && !norm(route.mode).includes('overview'));
      if (flight || fallback) (flight || fallback).recommended = true;
    }

    return classified;
  }

  function options(a, b) {
    const curatedRoutes = curated(a, b);
    S.curated = !!curatedRoutes;
    const distance = km(a, b);
    S.distance = distance;
    return applyPracticality(curatedRoutes || generic(a, b), a, b, distance).map((route, index) => ({
      ...route,
      recommended: route.recommended ?? index === 0,
      changesValue: typeof route.changes === 'number' ? route.changes : Number.parseInt(route.changes, 10) || 9
    }));
  }

  function eventCount(city, value) {
    const from = day(value);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return S.events.filter(live).filter(event => {
      const location = eventLoc(event);
      const eventDate = date(event?.Event_Date);
      return key(location.city, location.country) === city.key && eventDate && eventDate >= from && eventDate <= to;
    }).length;
  }

  const links = names => uniq(names.map(getProvider)).map(provider =>
    `<a href="${esc(provider.url)}" target="_blank" rel="noopener">${esc(provider.name)} ↗</a>`
  ).join('');

  const icon = value => value === 'train'
    ? `<img src="train.webp" alt="" onerror="this.replaceWith(document.createTextNode('🚄'))">`
    : ({ bus:'🚌', flight:'✈️', ferry:'⛴️', overview:'🧭' }[value] || '🧭');

  function badge(route) {
    if (route.practicality === 'avoid' || route.practicality === 'long') {
      return `<span class="badge danger">${esc(route.practicalityLabel)}</span>`;
    }
    if (route.practicality === 'preferred') {
      return `<span class="badge good">${esc(route.practicalityLabel)}</span>`;
    }
    if (route.direct === true) return '<span class="badge">Known direct option</span>';
    if (route.direct === false) return '<span class="badge secondary">Connection required</span>';
    return '<span class="badge secondary">Check direct service</span>';
  }

  function renderRoutes() {
    const order = { Rail:1, Coach:2, 'Ferry + surface':3, Flight:4, 'Route overview':5 };
    const sort = $('sort').value;
    const routes = [...S.routes];
    if (sort === 'mode') routes.sort((a, b) => (order[a.mode] || 9) - (order[b.mode] || 9));
    if (sort === 'changes') routes.sort((a, b) => a.changesValue - b.changesValue);
    if (sort === 'recommended') routes.sort((a, b) => +!!b.recommended - +!!a.recommended);

    $('routes').innerHTML = routes.map(route => {
      const caution = ['avoid','long'].includes(route.practicality);
      const preferred = route.practicality === 'preferred';
      const classes = ['route', route.recommended ? 'recommended' : '', caution ? 'caution' : '', preferred ? 'preferred' : ''].filter(Boolean).join(' ');
      const subtitle = caution ? route.practicalityLabel : (route.curated ? 'Curated main-city guide' : 'Provider-based suggestion');
      const note = [route.practicalityNote, route.note].filter(Boolean).join(' ');
      return `<article class="${classes}"><div class="route-top"><div class="mode"><div class="mode-pic">${icon(route.icon)}</div><div><strong>${esc(route.mode)}</strong><small>${esc(subtitle)}</small></div></div><div class="path"><strong>${route.path.map(esc).join(' → ')}</strong><small>${esc(route.changes)} suggested change${String(route.changes) === '1' ? '' : 's'}</small></div><div class="estimate"><strong>${esc(route.estimate)}</strong>${badge(route)}</div></div><div class="route-bottom"><div class="providers">${links(route.providers || [])}</div><div class="route-note">${esc(note)}</div></div></article>`;
    }).join('') || '<div class="empty">No provider guidance is available yet.</div>';
  }

  function renderDirectory(a, b) {
    const groups = [];
    const seen = new Set();
    [a, b].forEach(city => {
      const country = config(city.country);
      [['Rail',country.rail],['Coach / bus',country.coach],['Ferry',country.ferry],['Air',country.air]].forEach(([title, items]) => {
        const groupKey = `${city.country}|${title}`;
        if (items.length && !seen.has(groupKey)) {
          seen.add(groupKey);
          groups.push({ country: city.country, title, items });
        }
      });
    });
    groups.push({
      country: 'General comparison', title: 'Cross-border search',
      items: uniq([...S.providers.globals.rail, ...S.providers.globals.coach, ...S.providers.globals.flight, ...S.providers.globals.overview])
    });
    $('provider-directory-intro').textContent = `Official and regional sources relevant to ${a.country || a.city} and ${b.country || b.city}. Local operators appear before comparison sites.`;
    $('provider-columns').innerHTML = groups.map(group => `<section class="provider-group"><h4>${esc(group.country)} · ${esc(group.title)}</h4>${uniq(group.items).map(provider => `<a class="provider-link" href="${esc(provider.url)}" target="_blank" rel="noopener"><strong>${esc(provider.name)}</strong><small>${esc(provider.label || 'Official provider')}</small></a>`).join('')}</section>`).join('');
  }

  function choose(which, city) {
    S.selected[which] = city;
    const input = $(`${which}-input`);
    input.value = city.label;
    input.dataset.cityKey = city.key;
    input.classList.remove('invalid');
    $(`${which}-error`).textContent = '';
    close(which);
  }

  function clear(which) {
    S.selected[which] = null;
    delete $(`${which}-input`).dataset.cityKey;
  }

  function suggestions(which, query = '') {
    query = norm(query);
    const list = $(`${which}-list`);
    const items = S.cities.filter(city => !query || city.search.includes(query) || norm(city.city).startsWith(query))
      .sort((a, b) => (norm(a.city).startsWith(query) ? 0 : 1) - (norm(b.city).startsWith(query) ? 0 : 1) || b.total - a.total || a.city.localeCompare(b.city))
      .slice(0, 15);
    list.innerHTML = items.length
      ? items.map((city, index) => `<button type="button" class="combo-option ${index ? '' : 'active'}" data-key="${esc(city.key)}"><span><strong>${esc(city.city)}</strong><small>${esc(city.country || 'Country not recorded')}</small></span><em>${city.total} records</em></button>`).join('')
      : '<div class="combo-empty">No matching Backroom city.</div>';
    list.querySelectorAll('.combo-option').forEach(button => {
      button.onmousedown = event => event.preventDefault();
      button.onclick = () => choose(which, S.byCity.get(button.dataset.key));
    });
  }

  function open(which, all = false) {
    suggestions(which, all ? '' : $(`${which}-input`).value);
    $(`${which}-list`).classList.remove('hidden');
    $(`${which}-input`).setAttribute('aria-expanded', 'true');
  }

  function close(which) {
    $(`${which}-list`).classList.add('hidden');
    $(`${which}-input`).setAttribute('aria-expanded', 'false');
  }

  function validate(which, show = true) {
    const input = $(`${which}-input`);
    const selected = S.selected[which];
    if (selected && input.dataset.cityKey === selected.key && norm(input.value) === norm(selected.label)) return selected;
    const query = norm(input.value);
    const exact = S.cities.find(city => norm(city.label) === query) || (() => {
      const matching = S.cities.filter(city => norm(city.city) === query);
      return matching.length === 1 ? matching[0] : null;
    })();
    if (exact) {
      choose(which, exact);
      return exact;
    }
    clear(which);
    if (show) {
      input.classList.add('invalid');
      $(`${which}-error`).textContent = 'Choose a city from the Backroom list.';
    }
    return null;
  }

  function bindCombo(which) {
    const input = $(`${which}-input`);
    const toggle = document.querySelector(`#${which}-combo .combo-toggle`);
    input.onfocus = () => open(which);
    input.oninput = () => {
      clear(which);
      input.classList.remove('invalid');
      $(`${which}-error`).textContent = '';
      open(which);
    };
    input.onkeydown = event => {
      const list = $(`${which}-list`);
      const items = [...list.querySelectorAll('.combo-option')];
      const active = items.findIndex(item => item.classList.contains('active'));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (list.classList.contains('hidden')) open(which);
        else {
          const next = Math.max(0, Math.min(items.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
          items.forEach(item => item.classList.remove('active'));
          items[next]?.classList.add('active');
          items[next]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const activeItem = list.querySelector('.combo-option.active');
        activeItem ? choose(which, S.byCity.get(activeItem.dataset.key)) : validate(which);
      } else if (event.key === 'Escape') close(which);
    };
    input.onblur = () => window.setTimeout(() => {
      validate(which, !!input.value);
      close(which);
    }, 120);
    toggle.onclick = () => {
      input.focus();
      open(which, true);
    };
  }

  function openSite(kind, city) {
    try {
      if (parent !== window && typeof parent.openHeatmapRecordResults === 'function') {
        parent.openHeatmapRecordResults({ city: city.city, country: city.country, mode: kind === 'events' ? 'events' : 'venues', category: 'all' });
        return;
      }
    } catch (_) {}
    top.location.href = kind === 'events' ? './#calendar' : './#venues';
  }

  function search() {
    const from = validate('from');
    const to = validate('to');
    const travelDate = $('travel-date').value;
    if (!from || !to) return;
    if (from.key === to.key) {
      $('to-input').classList.add('invalid');
      $('to-error').textContent = 'Choose a different destination.';
      return;
    }
    if (!travelDate) {
      $('open-date-picker').click();
      return;
    }

    S.routes = options(from, to);
    const providerCount = uniq(S.routes.flatMap(route => (route.providers || []).map(getProvider))).length;
    const distance = S.distance;
    const destinationEvents = eventCount(to, travelDate);
    $('from-name').textContent = from.city;
    $('to-name').textContent = to.city;
    $('journey-meta').textContent = [
      new Date(`${travelDate}T12:00:00`).toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
      distance ? `approximately ${distance.toLocaleString()} km apart` : '',
      `${from.country || 'country unknown'} to ${to.country || 'country unknown'}`
    ].filter(Boolean).join(' · ');
    $('mode-count').textContent = new Set(S.routes.map(route => route.mode)).size;
    $('provider-count').textContent = providerCount;
    $('route-status').textContent = S.curated ? 'CURATED' : 'GUIDE';
    $('destination-venues').textContent = to.venueCount;
    $('destination-events').textContent = destinationEvents;
    $('destination-note').textContent = `${to.city} has ${to.venueCount} venue listing${to.venueCount === 1 ? '' : 's'} and ${destinationEvents} dated event${destinationEvents === 1 ? '' : 's'} in the selected seven-day period.`;
    $('open-destination-venues').onclick = () => openSite('venues', to);
    $('open-destination-events').onclick = () => openSite('events', to);
    renderRoutes();
    renderDirectory(from, to);
    ['summary','results','provider-directory'].forEach(id => $(id).classList.remove('hidden'));
    $('summary').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function bind() {
    bindCombo('from');
    bindCombo('to');
    $('swap').onclick = () => {
      const from = S.selected.from;
      const to = S.selected.to;
      to ? choose('from', to) : ($('from-input').value = '', clear('from'));
      from ? choose('to', from) : ($('to-input').value = '', clear('to'));
    };
    $('find-options').onclick = search;
    $('sort').onchange = renderRoutes;
    const input = $('travel-date');
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    input.min = input.value = iso;
    const picker = () => {
      try {
        input.showPicker ? input.showPicker() : (input.focus(), input.click());
      } catch (_) {
        input.focus();
      }
    };
    $('open-date-picker').onclick = picker;
    input.onclick = picker;
    document.addEventListener('click', event => {
      ['from','to'].forEach(which => !event.target.closest(`#${which}-combo`) && close(which));
    });
  }

  async function load() {
    bind();
    $('find-options').disabled = true;
    try {
      S.providers = window.BRTravelProviders;
      if (!S.providers) throw new Error('Transport-provider directory missing.');
      buildFallbackCoordinates();
      const stamp = Date.now();
      const [venueResponse, eventResponse] = await Promise.all([
        fetch(`listings.json?v=${stamp}`),
        fetch(`events.json?v=${stamp}`)
      ]);
      if (!venueResponse.ok || !eventResponse.ok) throw new Error('Backroom venue or event data could not be loaded.');
      [S.venues, S.events] = await Promise.all([venueResponse.json(), eventResponse.json()]);
      S.venues = Array.isArray(S.venues) ? S.venues : [];
      S.events = Array.isArray(S.events) ? S.events : [];
      S.byId = new Map(S.venues.map(venue => [clean(venue?.Venue_ID), venue]).filter(([id]) => id));
      buildCities();
      if (S.cities.length < 2) throw new Error('Not enough Backroom cities were found.');
      const berlin = S.cities.find(city => norm(city.city) === 'berlin') || S.cities[0];
      const london = S.cities.find(city => norm(city.city) === 'london') || S.cities.find(city => city.key !== berlin.key);
      choose('from', berlin);
      choose('to', london);
      $('load-state').classList.add('hidden');
      $('find-options').disabled = false;
    } catch (error) {
      console.error(error);
      $('load-state').textContent = `Travel data could not be loaded: ${error.message}`;
      $('load-state').style.color = '#ff7b66';
    }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', load) : load();
})();
