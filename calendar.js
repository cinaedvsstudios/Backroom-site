// Backroom Events calendar v1.03 — shareable day routes, location pill, filters and event-card rules.
(function () {
    'use strict';

    if (window.__backroomCalendarLoaded) return;
    window.__backroomCalendarLoaded = true;

    const WEEKDAY_INDEX = {
        sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
        wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
        friday: 5, fri: 5, saturday: 6, sat: 6
    };
    const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const EVENT_VIBE_TAGS = [
        'Bar', 'Party', 'Cinema', 'Sauna', 'Shop',
        'Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear',
        'Dancefloor', 'Smoking Area', 'Cocktails',
        'Fetish/Gear', 'Bear', 'Mature', 'Young Crowd', 'Queer', 'Pride', 'Social', 'Drag', 'Karaoke',
        'Pop/Dance', 'Techno'
    ];

    const GENERIC_PLACEHOLDER_POOL = [
        'placeholder_venue01.jpg',
        'placeholder_venue02.jpg',
        'placeholder_venue03.jpg',
        'placeholder_venue04.jpg',
        'placeholder_venue05.jpg',
        'placeholder_venue06.jpg',
        'placeholder_venue07.jpg'
    ];

    const SPECIAL_PLACEHOLDERS = Object.freeze({
        default: 'placeholder_venue.jpg',
        shop: 'placeholder_venue08.jpg',
        cruiseBar: 'placeholder_venue09.jpg',
        cinema: 'placeholder_venue10.jpg',
        pride: 'placeholder_venue11.jpg',
        cruisingIndoor: 'placeholder_venue12.jpg',
        cruisingOutdoor: 'placeholder_venue13.jpg',
        sauna: 'placeholder_venue14.jpg'
    });

    let previousGenericEventFallback = '';

    const state = {
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        selectedDate: dateKey(new Date()),
        location: { scope: 'all', city: '', country: '' },
        dateFilter: 'all',
        vibeFilter: '',
        events: [],
        venues: [],
        loading: false,
        loaded: false
    };

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function parseDate(value) {
        const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    }

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
        const ticketFormatted = escaped.replace(/(^|\s)Tickets:/gi, (match, prefix) => `${prefix ? '<br>' : ''}<span class="tickets-inline-label">🎟️ Tickets:</span>`);
        return ticketFormatted.replace(/(https?:\/\/[^\s<]+)/gi, candidate => {
            const trailingMatch = candidate.match(/[.,;:!?]+$/);
            const trailing = trailingMatch ? trailingMatch[0] : '';
            const url = candidate.slice(0, candidate.length - trailing.length);
            return `<a class="auto-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
        });
    }

    function formatEventDescription(value) {
        if (!value) return '';
        const normalized = String(value)
            .replace(/\r\n?/g, '\n')
            .replace(/={5,}/g, '\n=====\n')
            .replace(/------/g, '\n------\n')
            .replace(/(^|[^=])==(?!=)/g, '$1\n');
        const out = [];
        let inList = false;
        const closeList = () => {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
        };

        normalized.split('\n').forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) {
                closeList();
                return;
            }
            if (line === '=====') {
                closeList();
                out.push('<hr style="border:0; height:1px; background:var(--bright-red-orange); margin:13px 0;">');
                return;
            }
            if (line === '------') {
                closeList();
                return;
            }
            const headingMatch = line.match(/^(?:\*{5}|\+{5})\s*(.+)$/);
            if (headingMatch) {
                closeList();
                out.push(`<h4 style="color:var(--primary-blue); font-family:'Antonio', sans-serif; text-transform:uppercase; margin:13px 0 6px;">${linkifyText(headingMatch[1])}</h4>`);
                return;
            }
            const bulletMatch = line.match(/^--\s+(.+)$/);
            if (bulletMatch) {
                if (!inList) {
                    out.push('<ul style="margin:4px 0 10px 20px; padding:0;">');
                    inList = true;
                }
                out.push(`<li style="margin-bottom:4px;">${linkifyText(bulletMatch[1])}</li>`);
                return;
            }
            closeList();
            out.push(`<div style="margin:0 0 7px;">${linkifyText(line)}</div>`);
        });
        closeList();
        return out.join('\n');
    }

    function tagClass(tag) {
        const red = ['Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear', 'Smoking Area', 'Fetish/Gear'];
        const blue = ['Bar', 'Party', 'Cinema', 'Sauna', 'Shop', 'Dancefloor', 'Cocktails', 'Techno', 'Pop/Dance'];
        const yellow = ['Bear', 'Mature', 'Young Crowd', 'Queer', 'Pride', 'Social', 'Drag', 'Karaoke'];
        if (red.includes(tag)) return 'event-filter-red';
        if (yellow.includes(tag)) return 'event-filter-yellow';
        if (blue.includes(tag)) return 'event-filter-blue';
        return 'event-filter-blue';
    }

    function splitTags(value) {
        const seen = new Set();
        return String(value || '')
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => {
                if (!EVENT_VIBE_TAGS.includes(tag) || seen.has(tag)) return false;
                seen.add(tag);
                return true;
            });
    }

    function isGenericPlaceholderImage(value) {
        const image = String(value || '').trim().split('/').pop().toLowerCase();
        return /^placeholder_venue(?:0[1-7])?\.jpg$/.test(image);
    }

    function isAnyPlaceholderImage(value) {
        const image = String(value || '').trim().split('/').pop().toLowerCase();
        return /^placeholder_venue(?:0[1-9]|1[0-4])?\.jpg$/.test(image);
    }

    function isCruisingArea(venue) {
        return String(venue?.Category || '').trim().toLowerCase() === 'cruising area';
    }

    function categoryKey(venue) {
        return String(venue?.Category || '').trim().toLowerCase();
    }

    function isShopVenue(venue) {
        return categoryKey(venue).includes('shop') || splitTags(venue?.Vibe_Tags).includes('Shop');
    }

    function isCinemaVenue(venue) {
        return categoryKey(venue).includes('cinema') || splitTags(venue?.Vibe_Tags).includes('Cinema');
    }

    function isSaunaVenue(venue) {
        return categoryKey(venue).includes('sauna') || splitTags(venue?.Vibe_Tags).includes('Sauna');
    }

    function isCruiseBarVenue(venue) {
        const category = categoryKey(venue);
        const isBar = category.includes('bar');
        const tagList = splitTags(venue?.Vibe_Tags);
        const cruiseMarked = category.includes('cruise')
            || tagList.includes('Cruising')
            || tagList.includes('Cruise')
            || venue?.Feature_Cruise_Focused === true;
        return isBar && cruiseMarked;
    }

    function isRotatingGenericPlaceholder(value) {
        return GENERIC_PLACEHOLDER_POOL.includes(String(value || '').trim().split('/').pop());
    }

    function genericPlaceholder(seed = '', previousFallback = '') {
        const text = String(seed || 'backroom-calendar-generic-placeholder');
        let hash = 0;
        for (let index = 0; index < text.length; index += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(index);
            hash |= 0;
        }
        let poolIndex = Math.abs(hash) % GENERIC_PLACEHOLDER_POOL.length;
        let image = GENERIC_PLACEHOLDER_POOL[poolIndex];
        if (image === previousFallback && GENERIC_PLACEHOLDER_POOL.length > 1) {
            poolIndex = (poolIndex + 1) % GENERIC_PLACEHOLDER_POOL.length;
            image = GENERIC_PLACEHOLDER_POOL[poolIndex];
        }
        return image;
    }

    function combinedEventTags(event, venue) {
        return [...new Set([
            ...splitTags(event?.Vibe_Tags),
            ...splitTags(venue?.Vibe_Tags)
        ])];
    }

    function isMenOnlyEvent(event, venue) {
        return combinedEventTags(event, venue).includes('Men Only');
    }

    function eventPrefersVenueImageOverPride(event, venue) {
        const eventTags = combinedEventTags(event, venue);
        return eventTags.includes('Men Only')
            || eventTags.includes('Cruising')
            || eventTags.includes('Darkroom');
    }

    function venueFallbackImage(venue, previousFallback = '') {
        if (isCruisingArea(venue)) {
            const text = normalizeLocation([
                venue?.Name,
                venue?.Description,
                venue?.Address,
                venue?.Native_Map_Query
            ].filter(Boolean).join(' '));
            const indoor = [
                'toilet', 'toilets', 'bathroom', 'bathrooms', 'restroom', 'restrooms',
                'urinal', 'urinals', 'publicwc', 'station', 'railway'
            ];
            return indoor.some(word => text.includes(word))
                ? SPECIAL_PLACEHOLDERS.cruisingIndoor
                : SPECIAL_PLACEHOLDERS.cruisingOutdoor;
        }

        if (isShopVenue(venue)) return SPECIAL_PLACEHOLDERS.shop;
        if (isCinemaVenue(venue)) return SPECIAL_PLACEHOLDERS.cinema;
        if (isCruiseBarVenue(venue)) return SPECIAL_PLACEHOLDERS.cruiseBar;
        if (isSaunaVenue(venue)) return SPECIAL_PLACEHOLDERS.sauna;

        return genericPlaceholder(venue?.Venue_ID || venue?.Name || venue?.Native_Map_Query || '', previousFallback);
    }

    function venueImageSource(venue, preferredFallback = '') {
        // Shop and cinema images are intentional fixed artwork, not ordinary generic fallbacks.
        if (isShopVenue(venue)) return SPECIAL_PLACEHOLDERS.shop;
        if (isCinemaVenue(venue)) return SPECIAL_PLACEHOLDERS.cinema;

        const image = String(venue?.Image_URL || '').trim();
        if (image && !isAnyPlaceholderImage(image)) return image;
        return preferredFallback || venueFallbackImage(venue);
    }

    function eventImageSource(event, venue, preferredFallback = '') {
        const image = String(event?.Event_Image_URL || '').trim();
        if (image && !isAnyPlaceholderImage(image)) return image;

        const fallback = preferredFallback || eventFallbackImage(event, venue);

        if (eventPrefersVenueImageOverPride(event, venue)) {
            return venueImageSource(venue || {}, fallback);
        }

        if (combinedEventTags(event, venue).includes('Pride')) return SPECIAL_PLACEHOLDERS.pride;
        return venueImageSource(venue || {}, fallback);
    }

    function eventFallbackImage(event, venue, previousFallback = '') {
        if (eventPrefersVenueImageOverPride(event, venue)) {
            return venueFallbackImage(venue || {}, previousFallback);
        }

        return combinedEventTags(event, venue).includes('Pride')
            ? SPECIAL_PLACEHOLDERS.pride
            : venueFallbackImage(venue || {}, previousFallback);
    }

    // Mirrors the app location aliases so Events accepts the same GPS/native/
    // English city spellings as Results and Venues. This comparison key never changes
    // the city label stored in data or shown to the user.
    const CITY_NAME_ALIASES = {
        koln: 'cologne', koeln: 'cologne', cologne: 'cologne',
        munchen: 'munich', muenchen: 'munich', munich: 'munich',
        nurnberg: 'nuremberg', nuernberg: 'nuremberg', nuremberg: 'nuremberg',
        hannover: 'hanover', hanover: 'hanover',
        dusseldorf: 'dusseldorf', duesseldorf: 'dusseldorf',
        monchengladbach: 'monchengladbach', moenchengladbach: 'monchengladbach',
        munster: 'munster', muenster: 'munster',
        osnabruck: 'osnabruck', osnabrueck: 'osnabruck',
        saarbrucken: 'saarbrucken', saarbruecken: 'saarbrucken',
        lubeck: 'lubeck', luebeck: 'lubeck',
        gottingen: 'gottingen', goettingen: 'gottingen',
        wurzburg: 'wurzburg', wuerzburg: 'wurzburg',
        tubingen: 'tubingen', tuebingen: 'tubingen',
        furth: 'furth', fuerth: 'furth',
        schwaebischhall: 'schwabischhall', schwabischhall: 'schwabischhall',
        badenbaden: 'badenbaden',
        frankfurtammain: 'frankfurt', frankfurtmain: 'frankfurt', frankfurt: 'frankfurt',
        freiburgimbreisgau: 'freiburg', freiburg: 'freiburg',
        hallesaale: 'hallesale', hallesale: 'hallesale'
    };

    function normalizeLocation(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/ß/g, 'ss')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '');
        return CITY_NAME_ALIASES[normalized] || normalized;
    }

    function uniqueLocationValues(values) {
        const byKey = new Map();
        (values || []).forEach(value => {
            const clean = String(value || '').trim();
            const key = normalizeLocation(clean);
            if (clean && key && !byKey.has(key)) byKey.set(key, clean);
        });
        return [...byKey.values()].sort((a, b) => a.localeCompare(b));
    }

    function cityOptions() {
        return cityOptionRecords().map(option => option.city)
            .filter((city, index, values) => values.findIndex(value => normalizeLocation(value) === normalizeLocation(city)) === index);
    }

    function cityOptionRecords() {
        const records = new Map();

        const addRecord = record => {
            const country = String(record?.Country || '').trim();
            String(record?.City || '').split(',').map(city => city.trim()).filter(Boolean).forEach(city => {
                const key = `${normalizeLocation(city)}::${normalizeLocation(country)}`;
                if (!key || records.has(key)) return;
                records.set(key, { city, country });
            });
        };

        state.venues.forEach(addRecord);
        state.events.forEach(addRecord);

        const countsByCity = new Map();
        [...records.values()].forEach(record => {
            const cityKey = normalizeLocation(record.city);
            countsByCity.set(cityKey, (countsByCity.get(cityKey) || 0) + 1);
        });

        return [...records.values()]
            .map(record => {
                const duplicate = (countsByCity.get(normalizeLocation(record.city)) || 0) > 1;
                return {
                    ...record,
                    label: duplicate && record.country ? `${record.city}, ${record.country}` : record.city,
                    value: `city::${encodeURIComponent(record.city)}::${encodeURIComponent(record.country || '')}`
                };
            })
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    function countryOptions() {
        const venueCountries = state.venues.map(venue => String(venue?.Country || '').trim());
        const eventCountries = state.events.map(event => String(event?.Country || '').trim());
        return uniqueLocationValues([...venueCountries, ...eventCountries]);
    }

    function findDisplayLocation(value, options) {
        const requested = normalizeLocation(value);
        if (!requested) return '';
        return (options || []).find(option => normalizeLocation(option) === requested) || '';
    }

    function readSharedLocation() {
        try {
            const location = JSON.parse(localStorage.getItem('br_location') || 'null');
            if (!location || typeof location !== 'object') return { scope: 'all', city: '', country: '', postcode: '' };

            const city = String(location.city || '').trim();
            const country = String(location.country || '').trim();
            const scope = String(location.scope || '').trim().toLowerCase();

            if (scope === 'all' || (!city && !country)) {
                return { scope: 'all', city: '', country: '', postcode: '' };
            }

            if (city) {
                return { scope: 'city', city, country, postcode: String(location.postcode || '').trim() };
            }

            return { scope: 'country', city: '', country, postcode: String(location.postcode || '').trim() };
        } catch {
            return { scope: 'all', city: '', country: '', postcode: '' };
        }
    }

    function syncLocationFromSharedLocation() {
        const routeState = readCalendarRouteState();
        if (routeState) {
            state.location = routeState.location;
            return;
        }

        const shared = readSharedLocation();

        if (shared.scope === 'city') {
            const city = findDisplayLocation(shared.city, cityOptions()) || shared.city;
            let country = findDisplayLocation(shared.country, countryOptions()) || shared.country;

            if (!country) {
                const matches = cityOptionRecords().filter(option => normalizeLocation(option.city) === normalizeLocation(city));
                if (matches.length === 1) country = matches[0].country;
            }

            state.location = { scope: 'city', city, country };
            return;
        }

        if (shared.scope === 'country') {
            state.location = {
                scope: 'country',
                city: '',
                country: findDisplayLocation(shared.country, countryOptions()) || shared.country
            };
            return;
        }

        state.location = { scope: 'all', city: '', country: '' };
    }

    function getLocationLabel(location = state.location) {
        if (location?.scope === 'city') {
            const city = String(location.city || '').trim();
            const country = String(location.country || '').trim();
            return country ? `${city}, ${country}` : city;
        }
        if (location?.scope === 'country') return String(location.country || '').trim();
        return '';
    }

    function isCalendarRouteHash(hash = window.location.hash || '') {
        return hash === '#calendar' || String(hash).startsWith('#calendar?');
    }

    function readCalendarRouteState(hash = window.location.hash || '') {
        if (!String(hash || '').startsWith('#calendar?')) return null;

        const params = new URLSearchParams(String(hash).slice('#calendar?'.length));
        const city = String(params.get('city') || '').trim();
        const country = String(params.get('country') || '').trim();
        const requestedDate = parseDate(params.get('date')) || startOfToday();
        const rawTag = String(params.get('tag') || '').trim();
        const vibeFilter = EVENT_VIBE_TAGS.find(tag => normalizeLocation(tag) === normalizeLocation(rawTag)) || '';
        let location = { scope: 'all', city: '', country: '' };

        if (city && country) {
            const match = cityOptionRecords().find(option => (
                normalizeLocation(option.city) === normalizeLocation(city)
                && normalizeLocation(option.country) === normalizeLocation(country)
            ));
            if (match) location = { scope: 'city', city: match.city, country: match.country };
        } else if (!city && country) {
            const displayCountry = findDisplayLocation(country, countryOptions());
            if (displayCountry) location = { scope: 'country', city: '', country: displayCountry };
        }

        return {
            location,
            selectedDate: dateKey(requestedDate),
            vibeFilter,
            shared: true
        };
    }

    function applyCalendarRouteState() {
        const routeState = readCalendarRouteState();
        if (!routeState) return false;

        state.location = routeState.location;
        state.dateFilter = 'all';
        state.vibeFilter = routeState.vibeFilter;
        state.selectedDate = routeState.selectedDate;
        const selected = parseDate(routeState.selectedDate) || startOfToday();
        state.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
        return true;
    }

    function getCalendarShareUrl() {
        const params = new URLSearchParams();
        const location = state.location || { scope: 'all', city: '', country: '' };

        if (location.scope === 'city') params.set('city', location.city);
        if (location.country) params.set('country', location.country);
        params.set('date', state.selectedDate);
        if (state.vibeFilter) params.set('tag', state.vibeFilter);

        return `${window.location.origin}${window.location.pathname}#calendar?${params.toString()}`;
    }

    function shareSelectedCalendarDay() {
        const url = getCalendarShareUrl();
        const locationLabel = getLocationLabel();
        const subject = `Backroom Events: ${selectedLabel()}${locationLabel ? ` — ${locationLabel}` : ''}`;

        if (typeof window.shareURL === 'function') {
            window.shareURL(url, subject);
            return;
        }

        navigator.clipboard?.writeText(url);
    }

    function setSharedLocationFromSelection(value) {
        const selected = String(value || '');
        let next;

        if (selected === 'all') {
            next = { scope: 'all', city: '', country: '', postcode: '' };
        } else if (selected.startsWith('country::')) {
            next = {
                scope: 'country',
                city: '',
                country: selected.slice('country::'.length),
                postcode: ''
            };
        } else if (selected.startsWith('city::')) {
            const [, encodedCity = '', encodedCountry = ''] = selected.split('::');
            const city = decodeURIComponent(encodedCity);
            const country = decodeURIComponent(encodedCountry);
            next = {
                scope: 'city',
                city,
                country,
                postcode: ''
            };
        } else {
            next = { scope: 'all', city: '', country: '', postcode: '' };
        }

        if (typeof window.setBackroomSharedLocation === 'function') {
            window.setBackroomSharedLocation(next);
        } else {
            localStorage.setItem('br_location', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('backroom:location-changed', { detail: next }));
        }

        syncLocationFromSharedLocation();
    }

    function isWeekly(event) {
        return String(event?.Recurrence_Type || '').trim().toLowerCase() === 'weekly';
    }

    function weeklyDay(event) {
        const key = String(event?.Recurrence_Day || '').trim().toLowerCase();
        return Object.hasOwn(WEEKDAY_INDEX, key) ? WEEKDAY_INDEX[key] : null;
    }

    function recurrenceLabel(event) {
        const day = weeklyDay(event);
        return day === null ? 'Every week' : `Every ${WEEKDAY_LABELS[day]}`;
    }

    function venueFor(event) {
        return state.venues.find(venue => venue.Venue_ID === event.Venue_ID) || null;
    }

    function cityTokensFor(event) {
        const venue = venueFor(event);
        const cityText = String(venue?.City || event?.City || '');
        return cityText.split(',').map(city => city.trim()).filter(Boolean);
    }

    function cityFor(event) {
        return cityTokensFor(event)[0] || '';
    }

    function countryFor(event) {
        const venue = venueFor(event);
        return String(venue?.Country || event?.Country || '').trim();
    }

    function eventMatchesSharedLocation(event) {
        const location = state.location || { scope: 'all', city: '', country: '' };

        if (location.scope === 'country') {
            return normalizeLocation(countryFor(event)) === normalizeLocation(location.country);
        }

        if (location.scope === 'city') {
            const cityMatches = cityTokensFor(event).some(city => normalizeLocation(city) === normalizeLocation(location.city));
            const countryMatches = !location.country
                || normalizeLocation(countryFor(event)) === normalizeLocation(location.country);
            return cityMatches && countryMatches;
        }

        return true;
    }

    function tagsFor(event) {
        const venue = venueFor(event);
        const combined = [...splitTags(event?.Vibe_Tags), ...splitTags(venue?.Vibe_Tags)];
        return [...new Set(combined)];
    }

    function isPublic(event) {
        const status = String(event?.Status || '').trim();
        if (['Hold', 'Flag', 'Closed', 'Cancelled'].includes(status)) return false;
        if (!event?.Event_Date) return false;
        if (!eventMatchesSharedLocation(event)) return false;
        if (state.vibeFilter && !tagsFor(event).includes(state.vibeFilter)) return false;
        return true;
    }

    function occurrenceForDate(event, targetDate) {
        const firstDate = parseDate(event.Event_Date);
        const untilDate = parseDate(event.Recurrence_Until);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        if (!isWeekly(event)) {
            return firstDate && firstDate.getTime() === target.getTime()
                ? { ...event, Display_Date: dateKey(target), Is_Recurring: false, Recurrence_Label: '' }
                : null;
        }

        const weekday = weeklyDay(event);
        if (weekday === null || !firstDate || target < firstDate || (untilDate && target > untilDate) || target.getDay() !== weekday) return null;
        return { ...event, Display_Date: dateKey(target), Is_Recurring: true, Recurrence_Label: recurrenceLabel(event) };
    }

    function sortEvents(a, b) {
        const dateDiff = String(a.Display_Date || '').localeCompare(String(b.Display_Date || ''));
        if (dateDiff) return dateDiff;
        return String(a.Event_Start_Time || '').localeCompare(String(b.Event_Start_Time || ''));
    }

    function eventsOnDate(key) {
        const target = parseDate(key);
        if (!target) return [];
        return state.events
            .filter(isPublic)
            .map(event => occurrenceForDate(event, target))
            .filter(Boolean)
            .sort(sortEvents);
    }

    function startOfToday() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function endOfThisWeek() {
        const end = startOfToday();
        const daysUntilSunday = (7 - end.getDay()) % 7;
        end.setDate(end.getDate() + daysUntilSunday);
        return end;
    }

    function eventsForActiveDateFilter() {
        if (state.dateFilter === 'all') return eventsOnDate(state.selectedDate);

        const start = startOfToday();
        const end = state.dateFilter === 'today' ? start : endOfThisWeek();
        const output = [];
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            output.push(...eventsOnDate(dateKey(date)));
        }
        return output.sort(sortEvents);
    }

    function eventsForMonth() {
        const year = state.month.getFullYear();
        const month = state.month.getMonth();
        const count = new Date(year, month + 1, 0).getDate();
        const all = [];
        for (let day = 1; day <= count; day += 1) all.push(...eventsOnDate(dateKey(new Date(year, month, day))));
        return all;
    }

    function ensureContainer() {
        let container = document.getElementById('calendar-container');
        if (container) return container;
        container = document.createElement('div');
        container.id = 'calendar-container';
        container.className = 'hidden';
        const wrapper = document.querySelector('#main-content .content-wrapper');
        const filters = document.getElementById('main-filters');
        if (wrapper && filters) wrapper.insertBefore(container, filters);
        else wrapper?.appendChild(container);
        return container;
    }

    function savedEventIds() {
        try { return JSON.parse(localStorage.getItem('br_events')) || []; }
        catch { return []; }
    }

    function monthLabel() {
        return state.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    function selectedLabel() {
        return new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    }

    function activePanelLabel() {
        if (state.dateFilter === 'today') return 'TODAY';
        if (state.dateFilter === 'week') return 'THIS WEEK';
        return selectedLabel();
    }

    function monthCells() {
        const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
        const startOffset = (first.getDay() + 6) % 7;
        const days = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate();
        const cells = Array(startOffset).fill(null);
        for (let day = 1; day <= days; day += 1) cells.push(new Date(state.month.getFullYear(), state.month.getMonth(), day));
        while (cells.length % 7) cells.push(null);
        return cells;
    }

    function ensureSelectedDate() {
        if (state.dateFilter === 'today' || state.dateFilter === 'week') {
            const today = startOfToday();
            state.month = new Date(today.getFullYear(), today.getMonth(), 1);
            state.selectedDate = dateKey(today);
            return;
        }

        const selected = parseDate(state.selectedDate);
        if (!selected || selected.getMonth() !== state.month.getMonth() || selected.getFullYear() !== state.month.getFullYear()) {
            const firstEvent = eventsForMonth().sort(sortEvents)[0];
            state.selectedDate = firstEvent?.Display_Date || dateKey(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
        }
    }

    function renderLocationPill() {
        const label = getLocationLabel() || 'All Cities';
        return `<button type="button" id="calendar-location-pill" class="calendar-location-pill pill-btn" aria-label="Change shared location">${escapeHTML(label)}</button>`;
    }


    function filterChip(label, value, extraClass = '') {
        const isAll = value === 'all';
        const isDate = value === 'today' || value === 'week';
        const isActive = isAll
            ? !state.vibeFilter && state.dateFilter === 'all'
            : isDate
                ? state.dateFilter === value
                : state.vibeFilter === value;
        const className = isDate ? 'event-filter-green' : (isAll ? 'event-filter-all' : tagClass(value));
        return `<button type="button" class="calendar-filter-chip pill-btn ${className} ${isActive ? 'active' : ''} ${extraClass}" data-calendar-filter="${escapeHTML(value)}">${escapeHTML(label)}</button>`;
    }

    function renderFilterStrip() {
        const filters = [
            filterChip('All', 'all'),
            filterChip('Today', 'today'),
            filterChip('This Week', 'week'),
            ...EVENT_VIBE_TAGS.map(tag => filterChip(tag, tag))
        ].join('');
        return `<div class="calendar-filter-shell" aria-label="Event filters"><div class="calendar-filter-scroll"><div class="calendar-filter-grid">${filters}</div></div></div>`;
    }

    function renderGrid() {
        const today = dateKey(new Date());
        const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
        const days = monthCells().map(date => {
            if (!date) return '<div class="calendar-day blank" aria-hidden="true"></div>';
            const key = dateKey(date);
            const count = eventsOnDate(key).length;
            return `<button type="button" class="calendar-day${key === state.selectedDate ? ' selected' : ''}${key === today ? ' today' : ''}${count ? ' has-events' : ''}" data-calendar-date="${key}"><span class="calendar-number">${date.getDate()}</span><span class="calendar-indicators">${count ? `<span class="calendar-dot"></span>${count > 1 ? `<span class="calendar-count">${count}</span>` : ''}` : ''}</span></button>`;
        }).join('');
        return `<div class="calendar-grid">${weekdays}${days}</div>`;
    }

    function renderEventTags(event) {
        const tags = tagsFor(event);
        if (!tags.length) return '';
        return `<div class="calendar-tag-row">${tags.map(tag => `<span class="calendar-tag ${tagClass(tag)}">${escapeHTML(tag)}</span>`).join('')}</div>`;
    }

    function renderEventCard(event, includeDate = false) {
        const venue = venueFor(event);
        const venueName = venue?.Name || 'Venue not listed';
        const location = [venue?.City || event?.City, venue?.Country || event?.Country].filter(Boolean).join(' · ');
        const times = [event.Event_Start_Time, event.Event_End_Time].filter(Boolean).join(' – ');
        const saved = savedEventIds().includes(event.Event_ID);
        const imageFallback = eventFallbackImage(event, venue, previousGenericEventFallback);
        const image = eventImageSource(event, venue, imageFallback);
        previousGenericEventFallback = isRotatingGenericPlaceholder(imageFallback) ? imageFallback : '';
        const dateText = includeDate && event.Display_Date
            ? new Date(`${event.Display_Date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
            : '';
        return `<article class="calendar-event-card${isMenOnlyEvent(event, venue) ? ' calendar-event-card--men-only' : ''}"><div class="calendar-event-layout"><div class="calendar-event-media"><img class="calendar-venue-thumb" src="${escapeHTML(image)}" alt="${escapeHTML(venueName)}" onerror="this.onerror=null;this.src='${escapeHTML(imageFallback)}';"><button type="button" class="btn primary-btn pill-btn calendar-action ${saved ? 'calendar-saved' : ''}" data-calendar-save="${escapeHTML(event.Event_ID)}">${saved ? '💖 Saved' : '💖 Save Event'}</button><button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-shortlist="${escapeHTML(event.Event_ID)}">📑 Shortlist</button>${venue ? `<button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-venue="${escapeHTML(venue.Venue_ID)}">Open Venue</button>` : ''}</div><div class="calendar-event-body"><div class="calendar-event-top"><div><h3 class="calendar-event-name display-font">${escapeHTML(event.Event_Name || 'Event')}</h3><p class="calendar-event-meta">${escapeHTML(venueName)}${location ? ` · ${escapeHTML(location)}` : ''}</p>${dateText ? `<p class="calendar-event-date">${escapeHTML(dateText)}</p>` : ''}${times ? `<p class="calendar-event-time">${escapeHTML(times)}</p>` : ''}${event.Is_Recurring ? `<p class="calendar-event-recurrence">${escapeHTML(event.Recurrence_Label)}</p>` : ''}</div>${event.Dresscode_Info ? `<div class="calendar-event-dresscode">${escapeHTML(event.Dresscode_Info)}</div>` : ''}</div>${event.Event_Description ? `<div class="calendar-event-description">${formatEventDescription(event.Event_Description)}</div>` : ''}${renderEventTags(event)}</div></div></article>`;
    }

    function renderPanel() {
        const isWindowFilter = state.dateFilter !== 'all';
        const items = eventsForActiveDateFilter();
        const label = activePanelLabel();
        const shareButton = !isWindowFilter
            ? `<button type="button" id="calendar-share-day" class="calendar-share-day-btn icon-btn" title="Share events on ${escapeHTML(label)}" aria-label="Share events on ${escapeHTML(label)}">📣</button>`
            : '';
        const heading = `<div class="calendar-panel-heading"><h2 class="display-font">${label}</h2>${shareButton}</div>`;
        previousGenericEventFallback = '';
        if (!items.length) return `<section class="calendar-event-panel">${heading}<div class="calendar-empty">No listed events match these filters yet.</div></section>`;
        return `<section class="calendar-event-panel">${heading}<p class="calendar-day-count">${items.length} event${items.length === 1 ? '' : 's'} listed</p>${items.map(event => renderEventCard(event, isWindowFilter)).join('')}</section>`;
    }

    function render() {
        const container = ensureContainer();
        ensureSelectedDate();
        container.innerHTML = `<div class="calendar-page"><div class="calendar-title-row"><div class="calendar-title-block"><h1 class="display-font">📅 EVENTS IN</h1>${renderLocationPill()}<p>Choose a date to see what is on.</p></div>${renderFilterStrip()}</div><div class="calendar-layout"><section class="calendar-selector"><div class="calendar-month-row"><button type="button" class="calendar-month-button" id="calendar-prev-month" aria-label="Previous month">‹</button><h2 class="display-font">${monthLabel()}</h2><button type="button" class="calendar-month-button" id="calendar-next-month" aria-label="Next month">›</button></div>${renderGrid()}<p class="calendar-key"><span class="calendar-dot"></span> Events listed on this date</p></section>${renderPanel()}</div></div>`;
        bindControls();
    }

    function activateFilter(value) {
        if (value === 'all') {
            state.dateFilter = 'all';
            state.vibeFilter = '';
        } else if (value === 'today' || value === 'week') {
            state.dateFilter = state.dateFilter === value ? 'all' : value;
        } else {
            state.vibeFilter = state.vibeFilter === value ? '' : value;
        }
        ensureSelectedDate();
        render();
    }

    function bindControls() {
        document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
            ensureSelectedDate();
            render();
        });
        document.getElementById('calendar-next-month')?.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
            ensureSelectedDate();
            render();
        });
        document.getElementById('calendar-location-pill')?.addEventListener('click', () => {
            if (typeof window.openBackroomLocationModal === 'function') {
                window.openBackroomLocationModal();
                return;
            }

            // Fallback for an older app.js: reuse the normal top-bar location control.
            document.getElementById('btn-location')?.click();
        });
        document.getElementById('calendar-share-day')?.addEventListener('click', shareSelectedCalendarDay);
        document.querySelectorAll('[data-calendar-filter]').forEach(button => button.addEventListener('click', () => activateFilter(button.dataset.calendarFilter)));
        document.querySelectorAll('[data-calendar-date]').forEach(button => button.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.selectedDate = button.dataset.calendarDate;
            render();
        }));
        document.querySelectorAll('[data-calendar-save]').forEach(button => button.addEventListener('click', () => {
            window.toggleEventFavorite?.(button.dataset.calendarSave, button, false);
            render();
        }));
        document.querySelectorAll('[data-calendar-shortlist]').forEach(button => button.addEventListener('click', () => {
            window.promptAddEventToShortlist?.(button.dataset.calendarShortlist);
        }));
        document.querySelectorAll('[data-calendar-venue]').forEach(button => button.addEventListener('click', () => {
            close(false);
            window.location.hash = `#venue=${button.dataset.calendarVenue}`;
        }));
    }

    async function loadData() {
        if (state.loading) return;
        state.loading = true;
        try {
            const [eventResponse, venueResponse] = await Promise.all([
                fetch('events.json', { cache: 'no-store' }),
                fetch('listings.json', { cache: 'no-store' })
            ]);
            if (!eventResponse.ok || !venueResponse.ok) throw new Error('Event data unavailable');
            state.events = await eventResponse.json();
            state.venues = await venueResponse.json();
            syncLocationFromSharedLocation();
            state.loaded = true;
        } catch (error) {
            ensureContainer().innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 EVENTS</h1><p class="calendar-empty">Events could not be loaded.</p></div>';
        } finally {
            state.loading = false;
        }
    }

    function hideStandardPanels() {
        document.getElementById('context-header')?.classList.add('hidden');
        document.getElementById('main-filters')?.classList.add('hidden');
        ['discounts-container', 'about-container', 'featured-container', 'cruising-guide-container', 'welcome-screen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        const results = document.getElementById('results-container');
        if (results) results.style.display = 'none';
    }

    function close(clear = true) {
        const container = document.getElementById('calendar-container');
        container?.classList.add('hidden');
        if (container && clear) container.innerHTML = '';
        const results = document.getElementById('results-container');
        if (results) results.style.display = '';
    }

    window.closeCalendarScreen = close;
    window.openCalendarScreen = async function () {
        if (!isCalendarRouteHash()) history.pushState(null, '', '#calendar');
        hideStandardPanels();
        const container = ensureContainer();
        container.classList.remove('hidden');
        container.innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 EVENTS</h1><p class="calendar-loading">Loading events…</p></div>';
        if (!state.loaded) await loadData();
        if (state.loaded) {
            syncLocationFromSharedLocation();
            applyCalendarRouteState();
            render();
        }
    };

    window.addEventListener('backroom:location-changed', () => {
        if (!state.loaded) return;
        syncLocationFromSharedLocation();
        if (isCalendarRouteHash()) render();
    });

    window.addEventListener('hashchange', () => {
        if (!isCalendarRouteHash()) close(false);
    });
}());
