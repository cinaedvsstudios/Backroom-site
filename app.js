// --- Application State ---
const APP_VERSION = "v1.07";
const APP_DATE = "21 July 2026";

let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilters = []; // v0.66 Multi-select Array
let selectedCardId = null;
let venueReturnHash = '#results';
let currentTargetVenue = null; 
let currentShortlistTarget = null;
let currentEventCityFilter = 'All';
let isTutorialRunning = false; 
let activeShortlistContentFilter = 'all';
let activeShortlistContentName = '';
let searchUsesFuzzyMatching = false;
let searchResultTypeFilter = 'All';

// Profile Data Structure (Save Game Style)
let userProfile = JSON.parse(localStorage.getItem('br_profile')) || { name: '', avatar: '' };
let savedProfiles = JSON.parse(localStorage.getItem('br_saved_profiles')) || {};

// Globals swapped per profile
let userFavorites = [];
let userShortlists = {};
let userShortlistEmojis = {}; 
let userEvents = [];
let userTravel = [];

let importInfo = JSON.parse(localStorage.getItem('br_import_info')) || null;
let avatarData = [];
let activeAvatarCategories = [];
let profileOpenName = '';
let profileOpenAvatar = '';

let leafletMap = null;
let leafletMarker = null;

const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const errorPanel = document.getElementById('error-panel');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const searchInput = document.getElementById('search-input');
const contextHeader = document.getElementById('context-header');
const welcomeScreen = document.getElementById('welcome-screen');
const venueModal = document.getElementById('venue-modal');
const locModal = document.getElementById('location-modal');
const settingsModal = document.getElementById('settings-modal');
const addShortlistModal = document.getElementById('add-to-shortlist-modal');
const profileModal = document.getElementById('profile-modal');
const sidebar = document.getElementById('sidebar');
const hitArea = document.getElementById('sidebar-hit-area');
let sidebarTimeout;

const MASTER_VIBE_TAGS = ["Bar","Party","Cinema","Sauna","Shop","Cruising","Darkroom","Men Only","Dresscode","Naked","Underwear","Dancefloor","Smoking Area","Cocktails","Fetish/Gear","Bear","Mature","Young Crowd","Queer","Pride","Social","Drag","Karaoke","Pop/Dance","Techno"];
const SHORTLIST_EMOJIS = ['🤠','🚄','👑','🥂','🦄','🫦','💪','🪇','🔥','🍆','🍑','💄','🛁','✈️','💥','💦','🗝️','🧿','🎧','🧭','⛓️','🎼'];
// Generic fallback images are deliberately kept separate from category-specific artwork.
const PLACEHOLDER_POOL = [
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
const BR_ICONS = { share: '📣', favourite: '⚜️', savedEvent: '💖', report: 'report.png', link: 'link.png', shortlist: 'shortlist.png' };

function splitStoredTags(value) {
    return [...new Set(String(value || '').split(',').map(tag => tag.trim()).filter(Boolean))];
}

function hasExactVibeTag(value, tag) {
    return splitStoredTags(value).includes(tag);
}

function isCruisingAreaVenue(venue) {
    return String(venue?.Category || '').trim().toLowerCase() === 'cruising area';
}

function isMenOnlyTaggedVenue(venue) {
    return hasExactVibeTag(venue?.Vibe_Tags, 'Men Only');
}

function getVenueCategoryKey(venue) {
    return String(venue?.Category || '').trim().toLowerCase();
}

function isShopVenue(venue) {
    return getVenueCategoryKey(venue).includes('shop')
        || hasExactVibeTag(venue?.Vibe_Tags, 'Shop');
}

function isCinemaVenue(venue) {
    return getVenueCategoryKey(venue).includes('cinema')
        || hasExactVibeTag(venue?.Vibe_Tags, 'Cinema');
}

function isSaunaVenue(venue) {
    return getVenueCategoryKey(venue).includes('sauna')
        || hasExactVibeTag(venue?.Vibe_Tags, 'Sauna');
}

function isCruiseBarVenue(venue) {
    const category = getVenueCategoryKey(venue);
    const isBar = category.includes('bar');
    const isCruiseMarked = category.includes('cruise')
        || hasExactVibeTag(venue?.Vibe_Tags, 'Cruising')
        || hasExactVibeTag(venue?.Vibe_Tags, 'Cruise')
        || venue?.Feature_Cruise_Focused === true;

    return isBar && isCruiseMarked;
}

function isRotatingGenericPlaceholder(value) {
    return PLACEHOLDER_POOL.includes(String(value || '').trim().split('/').pop());
}

function getGenericPlaceholderImage(seed = '', previousFallback = '') {
    const text = String(seed || 'backroom-generic-placeholder');
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }

    let poolIndex = Math.abs(hash) % PLACEHOLDER_POOL.length;
    let image = PLACEHOLDER_POOL[poolIndex];

    // The calling renderer passes its previous generic image, so ordinary cards do not
    // repeat the same random-style fallback side by side. Category-specific artwork can repeat.
    if (image === previousFallback && PLACEHOLDER_POOL.length > 1) {
        poolIndex = (poolIndex + 1) % PLACEHOLDER_POOL.length;
        image = PLACEHOLDER_POOL[poolIndex];
    }

    return image;
}


function getCruisingAreaMapPointArray(venue) {
    const raw = venue?.Map_Points;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
}

function normaliseCoordinate(value) {
    const number = Number.parseFloat(String(value ?? '').trim());
    return Number.isFinite(number) ? String(number) : '';
}

function coordinatesFromGoogleMapsURL(value) {
    const decoded = decodeURIComponent(String(value || '').replace(/\+/g, ' '));
    const patterns = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
        /\/search\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
        const match = decoded.match(pattern);
        if (match) return { latitude: normaliseCoordinate(match[1]), longitude: normaliseCoordinate(match[2]) };
    }
    return { latitude: '', longitude: '' };
}

function getMapPointCoordinates(point) {
    const latitude = normaliseCoordinate(point?.Latitude);
    const longitude = normaliseCoordinate(point?.Longitude);
    if (latitude && longitude) return { latitude, longitude };
    return coordinatesFromGoogleMapsURL(point?.Google_Maps_URL);
}

function getCruisingAreaMapLinks(venue) {
    const mainPoint = {
        Label: '',
        Google_Maps_URL: String(venue?.Google_Maps_URL || '').trim(),
        Latitude: venue?.Latitude,
        Longitude: venue?.Longitude
    };

    const points = [mainPoint, ...getCruisingAreaMapPointArray(venue)];
    const seen = new Set();

    return points.map((point, index) => {
        const coordinates = getMapPointCoordinates(point);
        let url = String(point?.Google_Maps_URL || '').trim();

        if (!url && coordinates.latitude && coordinates.longitude) {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}`;
        }
        if (!url || seen.has(url)) return null;
        seen.add(url);

        const coordinateLabel = coordinates.latitude && coordinates.longitude
            ? `${coordinates.latitude}, ${coordinates.longitude}`
            : String(point?.Label || venue?.Native_Map_Query || venue?.Address || venue?.Name || 'Map search').trim();

        return { url, label: coordinateLabel, index };
    }).filter(Boolean);
}

function hasGenuineCruisingAreaTiming(venue) {
    const days = String(venue?.Opening_Days || '').trim();
    const open = String(venue?.Opening_Open_Time || '').trim();
    const close = String(venue?.Opening_Close_Time || '').trim();
    const notes = String(venue?.Opening_Notes || '').trim();
    const combined = [days, open, close, notes].join(' ');

    const clockTime = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/.test(combined);
    const namedSchedule = /\b(?:mon|tue|wed|thu|fri|sat|sun|daily|every day|weekdays|weekends|24\/?7|24 hours|sunrise|sunset|dawn|dusk|gate(?:s)?\s+(?:open|close)|locked?)\b/i.test(combined);

    return clockTime || namedSchedule;
}

function getCruisingAreaHoursText(venue) {
    if (!hasGenuineCruisingAreaTiming(venue)) return 'N/A';

    const days = String(venue?.Opening_Days || '').trim();
    const open = String(venue?.Opening_Open_Time || '').trim();
    const close = String(venue?.Opening_Close_Time || '').trim();
    const notes = String(venue?.Opening_Notes || '').trim();

    const timeRange = [open, close].filter(Boolean).join(open && close ? ' – ' : '');
    const main = [days, timeRange].filter(Boolean).join(' ');
    return [main, notes].filter(Boolean).join(main && notes ? ' — ' : '') || 'N/A';
}

function stripGenericCruisingAreaRules(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    const genericRulePatterns = [
        /no gps link available yet/i,
        /send it to us/i,
        /do not enter (?:private|fenced|protected)/i,
        /keep anything sexual out of public view/i,
        /keep the place comfortable for everyone/i,
        /access can change with local rules/i,
        /conditions and local patterns can change/i,
        /treat it as a starting point rather than a guarantee/i
    ];

    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    return sentences
        .map(sentence => sentence.trim())
        .filter(sentence => sentence && !genericRulePatterns.some(pattern => pattern.test(sentence)))
        .join(' ')
        .trim();
}

function renderCruisingAreaMapLinks(venue) {
    const links = getCruisingAreaMapLinks(venue);
    if (!links.length) {
        return `<div class="cruising-area-gps-links"><div class="cruising-area-gps-line">📍 <strong>GPS Link:</strong> No GPS Link available yet…</div></div>`;
    }

    return `<div class="cruising-area-gps-links">${links.map(link => `
        <div class="cruising-area-gps-line">📍 <strong>GPS Link:</strong> <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}</a></div>
    `).join('')}</div>`;
}

// Pride artwork is only for general Pride events. Men Only, Cruising and Darkroom
// events retain their venue image or category-specific fallback instead.
function isMenOnlyEvent(event, venue) {
    return getEventTags(event, venue).includes('Men Only');
}

function eventPrefersVenueImageOverPride(event, venue) {
    const eventTags = getEventTags(event, venue);
    return eventTags.includes('Men Only')
        || eventTags.includes('Cruising')
        || eventTags.includes('Darkroom');
}

function isGenericPlaceholderImage(value) {
    const image = String(value || '').trim().split('/').pop().toLowerCase();
    return /^placeholder_venue(?:0[1-7])?\.jpg$/.test(image);
}

function isAnyPlaceholderImage(value) {
    const image = String(value || '').trim().split('/').pop().toLowerCase();
    return /^placeholder_venue(?:0[1-9]|1[0-4])?\.jpg$/.test(image);
}

function isCruisingAreaIndoorLocation(venue) {
    const text = normalizeLocationName([
        venue?.Name,
        venue?.Description,
        venue?.Address,
        venue?.Native_Map_Query
    ].filter(Boolean).join(' '));

    return [
        'toilet', 'toilets', 'bathroom', 'bathrooms', 'restroom', 'restrooms',
        'urinal', 'urinals', 'publicwc', 'station', 'railway'
    ].some(keyword => text.includes(keyword));
}

function getVenueFallbackImage(venue, previousGenericFallback = '') {
    if (isCruisingAreaVenue(venue)) {
        return isCruisingAreaIndoorLocation(venue)
            ? SPECIAL_PLACEHOLDERS.cruisingIndoor
            : SPECIAL_PLACEHOLDERS.cruisingOutdoor;
    }
    if (isShopVenue(venue)) return SPECIAL_PLACEHOLDERS.shop;
    if (isCinemaVenue(venue)) return SPECIAL_PLACEHOLDERS.cinema;
    if (isCruiseBarVenue(venue)) return SPECIAL_PLACEHOLDERS.cruiseBar;
    if (isSaunaVenue(venue)) return SPECIAL_PLACEHOLDERS.sauna;

    return getGenericPlaceholderImage(
        venue?.Venue_ID || venue?.Name || venue?.Native_Map_Query || '',
        previousGenericFallback
    );
}

function getVenueImageSource(venue, preferredFallback = '') {
    // Shops and cinemas deliberately use their fixed directory artwork, even where an
    // older generic placeholder had previously been stored in the listing data.
    if (isShopVenue(venue)) return SPECIAL_PLACEHOLDERS.shop;
    if (isCinemaVenue(venue)) return SPECIAL_PLACEHOLDERS.cinema;

    const image = String(venue?.Image_URL || '').trim();
    if (image && !isAnyPlaceholderImage(image)) return image;

    return preferredFallback || getVenueFallbackImage(venue);
}

function getEventImageSource(event, venue, preferredFallback = '') {
    const eventImage = String(event?.Event_Image_URL || '').trim();
    if (eventImage && !isAnyPlaceholderImage(eventImage)) return eventImage;

    const fallback = preferredFallback || getEventFallbackImage(event, venue);

    if (eventPrefersVenueImageOverPride(event, venue)) {
        return getVenueImageSource(venue || {}, fallback);
    }

    // Pride artwork is reserved for non-sexual/general Pride events with no dedicated event image.
    if (hasExactVibeTag(event?.Vibe_Tags, 'Pride') || hasExactVibeTag(venue?.Vibe_Tags, 'Pride')) {
        return SPECIAL_PLACEHOLDERS.pride;
    }

    return getVenueImageSource(venue || {}, fallback);
}

function getEventFallbackImage(event, venue, previousGenericFallback = '') {
    if (eventPrefersVenueImageOverPride(event, venue)) {
        return getVenueFallbackImage(venue || {}, previousGenericFallback);
    }

    if (hasExactVibeTag(event?.Vibe_Tags, 'Pride') || hasExactVibeTag(venue?.Vibe_Tags, 'Pride')) {
        return SPECIAL_PLACEHOLDERS.pride;
    }
    return getVenueFallbackImage(venue || {}, previousGenericFallback);
}
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.cloud/f/ae0e141d-ad94-47fe-ac46-55702c6534a6/';


// --- Shared Supabase community ratings and venue view counts ---
// The publishable key is intentionally safe to ship in a static browser app. Database access is limited by Supabase RLS.
const COMMUNITY_SUPABASE = Object.freeze({
    url: 'https://dcnxvxfnxdxogesoiuyy.supabase.co',
    publishableKey: 'sb_publishable_RM4cq6aOV7R0gVIiHFljAg_K_ByS7KH',
    votesTable: 'venue_votes',
    viewsTable: 'venue_views'
});

let communityStatsLoaded = false;
let communityStatsLoading = false;
let communityStatsAvailable = true;
const communityVenueStats = new Map();

function getCommunityClientId() {
    const storageKey = 'br_community_vote_client_id';
    let clientId = localStorage.getItem(storageKey);
    if (clientId) return clientId;

    if (window.crypto?.randomUUID) clientId = window.crypto.randomUUID();
    else clientId = `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(storageKey, clientId);
    return clientId;
}

function getCommunityStats(venueId) {
    return communityVenueStats.get(String(venueId || '')) || {
        average: null,
        voteCount: 0,
        ownRating: null,
        viewCount: null
    };
}

function getCommunityHeaders(extra = {}) {
    return {
        apikey: COMMUNITY_SUPABASE.publishableKey,
        Authorization: `Bearer ${COMMUNITY_SUPABASE.publishableKey}`,
        ...extra
    };
}

async function communityRequest(path, options = {}) {
    const { method = 'GET', body = null, headers = {} } = options;
    const response = await fetch(`${COMMUNITY_SUPABASE.url}/rest/v1/${path}`, {
        method,
        headers: getCommunityHeaders({
            Accept: 'application/json',
            ...(body !== null ? { 'Content-Type': 'application/json' } : {}),
            ...headers
        }),
        body: body === null ? undefined : JSON.stringify(body)
    });

    const text = await response.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); }
        catch { data = text; }
    }

    if (!response.ok) {
        const detail = typeof data === 'string' ? data : (data?.message || data?.hint || response.statusText);
        throw new Error(`Supabase ${response.status}: ${detail}`);
    }

    return data;
}

function refreshCommunityStatsMarkup() {
    document.querySelectorAll('[data-community-stats]').forEach(container => {
        const venueId = container.dataset.communityStats;
        container.innerHTML = renderCommunityStatsInner(venueId);
    });
}

function renderCommunityStatsInner(venueId) {
    const stats = getCommunityStats(venueId);
    const hasVotes = Number.isFinite(stats.average) && stats.voteCount > 0;
    const scoreText = hasVotes ? `${stats.average.toFixed(1)}/5` : 'Rate it';
    const voteText = hasVotes ? `${stats.voteCount} vote${stats.voteCount === 1 ? '' : 's'}` : 'Be the first';
    const viewText = Number.isFinite(stats.viewCount) ? String(stats.viewCount) : '–';
    const ownText = Number.isFinite(stats.ownRating) ? `Your rating: ${stats.ownRating}/5` : 'Rate this venue';

    return `
        <button type="button" class="community-rating-button" onclick="event.stopPropagation(); window.openCommunityRatingModal('${escapeHTML(venueId)}')" title="${escapeHTML(ownText)}">
            <span class="community-rating-rainbow">🌈</span>
            <span class="community-rating-name">Rated by the gays</span>
            <strong class="community-rating-score">${escapeHTML(scoreText)}</strong>
            <span class="community-rating-votes">${escapeHTML(voteText)}</span>
        </button>
        <span class="community-view-count" title="Venue views">👁️ ${escapeHTML(viewText)}</span>
    `;
}

function renderCommunityStats(venueId) {
    return `<div class="community-stats" data-community-stats="${escapeHTML(venueId)}">${renderCommunityStatsInner(venueId)}</div>`;
}

async function loadCommunityVenueStats({ force = false } = {}) {
    if (communityStatsLoading || (communityStatsLoaded && !force)) return;
    communityStatsLoading = true;

    try {
        const clientId = getCommunityClientId();
        const [voteRows, viewRows] = await Promise.all([
            communityRequest(`${COMMUNITY_SUPABASE.votesTable}?select=venue_id,client_id,rating`),
            communityRequest(`${COMMUNITY_SUPABASE.viewsTable}?select=venue_id,view_count`)
        ]);

        const aggregate = new Map();
        (Array.isArray(voteRows) ? voteRows : []).forEach(row => {
            const venueId = String(row?.venue_id || '').trim();
            const rating = Number(row?.rating);
            if (!venueId || !Number.isInteger(rating) || rating < 1 || rating > 5) return;

            const current = aggregate.get(venueId) || { total: 0, voteCount: 0, ownRating: null, viewCount: null };
            current.total += rating;
            current.voteCount += 1;
            if (String(row?.client_id || '') === clientId) current.ownRating = rating;
            aggregate.set(venueId, current);
        });

        (Array.isArray(viewRows) ? viewRows : []).forEach(row => {
            const venueId = String(row?.venue_id || '').trim();
            if (!venueId) return;
            const current = aggregate.get(venueId) || { total: 0, voteCount: 0, ownRating: null, viewCount: null };
            const viewCount = Number(row?.view_count);
            current.viewCount = Number.isFinite(viewCount) && viewCount >= 0 ? viewCount : 0;
            aggregate.set(venueId, current);
        });

        communityVenueStats.clear();
        aggregate.forEach((value, venueId) => {
            communityVenueStats.set(venueId, {
                average: value.voteCount ? value.total / value.voteCount : null,
                voteCount: value.voteCount,
                ownRating: value.ownRating,
                viewCount: value.viewCount
            });
        });

        communityStatsAvailable = true;
        communityStatsLoaded = true;
    } catch (error) {
        communityStatsAvailable = false;
        console.warn('Community ratings could not be loaded.', error);
    } finally {
        communityStatsLoading = false;
        refreshCommunityStatsMarkup();
    }
}

function closeCommunityRatingModal() {
    document.getElementById('community-rating-modal')?.classList.add('hidden');
}

function openCommunityRatingModal(venueId) {
    const venue = venues.find(item => item?.Venue_ID === venueId);
    const modal = document.getElementById('community-rating-modal');
    const content = document.getElementById('community-rating-content');
    if (!modal || !content || !venue) return;

    const stats = getCommunityStats(venueId);
    const currentRating = Number.isFinite(stats.ownRating) ? stats.ownRating : 0;
    const averageText = Number.isFinite(stats.average) && stats.voteCount > 0
        ? `${stats.average.toFixed(1)} / 5 from ${stats.voteCount} vote${stats.voteCount === 1 ? '' : 's'}`
        : 'No public ratings yet.';

    content.innerHTML = `
        <p class="community-rating-venue-name display-font">${escapeHTML(venue.Name || 'Venue')}</p>
        <p class="community-rating-summary">${escapeHTML(averageText)}</p>
        <p class="community-rating-help">Choose your rating. Your browser keeps one editable anonymous vote for this venue.</p>
        <div class="community-rating-options" role="group" aria-label="Rate ${escapeHTML(venue.Name || 'venue')} from 1 to 5">
            ${[1, 2, 3, 4, 5].map(value => `
                <button type="button" class="community-rating-option ${currentRating === value ? 'selected' : ''}" onclick="window.submitCommunityRating('${escapeHTML(venueId)}', ${value})" aria-label="${value} out of 5">
                    <span>🌈</span><strong>${value}</strong>
                </button>
            `).join('')}
        </div>
        <p class="community-rating-current">${currentRating ? `Your current rating: ${currentRating}/5. Select another score to update it.` : 'You have not rated this venue yet.'}</p>
    `;

    modal.classList.remove('hidden');
}

async function submitCommunityRating(venueId, rating) {
    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) return;

    if (!communityStatsAvailable && communityStatsLoaded) {
        showToast('Public ratings are unavailable right now.');
        return;
    }

    const clientId = getCommunityClientId();
    const content = document.getElementById('community-rating-content');
    if (content) content.classList.add('is-saving');

    try {
        const selectPath = `${COMMUNITY_SUPABASE.votesTable}?select=id&venue_id=eq.${encodeURIComponent(venueId)}&client_id=eq.${encodeURIComponent(clientId)}&limit=1`;
        const existing = await communityRequest(selectPath);
        const now = new Date().toISOString();

        if (Array.isArray(existing) && existing[0]?.id) {
            await communityRequest(`${COMMUNITY_SUPABASE.votesTable}?id=eq.${encodeURIComponent(existing[0].id)}`, {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: { rating: score, updated_at: now }
            });
        } else {
            await communityRequest(COMMUNITY_SUPABASE.votesTable, {
                method: 'POST',
                headers: { Prefer: 'return=representation' },
                body: { venue_id: venueId, client_id: clientId, rating: score, updated_at: now }
            });
        }

        await loadCommunityVenueStats({ force: true });
        openCommunityRatingModal(venueId);
        showToast('Your rating has been saved.');
    } catch (error) {
        console.error('Could not save community rating.', error);
        showToast('Could not save your rating. Check the public Supabase policy.');
    } finally {
        content?.classList.remove('is-saving');
    }
}

async function recordCommunityVenueView(venueId) {
    const safeVenueId = String(venueId || '').trim();
    if (!safeVenueId) return;

    const sessionKey = `br_view_counted_${safeVenueId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    try {
        const existing = await communityRequest(`${COMMUNITY_SUPABASE.viewsTable}?select=venue_id,view_count&venue_id=eq.${encodeURIComponent(safeVenueId)}&limit=1`);
        const currentCount = Number(existing?.[0]?.view_count) || 0;
        const nextCount = currentCount + 1;
        const now = new Date().toISOString();

        if (Array.isArray(existing) && existing[0]?.venue_id) {
            await communityRequest(`${COMMUNITY_SUPABASE.viewsTable}?venue_id=eq.${encodeURIComponent(safeVenueId)}`, {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: { view_count: nextCount, last_viewed_at: now }
            });
        } else {
            await communityRequest(COMMUNITY_SUPABASE.viewsTable, {
                method: 'POST',
                headers: { Prefer: 'return=representation' },
                body: { venue_id: safeVenueId, view_count: 1, last_viewed_at: now }
            });
        }

        const previous = getCommunityStats(safeVenueId);
        communityVenueStats.set(safeVenueId, { ...previous, viewCount: nextCount });
        refreshCommunityStatsMarkup();
    } catch (error) {
        // Public views are a best-effort enhancement. A policy issue must never interrupt the venue screen.
        console.warn('Community venue view could not be recorded.', error);
    }
}

window.openCommunityRatingModal = openCommunityRatingModal;
window.submitCommunityRating = submitCommunityRating;
window.closeCommunityRatingModal = closeCommunityRatingModal;

function getTagColorClass(tag) {
    const red = ['Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear', 'Smoking Area', 'Fetish/Gear'];
    const blue = ['Bar', 'Party', 'Cinema', 'Sauna', 'Shop', 'Dancefloor', 'Cocktails', 'Techno', 'Pop/Dance'];
    const yellow = ['Bear', 'Mature', 'Young Crowd', 'Queer', 'Pride', 'Social', 'Drag', 'Karaoke'];
    if (red.includes(tag)) return 'tag-adult-red';
    if (blue.includes(tag)) return 'tag-venue-blue';
    if (yellow.includes(tag)) return 'tag-social-yellow';
    return 'tag-venue-blue';
}

function getVenueTags(venue) {
    if (!venue || !venue.Vibe_Tags) return [];
    const seen = new Set();
    return String(venue.Vibe_Tags)
        .split(',')
        .map(t => t.trim())
        .filter(t => {
            if (!t || seen.has(t)) return false;
            seen.add(t);
            return MASTER_VIBE_TAGS.includes(t);
        });
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
        // `!!text!!` is the current guide syntax. `||text||` is also accepted so
        // descriptions entered with the earlier wording still render correctly.
        .replace(/!!([\s\S]*?)!!/g, '<strong>$1</strong>')
        .replace(/\|\|([\s\S]*?)\|\|/g, '<strong>$1</strong>');

    const ticketFormatted = escaped.replace(/(^|\s)Tickets:/gi, (match, prefix) => {
        const startsLine = !prefix || /^\s*$/.test(prefix) && escaped.indexOf(match) === 0;
        return `${startsLine ? '' : '<br>'}<span class="tickets-inline-label">🎟️ Tickets:</span>`;
    });

    return ticketFormatted.replace(/(https?:\/\/[^\s<]+)/gi, candidate => {
        const trailingMatch = candidate.match(/[.,;:!?]+$/);
        const trailing = trailingMatch ? trailingMatch[0] : '';
        const url = candidate.slice(0, candidate.length - trailing.length);
        return `<a class="auto-link" href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">${url}</a>${trailing}`;
    });
}

// Hyphenated party names such as "2-4-1" should wrap as one unit, not at each hyphen.
function formatEventTitleForDisplay(value) {
    const protectedTitle = String(value || 'Event')
        .split(/(\s+)/)
        .map(part => /^\s+$/.test(part) ? part : part.replace(/-/g, '\u2011'))
        .join('');
    return escapeHTML(protectedTitle);
}

function buildEventDateBadge(event, extraClass = '') {
    const badgeData = getBadgeDateParts(getEventDisplayDate(event));
    return `
        <div class="event-date-badge ${extraClass}" aria-label="${escapeHTML(getEventDisplayDate(event))}">
            <span class="event-day">${escapeHTML(badgeData.d)}</span>
            <span class="event-month">${escapeHTML(badgeData.m)}</span>
            <span class="event-year">${escapeHTML(badgeData.y)}</span>
        </div>
    `;
}

function getEventTags(event, venue = null) {
    const seen = new Set();
    return [event?.Vibe_Tags, venue?.Vibe_Tags]
        .filter(Boolean)
        .flatMap(value => String(value).split(','))
        .map(tag => tag.trim())
        .filter(tag => {
            if (!tag || seen.has(tag) || !MASTER_VIBE_TAGS.includes(tag)) return false;
            seen.add(tag);
            return true;
        });
}

function getCityTokens(venue) {
    return String(venue?.City || '')
        .split(',')
        .map(city => city.trim())
        .filter(Boolean);
}

// Saved locations must match city fields directly, rather than relying on the loose text search.
// This also accepts normal German/English spellings for the cities currently supported by Backroom.
// German-city lookup for location comparisons only. It lets GPS/native spellings,
// English spellings and common ue/oe/ae spellings resolve to the same city key.
// Keep display labels and saved values untouched; this is intentionally a low-risk matcher.
const CITY_NAME_ALIASES = {
    // English / German exonyms
    koln: 'cologne',
    koeln: 'cologne',
    cologne: 'cologne',
    munchen: 'munich',
    muenchen: 'munich',
    munich: 'munich',
    nurnberg: 'nuremberg',
    nuernberg: 'nuremberg',
    nuremberg: 'nuremberg',
    hannover: 'hanover',
    hanover: 'hanover',

    // Umlaut and common keyboard spellings used by GPS, maps and manual entry.
    dusseldorf: 'dusseldorf',
    duesseldorf: 'dusseldorf',
    monchengladbach: 'monchengladbach',
    moenchengladbach: 'monchengladbach',
    munster: 'munster',
    muenster: 'munster',
    osnabruck: 'osnabruck',
    osnabrueck: 'osnabruck',
    saarbrucken: 'saarbrucken',
    saarbruecken: 'saarbrucken',
    lubeck: 'lubeck',
    luebeck: 'lubeck',
    gottingen: 'gottingen',
    goettingen: 'gottingen',
    wurzburg: 'wurzburg',
    wuerzburg: 'wurzburg',
    tubingen: 'tubingen',
    tuebingen: 'tubingen',
    furth: 'furth',
    fuerth: 'furth',
    schwaebischhall: 'schwaebischhall',
    schwabischhall: 'schwabischhall',
    badenbaden: 'badenbaden',

    // Common German formatting variants.
    frankfurtammain: 'frankfurt',
    frankfurtmain: 'frankfurt',
    frankfurt: 'frankfurt',
    freiburgimbreisgau: 'freiburg',
    freiburg: 'freiburg',
    hallesaale: 'hallesale',
    hallesaale: 'hallesale',
    hallesale: 'hallesale'
};

function normalizeLocationName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeCityName(value) {
    const normalized = normalizeLocationName(value);
    return CITY_NAME_ALIASES[normalized] || normalized;
}

function normalizeCountryName(value) {
    return normalizeLocationName(value);
}

function getSavedLocation() {
    try {
        const raw = localStorage.getItem('br_location');
        if (!raw) return null;
        const location = JSON.parse(raw);
        return location && typeof location === 'object' ? location : null;
    } catch (error) {
        console.warn('Saved location could not be read.', error);
        return null;
    }
}

function isAllCitiesLocation(location) {
    if (!location || typeof location !== 'object') return false;
    if (String(location.scope || '').trim().toLowerCase() === 'all') return true;

    // Backward compatibility: an older saved location with no values also means the all-cities view.
    return !String(location.city || '').trim()
        && !String(location.country || '').trim()
        && !String(location.postcode || '').trim();
}

function getLocationInput() {
    return document.getElementById('loc-location');
}

function getLocationDisplayText(location) {
    const scope = getSavedLocationScope(location);
    if (scope.scope === 'city') return scope.country ? `${scope.city}, ${scope.country}` : scope.city;
    if (scope.scope === 'country') return scope.country;
    return '';
}

function getLocationDirectory() {
    const countries = new Map();
    const cities = new Map();

    const addRecord = record => {
        const country = String(record?.Country || '').trim();
        const countryKey = normalizeCountryName(country);
        if (country && countryKey && !countries.has(countryKey)) countries.set(countryKey, country);

        getCityTokens(record).forEach(city => {
            const cityKey = normalizeCityName(city);
            if (!cityKey) return;

            const entries = cities.get(cityKey) || [];
            if (!entries.some(entry =>
                normalizeCityName(entry.city) === cityKey
                && normalizeCountryName(entry.country) === countryKey
            )) {
                entries.push({ city, country });
            }
            cities.set(cityKey, entries);
        });
    };

    (venues || []).forEach(addRecord);
    (events || []).forEach(addRecord);
    return { countries, cities };
}

function getMapResolvedLocation(value = getLocationInput()?.value || '') {
    const input = getLocationInput();
    if (!input) return null;

    const requested = normalizeLocationName(value);
    const resolvedFor = String(input.dataset.mapResolvedFor || '').trim();
    const city = String(input.dataset.mapResolvedCity || '').trim();
    const country = String(input.dataset.mapResolvedCountry || '').trim();

    if (!requested || !city || !country || requested !== resolvedFor) return null;
    return { city, country };
}

function clearMapResolvedLocation(input = getLocationInput()) {
    if (!input) return;
    delete input.dataset.mapResolvedFor;
    delete input.dataset.mapResolvedCity;
    delete input.dataset.mapResolvedCountry;
}

function rememberMapResolvedLocation(input, sourceQuery, result) {
    if (!input || !result || typeof result !== 'object') return null;

    const address = result.address || {};
    const city = String(
        address.city
        || address.town
        || address.village
        || address.municipality
        || address.county
        || ''
    ).trim();
    const country = String(address.country || '').trim();

    if (!city || !country) {
        clearMapResolvedLocation(input);
        return null;
    }

    input.dataset.mapResolvedFor = normalizeLocationName(sourceQuery);
    input.dataset.mapResolvedCity = city;
    input.dataset.mapResolvedCountry = country;
    input.dataset.lat = String(result.lat || '');
    input.dataset.lon = String(result.lon || '');

    // A successful map choice makes an ambiguous city explicit for both the user
    // and the subsequent save action.
    input.value = `${city}, ${country}`;
    input.dataset.mapResolvedFor = normalizeLocationName(input.value);

    return { city, country };
}

function resolveLocationInput(value, mapResolution = getMapResolvedLocation(value)) {
    const raw = String(value || '').trim();
    if (!raw) return { valid: true, scope: 'all', city: '', country: '', label: 'All Cities' };

    const { countries, cities } = getLocationDirectory();
    const parts = raw.split(',').map(part => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
        const cityRequest = parts.slice(0, -1).join(', ');
        const countryRequest = parts.at(-1);
        const canonicalCountry = countries.get(normalizeCountryName(countryRequest));
        const candidates = cities.get(normalizeCityName(cityRequest)) || [];
        const match = candidates.find(candidate =>
            normalizeCountryName(candidate.country) === normalizeCountryName(canonicalCountry)
        );

        if (match) {
            return {
                valid: true,
                scope: 'city',
                city: match.city,
                country: match.country,
                label: `${match.city}, ${match.country}`
            };
        }

        return { valid: false, message: 'Use a recognised City, Country pair from the directory.' };
    }

    const cityMatches = cities.get(normalizeCityName(raw)) || [];
    if (cityMatches.length === 1) {
        const match = cityMatches[0];
        return {
            valid: true,
            scope: 'city',
            city: match.city,
            country: match.country,
            label: `${match.city}, ${match.country}`
        };
    }

    if (cityMatches.length > 1) {
        const resolvedCountry = normalizeCountryName(mapResolution?.country || '');
        const mapMatch = resolvedCountry
            ? cityMatches.find(candidate => normalizeCountryName(candidate.country) === resolvedCountry)
            : null;

        if (mapMatch) {
            return {
                valid: true,
                scope: 'city',
                city: mapMatch.city,
                country: mapMatch.country,
                label: `${mapMatch.city}, ${mapMatch.country}`
            };
        }

        return { valid: false, message: `More than one ${raw} is listed. Enter City, Country.` };
    }

    const country = countries.get(normalizeCountryName(raw));
    if (country) return { valid: true, scope: 'country', city: '', country, label: country };

    return { valid: false, message: 'Choose a city or country that is already in the directory.' };
}

function getLocationResultsLabel(value = getLocationInput()?.value || '') {
    const resolved = resolveLocationInput(value);
    return resolved.valid ? resolved.label : (String(value || '').trim() || 'All Cities');
}

function updateLocationActionLabel(value = getLocationInput()?.value || '') {
    const button = document.getElementById('btn-save-location');
    if (!button) return;

    const raw = String(value || '').trim();
    const resolved = resolveLocationInput(raw);
    button.textContent = !raw
        ? 'Show Results in All Cities'
        : resolved.valid
            ? `Show Results in ${resolved.label}`
            : 'Show Results';
}

function locationsMatch(left, right) {
    const leftScope = getSavedLocationScope(left);
    const rightScope = getSavedLocationScope(right);

    return leftScope.scope === rightScope.scope
        && normalizeCityName(leftScope.city) === normalizeCityName(rightScope.city)
        && normalizeCountryName(leftScope.country) === normalizeCountryName(rightScope.country);
}

function updateLocationDraftStatus(value = getLocationInput()?.value || '') {
    const display = document.getElementById('current-location-display');
    if (!display) return;

    const raw = String(value || '').trim();
    const saved = getSavedLocation();
    const resolved = resolveLocationInput(raw);

    if (!raw) {
        updateLocationDisplay(saved);
        return;
    }

    if (!resolved.valid) {
        display.textContent = resolved.message || 'Choose a recognised city or country.';
        return;
    }

    const candidate = {
        scope: resolved.scope,
        city: resolved.city,
        country: resolved.country,
        postcode: String(saved?.postcode || '').trim()
    };

    if (locationsMatch(candidate, saved)) {
        updateLocationDisplay(saved);
        return;
    }

    display.textContent = `Selected: ${resolved.label} — press Show Results to apply.`;
}

function announceLocationChange(location) {
    window.dispatchEvent(new CustomEvent('backroom:location-changed', { detail: location || { scope: 'all', city: '', country: '', postcode: '' } }));
}

function openLocationModal() {
    const sharedScope = getSharedResultsRouteScope();

    if (sharedScope) {
        const locationInput = getLocationInput();
        const postcodeInput = document.getElementById('loc-postcode');
        const map = document.getElementById('loc-map');
        const mapPlaceholder = document.getElementById('map-preview-placeholder');
        const display = document.getElementById('current-location-display');

        if (locationInput) {
            locationInput.value = getLocationDisplayText(sharedScope);
            locationInput.dataset.lat = '';
            locationInput.dataset.lon = '';
            clearMapResolvedLocation(locationInput);
        }
        if (postcodeInput) postcodeInput.value = '';
        if (map) map.style.display = 'none';
        mapPlaceholder?.classList.remove('hidden');

        updateLocationActionLabel(locationInput?.value || '');
        if (display) {
            display.textContent = `Viewing shared results in ${sharedScope.label}. Save to use this location on this device.`;
        }
    } else {
        loadSavedLocation();
        updateLocationActionLabel();
    }

    locModal?.classList.remove('hidden');

    // Leaflet needs a size refresh when a previously hidden map is shown again.
    window.requestAnimationFrame(() => leafletMap?.invalidateSize?.());
}

function isMultiCityVenue(venue) {
    return getCityTokens(venue).length > 1;
}

function formatVenueLocation(venue) {
    const cityText = getCityTokens(venue).join(', ');
    const countryText = String(venue?.Country || '').trim();
    if (cityText && countryText) return `${cityText} · ${countryText}`;
    return cityText || countryText || '';
}

function formatEventLocation(event, venue) {
    return formatVenueLocation({
        City: venue?.City || event?.City || '',
        Country: venue?.Country || event?.Country || ''
    });
}

function venueMatchesCity(venue, cityName) {
    const target = normalizeCityName(cityName);
    if (!target) return true;
    return getCityTokens(venue).some(city => normalizeCityName(city) === target);
}

function venueMatchesCountry(venue, countryName) {
    const target = normalizeCountryName(countryName);
    if (!target) return true;
    return normalizeCountryName(venue?.Country) === target;
}

function getKnownCountryName(value, source = venues) {
    const target = normalizeCountryName(value);
    if (!target) return '';

    const match = (source || []).find(item => normalizeCountryName(item?.Country) === target);
    return match ? String(match.Country || '').trim() : '';
}

function hasKnownCityName(value, source = venues) {
    const target = normalizeCityName(value);
    if (!target) return false;
    return (source || []).some(venue => getCityTokens(venue).some(city => normalizeCityName(city) === target));
}

function getSavedLocationScope(location = getSavedLocation()) {
    if (!location || isAllCitiesLocation(location)) {
        return { scope: 'all', city: '', country: '', label: '' };
    }

    const city = String(location.city || '').trim();
    const country = String(location.country || '').trim();

    if (city && city.toLowerCase() !== 'my location') {
        return { scope: 'city', city, country, label: country ? `${city}, ${country}` : city };
    }

    if (country) {
        return { scope: 'country', city: '', country, label: country };
    }

    return { scope: 'all', city: '', country: '', label: '' };
}

// Shared Results links are route-only. They deliberately do not write to br_location,
// so opening somebody else's city, query or filter view never replaces saved profile state.
function isResultsRouteHash(hash = window.location.hash || '') {
    return hash === '#results' || hash.startsWith('#results?');
}

function getSharedResultsRouteState(hash = window.location.hash || '') {
    if (!String(hash || '').startsWith('#results?')) return null;

    const params = new URLSearchParams(String(hash).slice('#results?'.length));
    const city = String(params.get('city') || '').trim();
    const country = String(params.get('country') || '').trim();
    const query = String(params.get('q') || '').trim().slice(0, 160);
    const rawType = normalizeLocationName(params.get('type'));
    const type = ['venue', 'venues'].includes(rawType)
        ? 'Venue'
        : ['event', 'events'].includes(rawType)
            ? 'Event'
            : 'All';
    const tags = [...new Set(String(params.get('tags') || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => MASTER_VIBE_TAGS.includes(tag)))];
    const fuzzy = params.get('fuzzy') === '1';

    let scope = { scope: 'all', city: '', country: '', label: '' };
    if (country || city) {
        // A city without its country is intentionally treated as All Cities rather than
        // guessing between duplicate city names.
        const source = city && country ? `${city}, ${country}` : (!city ? country : '');
        const resolved = source ? resolveLocationInput(source) : null;
        if (resolved?.valid && resolved.scope !== 'all') {
            scope = {
                scope: resolved.scope,
                city: resolved.city,
                country: resolved.country,
                label: resolved.label
            };
        }
    }

    const hasSharedState = Boolean(city || country || query || type !== 'All' || tags.length || fuzzy);
    if (!hasSharedState) return null;

    return { scope, query, type, tags, fuzzy, shared: true };
}

function getSharedResultsRouteScope(hash = window.location.hash || '') {
    const routeState = getSharedResultsRouteState(hash);
    return routeState?.scope?.scope && routeState.scope.scope !== 'all'
        ? routeState.scope
        : null;
}

function getResultsSearchScope() {
    return getSharedResultsRouteState()?.scope || getSavedLocationScope();
}

function getResultsShareUrl(scope = getResultsSearchScope()) {
    const params = new URLSearchParams();
    const query = String(searchInput?.value || '').trim();

    if (scope?.scope === 'city') params.set('city', scope.city);
    if (scope?.country) params.set('country', scope.country);
    if (query) params.set('q', query);
    if (searchResultTypeFilter !== 'All') params.set('type', searchResultTypeFilter.toLowerCase());
    if (activeFilters.length) params.set('tags', activeFilters.join(','));
    if (query && searchUsesFuzzyMatching) params.set('fuzzy', '1');

    const encoded = params.toString();
    return encoded
        ? `${window.location.origin}${window.location.pathname}#results?${encoded}`
        : '';
}

function shareResultsForCurrentView(scope = getResultsSearchScope()) {
    const url = getResultsShareUrl(scope);
    if (!url) {
        showToast('Add a location, search or filter before sharing results.');
        return;
    }

    const query = String(searchInput?.value || '').trim();
    const subject = query
        ? `Backroom Results: ${query}`
        : scope?.label
            ? `Backroom Results: ${scope.label}`
            : 'Backroom Results';
    shareURL(url, subject);
}

function venueMatchesSavedLocation(venue, savedScope = getSavedLocationScope()) {
    if (savedScope.scope === 'country') {
        return venueMatchesCountry(venue, savedScope.country);
    }

    if (savedScope.scope === 'city') {
        const cityMatches = venueMatchesCity(venue, savedScope.city);
        const countryMatches = !savedScope.country || venueMatchesCountry(venue, savedScope.country);
        return cityMatches && countryMatches;
    }

    return true;
}

function hasFixedCoordinates(venue) {
    if (isMultiCityVenue(venue)) return false;
    const lat = parseFloat(venue?.Latitude);
    const lon = parseFloat(venue?.Longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon);
}

function renderTagPills(tags, extraStyle = '') {
    return (tags || []).map(tag => `<span class="chip pill-btn ${getTagColorClass(tag)}" title="${tag}" style="font-size:0.85rem; padding: 4px 10px; ${extraStyle}">${tag}</span>`).join('');
}


function normalizeFeaturedLevel(venue) {
    return String(venue?.Priority || '').trim();
}

function getVenueSearchText(venue) {
    const cityTokens = getCityTokens(venue).join(' ');
    return [
        venue?.Name,
        venue?.Description,
        venue?.Opening_Notes,
        venue?.Vibe_Tags,
        venue?.City,
        cityTokens,
        venue?.Country,
        venue?.Address,
        venue?.Postcode,
        venue?.Nearest_Station,
        venue?.Native_Map_Query,
        venue?.Website_URL,
        venue?.Instagram_URL,
        venue?.Facebook_URL,
        venue?.Other_URL,
        venue?.Source_URLs
    ].filter(Boolean).join(' ');
}

function getPublicVenues(source = venues) {
    return (source || []).filter(v => {
        const status = String(v?.Status || '').trim();
        return status !== 'Hold' && status !== 'Flag';
    });
}

// Search Results follows a shared city/country link when present; otherwise it follows
// the recipient's saved city or country. All Cities remains unfiltered.
function getSavedSearchScope() {
    return getSavedLocationScope();
}

function getSearchScopeVenues(scope = getResultsSearchScope()) {
    const publicVenues = getPublicVenues();
    return scope.scope === 'all'
        ? publicVenues
        : publicVenues.filter(venue => venueMatchesSavedLocation(venue, scope));
}

function getSearchScopeEvents(now = new Date(), scope = getResultsSearchScope()) {
    const publicVenueById = new Map(getPublicVenues().map(venue => [venue.Venue_ID, venue]));

    return (events || [])
        .filter(isSearchableEvent)
        .map(event => {
            const venue = publicVenueById.get(event?.Venue_ID) || null;
            const locationRecord = {
                City: venue?.City || event?.City || '',
                Country: venue?.Country || event?.Country || ''
            };

            // Events can still be useful where a venue was removed, held or is incomplete.
            // Their own City/Country fields are the location fallback.
            if (!venueMatchesSavedLocation(locationRecord, scope)) return null;

            const occurrence = getEventDisplayOccurrence(event, now);
            if (!occurrence || occurrence.Is_Past) return null;
            return { event: occurrence, venue };
        })
        .filter(Boolean)
        .sort((a, b) => compareEventOccurrences(a.event, b.event));
}

function getEventSearchText(event, venue) {
    return [
        event?.Event_Name,
        event?.Event_Description,
        event?.Dresscode_Info,
        event?.Vibe_Tags,
        event?.Price_Info,
        event?.Ticket_URL,
        venue?.Name,
        venue?.City || event?.City,
        venue?.Country || event?.Country,
        venue?.Address || event?.Address
    ].filter(Boolean).join(' ');
}

function eventMatchesActiveTags(event, venue) {
    if (!activeFilters.length) return true;
    const tags = getEventTags(event, venue);
    return activeFilters.every(filterTag => tags.includes(filterTag));
}

function isSearchableEvent(event) {
    const status = String(event?.Status || '').trim().toLowerCase();
    return !['hold', 'flag', 'closed', 'cancelled', 'canceled'].includes(status);
}

function getVenueEventSearchText(venueId) {
    return (events || [])
        .filter(event => event?.Venue_ID === venueId && isSearchableEvent(event))
        .map(event => [
            event?.Event_Name,
            event?.Event_Description,
            event?.Dresscode_Info,
            event?.Vibe_Tags,
            event?.Price_Info
        ].filter(Boolean).join(' '))
        .join(' ');
}

function getVenueAndEventSearchText(venue) {
    return `${getVenueSearchText(venue)} ${getVenueEventSearchText(venue?.Venue_ID)}`;
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/ß/g, 'ss');
}

function directSearchMatch(text, query) {
    const haystack = normalizeSearchText(text);
    const requested = normalizeSearchText(query).trim();
    if (!requested) return true;
    if (haystack.includes(requested)) return true;

    // Normal search accepts multiple exact words in any order, but does not guess spellings.
    const requestedWords = requested.split(/[^a-z0-9]+/).filter(Boolean);
    return requestedWords.length > 0 && requestedWords.every(word => haystack.includes(word));
}

function getCardStatusLabel(venue) {
    const status = String(venue?.Status || '').trim();
    if (status === 'Closed') return 'CLOSED';
    if (activeFilters && activeFilters.length > 0) return activeFilters.slice(0, 3).join(' / ');
    return 'ALL';
}

function getCardStatusClass(venue) {
    const status = String(venue?.Status || '').trim().toLowerCase();
    if (status === 'closed') return 'closed';
    return 'all';
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    container.classList.remove('hidden');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function formatDateToDDMMYYYY(ymdDate) {
    if(!ymdDate) return '';
    const parts = ymdDate.split('-');
    if(parts.length !== 3) return ymdDate;
    return `${parts[2]}-${parts[1]}-${parts[0]}`; 
}

function getBadgeDateParts(ymdDate) {
    if(!ymdDate) return { d:'', m:'', y:'' };
    const parts = ymdDate.split('-');
    if(parts.length !== 3) return { d:'', m:'', y:'' };
    const monthIndex = Number(parts[1]) - 1;
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return {
        d: parts[2],
        m: monthNames[monthIndex] || parts[1],
        y: parts[0]
    };
}

// --- Weekly event recurrence: one JSON record, dynamically dated on the public site ---
const WEEKDAY_INDEX = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6
};
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseEventDateLocal(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if(date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function formatEventDateYmd(date) {
    if(!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStartOfEventDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function getEventStartMinutes(timeValue) {
    const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!match) return null;
    const hours = Number(match[1]), minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : null;
}

function isWeeklyRecurringEvent(event) {
    return String(event?.Recurrence_Type || '').trim().toLowerCase() === 'weekly';
}

function getWeeklyDayIndex(event) {
    const key = String(event?.Recurrence_Day || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, key) ? WEEKDAY_INDEX[key] : null;
}

function getWeeklyRecurrenceLabel(event) {
    const weekday = getWeeklyDayIndex(event);
    return weekday === null ? 'Every week' : `Every ${WEEKDAY_LABELS[weekday]}`;
}

function getNextWeeklyOccurrenceDate(event, now = new Date()) {
    const weekday = getWeeklyDayIndex(event);
    if(!isWeeklyRecurringEvent(event) || weekday === null) return null;

    const today = getStartOfEventDay(now);
    const firstDate = parseEventDateLocal(event.Event_Date);
    const untilDate = parseEventDateLocal(event.Recurrence_Until);
    const earliest = firstDate && firstDate > today ? firstDate : today;
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + ((weekday - candidate.getDay() + 7) % 7));

    if(candidate.getTime() === today.getTime()) {
        const startMinutes = getEventStartMinutes(event.Event_Start_Time);
        if(startMinutes !== null) {
            const start = new Date(candidate);
            start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            if(now > start) candidate.setDate(candidate.getDate() + 7);
        }
    }
    while(firstDate && candidate < firstDate) candidate.setDate(candidate.getDate() + 7);
    return untilDate && candidate > untilDate ? null : candidate;
}

function getEventDisplayOccurrence(event, now = new Date()) {
    if(!event) return null;
    if(isWeeklyRecurringEvent(event)) {
        const nextDate = getNextWeeklyOccurrenceDate(event, now);
        if(!nextDate) return null;
        return { ...event, Display_Date: formatEventDateYmd(nextDate), Is_Recurring: true, Recurrence_Label: getWeeklyRecurrenceLabel(event), Is_Past: false };
    }
    const displayDate = String(event.Event_Date || '').trim();
    const eventDate = parseEventDateLocal(displayDate);
    return { ...event, Display_Date: displayDate, Is_Recurring: false, Recurrence_Label: '', Is_Past: Boolean(eventDate && eventDate < getStartOfEventDay(now)) };
}

function getEventDisplayDate(event) {
    return event?.Display_Date || event?.Event_Date || '';
}

function getEventDisplayMeta(event) {
    const pieces = [];
    const date = getEventDisplayDate(event);
    if(date) pieces.push(formatDateToDDMMYYYY(date));
    if(event?.Event_Start_Time) pieces.push(event.Event_Start_Time);
    if(event?.Is_Recurring && event.Recurrence_Label) pieces.push(event.Recurrence_Label);
    return pieces.join(' | ');
}

function compareEventOccurrences(a, b) {
    if(Boolean(a?.Is_Past) !== Boolean(b?.Is_Past)) return a.Is_Past ? 1 : -1;
    const dateA = parseEventDateLocal(getEventDisplayDate(a)) || new Date(8640000000000000);
    const dateB = parseEventDateLocal(getEventDisplayDate(b)) || new Date(8640000000000000);
    if(dateA.getTime() !== dateB.getTime()) return dateA - dateB;
    const timeA = getEventStartMinutes(a?.Event_Start_Time), timeB = getEventStartMinutes(b?.Event_Start_Time);
    if(timeA !== timeB) return (timeA ?? 1440) - (timeB ?? 1440);
    return String(a?.Event_Name || '').localeCompare(String(b?.Event_Name || ''));
}

function getVenueEventOccurrences(venueId, options = {}) {
    const { includePast = true, activeOnly = false, now = new Date() } = options;
    return (events || [])
        .filter(event => event?.Venue_ID === venueId)
        .filter(event => !activeOnly || !['Hold', 'Flag'].includes(String(event?.Status || '').trim()))
        .map(event => getEventDisplayOccurrence(event, now))
        .filter(Boolean)
        .filter(event => includePast || !event.Is_Past)
        .sort(compareEventOccurrences);
}


function normalizeShortlistEntry(entry) {
    if (entry && typeof entry === 'object') {
        const type = String(entry.type || entry.kind || 'venue').trim().toLowerCase() === 'event' ? 'event' : 'venue';
        const id = String(entry.id || entry.Event_ID || entry.Venue_ID || '').trim();
        return id ? { type, id } : null;
    }

    const raw = String(entry || '').trim();
    if (!raw) return null;
    if (raw.startsWith('event:')) return { type: 'event', id: raw.slice(6) };
    if (raw.startsWith('venue:')) return { type: 'venue', id: raw.slice(6) };

    // Existing saved lists used bare Venue_ID values. Keep those working as venue entries.
    return { type: 'venue', id: raw };
}

function getShortlistEntries(name) {
    const rawEntries = Array.isArray(userShortlists?.[name]) ? userShortlists[name] : [];
    const seen = new Set();
    return rawEntries
        .map(normalizeShortlistEntry)
        .filter(Boolean)
        .filter(entry => {
            const key = `${entry.type}:${entry.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function shortlistToken(type, id) {
    return `${type === 'event' ? 'event' : 'venue'}:${String(id || '').trim()}`;
}

function shortlistHasItem(name, type, id) {
    return getShortlistEntries(name).some(entry => entry.type === type && entry.id === id);
}

function hasItemInAnyShortlist(type, id) {
    return Object.keys(userShortlists || {}).some(name => shortlistHasItem(name, type, id));
}

function setShortlistItem(name, target, shouldContain) {
    const entries = getShortlistEntries(name);
    const exists = entries.some(entry => entry.type === target.type && entry.id === target.id);
    const next = shouldContain
        ? (exists ? entries : [...entries, { type: target.type, id: target.id }])
        : entries.filter(entry => entry.type !== target.type || entry.id !== target.id);
    userShortlists[name] = next.map(entry => shortlistToken(entry.type, entry.id));
}

function getShortlistCounts(name) {
    const entries = getShortlistEntries(name);
    return {
        venues: entries.filter(entry => entry.type === 'venue').length,
        events: entries.filter(entry => entry.type === 'event').length,
        total: entries.length
    };
}

function formatShortlistCount(name) {
    const counts = getShortlistCounts(name);
    const parts = [];
    if (counts.venues) parts.push(`${counts.venues} venue${counts.venues === 1 ? '' : 's'}`);
    if (counts.events) parts.push(`${counts.events} event${counts.events === 1 ? '' : 's'}`);
    return parts.join(' · ') || 'Empty shortlist';
}

function getShortlistTargetForEvent(event) {
    const venue = (venues || []).find(item => item.Venue_ID === event?.Venue_ID);
    const venueName = venue?.Name ? ` · ${venue.Name}` : '';
    return {
        type: 'event',
        id: String(event?.Event_ID || '').trim(),
        label: `Event: ${event?.Event_Name || 'Event'}${venueName}`
    };
}

function openShortlistPicker(target) {
    if (!target?.id) return;
    currentShortlistTarget = target;
    currentTargetVenue = target.type === 'venue' ? target : null;

    const tName = document.getElementById('add-shortlist-target-name');
    if (tName) tName.innerText = target.label || target.id;

    const container = document.getElementById('add-shortlist-options');
    if (!container) return;
    container.innerHTML = '';

    const lists = Object.keys(userShortlists || {});
    if (lists.length === 0) {
        container.innerHTML = '<p class="meta-text">No shortlists exist. Create one below.</p>';
    } else {
        lists.forEach(name => {
            const isAdded = shortlistHasItem(name, target.type, target.id);
            const button = document.createElement('button');
            button.className = `btn pill-btn ${isAdded ? 'secondary-btn' : 'primary-btn'}`;
            button.innerText = isAdded ? `Remove from ${name}` : `Add to ${name}`;
            button.addEventListener('click', () => {
                setShortlistItem(name, target, !isAdded);
                saveCurrentToBundle();
                addShortlistModal?.classList.add('hidden');
                showToast(isAdded ? 'Removed from Shortlist' : `Added to ${name}`);

                if (target.type === 'venue') {
                    const buttonEl = document.getElementById('modal-shortlist');
                    if (buttonEl) buttonEl.classList.toggle('active-star', hasItemInAnyShortlist('venue', target.id));

                    document.querySelectorAll('.shortlist-card-btn[data-venue-id]').forEach(cardButton => {
                        if (String(cardButton.dataset.venueId || '') === String(target.id)) {
                            cardButton.classList.toggle('active-shortlist', hasItemInAnyShortlist('venue', target.id));
                        }
                    });
                }
            });
            container.appendChild(button);
        });
    }

    addShortlistModal?.classList.remove('hidden');
}

function promptAddToShortlist(venue) {
    openShortlistPicker({
        type: 'venue',
        id: String(venue?.Venue_ID || '').trim(),
        label: venue?.Name || 'Venue'
    });
}

window.promptAddVenueToShortlist = function(venueId) {
    const venue = (venues || []).find(item => String(item.Venue_ID || '') === String(venueId || ''));
    if (!venue) {
        showToast('Venue not available');
        return;
    }
    promptAddToShortlist(venue);
};

window.promptAddEventToShortlist = function(eventId) {
    const event = (events || []).find(item => item.Event_ID === eventId);
    if (!event) {
        showToast('Event not available');
        return;
    }
    openShortlistPicker(getShortlistTargetForEvent(event));
};

function recordUserInteraction() {
    sessionStorage.setItem('br_welcome_dismissed', 'true');
    welcomeScreen?.classList.add('hidden');
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    var R = 6371; var dLat = (lat2-lat1) * (Math.PI/180); var dLon = (lon2-lon1) * (Math.PI/180); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

function getPlainDescriptionText(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/={5,}/g, ' ')
        .replace(/------/g, ' ')
        .replace(/(^|[^=])==(?!=)/g, '$1 ')
        .replace(/(?:\*{5}|\+{5})\s*/g, '')
        .replace(/!!([\s\S]*?)!!/g, '$1')
        .replace(/\|\|([\s\S]*?)\|\|/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatAboutText(text) {
    if (!text) return '';

    // The admin guide uses `==` for a line break and `=====` for a divider.
    // Treat markers as their own lines before processing so a five-equals divider
    // is never split into fragments by the two-equals line-break marker.
    const normalized = String(text)
        .replace(/\r\n?/g, '\n')
        .replace(/={5,}/g, '\n=====\n')
        .replace(/------/g, '\n------\n')
        .replace(/(^|[^=])==(?!=)/g, '$1\n');

    const lines = normalized.split('\n');
    const out = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            out.push('</ul>');
            inList = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            closeList();
            continue;
        }

        if (line === '=====') {
            closeList();
            out.push('<hr style="border:0; height:1px; background:var(--bright-red-orange); margin:15px 0;">');
            continue;
        }

        if (line === '------') {
            closeList();
            continue;
        }

        // `***** Title` is the documented heading marker. `+++++ Title` is also
        // supported for descriptions entered before the guide was corrected.
        const headingMatch = line.match(/^(?:\*{5}|\+{5})\s*(.+)$/);
        if (headingMatch) {
            closeList();
            out.push(`<h4 style="color:var(--primary-blue); font-family:'Antonio', sans-serif; text-transform:uppercase; margin:15px 0 7px;">${linkifyText(headingMatch[1])}</h4>`);
            continue;
        }

        const bulletMatch = line.match(/^--\s+(.+)$/);
        if (bulletMatch) {
            if (!inList) {
                out.push('<ul style="margin:4px 0 10px 22px; padding:0; color:#fff;">');
                inList = true;
            }
            out.push(`<li style="margin-bottom:4px;">${linkifyText(bulletMatch[1])}</li>`);
            continue;
        }

        closeList();
        out.push(`<div style="margin:0 0 7px;">${linkifyText(line)}</div>`);
    }

    closeList();
    return out.join('\n');
}

function buildSocialBar(venue) {
    let html = '<div class="social-bar" style="display:flex; gap:16px; margin-top:10px; align-items:center;">';
    const buildIcon = (url, iconName, platformName) => {
        const hasUrl = url && url.trim() !== '';
        const opacity = hasUrl ? '1' : '0.6';
        const cursor = hasUrl ? 'pointer' : 'default';
        const clickAction = hasUrl ? `onclick="window.open('${url}', '_blank')"` : '';
        const titleText = hasUrl ? `Open ${platformName}` : `This link is not available`;
        return `<img src="Emoji/${iconName}" title="${titleText}" style="width:24px; height:24px; opacity:${opacity}; cursor:${cursor}; transition: opacity 0.2s;" ${clickAction} alt="${iconName}">`;
    };
    html += buildIcon(venue.Instagram_URL, 'instagram_url.png', 'Instagram');
    html += buildIcon(venue.Facebook_URL, 'facebook_url.png', 'Facebook');
    html += buildIcon(venue.Website_URL, 'website_url.png', 'Website');
    html += buildIcon(venue.Emoji_Override, 'xicon.png', 'X (Twitter)'); 
    html += buildIcon(venue.Other_URL, 'link.png', 'Link');
    html += '</div>';
    return html;
}

function loadActiveProfileData() {
    if (userProfile.name && savedProfiles[userProfile.name]) {
        const bundle = savedProfiles[userProfile.name];
        userFavorites = bundle.favorites || [];
        userShortlists = bundle.shortlists || {};
        userShortlistEmojis = bundle.shortlistEmojis || {};
        userEvents = bundle.events || [];
        userTravel = bundle.travel || [];
    } else {
        userFavorites = JSON.parse(localStorage.getItem('br_favorites')) || [];
        userShortlists = JSON.parse(localStorage.getItem('br_shortlists')) || {};
        userShortlistEmojis = JSON.parse(localStorage.getItem('br_shortlist_emojis')) || {};
        userEvents = JSON.parse(localStorage.getItem('br_events')) || [];
        userTravel = JSON.parse(localStorage.getItem('br_travel')) || [];
    }
}

function saveCurrentToBundle() {
    if (userProfile.name) {
        savedProfiles[userProfile.name] = {
            ...userProfile,
            favorites: userFavorites,
            shortlists: userShortlists,
            shortlistEmojis: userShortlistEmojis,
            events: userEvents,
            travel: userTravel
        };
        localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
    }
    localStorage.setItem('br_favorites', JSON.stringify(userFavorites));
    localStorage.setItem('br_shortlists', JSON.stringify(userShortlists));
    localStorage.setItem('br_shortlist_emojis', JSON.stringify(userShortlistEmojis));
    localStorage.setItem('br_events', JSON.stringify(userEvents));
    localStorage.setItem('br_travel', JSON.stringify(userTravel));
    localStorage.setItem('br_profile', JSON.stringify(userProfile));
}

function setupCriticalListeners() {
    const handleEnter = (e) => {
        if(e.cancelable) e.preventDefault();
        localStorage.setItem('br_age_verified', 'true');
        ageGate?.classList.add('hidden');
        appShell?.classList.remove('hidden');
        
        showToast("Backroom " + APP_VERSION);
        handleRouting(); 
    };
    btnEnter?.addEventListener('click', handleEnter);
    btnEnter?.addEventListener('touchstart', handleEnter, {passive: false});

    if(localStorage.getItem('br_age_verified') === 'true') {
        ageGate?.classList.add('hidden');
        appShell?.classList.remove('hidden');
        showToast("Backroom " + APP_VERSION);
    }

    if(!document.body.dataset.escapeVenueBound) {
        document.body.dataset.escapeVenueBound = 'true';
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape' && venueModal && !venueModal.classList.contains('hidden')) {
                closeVenueModalToPreviousView();
            }
        });
    }
}

async function initApp() {
    loadActiveProfileData(); 
    setupCriticalListeners();
    
    const verDisplay = document.getElementById('sidebar-version-display');
    if(verDisplay) verDisplay.innerHTML = `${APP_VERSION}<br>${APP_DATE}`;
    
    try {
        const fetchJson = async (url) => {
            const cacheBuster = '?v=' + new Date().getTime();
            const res = await fetch(url + cacheBuster);
            if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
            return res.json();
        };

        try { systemInfo = await fetchJson('system_info.json'); } catch(e) { console.warn("Using default system info."); }
        try { designTheme = await fetchJson('design_theme.json'); } catch(e) { console.warn("Using default theme."); }
        try { events = await fetchJson('events.json'); } catch(e) { events = []; }
        try { 
            const avatarRes = await fetch('Profile_images/avatar_list.json?v=' + new Date().getTime());
            if(avatarRes.ok) avatarData = await avatarRes.json();
        } catch(e) { console.warn("Avatar JSON missing"); avatarData = []; }

        try {
            venues = await fetchJson('listings.json');
        } catch (e) {
            throw new Error(`Failed to load listings.json. Error: ${e.message}`);
        }

        updateProfileDisplay(); // Moved here so avatarData is loaded
        void loadCommunityVenueStats();
        checkImportPreview();
        applyTheme(); 
        populateSystemText(); 
        setupEventListeners(); 
       
        loadSavedLocation();
         
        
        if(localStorage.getItem('br_age_verified') === 'true') handleRouting();
        
    } catch (error) {
        console.error("Data load failed:", error);
        const errText = document.getElementById('error-text');
        if(errText) errText.innerText = `SYSTEM ERROR: ${error.message}. Click bypass below to view a dummy UI.`;
        errorPanel?.classList.remove('hidden');
        
        const bypassContainer = document.getElementById('bypass-container');
        if(bypassContainer) {
            bypassContainer.innerHTML = '';
            const bypassBtn = document.createElement('button');
            bypassBtn.innerText = "Continue Without Data (Dummy Mode)";
            bypassBtn.className = "btn secondary-btn pill-btn display-font";
            
            const bypassLogic = (e) => {
                if(e && e.cancelable) e.preventDefault();
                errorPanel?.classList.add('hidden');
                if(!systemInfo.labels) systemInfo = { labels: { rated_by_gays: "Rated by gays" } };
                
                venues = [{ 
                    Venue_ID: "LOCAL-01", 
                    Name: "Dummy GitHub Venue", 
                    City: "Berlin", 
                    Status: "Live", 
                    Description: "If you see this on GitHub, it means listings.json failed to load.",
                    Vibe_Tags: "Dancefloor, Darkroom", 
                    Views: 420,
                    Rating_Age_Range: 3,
                    Rating_Size: 4,
                    Rating_Busyness: 5
                }]; 
                if(!events) events = [];
                
                applyTheme(); populateSystemText(); setupEventListeners(); loadSavedLocation();  
                if(localStorage.getItem('br_age_verified') === 'true') {
                    showToast("Backroom " + APP_VERSION);
                    handleRouting();
                }
            };

            bypassBtn.addEventListener('click', bypassLogic);
            bypassBtn.addEventListener('touchstart', bypassLogic, {passive: false});
            bypassContainer.appendChild(bypassBtn);
        }
    }
}

function applyTheme() {
    if(!designTheme.palette) return;
    const r = document.documentElement, p = designTheme.palette;
    r.style.setProperty('--bg-color', p.black); r.style.setProperty('--primary-blue', p.bright_cyan_blue);
    r.style.setProperty('--near-black', p.near_black_grey); r.style.setProperty('--navy-grey', p.deep_navy_grey);
    r.style.setProperty('--panel-dark', p.dark_panel_grey); r.style.setProperty('--panel-standard', p.standard_panel_grey);
    r.style.setProperty('--panel-mid', p.mid_panel_grey); r.style.setProperty('--label-grey', p.muted_label_grey);
    r.style.setProperty('--text-light', p.light_text_grey); r.style.setProperty('--bright-red-orange', p.bright_red_orange);
}

function populateSystemText() {
    const agText = document.getElementById('ag-text');
    const agDisc = document.getElementById('ag-disclaimer');
    if(agText) agText.innerText = systemInfo.age_gate_text || '';
    if(agDisc) agDisc.innerText = systemInfo.disclaimer_text || '';
}

window.addEventListener('hashchange', handleRouting);


function getCurrentListHashForVenueReturn() {
    const hash = window.location.hash || '#results';
    const listRoutes = ['#results', '#venues', '#featured', '#favorites', '#myshortlists', '#myevents', '#mytravel', '#discounts', '#about', '#cruising-guide'];
    if (hash.startsWith('#results?')) return hash;
    if (listRoutes.includes(hash)) return hash;
    if (hash.startsWith('#shortlist=')) return '#myshortlists';
    return '#results';
}

function closeVenueModalToPreviousView() {
    venueModal?.classList.add('hidden');
    const target = venueReturnHash || '#results';
    if (window.location.hash === target) handleRouting();
    else window.location.hash = target;
}

function getFeaturedSortScore(venue) {
    const general = Number.parseInt(venue?.Rating_General, 10) || 0;
    const popularity = Number.parseInt(venue?.Rating_Busyness || venue?.Rating_Popularity, 10) || 0;
    const darkroom = Number.parseInt(venue?.Rating_Darkroom, 10) || 0;
    const location = Number.parseInt(venue?.Rating_Location, 10) || 0;
    return (general * 1000) + (popularity * 100) + (darkroom * 10) + location;
}

function sortFeaturedVenues(list) {
    return [...(list || [])].sort((a, b) => {
        const scoreDiff = getFeaturedSortScore(b) - getFeaturedSortScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return String(a?.Name || '').localeCompare(String(b?.Name || ''));
    });
}


function closeSidebarImmediately() {
    if (!sidebar) return;
    sidebar.classList.remove('visible', 'sidebar-opening');
    clearTimeout(sidebarTimeout);
}

function openSidebarTemporarily() {
    if (!sidebar) return;
    
    sidebar.classList.add('visible', 'sidebar-opening');
    sidebar.scrollTop = 0;
    window.clearTimeout(sidebar.dataset.openingTimer);
    sidebar.dataset.openingTimer = window.setTimeout(() => sidebar.classList.remove('sidebar-opening'), 340);
    clearTimeout(sidebarTimeout);
    sidebarTimeout = setTimeout(closeSidebarImmediately, 5000);
}

function checkSharedListRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#sharedlist?')) {
        const urlParams = new URLSearchParams(hash.substring(12));
        const listName = urlParams.get('title') || 'Shared List';
        const listEmoji = urlParams.get('emoji') || '🔥';
        const entries = (urlParams.get('ids') || '')
            .split(',')
            .map(normalizeShortlistEntry)
            .filter(Boolean);

        renderSharedListView(listName, listEmoji, entries);
        return true;
    }
    return false;
}

function getShortlistEventOccurrences(entries) {
    const eventIds = (entries || []).filter(entry => entry.type === 'event').map(entry => entry.id);
    return (events || [])
        .filter(event => eventIds.includes(event.Event_ID))
        .map(event => getEventDisplayOccurrence(event))
        .filter(Boolean)
        .sort(compareEventOccurrences);
}

function createShortlistEventCard(event) {
    const venue = (venues || []).find(item => item.Venue_ID === event.Venue_ID) || null;
    const safeEventName = String(event.Event_Name || 'Event').replace(/'/g, "\\'");
    const eventTags = getEventTags(event, venue);
    const card = document.createElement('article');
    card.className = `card shortlist-event-card${isMenOnlyEvent(event, venue) ? ' card--men-only-event' : ''}`;
    card.innerHTML = `
        <div class="shortlist-event-card-inner">
            ${buildEventDateBadge(event, 'shortlist-event-date')}
            <div class="shortlist-event-content">
                <div class="shortlist-event-header">
                    <div class="shortlist-event-heading">
                        <h3 class="shortlist-event-title display-font">${formatEventTitleForDisplay(event.Event_Name)}</h3>
                        <p class="shortlist-event-meta">${escapeHTML(getEventDisplayMeta(event))}${venue?.Name ? ` · ${escapeHTML(venue.Name)}` : ''}</p>
                    </div>
                    <div class="shortlist-event-actions" aria-label="Event actions">
                        <button type="button" class="event-action-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${event.Event_ID}', '${safeEventName}')" title="Share event">${BR_ICONS.share}</button>
                        <button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.promptAddEventToShortlist('${event.Event_ID}')" title="Add to another shortlist"><img src="shortlist.png" alt="" aria-hidden="true"></button>
                        ${venue ? `<button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.location.hash='#venue=${venue.Venue_ID}'" title="Open ${escapeHTML(venue.Name)}">🏛️</button>` : ''}
                    </div>
                </div>
                ${event.Event_Description ? `<div class="shortlist-event-description">${formatAboutText(event.Event_Description)}</div>` : ''}
                ${eventTags.length ? `<div class="feature-chips shortlist-event-tags">${renderTagPills(eventTags, 'font-size:0.72rem; padding:3px 8px;')}</div>` : ''}
            </div>
        </div>
    `;

    card.addEventListener('click', clickEvent => {
        if (clickEvent.target.closest('a, button')) return;
        if (venue?.Venue_ID) {
            venueReturnHash = window.location.hash || '#myshortlists';
            window.location.hash = `#venue=${venue.Venue_ID}`;
        }
    });

    return card;
}

function renderShortlistCollection(entries, container, filter = 'all') {
    if (!container) return { venueCount: 0, eventCount: 0 };

    const venueIds = (entries || []).filter(entry => entry.type === 'venue').map(entry => entry.id);
    const shortlistVenues = (venues || []).filter(venue => venueIds.includes(venue.Venue_ID));
    const shortlistEvents = getShortlistEventOccurrences(entries);
    const showVenues = filter !== 'events';
    const showEvents = filter !== 'venues';

    const layout = document.createElement('div');
    layout.className = `shortlist-layout${(showVenues && showEvents) ? '' : ' shortlist-layout-single'}`;

    if (showVenues && shortlistVenues.length) {
        const venueSection = document.createElement('section');
        venueSection.className = 'shortlist-section shortlist-venues-section';
        venueSection.innerHTML = '<h2 class="display-font shortlist-section-title">🏛️ VENUES</h2>';
        const venueGrid = document.createElement('div');
        venueGrid.className = 'shortlist-venue-grid';
        venueSection.appendChild(venueGrid);
        renderListings(shortlistVenues, true, venueGrid);
        layout.appendChild(venueSection);
    }

    if (showEvents && shortlistEvents.length) {
        const eventSection = document.createElement('section');
        eventSection.className = 'shortlist-section shortlist-events-section';
        eventSection.innerHTML = '<h2 class="display-font shortlist-section-title">📅 EVENTS</h2>';
        const eventGrid = document.createElement('div');
        eventGrid.className = 'shortlist-event-grid';
        shortlistEvents.forEach(event => eventGrid.appendChild(createShortlistEventCard(event)));
        eventSection.appendChild(eventGrid);
        layout.appendChild(eventSection);
    }

    if (!layout.children.length) {
        const empty = document.createElement('p');
        empty.className = 'shortlist-empty-state';
        const filterLabel = filter === 'venues' ? 'venues' : filter === 'events' ? 'events' : 'items';
        empty.textContent = `No ${filterLabel} are available in this shortlist.`;
        container.appendChild(empty);
    } else {
        container.appendChild(layout);
    }

    return { venueCount: shortlistVenues.length, eventCount: shortlistEvents.length };
}

function renderSharedShortlistEvents(entries, container) {
    // Kept as the shared public helper, now using the same visual card system as saved shortlists.
    return renderShortlistCollection(entries, container, 'events');
}

function renderSharedListView(name, emoji, entries) {
    const searchInputEl = document.getElementById('search-input');
    if(searchInputEl) searchInputEl.style.display = 'none';
    const mainFilters = document.getElementById('main-filters');
    if(mainFilters) mainFilters.style.display = 'none';
    contextHeader?.classList.add('hidden');

    if(!resultsContainer) return;
    resultsContainer.innerHTML = '';

    const venueCount = entries.filter(entry => entry.type === 'venue').length;
    const eventCount = entries.filter(entry => entry.type === 'event').length;
    const countParts = [];
    if (venueCount) countParts.push(`${venueCount} venue${venueCount === 1 ? '' : 's'}`);
    if (eventCount) countParts.push(`${eventCount} event${eventCount === 1 ? '' : 's'}`);

    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'shared-list-header';
    sharedHeader.style.cssText = 'text-align:center; padding:30px 15px; margin-bottom:20px; grid-column:1 / -1;';
    sharedHeader.innerHTML = `
        <h1 style="font-size:3rem; margin-bottom:10px; color:#fff;">${emoji} ${name}</h1>
        <p style="color:var(--text-light); margin-bottom:8px;">Someone shared this Backroom list with you!</p>
        <p style="color:var(--primary-blue); margin-bottom:20px;">${countParts.join(' · ') || 'Shared shortlist'}</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button id="btn-save-shared" class="btn primary-btn pill-btn" style="padding:10px 20px;">💾 Save List to Profile</button>
            <button id="btn-open-site" class="btn secondary-btn pill-btn" style="padding:10px 20px;">🌍 Open Main Site</button>
        </div>
        <p style="font-size:0.85rem; color:var(--label-grey); margin-top:15px;">Saving adds these venues and events to your Shortlists.</p>
    `;
    resultsContainer.appendChild(sharedHeader);

    const sharedCounts = renderShortlistCollection(entries, resultsContainer, 'all');

    if (!sharedCounts.venueCount && !sharedCounts.eventCount) {
        resultsContainer.innerHTML += '<p class="shortlist-empty-state">No active shortlist items found.</p>';
    }

    document.getElementById('btn-save-shared')?.addEventListener('click', () => {
        if (!userProfile.name) {
            userProfile.name = 'New Profile';
            userProfile.avatar = avatarData[0]?.file || 'noavatar01.png';
            localStorage.setItem('br_profile', JSON.stringify(userProfile));
        }
        userShortlists[name] = entries.map(entry => shortlistToken(entry.type, entry.id));
        userShortlistEmojis[name] = emoji;
        saveCurrentToBundle();
        showToast('List saved to your Shortlists!');
    });

    document.getElementById('btn-open-site')?.addEventListener('click', () => {
        if(searchInputEl) searchInputEl.style.display = '';
        if(mainFilters) mainFilters.style.display = '';
        window.location.hash = '';
        window.location.reload();
    });
}

function handleRouting() {
    if (checkSharedListRoute()) return; 

    const hash = window.location.hash;

    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    contextHeader?.classList.add('hidden');
    document.getElementById('event-city-filters')?.classList.add('hidden');
    document.getElementById('shortlist-view-filters')?.classList.add('hidden');
    document.getElementById('btn-new-shortlist-view')?.classList.add('hidden');
    document.getElementById('main-filters')?.classList.remove('hidden');
    ['discounts', 'about', 'featured', 'cruising-guide'].forEach(page => document.getElementById(`${page}-container`)?.classList.add('hidden'));

    welcomeScreen?.classList.add('hidden');
    document.getElementById('profile-wipe-toast')?.classList.add('hidden');

    if (hash === '') {
        searchUsesFuzzyMatching = false;
        if (searchInput) searchInput.value = '';
        updateSearchClearButton();
        activeFilters = [];
        selectedCardId = null;
        document.getElementById('main-filters')?.classList.add('hidden');
        if(resultsContainer) resultsContainer.innerHTML = '';
        renderWelcomeScreen();
        updateTravelSidebarHighlight();
        return;
    }

    if (hash.startsWith('#venue=')) {
        const id = hash.replace('#venue=', '');
        const venue = venues.find(v => v.Venue_ID === id);
        if (venue && !['Hold', 'Flag'].includes(String(venue.Status || '').trim())) { 
            openVenueModal(venue); 
            applyFilters(); 
        } else {
            showToast('Venue not available or under review');
            window.location.hash = '#results'; 
        }
    } else if (isResultsRouteHash(hash)) {
        const sharedResultsRoute = hash.startsWith('#results?');
        const sharedResultsState = getSharedResultsRouteState(hash);

        // A shared link replaces only the temporary Results controls. It never changes
        // the recipient's saved location, favourites, events or profile.
        if (sharedResultsRoute && window.__backroomLastSharedResultsRoute !== hash) {
            searchUsesFuzzyMatching = Boolean(sharedResultsState?.fuzzy);
            searchResultTypeFilter = sharedResultsState?.type || 'All';
            activeFilters = [...(sharedResultsState?.tags || [])];
            if (searchInput) searchInput.value = sharedResultsState?.query || '';
            updateSearchClearButton();
        }

        window.__backroomLastSharedResultsRoute = sharedResultsRoute ? hash : '';
        recordUserInteraction();
        applyFilters();
    } else if (hash === '#calendar' || hash.startsWith('#calendar?')) {
        recordUserInteraction();
        window.openCalendarScreen?.();
    } else if (hash === '#venues') {
        recordUserInteraction();
        renderSavedLocationVenuesView();
    } else if (hash === '#favorites') {
        recordUserInteraction();
        renderFavoritesView();
    } else if (hash === '#myevents') {
        recordUserInteraction();
        renderMyEventsView();
    } else if (hash === '#myshortlists') {
        recordUserInteraction();
        renderShortlistsFullView();
    } else if (hash === '#mytravel') {
        recordUserInteraction();
        renderTravelFullView();
    } else if (hash === '#discounts') {
        recordUserInteraction();
        renderStaticPageView('discounts');
    } else if (hash === '#about') {
        recordUserInteraction();
        renderStaticPageView('about');
    } else if (hash === '#cruising-guide') {
        recordUserInteraction();
        renderStaticPageView('cruising-guide');
    } else if (hash === '#featured') {
        recordUserInteraction();
        renderFeaturedView();
    } else if (hash.startsWith('#shortlist=')) {
        recordUserInteraction();
        const name = decodeURIComponent(hash.replace('#shortlist=', ''));
        renderSingleShortlist(name);
    } else {
        window.location.hash = '#results';
    }

    updateTravelSidebarHighlight();
}

function renderSingleShortlist(name) {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Shortlists', 'shortlists');

    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    const eIcon = userShortlistEmojis[name] || '📑';
    if(cTitle) cTitle.innerHTML = `${eIcon} ${escapeHTML(name)}`;
    if(cDesc) cDesc.innerText = `A saved shortlist collection: ${formatShortlistCount(name)}.`;

    if (activeShortlistContentName !== name) {
        activeShortlistContentName = name;
        activeShortlistContentFilter = 'all';
    }

    const filterContainer = document.getElementById('shortlist-view-filters');
    if (filterContainer) {
        filterContainer.classList.remove('hidden');
        filterContainer.innerHTML = '';
        [
            { value: 'all', label: 'All' },
            { value: 'venues', label: 'Venues' },
            { value: 'events', label: 'Events' }
        ].forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `chip pill-btn shortlist-view-chip ${activeShortlistContentFilter === item.value ? 'active' : ''}`;
            button.textContent = item.label;
            button.addEventListener('click', () => {
                activeShortlistContentFilter = item.value;
                renderSingleShortlist(name);
            });
            filterContainer.appendChild(button);
        });
    }

    const entries = getShortlistEntries(name);
    if (resultsContainer) resultsContainer.innerHTML = '';
    const counts = renderShortlistCollection(entries, resultsContainer, activeShortlistContentFilter);

    if (!entries.length && resultsContainer) {
        resultsContainer.innerHTML = '<p class="shortlist-empty-state">This shortlist is empty.</p>';
    } else if (!counts.venueCount && !counts.eventCount && resultsContainer) {
        resultsContainer.innerHTML = `<p class="shortlist-empty-state">No ${activeShortlistContentFilter === 'venues' ? 'venues' : 'events'} are available in this shortlist.</p>`;
    }
}

async function renderStaticPageView(page) {
    document.getElementById('main-filters')?.classList.add('hidden');
    if(resultsContainer) resultsContainer.innerHTML = '';
    ['discounts', 'about', 'featured', 'cruising-guide'].forEach(p => {
        if(p !== page) document.getElementById(`${p}-container`)?.classList.add('hidden');
    });
    const container = document.getElementById(`${page}-container`);
    if(!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `<p class="body-font">Loading content...</p>`;
    try {
        const res = await fetch(`${page}.html?v=${Date.now()}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const main = doc.querySelector('main');
        container.innerHTML = main ? main.innerHTML : doc.body.innerHTML;
    } catch (e) {
        container.innerHTML = `<h2 class="display-font" style="color:var(--primary-blue);">Content not available</h2><p class="body-font">This page could not be loaded.</p>`;
    }
}

function renderBlankPageView(page) {
    renderStaticPageView(page);
}

function renderWelcomeScreen() {
    const wName = document.getElementById('welcome-name');
    const wAvatar = document.getElementById('welcome-avatar');
    // v0.66 Dynamic Fallback Name
    let dispName = 'GUEST';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label;
    }
    
    if(wName) wName.innerText = dispName;
    if(wAvatar && userProfile.avatar) wAvatar.src = `Profile_images/${userProfile.avatar}`;
    welcomeScreen?.classList.remove('hidden');
}

function renderDiscountsView() {
    renderStaticPageView('discounts');
}

// --- Featured page: city-specific editorial lists ---
const FEATURED_CITY_ORDER = ['Berlin', 'Hamburg', 'Cologne', 'Frankfurt', 'Munich'];
let activeFeaturedCity = 'Berlin';

const FEATURED_CITY_CONFIG = {
    Berlin: {
        mode: 'priority'
    },
    Hamburg: {
        topPicks: [
            { label: 'Toms', venueId: 'HAM-BAR-14' },
            { label: 'Babylon', venueId: 'HAM-PAR-03' },
            { label: 'WunderBar', venueId: 'HAM-BAR-12' }
        ],
        recommended: [
            { label: 'Dragon Sauna', venueId: 'HAM-SAU-01' }
        ]
    },
    Cologne: {
        topPicks: [
            { label: 'SEXY Party', venueId: 'CGN-PAR-04' },
            { label: 'Mumu', venueId: 'CGN-BAR-11' },
            { label: 'Exile', venueId: 'CGN-BAR-07' },
            { label: 'Phoenix', venueId: 'CGN-SAU-02' }
        ],
        recommended: [
            { label: 'Guyz', venueId: 'CGN-PAR-02' },
            { label: 'Play', venueId: 'CGN-PAR-05' },
            { label: 'Babylon Sauna', venueId: 'CGN-SAU-01' }
        ]
    },
    Frankfurt: {
        topPicks: [
            { label: 'PINK Frankfurt', venueId: 'FFM-BAR-04' },
            { label: 'Saunawerk', venueId: 'FFM-SAU-01' }
        ],
        recommended: []
    },
    Munich: {
        topPicks: [
            { label: 'NY Club', venueId: 'MUC-PAR-01' },
            { label: 'Sauna Deutsche Eiche', venueId: 'MUC-SAU-01' }
        ],
        recommended: []
    }
};

function normalizeFeaturedLookupText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function featuredCityMatches(venue, cityName) {
    const target = normalizeFeaturedLookupText(cityName);
    const aliases = {
        cologne: ['cologne', 'koln'],
        frankfurt: ['frankfurt', 'frankfurtammain'],
        munich: ['munich', 'munchen']
    };
    const accepted = aliases[target] || [target];
    return getCityTokens(venue).some(city => accepted.includes(normalizeFeaturedLookupText(city)));
}

function featuredEntryNameMatches(venueName, entry) {
    const actualName = normalizeFeaturedLookupText(venueName);
    if (!actualName) return false;

    return (entry.aliases || [entry.label])
        .map(normalizeFeaturedLookupText)
        .filter(Boolean)
        .some(alias => actualName === alias || actualName.startsWith(alias));
}

function findConfiguredFeaturedVenue(cityName, entry) {
    const publicVenues = getPublicVenues();

    // Curated Featured cards are bound to their exact Venue_IDs, never guessed from names.
    if (entry?.venueId) {
        return publicVenues.find(venue => venue?.Venue_ID === entry.venueId) || null;
    }

    return publicVenues.find(venue => {
        if (!featuredCityMatches(venue, cityName)) return false;
        return featuredEntryNameMatches(venue?.Name, entry);
    }) || null;
}

function buildFeaturedPlaceholder(entry) {
    const card = document.createElement('article');
    card.className = 'card featured-missing-card';
    card.style.cssText = 'min-height:190px; border:1px dashed var(--primary-blue); background:rgba(12,18,34,.74); display:flex; align-items:stretch;';
    card.innerHTML = `
        <div class="card-inner-content" style="width:100%; display:flex; flex-direction:column; justify-content:center;">
            <div class="card-header">
                <div>
                    <h3 class="card-title display-font">${entry.label}</h3>
                    <div class="card-meta">FEATURED LISTING</div>
                </div>
                <div class="status-badge all">SOON</div>
            </div>
            <div class="card-about">This regular venue or party is queued for its full directory listing.</div>
        </div>
    `;
    return card;
}

function renderConfiguredFeaturedEntries(cityName, entries, grid) {
    const foundVenues = [];
    const missingEntries = [];
    const usedVenueIds = new Set();

    (entries || []).forEach(entry => {
        const venue = findConfiguredFeaturedVenue(cityName, entry);
        if (venue && !usedVenueIds.has(venue.Venue_ID)) {
            usedVenueIds.add(venue.Venue_ID);
            foundVenues.push(venue);
        } else {
            missingEntries.push(entry);
        }
    });

    if (foundVenues.length) renderListings(foundVenues, true, grid);
    missingEntries.forEach(entry => grid.appendChild(buildFeaturedPlaceholder(entry)));
}

function setFeaturedCity(cityName) {
    if (!FEATURED_CITY_CONFIG[cityName]) return;
    activeFeaturedCity = cityName;
    renderFeaturedView();
}

function renderFeaturedView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    if (resultsContainer) resultsContainer.innerHTML = '';

    const container = document.getElementById('featured-container');
    if (!container) return;
    container.classList.remove('hidden');

    const cityName = FEATURED_CITY_CONFIG[activeFeaturedCity] ? activeFeaturedCity : 'Berlin';
    const config = FEATURED_CITY_CONFIG[cityName];
    const isBerlin = config.mode === 'priority';

    let html = `<h2 class="display-font" style="color:var(--primary-blue); margin-bottom:5px;">🏛️ FEATURED VENUES</h2>`;
    html += `<p class="body-font" style="margin-bottom:15px; color:#fff;">${systemInfo.featured_page_intro || 'Below are some of our favourite venues.'}</p>`;
    html += `<div class="featured-city-strip" style="display:flex; gap:8px; margin-bottom:22px; overflow-x:auto; flex-wrap:wrap;">`;
    html += FEATURED_CITY_ORDER.map(city => {
        const selected = city === cityName;
        const selectedStyle = selected ? 'background:var(--primary-blue); color:#071018; border-color:var(--primary-blue);' : '';
        return `<button class="chip pill-btn" style="${selectedStyle}" onclick="setFeaturedCity('${city}')">${city}</button>`;
    }).join('');
    html += `</div>`;

    html += `<h3 class="display-font" style="margin:0 0 16px; color:#fff;">${cityName}</h3>`;

    if (isBerlin) {
        const berlinVenues = getPublicVenues().filter(venue => featuredCityMatches(venue, 'Berlin'));
        const groups = [
            { level: '1', label: 'Top Picks' },
            { level: '2', label: 'Recommended' },
            { level: '3', label: 'Also Featured' }
        ];

        groups.forEach(group => {
            const groupVenues = sortFeaturedVenues(berlinVenues.filter(venue => normalizeFeaturedLevel(venue) === group.level));
            if (groupVenues.length) {
                html += `<section class="featured-section" style="margin-bottom:28px;"><h3 class="display-font" style="margin:0 0 12px; color:var(--primary-blue);">${group.label}</h3><div id="featured-berlin-${group.level}" class="featured-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px;"></div></section>`;
            }
        });

        if (!berlinVenues.some(venue => ['1', '2', '3'].includes(normalizeFeaturedLevel(venue)))) {
            html += `<p class="body-font" style="color:var(--text-light);">More coming soon.</p>`;
        }

        container.innerHTML = html;
        groups.forEach(group => {
            const grid = document.getElementById(`featured-berlin-${group.level}`);
            if (!grid) return;
            const groupVenues = sortFeaturedVenues(berlinVenues.filter(venue => normalizeFeaturedLevel(venue) === group.level));
            renderListings(groupVenues, true, grid);
        });
        return;
    }

    const groups = [
        { key: 'topPicks', label: 'Top Picks' },
        { key: 'recommended', label: 'Recommended' }
    ];

    groups.forEach(group => {
        const entries = config[group.key] || [];
        html += `<section class="featured-section" style="margin-bottom:28px;"><h3 class="display-font" style="margin:0 0 12px; color:var(--primary-blue);">${group.label}</h3>`;
        if (entries.length) {
            html += `<div id="featured-${cityName.toLowerCase()}-${group.key}" class="featured-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px;"></div>`;
        } else {
            html += `<p class="body-font" style="color:var(--text-light);">More coming soon.</p>`;
        }
        html += `</section>`;
    });

    container.innerHTML = html;
    groups.forEach(group => {
        const entries = config[group.key] || [];
        if (!entries.length) return;
        const grid = document.getElementById(`featured-${cityName.toLowerCase()}-${group.key}`);
        if (grid) renderConfiguredFeaturedEntries(cityName, entries, grid);
    });
}

// --- Tutorial System ---
let currentTutorialSteps = [];
let currentTutorialStepIndex = 0;
let currentTutorialType = '';

function startTutorial(type) {
    isTutorialRunning = true; 
    
    // v0.66 Tutorial Reset & Hardcode Anchor
    if (type === 'general') {
        window.location.hash = '#results'; // Clear views
        activeFilters = []; // Clear filters
        const searchInputEl = document.getElementById('search-input');
        if(searchInputEl) {
            searchInputEl.value = "Berlin";
            applyFilters(); 
            // Force Lab to open immediately so it's ready for highlighting
            const labVenue = venues.find(x => x.Venue_ID === 'BER-LAB-01');
            if(labVenue) openVenueModal(labVenue);
        }
    }

    currentTutorialType = type;
    currentTutorialStepIndex = 0;
    if (type === 'general') {
        currentTutorialSteps = [
            { target: '#search-input', text: 'Search for venues by name, city, or specific tags.' },
            { target: '#btn-location', text: 'Set your location and see venues closest to you.' },
            { target: '#filter-chips', text: 'Use dynamic filter pills to sort results.' },
            { target: '#btn-favorites', text: 'View your locally saved Favourite venues.' },
            { target: '#btn-shortlists-menu', text: 'Create and view named venue collections.' },
            { target: '.card', text: 'Click any venue card to select it.' },
            { target: '.card.selected', text: 'Double tap a selected card to open its full profile.' },
            { target: '#modal-star', text: 'Use these buttons to favourite, shortlist, report, or share.' },
            { target: '.ratings-table', text: 'Check out detailed venue ratings.' },
            { target: '.social-bar', text: 'Quickly access the venue\'s social media and websites.' },
            { target: '.full-width-about', text: 'Read detailed descriptions and opening hours.' },
            { target: '.events-block', text: 'Scroll down to see upcoming events hosted here.' },
            { target: '.event-card .fav-btn', text: 'Click the heart to save events to your personal list.' },
            { target: '#btn-profile-tutorial', text: 'Do you want to go to the Profile tutorial now? Click "Yes" below!' }
        ];
    } else if (type === 'profile') {
        currentTutorialSteps = [
            { target: '#profile-name', text: 'Enter your custom profile name here.', action: 'mob_tab_1' },
            { target: '#avatar-grid', text: 'Choose your avatar from the grid.', action: 'mob_tab_2' },
            { target: '#avatar-filters', text: 'Select filter tags to find the perfect avatar.', action: 'mob_tab_2' },
            { target: '#btn-save-profile', text: 'Click this to save your current active profile to this browser.', action: 'mob_tab_3' },
            { target: '#profile-switcher', text: 'Switch between your saved profiles easily.', action: 'mob_tab_3' },
            { target: '#btn-new-profile', text: 'Create a new profile from scratch.', action: 'mob_tab_3' },
            { target: '#btn-profile-download-data', text: 'You are in control of your own data. We do not store any information online so there is no risk of data breaches. If you clear your cache in your browser everything you have saved will be gone unless you download your data and then import it all. We recommend you store this on your online Google Drive or Apple Drive.', action: 'mob_tab_3' }
        ];
    }
    
    const toast = document.getElementById('tutorial-toast');
    if(toast) {
        toast.classList.remove('hidden');
        showNextTutorialStep();
        setupTutorialDrag();
    }
}

function showNextTutorialStep() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    
    if (currentTutorialStepIndex >= currentTutorialSteps.length) {
        endTutorial();
        return;
    }
    
    const step = currentTutorialSteps[currentTutorialStepIndex];

    if (window.innerWidth < 768 && step.action && step.action.startsWith('mob_tab_')) {
        const tabNum = parseInt(step.action.replace('mob_tab_', ''));
        if (typeof switchProfileTab === 'function') {
            switchProfileTab(tabNum);
        }
    }

    const targetEl = document.querySelector(step.target);
    if (targetEl) {
        targetEl.classList.add('tutorial-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    const msgEl = document.getElementById('tutorial-message');
    if (msgEl) msgEl.innerText = step.text;
    
    const nextBtn = document.getElementById('btn-tutorial-next');
    const skipBtn = document.getElementById('btn-tutorial-skip');
    
    if (nextBtn && skipBtn) {
        if (currentTutorialStepIndex === currentTutorialSteps.length - 1) {
            if(currentTutorialType === 'general') {
                nextBtn.innerText = "Yes, go to profile";
                skipBtn.innerText = "End tutorial";
                nextBtn.onclick = () => { endTutorial(); startTutorial('profile'); document.getElementById('btn-profile-menu').click(); };
            } else {
                nextBtn.innerText = "Finish ✔️";
                nextBtn.onclick = showNextTutorialStep;
                skipBtn.innerText = "Skip";
            }
        } else {
            nextBtn.innerText = "Next Step ▶";
            nextBtn.onclick = showNextTutorialStep;
            skipBtn.innerText = "Skip";
        }
    }
    
    currentTutorialStepIndex++;
}

function endTutorial() {
    isTutorialRunning = false; 
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    document.getElementById('tutorial-toast')?.classList.add('hidden');
    currentTutorialSteps = [];
    currentTutorialStepIndex = 0;
}

function runTutorial() {
    startTutorial('general');
}

function setupTutorialDrag() {
    const windowEl = document.querySelector('#tutorial-toast .toast');
    const headerEl = windowEl.querySelector('h3');
    if(!headerEl || !windowEl || windowEl.dataset.dragSet) return;
    
    headerEl.style.cursor = 'move';
    let isDragging = false, startX, startY, initialLeft, initialTop;
    
    headerEl.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = windowEl.getBoundingClientRect();
        windowEl.style.transform = 'none'; 
        windowEl.style.bottom = 'auto'; 
        initialLeft = rect.left; initialTop = rect.top;
        windowEl.style.left = initialLeft + 'px';
        windowEl.style.top = initialTop + 'px';
        windowEl.style.position = 'fixed';
    });
    document.addEventListener('mousemove', (e) => {
        if(isDragging) {
            windowEl.style.left = (initialLeft + e.clientX - startX) + 'px';
            windowEl.style.top = (initialTop + e.clientY - startY) + 'px';
        }
    });
    document.addEventListener('mouseup', () => isDragging = false);
    windowEl.dataset.dragSet = 'true';
}

function updateSearchClearButton() {
    const clearBtn = document.getElementById('search-clear');
    if (!clearBtn || !searchInput) return;
    clearBtn.classList.toggle('hidden', !searchInput.value.trim());
}

function resetBackButton(label = '← Back to Results', target = 'results') {
    const btn = document.getElementById('btn-back-to-results');
    if (!btn) return;
    btn.textContent = label;
    btn.dataset.backTarget = target;
}

function formatReportTimestamp(date = new Date()) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yy} ${hh}-${min}-${ss}`;
}

window.flagListing = function(id, name, type="Venue/Event") {
    const modal = document.getElementById('formsubmit-modal');
    if(modal) {
        const fsId = document.getElementById('fs-id');
        const fsName = document.getElementById('fs-name');
        const fsType = document.getElementById('fs-type');
        const fsUrl = document.getElementById('fs-url');

        if(fsId) fsId.value = id;
        if(fsName) fsName.value = name;
        if(fsType) fsType.value = type;
        if(fsUrl) fsUrl.value = window.location.href;

        const nameInp = modal.querySelector('input[name="name"]');
        const emailInp = modal.querySelector('input[name="email"]');
        if(nameInp && !nameInp.value) nameInp.value = userProfile.name || 'Backroom User';
        if(emailInp && !emailInp.value) emailInp.value = systemInfo.form_default_email || 'your@email.com';

        const msg = modal.querySelector('textarea[name="message"]');
        if(msg) {
            const cleanId = String(id || '').trim();
            const cleanName = String(name || '').trim();
            if(cleanId && cleanId !== 'N/A') {
                msg.value = `Report problem with ${cleanId} ${cleanName} ${formatReportTimestamp()}
--------------------------
Type your message here`;
                msg.selectionStart = msg.selectionEnd = msg.value.length;
            } else if(!msg.value.trim()) {
                msg.value = 'Type your message here';
                msg.select();
            }
        }

        modal.classList.remove('hidden');
    }
};


function getCurrentProfileFormName() {
    return document.getElementById('profile-name')?.value.trim() || '';
}

function markProfileOpenState() {
    profileOpenName = userProfile.name || '';
    profileOpenAvatar = userProfile.avatar || '';
}

function hasUnsavedProfileChanges() {
    return getCurrentProfileFormName() !== profileOpenName || (userProfile.avatar || '') !== profileOpenAvatar;
}

function hideProfileUnsavedModal() {
    document.getElementById('profile-unsaved-modal')?.classList.add('hidden');
}

function showProfileUnsavedModal() {
    document.getElementById('profile-unsaved-modal')?.classList.remove('hidden');
}

function setupEventListeners() {
    const addEvt = (id, evt, func) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(evt, func);
    };

    const fsForm = document.getElementById('fs-form');
    if(fsForm && !fsForm.dataset.submitBound) {
        fsForm.dataset.submitBound = 'true';
        fsForm.addEventListener('submit', () => {
            fsForm.action = FORMSUBMIT_ENDPOINT;
            fsForm.method = 'POST';
            fsForm.target = '_blank';
            showToast('Continue in the FormSubmit tab to complete verification.');
            document.getElementById('formsubmit-modal')?.classList.add('hidden');
            setTimeout(() => fsForm.removeAttribute('target'), 1500);
        });
    }

    addEvt('btn-formsubmit-newtab', 'click', () => {
        const form = document.getElementById('fs-form');
        if (!form) return;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        form.action = FORMSUBMIT_ENDPOINT;
        form.method = 'POST';
        form.target = '_blank';
        showToast('Continue in the FormSubmit tab to complete verification.');
        HTMLFormElement.prototype.submit.call(form);
        setTimeout(() => form.removeAttribute('target'), 1500);
    });

    addEvt('btn-formsubmit-flow-close', 'click', () => {
        document.getElementById('formsubmit-flow-modal')?.classList.add('hidden');
        const form = document.getElementById('fs-form');
        if(form) form.removeAttribute('target');
    });


    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if(modal && modal.id === 'profile-modal' && hasUnsavedProfileChanges()) {
                showProfileUnsavedModal();
                return;
            }
            modal?.classList.add('hidden');
        });
    });
    
    addEvt('close-modal', 'click', closeVenueModalToPreviousView);

    addEvt('btn-location', 'click', openLocationModal);
    
    addEvt('btn-settings', 'click', () => settingsModal?.classList.remove('hidden'));
    addEvt('btn-profile-menu', 'click', openProfileMenu);
    const previewShortcut = document.getElementById('preview-img-wrapper');
    if(previewShortcut && !previewShortcut.dataset.avatarShortcutBound) {
        previewShortcut.dataset.avatarShortcutBound = 'true';
        previewShortcut.addEventListener('click', () => {
            if(window.innerWidth <= 768 && typeof window.switchProfileTab === 'function') window.switchProfileTab(2);
        });
    }
    addEvt('btn-save-profile-unsaved', 'click', () => {
        document.getElementById('btn-save-profile')?.click();
        profileModal?.classList.add('hidden');
    });
    addEvt('btn-discard-profile-unsaved', 'click', () => {
        hideProfileUnsavedModal();
        const nameInp = document.getElementById('profile-name');
        if(nameInp) nameInp.value = profileOpenName || '';
        userProfile.name = profileOpenName || '';
        userProfile.avatar = profileOpenAvatar || '';
        renderProfileAvatars();
        updateProfileDisplay();
        profileModal?.classList.add('hidden');
    });
    addEvt('btn-favorites', 'click', () => window.location.hash = '#favorites');
    addEvt('btn-shortlists-menu', 'click', () => window.location.hash = '#myshortlists');
    
    addEvt('btn-sidebar-travel', 'click', () => {
        const drop = document.getElementById('travel-dropdown');
        drop?.classList.toggle('hidden');
        renderTravelDropdown();
    });

    addEvt('btn-tutorial-skip', 'click', endTutorial);
    addEvt('btn-profile-tutorial', 'click', () => startTutorial('profile'));

    addEvt('btn-language', 'click', () => showToast("Coming soon!")); 
    addEvt('btn-back-to-results', 'click', () => {
        const btn = document.getElementById('btn-back-to-results');
        const target = btn?.dataset.backTarget || 'results';
        if(target === 'shortlists') {
            window.location.hash = '#myshortlists';
        } else if(target === 'venues') {
            window.location.hash = '#venues';
        } else {
            // Search Results is a return view, not a reset: keep the current text and filters.
            updateSearchClearButton();
            window.location.hash = '#results';
            if(window.location.hash === '#results') handleRouting();
            updateTravelSidebarHighlight();
        }
    });

    // The buttons call window.saveBackroomLocation / window.clearBackroomLocation
    // directly from index.html. This avoids losing the location action when the
    // listener setup order changes during later feature updates.
    const locationInput = getLocationInput();
    const refreshLocationActionLabel = () => {
        const value = locationInput?.value || '';
        updateLocationActionLabel(value);
        updateLocationDraftStatus(value);
    };

    if (locationInput && !locationInput.dataset.locationLabelBound) {
        locationInput.dataset.locationLabelBound = 'true';
        locationInput.addEventListener('input', () => {
            clearMapResolvedLocation(locationInput);
            refreshLocationActionLabel();
        });
        locationInput.addEventListener('change', () => {
            clearMapResolvedLocation(locationInput);
            refreshLocationActionLabel();
        });
        locationInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            window.saveBackroomLocation();
        });
    }
    refreshLocationActionLabel();

    addEvt('btn-gps', 'click', () => {
        showToast('Hold up a few seconds, we are confirming your location.');
        if (!navigator.geolocation) {
            alert('Geolocation not supported.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async pos => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const input = getLocationInput();

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    const city = data?.address?.city || data?.address?.town || data?.address?.village || '';
                    const country = data?.address?.country || '';

                    if (input) {
                        input.value = city && country ? `${city}, ${country}` : (city || country);
                        input.dataset.lat = lat;
                        input.dataset.lon = lon;
                    }
                    updateLocationActionLabel(input?.value || '');
                    updateLocationDraftStatus(input?.value || '');
                } catch (error) {
                    if (input) {
                        input.value = '';
                        input.dataset.lat = lat;
                        input.dataset.lon = lon;
                    }
                    updateLocationActionLabel('');
                    updateLocationDraftStatus('');
                    showToast('GPS found your coordinates, but could not resolve a city.');
                }

                initLeafletMap(lat, lon);
            },
            () => alert('GPS denied or unavailable.')
        );
    });

    addEvt('btn-search-map', 'click', async () => {
        const input = getLocationInput();
        const location = input?.value.trim() || '';
        const postcode = document.getElementById('loc-postcode')?.value.trim() || '';
        const query = `${postcode} ${location}`.trim();

        if (!query) return;

        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&accept-language=en&limit=1&q=${encodeURIComponent(query)}`
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const selected = data[0];
                rememberMapResolvedLocation(input, location, selected);
                initLeafletMap(selected.lat, selected.lon);
                updateLocationActionLabel(input?.value || '');
                updateLocationDraftStatus(input?.value || '');
            } else {
                clearMapResolvedLocation(input);
                alert('Location not found on map, but you can still save a recognised directory location.');
            }
        } catch (error) {
            console.error('OSM Error', error);
        }
    });

    addEvt('btn-reset-age', 'click', () => {
        localStorage.removeItem('br_age_verified');
        window.location.reload();
    });
    
    addEvt('btn-clear-data', 'click', () => {
        if(confirm("Delete all favorites, shortlists, events, and settings? This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
    
    document.querySelectorAll('.btn-export-trigger').forEach(btn => btn.addEventListener('click', exportUserData));
    addEvt('import-data-file', 'change', importUserData);
    addEvt('import-profile-file', 'change', importUserData); 

    addEvt('btn-add-create-shortlist', 'click', () => {
        const nameInp = document.getElementById('add-new-shortlist-name');
        if(!nameInp || !currentShortlistTarget) return;
        const name = nameInp.value.trim();
        if(name) {
            userShortlists[name] = [shortlistToken(currentShortlistTarget.type, currentShortlistTarget.id)];
            userShortlistEmojis[name] = SHORTLIST_EMOJIS[Math.floor(Math.random() * SHORTLIST_EMOJIS.length)];
            saveCurrentToBundle();
            addShortlistModal?.classList.add('hidden');
            showToast(`Added to shortlist: ${name}`);
            if(currentShortlistTarget.type === 'venue') {
                const sBtn = document.getElementById('modal-shortlist');
                if(sBtn) sBtn.classList.add('active-star');
            }
        }
    });
    
    addEvt('btn-save-profile', 'click', () => {
        const nameInp = document.getElementById('profile-name');
        if(nameInp) userProfile.name = nameInp.value.trim();
        saveCurrentToBundle(); 
        markProfileOpenState();
        hideProfileUnsavedModal();
        updateProfileDisplay();
        showToast("Profile saved locally!");
        if(window.location.hash === '' && searchInput?.value === '') renderWelcomeScreen();
    });

    addEvt('btn-new-profile', 'click', () => {
        document.getElementById('profile-wipe-toast')?.classList.remove('hidden');
    });

    addEvt('btn-wipe-all', 'click', () => {
        userProfile = { name: '', avatar: '' };
        userFavorites = []; userShortlists = {}; userEvents = []; userTravel = [];
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Started fresh blank profile.");
    });

    addEvt('btn-wipe-profile-only', 'click', () => {
        userProfile = { name: '', avatar: '' };
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Profile copied. Choose a new name.");
    });
    
    addEvt('btn-delete-profile', 'click', () => {
        if(!userProfile.name) { showToast("No active profile to delete."); return; }
        const delModal = document.getElementById('delete-profile-modal');
        if(delModal) delModal.classList.remove('hidden');
    });

    addEvt('btn-confirm-delete-profile', 'click', () => {
        if(userProfile.name) {
            delete savedProfiles[userProfile.name];
            localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
        }
        userProfile = { name: '', avatar: '' };
        userFavorites = []; userShortlists = {}; userEvents = []; userTravel = [];
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('delete-profile-modal')?.classList.add('hidden');
        showToast("Profile deleted.");
        if(window.location.hash === '' && searchInput?.value === '') renderWelcomeScreen();
    });

    addEvt('btn-cancel-delete-profile', 'click', () => {
        document.getElementById('delete-profile-modal')?.classList.add('hidden');
    });

    addEvt('profile-switcher', 'change', (e) => {
        const pName = e.target.value;
        if(pName && savedProfiles[pName]) {
            userProfile = { ...savedProfiles[pName] };
            const nInp = document.getElementById('profile-name');
            if(nInp) nInp.value = userProfile.name;
            loadActiveProfileData();
            renderProfileAvatars();
            updateProfileDisplay();
            showToast(`Switched to profile: ${pName}`);
            handleRouting();
        }
    });

    if(hitArea && sidebar && !document.body.dataset.sidebarBound) {
        document.body.dataset.sidebarBound = 'true';
        hitArea.addEventListener('click', (e) => { e.stopPropagation(); openSidebarTemporarily(); });
        hitArea.addEventListener('touchstart', (e) => { e.stopPropagation(); openSidebarTemporarily(); }, {passive:true});
        sidebar.addEventListener('click', (e) => {
            if(sidebar.classList.contains('sidebar-opening')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }
        }, true);
        sidebar.addEventListener('click', (e) => { e.stopPropagation(); openSidebarTemporarily(); });
        document.addEventListener('click', (e) => {
            if(!sidebar.classList.contains('visible')) return;
            if(e.target.closest('#sidebar') || e.target.closest('#sidebar-hit-area')) return;
            closeSidebarImmediately();
        });
        document.addEventListener('touchstart', (e) => {
            if(!sidebar.classList.contains('visible')) return;
            if(e.target.closest('#sidebar') || e.target.closest('#sidebar-hit-area')) return;
            closeSidebarImmediately();
        }, {passive:true});
        
    }

    if(searchInput) {
        searchInput.addEventListener('input', () => {
            searchUsesFuzzyMatching = false;
            recordUserInteraction();
            updateSearchClearButton();
            window.location.hash = '#results';
            handleRouting();
        });
        updateSearchClearButton();
    }
    const searchClear = document.getElementById('search-clear');
    if(searchClear) {
        searchClear.addEventListener('click', () => {
            searchUsesFuzzyMatching = false;
            if(searchInput) searchInput.value = '';
            updateSearchClearButton();
            recordUserInteraction();
            window.location.hash = '#results';
            handleRouting();
        });
    }
    addEvt('btn-save-profile-inline', 'click', () => document.getElementById('btn-save-profile')?.click());
}

function initLeafletMap(lat, lng) {
    document.getElementById('map-preview-placeholder')?.classList.add('hidden');
    const mapDiv = document.getElementById('loc-map');
    if(!mapDiv) return;
    mapDiv.style.display = 'block';
    
    if (!leafletMap) {
        leafletMap = L.map('loc-map').setView([lat, lng], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(leafletMap);
        leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
    } else {
        leafletMap.setView([lat, lng], 13);
        leafletMarker.setLatLng([lat, lng]);
    }
    setTimeout(() => leafletMap.invalidateSize(), 150);
}

function updateProfileDisplay() {
    const topAvatarContainer = document.getElementById('top-profile-container');
    const topAvatar = document.getElementById('top-profile-avatar');
    const topName = document.getElementById('top-profile-name');
    
    if(!topName || !topAvatar) return;

    let dispName = '👤';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label; // v0.66 Fallback Name Logic
    }

    topName.innerText = dispName;

    if(userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        topAvatar.src = `Profile_images/${userProfile.avatar}`;
        if(topAvatarContainer) topAvatarContainer.style.display = 'block'; 
        else topAvatar.style.display = 'inline-block';
        if(!userProfile.name) topName.style.display = 'none'; 
    } else {
        if(topAvatarContainer) topAvatarContainer.style.display = 'none';
        else topAvatar.style.display = 'none';
        topName.style.display = 'inline-block';
    }
}

function renderTravelDropdown() {
    const list = document.getElementById('travel-cities-list');
    if(!list) return;
    list.classList.remove('hidden');
    list.innerHTML = '';
    
    const query = searchInput?.value.trim().toLowerCase() || '';

    userTravel.forEach(city => {
        const item = document.createElement('div');
        const isActive = query === city.toLowerCase() ? 'active-travel' : '';
        item.className = `submenu-item ${isActive}`;
        item.innerHTML = `<span style="flex-grow:1;" onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash='#results'; handleRouting();">${city}</span>`;
        list.appendChild(item);
    });
}

// =================== part 2 ================

function updateTravelSidebarHighlight() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    const items = document.querySelectorAll('#travel-cities-list .submenu-item');
    items.forEach(item => {
        const spanText = item.querySelector('span').innerText.toLowerCase();
        if(spanText === query && window.location.hash === '#results') {
            item.classList.add('active-travel');
        } else {
            item.classList.remove('active-travel');
        }
    });
}

window.removeTravel = function(city) {
    userTravel = userTravel.filter(c => c !== city);
    saveCurrentToBundle();
    if(window.location.hash === '#mytravel') renderTravelFullView();
    else renderTravelDropdown();
}

function renderDynamicFilters(filteredData) {
    const container = document.getElementById('filter-chips');
    if(!container) return;

    const isResultsScreen = window.location.hash === '#results' || !window.location.hash;
    const availableTags = new Set();
    const availabilitySource = Array.isArray(filteredData) ? filteredData : getPublicVenues();
    availabilitySource.forEach(v => getVenueTags(v).forEach(t => availableTags.add(t)));
    if (isResultsScreen) {
        getSearchScopeEvents().forEach(({ event, venue }) => getEventTags(event, venue).forEach(tag => availableTags.add(tag)));
    }
    activeFilters.forEach(t => availableTags.add(t));

    const allActive = activeFilters.length === 0 && searchResultTypeFilter === 'All';
    let html = `<button class="chip pill-btn ${allActive ? 'active' : ''}" data-filter="All">All</button>`;

    if (isResultsScreen) {
        html += `<button class="chip pill-btn search-result-type-chip ${searchResultTypeFilter === 'Event' ? 'active' : ''}" data-search-result-type="Event">Event</button>`;
        html += `<button class="chip pill-btn search-result-type-chip ${searchResultTypeFilter === 'Venue' ? 'active' : ''}" data-search-result-type="Venue">Venue</button>`;
    }

    html += `<button class="chip pill-btn tag-social-yellow" data-filter="__close_to_me">Venues close to me</button>`;

    MASTER_VIBE_TAGS.forEach(tag => {
        const colorClass = getTagColorClass(tag);
        const isActive = activeFilters.includes(tag);
        const isAvailable = availableTags.has(tag);
        const isDisabled = (!isAvailable && !isActive);
        const disabledClass = isDisabled ? 'muted-chip' : '';
        const disabledAttrs = isDisabled ? ' data-disabled="true" aria-disabled="true" title="No matching listings with current filters"' : '';
        html += `<button class="chip pill-btn ${colorClass} ${isActive ? 'active' : ''} ${disabledClass}" data-filter="${tag}"${disabledAttrs}>${tag}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            recordUserInteraction();
            if(e.currentTarget.dataset.disabled === 'true') {
                showToast('No matching listings with current filters.');
                return;
            }

            const resultType = e.currentTarget.getAttribute('data-search-result-type');
            if (resultType) {
                searchResultTypeFilter = resultType;
                applyFilters();
                return;
            }

            const tag = e.currentTarget.getAttribute('data-filter');

            if(tag === '__close_to_me') {
                showToast('Coming soon');
                return;
            }

            if(tag === 'All') {
                activeFilters = [];
                searchResultTypeFilter = 'All';
            } else {
                const idx = activeFilters.indexOf(tag);
                if(idx > -1) activeFilters.splice(idx, 1);
                else activeFilters.push(tag);
            }
            // The Venues screen has its own city-scoped list, so keep tag filtering there.
            if(window.location.hash === '#venues') {
                renderSavedLocationVenuesView();
            } else if(window.location.hash === '#results' || !window.location.hash) {
                applyFilters();
            } else {
                window.location.hash = '#results';
            }
        });
    });
}


function renderSearchNoResults(query, savedScope, isFuzzySearch) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    const scopeText = savedScope?.scope && savedScope.scope !== 'all'
        ? ` in ${savedScope.label}`
        : ' across all cities';
    const panel = document.createElement('section');
    panel.className = 'search-empty-state';

    const title = document.createElement('h3');
    title.className = 'display-font';
    title.textContent = isFuzzySearch ? 'NO SIMILAR RESULTS FOUND' : 'WE FOUND NO RESULTS';

    const body = document.createElement('p');
    body.className = 'body-font';
    body.textContent = isFuzzySearch
        ? `No similar venue or event names matched “${query}”${scopeText}.`
        : `No venue or event names matched “${query}”${scopeText}.`;

    panel.append(title, body);

    if (!isFuzzySearch) {
        const hint = document.createElement('p');
        hint.className = 'search-empty-hint body-font';
        hint.textContent = 'Try a fuzzy search for close spellings or similar words.';

        const fuzzyButton = document.createElement('button');
        fuzzyButton.type = 'button';
        fuzzyButton.className = 'btn primary-btn pill-btn search-empty-action';
        fuzzyButton.textContent = 'Click here to do a fuzzy search for similar words';
        fuzzyButton.addEventListener('click', () => {
            // A failed city search expands to the full directory before checking close spellings.
            // This deliberately resets the shared location too, so Results, Venues, and Events all use All Cities afterwards.
            const allCitiesLocation = { country: '', city: '', postcode: '', scope: 'all' };
            localStorage.setItem('br_location', JSON.stringify(allCitiesLocation));
            updateLocationDisplay(allCitiesLocation);
            updateLocationActionLabel('');
            announceLocationChange(allCitiesLocation);
            searchUsesFuzzyMatching = true;
            applyFilters();
        });

        panel.append(hint, fuzzyButton);
    } else {
        const exactButton = document.createElement('button');
        exactButton.type = 'button';
        exactButton.className = 'btn secondary-btn pill-btn search-empty-action';
        exactButton.textContent = 'Back to exact search';
        exactButton.addEventListener('click', () => {
            searchUsesFuzzyMatching = false;
            applyFilters();
        });
        panel.append(exactButton);
    }

    resultsContainer.appendChild(panel);
}

function sortSearchVenues(list, query) {
    return [...list].sort((a, b) => {
        const queryCity = String(query || '').toLowerCase();
        if (queryCity) {
            const aCityMatch = venueMatchesCity(a, queryCity);
            const bCityMatch = venueMatchesCity(b, queryCity);
            if (aCityMatch && bCityMatch && isMultiCityVenue(a) !== isMultiCityVenue(b)) return isMultiCityVenue(a) ? 1 : -1;
        }

        const aShop = getVenueTags(a).includes('Shop') ? 1 : 0;
        const bShop = getVenueTags(b).includes('Shop') ? 1 : 0;
        if (aShop !== bShop) return aShop - bShop;

        const aHasImg = (a.Image_URL && a.Image_URL.trim() !== '') ? 1 : 0;
        const bHasImg = (b.Image_URL && b.Image_URL.trim() !== '') ? 1 : 0;
        if (aHasImg !== bHasImg) return bHasImg - aHasImg;

        const aPriority = parseInt(normalizeFeaturedLevel(a)) || 99;
        const bPriority = parseInt(normalizeFeaturedLevel(b)) || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const aSize = parseInt(a.Rating_Size) || 0;
        const bSize = parseInt(b.Rating_Size) || 0;
        if (aSize !== bSize) return bSize - aSize;

        const aPop = parseInt(a.Rating_Busyness || a.Rating_Popularity) || 0;
        const bPop = parseInt(b.Rating_Busyness || b.Rating_Popularity) || 0;
        return bPop - aPop;
    });
}

function renderSearchEventResults(items, targetContainer) {
    const container = targetContainer || resultsContainer;
    if (!container) return;

    let previousGenericFallback = '';
    items.forEach(({ event, venue }) => {
        const isSaved = userEvents.includes(event.Event_ID);
        const imageFallback = getEventFallbackImage(event, venue, previousGenericFallback);
        const image = getEventImageSource(event, venue, imageFallback);
        previousGenericFallback = isRotatingGenericPlaceholder(imageFallback) ? imageFallback : '';
        const eventName = String(event.Event_Name || 'Event');
        const safeEventName = eventName.replace(/'/g, "\\'");
        const description = getPlainDescriptionText(event.Event_Description || '');
        const shortDescription = description.length > 130 ? `${description.slice(0, 130)}...` : description;
        const eventTags = getEventTags(event, venue);
        const card = document.createElement('article');
        card.className = `card search-result-event-card${isMenOnlyEvent(event, venue) ? ' card--men-only-event' : ''}`;
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img class="venue-image centered-image" src="${image}" onerror="this.onerror=null; this.src='${imageFallback}'" title="${eventName}">
            </div>
            <div class="card-inner-content">
                <div class="card-header">
                    <div>
                        <h3 class="card-title display-font">${formatEventTitleForDisplay(eventName)}</h3>
                        <div class="card-meta">📅 ${escapeHTML(getEventDisplayMeta(event))}</div>
                        <div class="card-meta">🏛️ ${escapeHTML(venue?.Name || 'Venue not listed')}${formatEventLocation(event, venue) ? ` · ${escapeHTML(formatEventLocation(event, venue))}` : ''}</div>
                    </div>
                    <div class="status-badge live">EVENT</div>
                </div>
                ${shortDescription ? `<div class="card-about">${linkifyText(shortDescription)}</div>` : ''}
                ${eventTags.length ? `<div class="feature-chips search-event-tags">${renderTagPills(eventTags, 'font-size:0.72rem; padding:3px 8px;')}</div>` : ''}
                <div class="card-stats">
                    <span>📅 ${escapeHTML(getEventDisplayDate(event) || 'Date TBC')}</span>
                    <div style="margin-left:auto; display:flex; gap:10px; align-items:center;">
                        <span class="icon-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${event.Event_ID}', '${safeEventName}')" title="Share event" style="font-size:1.5rem;">${BR_ICONS.share}</span>
                        <span class="icon-btn" onclick="event.stopPropagation(); window.promptAddEventToShortlist('${event.Event_ID}')" title="Add to shortlist" style="display:flex; align-items:center; justify-content:center;"><img src="shortlist.png" style="width:24px; height:24px; object-fit:contain;"></span>
                        <span class="star-btn icon-btn fav-btn ${isSaved ? 'active-star' : ''}" title="${isSaved ? 'Remove from My Events' : 'Save event'}" style="font-size:1.55rem; line-height:1;">💖</span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', clickEvent => {
            if (clickEvent.target.closest('a, .icon-btn, .star-btn')) return;
            if (venue?.Venue_ID) {
                recordUserInteraction();
                venueReturnHash = '#results';
                window.location.hash = `#venue=${venue.Venue_ID}`;
            }
        });

        card.querySelector('.star-btn')?.addEventListener('click', clickEvent => {
            clickEvent.stopPropagation();
            window.toggleEventFavorite(event.Event_ID, clickEvent.currentTarget, false);
        });

        container.appendChild(card);
    });
}

function renderMixedSearchResults(venueResults, eventResults) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (venueResults.length) {
        const venueHolder = document.createElement('div');
        venueHolder.className = 'search-result-venue-holder';
        resultsContainer.appendChild(venueHolder);
        renderListings(venueResults, false, venueHolder);
    }

    if (eventResults.length) {
        renderSearchEventResults(eventResults, resultsContainer);
    }
}

function applyFilters() {
    const query = String(searchInput?.value || '').trim();
    const resultsScope = getResultsSearchScope();
    const scopeVenues = getSearchScopeVenues(resultsScope);
    const scopeEvents = getSearchScopeEvents(new Date(), resultsScope);
    selectedCardId = null;

    let filteredVenues = [...scopeVenues];
    let filteredEvents = [...scopeEvents];

    if(activeFilters.length > 0) {
        filteredVenues = filteredVenues.filter(venue => {
            const tags = getVenueTags(venue);
            return activeFilters.every(filterTag => tags.includes(filterTag));
        });
        filteredEvents = filteredEvents.filter(({ event, venue }) => eventMatchesActiveTags(event, venue));
    }

    if(query) {
        filteredVenues = filteredVenues.filter(venue => {
            const searchableText = getVenueSearchText(venue);
            return searchUsesFuzzyMatching
                ? fuzzyMatch(searchableText, query)
                : directSearchMatch(searchableText, query);
        });
        filteredEvents = filteredEvents.filter(({ event, venue }) => {
            const searchableText = getEventSearchText(event, venue);
            return searchUsesFuzzyMatching
                ? fuzzyMatch(searchableText, query)
                : directSearchMatch(searchableText, query);
        });
    }

    filteredVenues = sortSearchVenues(filteredVenues, query);
    filteredEvents.sort((a, b) => compareEventOccurrences(a.event, b.event));

    const displayVenues = searchResultTypeFilter === 'Event' ? [] : filteredVenues;
    const displayEvents = searchResultTypeFilter === 'Venue' ? [] : filteredEvents;
    const totalResults = displayVenues.length + displayEvents.length;

    if(contextHeader) {
        contextHeader.classList.remove('hidden');
        resetBackButton('← Back to Results', 'results');
        document.getElementById('btn-back-to-results')?.classList.add('result-back-hidden');

        const title = document.getElementById('context-title');
        const desc = document.getElementById('context-desc');
        const locationText = resultsScope.scope === 'all'
            ? 'across all cities'
            : `in ${resultsScope.label}`;
        const resultTypeText = searchResultTypeFilter === 'All'
            ? 'results'
            : `${searchResultTypeFilter.toLowerCase()} result${totalResults === 1 ? '' : 's'}`;

        if (title) {
            title.replaceChildren();

            if (resultsScope.scope !== 'all') {
                title.appendChild(document.createTextNode('RESULTS IN '));

                const locationPill = document.createElement('button');
                locationPill.type = 'button';
                locationPill.className = 'location-city-pill pill-btn';
                locationPill.textContent = resultsScope.label;
                locationPill.title = 'Change location';
                locationPill.setAttribute('aria-label', `Change location from ${resultsScope.label}`);
                locationPill.addEventListener('click', openLocationModal);
                title.appendChild(locationPill);
            } else {
                title.appendChild(document.createTextNode('RESULTS'));
            }

            if (getResultsShareUrl(resultsScope)) {
                const shareButton = document.createElement('button');
                shareButton.type = 'button';
                shareButton.className = 'results-location-share-btn icon-btn';
                shareButton.textContent = BR_ICONS.share;
                shareButton.title = 'Share these results';
                shareButton.setAttribute('aria-label', 'Share these results');
                shareButton.addEventListener('click', event => {
                    event.stopPropagation();
                    shareResultsForCurrentView(resultsScope);
                });
                title.appendChild(shareButton);
            }
        }
        if(desc) {
            const searchText = query ? ` for “${query}”` : '';
            const fuzzyText = searchUsesFuzzyMatching && query ? ' · Similar words search' : '';
            desc.innerText = `${totalResults} ${resultTypeText} found ${locationText}${searchText}${fuzzyText}`;
        }
    }

    // The tag availability follows the saved location scope, not the current text query.
    renderDynamicFilters(scopeVenues);

    if(query && totalResults === 0) {
        renderSearchNoResults(query, resultsScope, searchUsesFuzzyMatching);
    } else if (totalResults === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center; color:var(--label-grey); margin-top:20px; width:100%; grid-column:1 / -1;">No matching listings found.</p>';
    } else {
        renderMixedSearchResults(displayVenues, displayEvents);
    }

    updateTravelSidebarHighlight();
}

function sortSavedLocationVenues(list) {
    return [...(list || [])].sort((a, b) => {
        const aShop = getVenueTags(a).includes('Shop') ? 1 : 0;
        const bShop = getVenueTags(b).includes('Shop') ? 1 : 0;
        if (aShop !== bShop) return aShop - bShop;

        const aPriority = Number.parseInt(normalizeFeaturedLevel(a), 10) || 99;
        const bPriority = Number.parseInt(normalizeFeaturedLevel(b), 10) || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const aSize = Number.parseInt(a?.Rating_Size, 10) || 0;
        const bSize = Number.parseInt(b?.Rating_Size, 10) || 0;
        if (aSize !== bSize) return bSize - aSize;

        const aPop = Number.parseInt(a?.Rating_Busyness || a?.Rating_Popularity, 10) || 0;
        const bPop = Number.parseInt(b?.Rating_Busyness || b?.Rating_Popularity, 10) || 0;
        if (aPop !== bPop) return bPop - aPop;

        return String(a?.Name || '').localeCompare(String(b?.Name || ''));
    });
}

function renderSavedLocationEmptyState(titleText, bodyText, showLocationButton = false) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'grid-column:1 / -1; max-width:620px; width:100%; margin:20px auto; padding:28px; text-align:center; background:var(--panel-dark); border:1px solid var(--panel-mid); border-radius:var(--radius-card);';

    const title = document.createElement('h3');
    title.className = 'display-font';
    title.style.cssText = 'margin:0 0 10px; color:var(--primary-blue); font-size:1.8rem;';
    title.textContent = titleText;

    const body = document.createElement('p');
    body.className = 'body-font';
    body.style.cssText = 'margin:0; color:var(--text-light);';
    body.textContent = bodyText;

    panel.append(title, body);

    if (showLocationButton) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn primary-btn pill-btn';
        button.style.marginTop = '18px';
        button.textContent = 'Set Location';
        button.addEventListener('click', openLocationModal);
        panel.appendChild(button);
    }

    resultsContainer.appendChild(panel);
}

function renderSavedLocationVenuesView() {
    // Venues uses the same filter chips as Search Results, scoped to the saved city or country.
    document.getElementById('main-filters')?.classList.remove('hidden');
    contextHeader?.classList.remove('hidden');
    resetBackButton('← Back to Results', 'results');
    document.getElementById('btn-back-to-results')?.classList.add('result-back-hidden');

    const title = document.getElementById('context-title');
    const desc = document.getElementById('context-desc');
    const savedScope = getSavedSearchScope();
    const isAllCities = savedScope.scope === 'all';
    const displayLocation = isAllCities ? 'ALL CITIES' : savedScope.label;

    const scopedVenues = isAllCities
        ? getPublicVenues()
        : getPublicVenues().filter(venue => venueMatchesSavedLocation(venue, savedScope));

    // Keep the filter bar available even when a tag produces zero matching cards.
    renderDynamicFilters(scopedVenues);

    const matchingVenues = sortSavedLocationVenues(
        activeFilters.length > 0
            ? scopedVenues.filter(venue => {
                const tags = getVenueTags(venue);
                return activeFilters.every(filterTag => tags.includes(filterTag));
            })
            : scopedVenues
    );

    if (title) {
        title.replaceChildren(document.createTextNode('VENUES IN '));

        const locationPill = document.createElement('button');
        locationPill.type = 'button';
        locationPill.className = 'location-city-pill pill-btn';
        locationPill.textContent = displayLocation;
        locationPill.title = 'Change location';
        locationPill.setAttribute('aria-label', `Change location from ${displayLocation.toLowerCase()}`);
        locationPill.addEventListener('click', openLocationModal);
        title.appendChild(locationPill);
    }

    if (desc) {
        const scopedPhrase = isAllCities
            ? 'across all cities'
            : `in ${savedScope.label}`;

        if (activeFilters.length > 0) {
            desc.textContent = matchingVenues.length === 1
                ? `1 public venue listing matches these tags ${scopedPhrase}.`
                : `${matchingVenues.length} public venue listings match these tags ${scopedPhrase}.`;
        } else if (isAllCities) {
            desc.textContent = matchingVenues.length === 1
                ? '1 public venue listing across all cities.'
                : `${matchingVenues.length} public venue listings across all cities.`;
        } else {
            desc.textContent = matchingVenues.length === 1
                ? `1 public venue listing in ${savedScope.label}.`
                : `${matchingVenues.length} public venue listings in ${savedScope.label}.`;
        }
    }

    if (!matchingVenues.length) {
        renderSavedLocationEmptyState(
            activeFilters.length > 0
                ? 'NO VENUES MATCH THESE TAGS'
                : (isAllCities ? 'NO PUBLIC VENUES YET' : `NO PUBLIC VENUES YET FOR ${displayLocation.toUpperCase()}`),
            activeFilters.length > 0
                ? 'Choose another tag or select All to clear the venue filters.'
                : (isAllCities
                    ? 'More coming soon.'
                    : `More listings in ${savedScope.label} will appear here as they are added.`)
        );
        return;
    }

    renderListings(matchingVenues, true);
}


function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
}

function fuzzyMatch(text, query) {
    if(!query) return true;
    const str = normalizeSearchText(text);
    const q = normalizeSearchText(query);
    if (str.includes(q)) return true;
    
    const words = str.split(/[^a-z0-9]+/);
    const queryWords = q.split(/[^a-z0-9]+/);
    
    for(let qw of queryWords) {
        if(!qw) continue;
        let matchFound = false;
        for(let w of words) {
            if(!w) continue;
            if(Math.abs(w.length - qw.length) <= 1) {
                if(getLevenshteinDistance(w, qw) <= 1) { matchFound = true; break; }
            }
        }
        if(!matchFound) return false; 
    }
    return true;
}

function toggleFavorite(id, btnElement) {
    const index = userFavorites.indexOf(id);
    if(index > -1) {
        userFavorites.splice(index, 1);
        btnElement?.classList.remove('active-star');
        showToast("Removed from Favourites");
    } else {
        userFavorites.push(id);
        btnElement?.classList.add('active-star');
        showToast("Added to Favourites ⚜️");
    }
    saveCurrentToBundle();
    if(window.location.hash === '#favorites') renderFavoritesView();
}

window.toggleEventFavorite = function(eventId, btnElement, isRemovalView = false) {
    const index = userEvents.indexOf(eventId);
    if(index > -1) {
        if(isRemovalView && !confirm("Remove this event from your list?")) return;
        userEvents.splice(index, 1);
        btnElement?.classList.remove('active-star');
        if(!isRemovalView) showToast("Removed from Events");
    } else {
        userEvents.push(eventId);
        btnElement?.classList.add('active-star');
        showToast("Saved to 💖 Events");
    }
    saveCurrentToBundle();
    if(window.location.hash === '#myevents') renderMyEventsView();
}

function renderFavoritesView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    document.getElementById('btn-back-to-results')?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "⚜️ MY FAVOURITES";
    if(cDesc) cDesc.innerText = "Venues you have starred locally.";
    
    const favVenues = (venues||[]).filter(v => userFavorites.includes(v.Venue_ID));
    renderListings(favVenues, true);
}

function renderMyEventsView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    document.getElementById('shortlist-view-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');

    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = '💖 MY EVENTS';
    if(cDesc) cDesc.innerText = 'Events you have pinned locally, ordered by date.';

    const cityFilterContainer = document.getElementById('event-city-filters');
    if(cityFilterContainer) {
        cityFilterContainer.classList.remove('hidden');
        cityFilterContainer.innerHTML = '';
    }

    let myEvts = (events || [])
        .filter(event => userEvents.includes(event.Event_ID))
        .map(event => getEventDisplayOccurrence(event))
        .filter(Boolean)
        .sort(compareEventOccurrences);

    if(myEvts.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = '<p class="shortlist-empty-state">No saved events.</p>';
        cityFilterContainer?.classList.add('hidden');
        return;
    }

    const cities = new Set();
    myEvts.forEach(event => {
        const venue = (venues || []).find(item => item.Venue_ID === event.Venue_ID);
        if(venue) getCityTokens(venue).forEach(city => cities.add(city));
    });

    const createCityBtn = (cityName, label) => {
        if(!cityFilterContainer) return;
        const button = document.createElement('button');
        button.className = `chip pill-btn ${currentEventCityFilter === cityName ? 'active' : ''}`;
        button.textContent = label;
        button.addEventListener('click', () => {
            currentEventCityFilter = cityName;
            renderMyEventsView();
        });
        cityFilterContainer.appendChild(button);
    };

    createCityBtn('All', 'All');
    [...cities].sort((a, b) => a.localeCompare(b)).forEach(city => createCityBtn(city, city));

    if(currentEventCityFilter !== 'All') {
        myEvts = myEvts.filter(event => {
            const venue = (venues || []).find(item => item.Venue_ID === event.Venue_ID);
            return venue && venueMatchesCity(venue, currentEventCityFilter);
        });
    }

    if(resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('my-events-grid');
    }

    if (!myEvts.length) {
        if(resultsContainer) resultsContainer.innerHTML = '<p class="shortlist-empty-state">No saved events match this city.</p>';
        return;
    }

    myEvts.sort(compareEventOccurrences).forEach(event => {
        const venue = (venues || []).find(item => item.Venue_ID === event.Venue_ID) || null;
        const venueName = venue ? venue.Name : 'Unknown Venue';
        const safeEventName = String(event.Event_Name || 'Event').replace(/'/g, "\\'");
        const eventTags = getEventTags(event, venue);
        const card = document.createElement('article');
        card.className = `card my-event-card${isMenOnlyEvent(event, venue) ? ' card--men-only-event' : ''}`;
        card.innerHTML = `
            <div class="my-event-card-inner">
                ${buildEventDateBadge(event, 'my-event-date')}
                <div class="my-event-content">
                    <div class="my-event-header">
                        <div class="my-event-heading">
                            <h3 class="my-event-title display-font">${formatEventTitleForDisplay(event.Event_Name)}</h3>
                            <p class="my-event-meta">${escapeHTML(getEventDisplayMeta(event))}${venueName ? ` · ${escapeHTML(venueName)}` : ''}</p>
                        </div>
                        <div class="my-event-actions" aria-label="Event actions">
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${event.Event_ID}#myevents', '${safeEventName}')" title="Share event">${BR_ICONS.share}</button>
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.flagListing('${event.Event_ID}', '${safeEventName}', 'Event Report')" title="Report event"><img src="report.png" alt="" aria-hidden="true"></button>
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.promptAddEventToShortlist('${event.Event_ID}')" title="Add to shortlist"><img src="shortlist.png" alt="" aria-hidden="true"></button>
                            <button type="button" class="event-action-btn fav-btn active-star" onclick="event.stopPropagation(); toggleEventFavorite('${event.Event_ID}', null, true)" title="Remove from My Events">💖</button>
                        </div>
                    </div>
                    ${event.Event_Description ? `<div class="my-event-description">${formatAboutText(event.Event_Description)}</div>` : ''}
                    ${eventTags.length ? `<div class="feature-chips my-event-tags">${renderTagPills(eventTags, 'font-size:0.72rem; padding:3px 8px;')}</div>` : ''}
                </div>
            </div>
        `;
        card.addEventListener('click', clickEvent => {
            if (clickEvent.target.closest('a, button')) return;
            if (venue?.Venue_ID) {
                venueReturnHash = '#myevents';
                window.location.hash = `#venue=${venue.Venue_ID}`;
            }
        });
        resultsContainer?.appendChild(card);
    });
}

function renderTravelFullView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "🚄 MY TRAVEL PINS";
    if(cDesc) cDesc.innerText = "Cities you plan to visit.";
    
    if(resultsContainer) resultsContainer.innerHTML = '';

    if(userTravel.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No travel pins saved yet.</p>`;
        return;
    }

    userTravel.forEach(city => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash='#results'; handleRouting();" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${city}</h3>
                </div>
                <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete ${city}?')){ removeTravel('${city}'); }">❌</button>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

window.openEmojiPicker = function(listName) {
    const listHtml = SHORTLIST_EMOJIS.map(e => `<span style="font-size:1.5rem; cursor:pointer; padding:5px;" onclick="userShortlistEmojis['${listName}']='${e}'; saveCurrentToBundle(); renderShortlistsFullView(); document.getElementById('emoji-picker-modal').classList.add('hidden');">${e}</span>`).join('');
    let modal = document.getElementById('emoji-picker-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'emoji-picker-modal';
        modal.className = 'modal hidden';
        modal.style.zIndex = '4000';
        modal.innerHTML = `
            <div class="modal-content small-modal" style="background:var(--panel-dark); max-width: 300px;">
                <div class="modal-header"><h3 class="display-font" style="margin:0; font-size:1.2rem;">Pick Icon</h3><button class="btn-close" onclick="document.getElementById('emoji-picker-modal').classList.add('hidden');" style="position:relative; right:auto; top:auto;">❌</button></div>
                <div class="modal-body" style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.querySelector('.modal-body').innerHTML = listHtml;
    modal.classList.remove('hidden');
}

function shareShortlist(name) {
    const eIcon = userShortlistEmojis[name] || '📑';
    const entries = getShortlistEntries(name);
    const ids = entries.map(entry => shortlistToken(entry.type, entry.id)).join(',');
    const url = `${window.location.origin}${window.location.pathname}#sharedlist?title=${encodeURIComponent(name)}&emoji=${encodeURIComponent(eIcon)}&ids=${encodeURIComponent(ids)}`;
    shareURL(url, `Backroom Shortlist: ${name}`);
}

function renderShortlistsFullView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');

    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = '<img src="shortlist.png" style="width:55px; vertical-align:bottom; margin-right:8px;"> MY SHORTLISTS';
    if(cDesc) cDesc.innerText = 'Build a mixed list of venues and events, then send it to someone else to plan a night out.';

    const newBtn = document.getElementById('btn-new-shortlist-view');
    if(newBtn) {
        newBtn.classList.remove('hidden');
        newBtn.onclick = () => {
            const name = prompt('Enter new shortlist name:');
            if(name && name.trim() !== '') {
                userShortlists[name.trim()] = [];
                userShortlistEmojis[name.trim()] = SHORTLIST_EMOJIS[Math.floor(Math.random() * SHORTLIST_EMOJIS.length)];
                saveCurrentToBundle();
                renderShortlistsFullView();
            }
        };
    }

    if(resultsContainer) resultsContainer.innerHTML = '';
    const lists = Object.keys(userShortlists || {});

    if(lists.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = '<p style="text-align:center; color:var(--label-grey); margin-top:20px; width:100%; grid-column:1 / -1;">No shortlists created yet.</p>';
        return;
    }

    lists.forEach(name => {
        const eIcon = userShortlistEmojis[name] || '📑';
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div style="font-size:2rem; margin-right:15px; cursor:pointer;" onclick="event.stopPropagation(); openEmojiPicker('${name.replace(/'/g, "\\'")}')" title="Tap to change icon">${eIcon}</div>
                <div onclick="window.location.hash='#shortlist=${encodeURIComponent(name)}';" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${name}</h3>
                    <p class="meta-text" style="margin-top:5px;">${formatShortlistCount(name)}</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="icon-btn" onclick="event.stopPropagation(); shareShortlist('${name.replace(/'/g, "\\'")}')" title="Share" style="font-size:1.35rem;">${BR_ICONS.share}</button>
                    <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete shortlist ${name.replace(/'/g, "\\'")}?')){ delete userShortlists['${name.replace(/'/g, "\\'")}']; saveCurrentToBundle(); renderShortlistsFullView(); }">❌</button>
                </div>
            </div>
        `;
        resultsContainer?.appendChild(card);
    });
}

window.switchProfileTab = function(step) {
    const p1 = document.getElementById('profile-mob-view-1');
    const p2 = document.getElementById('profile-mob-view-2');
    const p3 = document.getElementById('profile-mob-view-3');
    
    const t1 = document.getElementById('ptab-1');
    const a1 = document.getElementById('parr-1');
    const t2 = document.getElementById('ptab-2');
    const a2 = document.getElementById('parr-2');
    const t3 = document.getElementById('ptab-3');

    if(p1 && p2 && p3 && t1 && t2 && t3) {
        p1.classList.add('mobile-hidden-tab');
        p2.classList.add('mobile-hidden-tab');
        p3.classList.add('mobile-hidden-tab');
        
        [t1, t2, t3].forEach(t => { t.classList.remove('tutorial-highlight'); t.classList.remove('active-profile-tab'); });
        
        if(a1) { a1.classList.remove('tutorial-highlight'); a1.classList.remove('active-profile-tab'); }
        if(a2) { a2.classList.remove('tutorial-highlight'); a2.classList.remove('active-profile-tab'); }

        if(step === 1) { 
            p1.classList.remove('mobile-hidden-tab'); 
            t1.classList.add('tutorial-highlight', 'active-profile-tab');
            if(a1) a1.classList.add('tutorial-highlight', 'active-profile-tab');
        }
        else if(step === 2) { 
            p2.classList.remove('mobile-hidden-tab'); 
            t2.classList.add('tutorial-highlight', 'active-profile-tab');
            if(a2) a2.classList.add('tutorial-highlight', 'active-profile-tab');
        }
        else if(step === 3) { 
            p3.classList.remove('mobile-hidden-tab'); 
            t3.classList.add('tutorial-highlight', 'active-profile-tab');
        }
    }
}

function renderProfileAvatars() {
    const grid = document.getElementById('avatar-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const switcher = document.getElementById('profile-switcher');
    if (switcher) {
        switcher.innerHTML = '<option value="">Switch Profile...</option>';
        Object.keys(savedProfiles).forEach(pName => {
            switcher.innerHTML += `<option value="${pName}">${pName}</option>`;
        });
    }

    let filterContainer = document.getElementById('avatar-filters');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'avatar-filters';
        filterContainer.style.display = 'flex';
        filterContainer.style.flexWrap = 'wrap';
        filterContainer.style.justifyContent = 'center';
        filterContainer.style.gap = '8px';
        filterContainer.style.marginBottom = '15px';
        grid.parentNode.insertBefore(filterContainer, grid);
    }
    
    const ageTags = ['Young', 'Prime', 'Mature'];
    const funTags = ['Fun'];
    const fetishTags = ['Ink', 'Inked', 'Leather', 'Rubber', 'Puppy'];
    
    let html = `<div class="tag-row-blue" style="display:flex; justify-content:center; gap:8px;">`;
    html += `<button class="chip pill-btn ${activeAvatarCategories.length === 0 ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; flex-shrink:0;" data-val="All">All</button>`;
    html += ageTags.map(c => `<button class="chip pill-btn ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: var(--primary-blue); border-color: var(--primary-blue); flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div><div class="tag-row-yellow" style="display:flex; justify-content:center; gap:8px;">`;
    html += funTags.map(c => `<button class="chip pill-btn avatar-fun-chip ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: #f3c743; border-color: #f3c743; flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div><div class="tag-row-red" style="display:flex; justify-content:center; gap:8px;">`;
    html += fetishTags.map(c => `<button class="chip pill-btn ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: var(--bright-red-orange); border-color: var(--bright-red-orange); flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div>`;

    filterContainer.innerHTML = html;
    
    filterContainer.querySelectorAll('.chip').forEach(btn => {
        btn.onclick = () => { 
            const val = btn.getAttribute('data-val');
            if(val === 'All') activeAvatarCategories = [];
            else {
                const idx = activeAvatarCategories.indexOf(val);
                if(idx > -1) activeAvatarCategories.splice(idx, 1);
                else activeAvatarCategories.push(val);
            }
            renderProfileAvatars(); 
        };
    });

    let displayData = [...avatarData];
    if (activeAvatarCategories.length === 0) {
        displayData.unshift({ file: 'noavatar01.png', label: 'Default', category: [] });
    }

    const filteredData = activeAvatarCategories.length === 0 ? displayData : displayData.filter(a => {
        let cats = Array.isArray(a.category) ? a.category : [a.category];
        return activeAvatarCategories.every(cat => cats.includes(cat));
    });

    filteredData.forEach(avatar => {
        const item = document.createElement('div');
        item.className = 'avatar-item';
        if (avatar.file === userProfile.avatar) item.classList.add('selected');
        
        // v0.66 Title fallback for desktop span hiding
        item.innerHTML = `<img src="Profile_images/${avatar.file}" onerror="this.parentElement.style.display='none';" alt="${avatar.label}" title="${avatar.label}"><span>${avatar.label}</span>`;
        
        item.addEventListener('click', () => {
            userProfile.avatar = avatar.file;
            showToast(`You selected ${avatar.label || avatar.file}`);
            const previewImg = document.getElementById('profile-avatar-preview');
            if(previewImg) {
                previewImg.src = `Profile_images/${avatar.file}`;
                previewImg.parentElement.classList.remove('hidden');
            }
            
            document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
        });
        grid.appendChild(item);
    });
    
    const initialPreviewImg = document.getElementById('profile-avatar-preview');
    if(initialPreviewImg) {
        if(userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
            initialPreviewImg.src = `Profile_images/${userProfile.avatar}`;
            initialPreviewImg.parentElement.classList.remove('hidden');
        } else {
            initialPreviewImg.parentElement.classList.add('hidden');
        }
    }
}

function renderProfileStats() {
    const container = document.getElementById('profile-stats-container');
    if(!container) return;
    
    const favCount = userFavorites.length;
    const eventCount = userEvents.length;
    const shortCount = Object.keys(userShortlists).length;
    const travelCount = userTravel.length;
    
    let html = `
        <h3 class="desktop-only-text display-font" style="color:var(--primary-blue); margin-bottom:10px; font-size:1.2rem;">YOUR PROFILE CONTAINS</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    const createStatHtml = (title, count, items, icon) => {
        let itemsHtml = items.length > 0 ? `<div class="hidden meta-text" style="padding-left:30px; margin-top:8px; font-size:0.95rem; line-height: 1.4; color: var(--text-light);">${items.join('<br>')}</div>` : '<div class="hidden meta-text" style="padding-left:30px; margin-top:8px; font-size:0.95rem; color: var(--text-light);">None</div>';
        return `
            <div style="background: var(--panel-dark); border: 1px solid var(--panel-mid); padding: 12px; border-radius: var(--radius-card); cursor: pointer;" onclick="const d=this.querySelector('.meta-text'); if(d) d.classList.toggle('hidden');">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size: 1.05rem; display:flex; align-items:center; gap:8px;">${icon} <span>${title}</span></strong>
                    <span style="background:var(--primary-blue); color:#fff; padding:3px 10px; border-radius:var(--radius-pill); font-size:0.9rem; font-weight: bold;">${count}</span>
                </div>
                ${itemsHtml}
            </div>
        `;
    };

    const favNames = userFavorites.map(id => {
        const v = venues.find(v => v.Venue_ID === id);
        return v ? v.Name : id;
    });
    const eventNames = userEvents.map(id => {
        const e = events.find(e => e.Event_ID === id);
        return e ? e.Event_Name : id;
    });
    const shortNames = Object.keys(userShortlists);
    
    html += createStatHtml('Saved Locations', travelCount, userTravel, '<img src="location.png" style="width:18px;">');
    html += createStatHtml('Shortlists', shortCount, shortNames, '<img src="shortlist.png" style="width:18px;">');
    html += createStatHtml('Saved Events', eventCount, eventNames, '💖');
    html += createStatHtml('Saved Venues', favCount, favNames, '⚜️');
    
    html += `</div>`;
    container.innerHTML = html;
    const mobileHtml = html.replace('desktop-only-text ', '');
    const containerMob = document.getElementById('profile-stats-container-mob');
    if(containerMob) containerMob.innerHTML = '';
    const containerMobFirst = document.getElementById('profile-stats-container-mob-first');
    if(containerMobFirst) containerMobFirst.innerHTML = mobileHtml;
}

function openProfileMenu() {
    const pName = document.getElementById('profile-name');
    if(pName) pName.value = userProfile.name || '';
    renderProfileAvatars();
    renderProfileStats();
    
    if(window.innerWidth <= 768) {
        window.switchProfileTab(1);
    }
    
    // v0.66 Dynamic Fallback welcome string
    const privacyGreeting = document.getElementById('profile-privacy-greeting');
    let dispName = 'Guest';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label; 
    }
    if(privacyGreeting) privacyGreeting.innerText = `Hi ${dispName},`;

    const mobileFunctions = document.querySelector('#profile-mob-view-3 .mobile-only');
    if(mobileFunctions) {
        let mobileHi = document.getElementById('profile-mobile-hi-box');
        if(!mobileHi) {
            mobileHi = document.createElement('div');
            mobileHi.id = 'profile-mobile-hi-box';
            mobileHi.className = 'profile-hi-mobile-box';
            const tutorialButton = document.getElementById('btn-profile-tutorial-mob');
            const btnStack = mobileFunctions.querySelector('.profile-btn-stack');
            if(tutorialButton) tutorialButton.insertAdjacentElement('afterend', mobileHi);
            else if(btnStack) btnStack.appendChild(mobileHi);
            else mobileFunctions.prepend(mobileHi);
        }
        mobileHi.innerHTML = `<h4>Hi ${dispName},</h4><p>In this screen you can edit your profile. Your favorites, shortlists, events, travel pins and profile choices are stored locally in this browser. Export your data if you want a backup.</p>`;
    }

    const profileWipeToast = document.getElementById('profile-wipe-toast');
    if(profileWipeToast) {
        const wipeAllBtn = profileWipeToast.querySelector('#btn-wipe-all');
        const copyBtn = profileWipeToast.querySelector('#btn-wipe-profile-only');
        if(wipeAllBtn) wipeAllBtn.innerText = "Make a new blank profile";
        if(copyBtn) copyBtn.innerText = "Make a copy of this profile";
    }


    markProfileOpenState();
    profileModal?.classList.remove('hidden');
}

function exportUserData() {
    const data = {
        profile: userProfile,
        saved_profiles: savedProfiles,
        favorites: userFavorites,
        shortlists: userShortlists,
        shortlistEmojis: userShortlistEmojis,
        events: userEvents,
        travel: userTravel,
        location: JSON.parse(localStorage.getItem('br_location') || 'null')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `backroom_userdata_${new Date().toISOString().split('T')[0]}.json`; 
    a.click();
}

function importUserData(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if(data.profile) { userProfile = data.profile; localStorage.setItem('br_profile', JSON.stringify(userProfile)); }
            if(data.saved_profiles) { savedProfiles = data.saved_profiles; localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles)); }
            if(data.favorites) { userFavorites = data.favorites; localStorage.setItem('br_favorites', JSON.stringify(userFavorites)); }
            if(data.shortlists) { userShortlists = data.shortlists; localStorage.setItem('br_shortlists', JSON.stringify(userShortlists)); }
            if(data.shortlistEmojis) { userShortlistEmojis = data.shortlistEmojis; localStorage.setItem('br_shortlist_emojis', JSON.stringify(userShortlistEmojis)); }
            if(data.events) { userEvents = data.events; localStorage.setItem('br_events', JSON.stringify(userEvents)); }
            if(data.travel) { userTravel = data.travel; localStorage.setItem('br_travel', JSON.stringify(userTravel)); }
            if(data.location) { localStorage.setItem('br_location', JSON.stringify(data.location)); updateLocationDisplay(data.location); }
            
            importInfo = { date: new Date().toLocaleString(), filename: file.name, userName: userProfile.name || 'Anonymous' };
            localStorage.setItem('br_import_info', JSON.stringify(importInfo));
            
            showToast("Data imported successfully!");
            setTimeout(() => window.location.reload(), 1000);
        } catch(err) {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
}

function checkImportPreview() {
    const previewBox = document.getElementById('import-preview-info');
    if(importInfo && previewBox) {
        previewBox.innerHTML = `<strong>Current Active File:</strong><br>Name: ${importInfo.userName}<br>File: ${importInfo.filename}<br>Loaded: ${importInfo.date}`;
        previewBox.classList.remove('hidden');
    }
}

// v0.66 Random Placeholder Infinite Loop Breaker
function handleImageCarousel(imgElement) {
    if (!imgElement || imgElement.dataset.carouselBound) return;
    imgElement.dataset.carouselBound = 'true';

    imgElement.addEventListener('click', event => {
        event.stopPropagation();

        const id = imgElement.getAttribute('data-id');
        if (!id) return;

        const index = parseInt(imgElement.getAttribute('data-index') || '1', 10) + 1;
        const number = String(index).padStart(2, '0');
        const nextSource = `Venue_images/${id}-${number}.jpg`;

        const testImage = new Image();
        testImage.onload = () => {
            imgElement.src = nextSource;
            imgElement.setAttribute('data-index', String(index));
            showToast('Double tap the venue name to open');
        };
        testImage.onerror = () => {
            // Specialised placeholders stay specialised. Normal venues keep the existing pool.
            const previousFallback = String(imgElement.src || '').split('/').pop();
            const fallback = imgElement.dataset.fallbackImage
                || getGenericPlaceholderImage(id, previousFallback);
            imgElement.onerror = null;
            imgElement.src = fallback;
            imgElement.setAttribute('data-index', '1');
            showToast('Double tap the venue name to open');
        };
        testImage.src = nextSource;
    });
}


function renderListings(data, isContextView = false, targetContainer = resultsContainer) {
    const container = targetContainer || resultsContainer;
    if(container) container.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);

    if(!data || data.length === 0) {
        let emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No venues found.</p>`;

        const locationInput = getLocationInput();
        const userLat = parseFloat(locationInput?.dataset.lat || 'NaN');
        const userLon = parseFloat(locationInput?.dataset.lon || 'NaN');

        if (!isNaN(userLat) && !isNaN(userLon) && venues.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            getPublicVenues().forEach(v => {
                if(!hasFixedCoordinates(v)) return;
                const dist = getDistanceFromLatLonInKm(userLat, userLon, parseFloat(v.Latitude), parseFloat(v.Longitude));
                if (dist < minDist) { minDist = dist; nearest = v; }
            });

            if (nearest && minDist !== Infinity) {
                const distRounded = Math.round(minDist);
                emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">
                    <img src="location.png" style="width:40px; margin-bottom:10px;"><br>
                    <span style="color: var(--bright-red-orange); font-family: 'Antonio', sans-serif; font-size: 1.5rem; text-transform: uppercase;">No venues found nearby</span><br><br>
                    <a href="javascript:void(0)" onclick="const s = document.getElementById('search-input'); if(s) s.value='${getCityTokens(nearest)[0] || nearest.City}'; window.location.hash='#results'; applyFilters();" style="color:var(--primary-blue); font-weight:bold; font-size:1.1rem; text-decoration:underline;">
                        Closest venue is ${distRounded} km away in ${getCityTokens(nearest)[0] || nearest.City}.<br>Click here to load ${getCityTokens(nearest)[0] || nearest.City}.
                    </a>
                </p>`;
            }
        }
        if(container) container.innerHTML = emptyHtml;
        return;
    }

    let previousGenericFallback = '';
    data.forEach(venue => {
        let nextEventHtml = '';
        const venueEvents = getVenueEventOccurrences(venue.Venue_ID, { includePast: false, activeOnly: true, now: new Date() });
        if(venueEvents.length > 0) {
            const nextE = venueEvents[0];
            const recurrenceText = nextE.Is_Recurring ? ` · ${nextE.Recurrence_Label}` : '';
            nextEventHtml = `<div class="card-next-event">📅 Next: ${formatEventTitleForDisplay(nextE.Event_Name)} (${formatDateToDDMMYYYY(getEventDisplayDate(nextE))})${recurrenceText}</div>`;
        }

        const isFav = userFavorites.includes(venue.Venue_ID);
        const isShortlisted = hasItemInAnyShortlist('venue', venue.Venue_ID);
        const shortDescSource = venue.Description || '';
        const shortDesc = shortDescSource.length > 90 ? shortDescSource.substring(0, 90) + '...' : shortDescSource;
        const card = document.createElement('div');
        const cardStyleClass = isCruisingAreaVenue(venue)
            ? ' card--cruising-area'
            : isMenOnlyTaggedVenue(venue)
                ? ' card--men-only'
                : '';
        card.className = `card${cardStyleClass}`;

        const fallbackImage = getVenueFallbackImage(venue, previousGenericFallback);
        const baseImageSrc = getVenueImageSource(venue, fallbackImage);
        previousGenericFallback = isRotatingGenericPlaceholder(fallbackImage) ? fallbackImage : '';
        const badgeLabel = getCardStatusLabel(venue);
        const badgeClass = getCardStatusClass(venue);

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img class="venue-image centered-image" src="${baseImageSrc}" onerror="this.onerror=null; this.src='${fallbackImage}'" data-fallback-image="${fallbackImage}" data-id="${venue.Venue_ID}" data-index="1" title="Tap to see next photo">
            </div>
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${venue.Name || 'Unnamed venue'}</h3><div class="card-meta"><img src="location.png" style="width:14px; vertical-align:middle;"> ${formatVenueLocation(venue)}</div></div>
                    <div class="status-badge ${badgeClass}">${badgeLabel}</div>
                </div>
                <div class="card-about">${shortDesc}</div>
                ${nextEventHtml}
                <div class="card-stats">
                    ${renderCommunityStats(venue.Venue_ID)}
                    <div class="card-quick-actions" aria-label="Venue actions">
                        <span class="icon-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}', '${String(venue.Name || '').replace(/'/g, "\\'")}')" title="Share" style="font-size:1.5rem;">${BR_ICONS.share}</span>
                        <span class="icon-btn shortlist-card-btn ${isShortlisted ? 'active-shortlist' : ''}" data-venue-id="${venue.Venue_ID}" onclick="event.stopPropagation(); window.promptAddVenueToShortlist('${venue.Venue_ID}')" title="Add ${String(venue.Name || 'venue').replace(/"/g, '&quot;')} to Shortlist"><img src="shortlist.png" alt="" aria-hidden="true"></span>
                        <span class="icon-btn" onclick="event.stopPropagation(); window.flagListing('${venue.Venue_ID}', '${String(venue.Name || '').replace(/'/g, "\\'")}', 'Venue Report')" title="Report" style="display:flex; align-items:center; justify-content:center;"><img src="report.png" style="width:24px; height:24px; object-fit:contain;"></span>
                        <span class="star-btn icon-btn fav-btn ${isFav ? 'active-star' : ''}" style="font-size:1.8rem; line-height:1;">⚜️</span>
                    </div>
                </div>
            </div>
        `;

        handleImageCarousel(card.querySelector('.venue-image'));

        card.addEventListener('click', (e) => { 
            if(e.target.classList.contains('star-btn')) {
                toggleFavorite(venue.Venue_ID, e.target);
            } else if (!e.target.classList.contains('venue-image')) {
                if(selectedCardId === venue.Venue_ID) {
                    recordUserInteraction();
                    venueReturnHash = getCurrentListHashForVenueReturn();
                    window.location.hash = `#venue=${venue.Venue_ID}`; 
                } else {
                    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedCardId = venue.Venue_ID;
                    showToast("Double tap the venue name to open");
                }
            } 
        });
        if(container) container.appendChild(card);
    });
}

function formatLastUpdatedDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let year = '';
    let month = '';
    let day = '';

    // Preferred source format: YYYY-MM-DD. Also accepts the common DD-MM-YYYY,
    // DD/MM/YYYY and ISO timestamp forms already used by older listing exports.
    let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
    if (match) {
        [, year, month, day] = match;
    } else {
        match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (match) [, day, month, year] = match;
    }

    const numericMonth = Number(month);
    const numericDay = Number(day);
    const numericYear = Number(year);
    if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || !Number.isInteger(numericDay)) return '';

    const date = new Date(numericYear, numericMonth - 1, numericDay);
    if (
        date.getFullYear() !== numericYear ||
        date.getMonth() !== numericMonth - 1 ||
        date.getDate() !== numericDay
    ) return '';

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(numericDay).padStart(2, '0')} - ${months[numericMonth - 1]} - ${numericYear}`;
}

function getRatingTooltip(type, val) {
    if(!val) return '';
    const tooltips = {
        'Age': ['Young Crowd', 'Mixed Young', 'Mixed', 'Mixed Mature', 'Mature Crowd'],
        'Size': ['Tiny', 'Small', 'Medium', 'Large', 'Huge'],
        'Overall': ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
        'Darkroom': ['Basic', 'Standard', 'Good', 'Extensive', 'Maze'],
        'Cost': ['Cheap', 'Reasonable', 'Average', 'Expensive', 'Very Expensive'],
        'Location': ['Poorly Connected', 'Okay', 'Good', 'Great', 'Perfectly Located'],
        'Popularity': ['Quiet', 'Moderate', 'Busy', 'Very Busy', 'Packed']
    };
    if(tooltips[type] && tooltips[type][val-1]) return `${val}/5: ${tooltips[type][val-1]}`;
    return `${val}/5`;
}

function getRatingCells(val, type) {
    const raw = val;
    const isBlank = raw === null || raw === undefined || String(raw).trim() === '' || String(raw).toUpperCase() === 'NA' || String(raw).toUpperCase() === 'N/A';
    if (isBlank) {
        return `<div class="rating-not-rated">not yet rated</div>`;
    }

    const numericVal = parseInt(raw, 10);
    if (type === 'Darkroom' && numericVal === 0) {
        return `<div class="rating-no-darkroom" title="No darkroom">🚫</div>`;
    }
    if (Number.isNaN(numericVal) || numericVal <= 0) {
        return `<div class="rating-not-rated">not yet rated</div>`;
    }

    let html = '';
    for(let i=1; i<=5; i++) {
        const op = i <= numericVal ? '1' : '0.25';
        let asset = '';
        let iconSize = '26px';
        if (type === 'Age' || type === 'Popularity') iconSize = '31.2px';
        const tooltip = getRatingTooltip(type, i);
        if (type === 'Size') {
            asset = `<img src="Emoji/size0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else if (type === 'Age') {
            asset = `<img src="Emoji/age0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else {
            const map = { 'Overall': 'eggplant', 'General': 'eggplant', 'Darkroom': 'water', 'Cost': 'money', 'Location': 'peach', 'Popularity': 'busy' };
            const prefix = map[type] || 'eggplant';
            asset = `<img src="Emoji/${prefix}0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        }
        html += `<div class="rating-cell-target" style="opacity:${op}; display:flex; align-items:center; justify-content:center; cursor:pointer;" ontouchstart="event.preventDefault(); this.classList.add('flash-glow'); setTimeout(() => this.classList.remove('flash-glow'), 500); showToast('${tooltip.replace(/'/g, "\\'")}')">${asset}</div>`;
    }
    return html;
}

function openVenueModal(venue) {
    const isCruisingAreaDetail = isCruisingAreaVenue(venue);
    venueModal?.classList.toggle('venue-modal--cruising-area', isCruisingAreaDetail);
    void recordCommunityVenueView(venue?.Venue_ID);
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.innerText = venue.Name;
    
    const dynamicLayout = document.getElementById('modal-dynamic-layout');
    if(!dynamicLayout) return;

    const features = getVenueTags(venue);
    const featureHtml = renderTagPills(features);
    const modalImageFallback = getVenueFallbackImage(venue);
    const modalImageSource = getVenueImageSource(venue, modalImageFallback);

    const statsHtml = `
        ${renderCommunityStats(venue.Venue_ID)}
        ${buildSocialBar(venue)}
        <div class="feature-chips" style="margin-top: 15px;">${featureHtml}</div>
    `;
    
    const standardRatingTypes = [
        { label: 'Overall', key: 'Rating_General', type: 'Overall' },
        { label: 'Age Range', key: 'Rating_Age_Range', type: 'Age' },
        { label: 'Size', key: 'Rating_Size', type: 'Size' },
        { label: 'Darkroom', key: 'Rating_Darkroom', type: 'Darkroom' },
        { label: 'Cost', key: 'Rating_Cost', type: 'Cost' },
        { label: 'Location', key: 'Rating_Location', type: 'Location' },
        { label: 'Popularity', key: 'Rating_Busyness', type: 'Popularity' }
    ];
    const cruisingAreaRatingTypes = [
        { label: 'Overall', key: 'Rating_General', type: 'Overall' },
        { label: 'Age Range', key: 'Rating_Age_Range', type: 'Age' },
        { label: 'Location', key: 'Rating_Location', type: 'Location' },
        { label: 'Popularity', key: 'Rating_Busyness', type: 'Popularity' }
    ];
    const ratingTypes = isCruisingAreaVenue(venue) ? cruisingAreaRatingTypes : standardRatingTypes;

    let ratingsTableHtml = `<div class="ratings-table" style="display: grid; grid-template-columns: 1fr repeat(5, 30px); gap: 16px 8px; align-items: center; background-color: var(--near-black); padding: 15px; border-radius: var(--radius-card); border: 1px solid var(--panel-mid);">`;
    
    ratingsTableHtml += `
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: left; padding-right: 10px;">FEATURE</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">1</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">2</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">3</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">4</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">5</div>
    `;
    
    ratingTypes.forEach(r => {
        const val = venue[r.key];
        ratingsTableHtml += `
            <div style="font-size: 1rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding-right: 10px;">${r.label}</div>
            ${getRatingCells(val, r.type)}
        `;
    });
    
    ratingsTableHtml += `</div>`;

    const venueEvents = getVenueEventOccurrences(venue.Venue_ID, { includePast: true, activeOnly: false, now: new Date() });
    let eventsHtml = '';
    if(venueEvents.length > 0) {
        eventsHtml = `
            <div class="events-block"><h3>📅 UPCOMING EVENTS</h3>
        `;
        venueEvents.forEach(ev => {
            const isPast = ev.Is_Past;
            const isSaved = userEvents.includes(ev.Event_ID);
            const badgeData = getBadgeDateParts(getEventDisplayDate(ev));
            const safeEventName = String(ev.Event_Name || 'Event').replace(/'/g, "\'");
            eventsHtml += `
                <article class="event-card ${isPast ? 'past' : ''}${isMenOnlyEvent(ev, venue) ? ' event-card--men-only' : ''}">
                    <div class="event-date-badge" aria-label="${getEventDisplayDate(ev)}">
                        <span class="event-day">${badgeData.d}</span>
                        <span class="event-month">${badgeData.m}</span>
                        <span class="event-year">${badgeData.y}</span>
                    </div>
                    <div class="event-content">
                        <h4 class="event-title">${formatEventTitleForDisplay(ev.Event_Name)} ${isPast ? '<small>(Past)</small>' : ''}</h4>
                        <p class="event-meta meta-text">${getEventDisplayMeta(ev)}</p>
                        <div class="event-action-row" aria-label="Event actions">
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${ev.Event_ID}', '${safeEventName}')" title="Share ${safeEventName}">${BR_ICONS.share}</button>
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.flagListing('${ev.Event_ID}', '${safeEventName}', 'Event Report')" title="Report ${safeEventName}"><img src="report.png" alt="" aria-hidden="true"></button>
                            <button type="button" class="event-action-btn" onclick="event.stopPropagation(); window.promptAddEventToShortlist('${ev.Event_ID}')" title="Add ${safeEventName} to Shortlist"><img src="shortlist.png" alt="" aria-hidden="true"></button>
                            <button type="button" class="event-action-btn fav-btn ${isSaved ? 'active-star' : ''}" onclick="toggleEventFavorite('${ev.Event_ID}', this)" title="${isSaved ? 'Remove from My Events' : 'Save event'}">💖</button>
                        </div>
                        ${ev.Event_Description ? `<div class="event-description">${formatAboutText(ev.Event_Description)}</div>` : ''}
                    </div>
                </article>
            `;
        });
        eventsHtml += `</div>`;
    }
    const cruisingAreaMapLinks = isCruisingAreaDetail ? renderCruisingAreaMapLinks(venue) : '';
    const cruisingAreaHours = isCruisingAreaDetail ? getCruisingAreaHoursText(venue) : '';

    let openingHtml = '';
    if (isCruisingAreaDetail) {
        openingHtml = `
            <div class="cruising-area-hours"><strong>Hours:</strong> ${escapeHTML(cruisingAreaHours)}</div>
            ${cruisingAreaMapLinks}
            <hr class="cruising-area-about-divider">
        `;
    } else if (venue.Opening_Days || venue.Opening_Open_Time) {
        openingHtml = `
            <div style="margin-bottom: 15px; color: var(--text-light); line-height: 1.5;">
                <strong style="color: #fff;">Hours:</strong> ${venue.Opening_Days || ''} ${venue.Opening_Open_Time || ''} - ${venue.Opening_Close_Time || ''}<br>
                ${venue.Opening_Notes ? `<em>${venue.Opening_Notes}</em>` : ''}
            </div>
            <hr style="border: 0; height: 1px; background: var(--bright-red-orange); margin: 15px 0;">
        `;
    }

    const aboutDescription = isCruisingAreaDetail
        ? stripGenericCruisingAreaRules(venue.Description)
        : venue.Description;

    dynamicLayout.innerHTML = `
        <div class="modal-top-split${isCruisingAreaDetail ? ' cruising-area-detail-top' : ''}">
            <div class="modal-left-col">
                <div class="modal-image-container">
                    <img id="modal-venue-image" class="venue-image centered-image" src="${modalImageSource}" onerror="this.onerror=null; this.src='${modalImageFallback}'" data-fallback-image="${modalImageFallback}" data-id="${venue.Venue_ID}" data-index="1" title="Tap for next image">
                </div>
                
                <div class="desktop-stats">
                    <div class="desktop-stats-container">
                        ${statsHtml}
                    </div>
                </div>
            </div>

            <div class="modal-right-col${isCruisingAreaDetail ? ' cruising-area-detail-panel' : ''}">
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; flex-direction: column;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="btn-map" class="btn secondary-btn pill-btn" style="padding: 2px 8px; font-size: 0.75rem; width: auto; flex-shrink: 0;">🗺️ Directions</button>
                        <p class="meta-text" style="margin:0; color:#fff;"><strong>${venue.Address || ''}</strong></p>
                    </div>
                    ${venue.Nearest_Station ? `<p class="meta-text" style="margin:0; padding-left: 5px; color:#fff;">🚄 Station: ${venue.Nearest_Station}</p>` : ''}
                    ${formatLastUpdatedDate(venue.Last_Updated) ? `<p class="meta-text" style="margin:0; padding-left: 5px; color:var(--text-light);">⌛ Last updated: ${formatLastUpdatedDate(venue.Last_Updated)}</p>` : ''}
                </div>
                
                <div class="mobile-stats">
                    ${statsHtml}
                </div>
                
                ${ratingsTableHtml}
            </div>
        </div>
        
        <div class="full-width-about" style="background-color: var(--near-black); padding: 20px; border-radius: var(--radius-card); margin-bottom: 15px; margin-top: 15px;">
            <h3 class="display-font" style="color: var(--primary-blue); margin-bottom:10px;">ABOUT</h3>
            ${openingHtml}
            <div style="color: #fff; line-height: 1.5;">${formatAboutText(aboutDescription)}</div>
        </div>
        
        ${eventsHtml}
    `;

    const img = document.getElementById('modal-venue-image');
    if(img) handleImageCarousel(img);

    const starBtn = document.getElementById('modal-star');
    if(starBtn) {
        const isFav = userFavorites.includes(venue.Venue_ID);
        starBtn.className = `icon-btn fav-btn ${isFav ? 'active-star' : ''}`;
        starBtn.onclick = () => toggleFavorite(venue.Venue_ID, starBtn);
    }

    const shortBtn = document.getElementById('modal-shortlist');
    if(shortBtn) {
        const isShortlisted = hasItemInAnyShortlist('venue', venue.Venue_ID);
        shortBtn.className = `icon-btn fav-btn ${isShortlisted ? 'active-star' : ''}`;
        shortBtn.innerHTML = '<img src="shortlist.png" style="width:24px;">';
        shortBtn.onclick = () => promptAddToShortlist(venue);
    }
    
    const shareBtn = document.getElementById('modal-share');
    if(shareBtn) {
        shareBtn.innerHTML = BR_ICONS.share;
        shareBtn.onclick = () => shareURL(`${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}`, venue.Name);
    }
    
    const reportBtn = document.getElementById('modal-report');
    if(reportBtn) {
        reportBtn.onclick = () => window.flagListing(venue.Venue_ID, venue.Name, 'Venue Report');
    }
    
    const mapBtn = document.getElementById('btn-map');
    if(mapBtn) {
        mapBtn.onclick = () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS && venue.Apple_Maps_URL && venue.Apple_Maps_URL.trim() !== '') {
                window.open(venue.Apple_Maps_URL, '_blank');
                return;
            } else if (!isIOS && venue.Google_Maps_URL && venue.Google_Maps_URL.trim() !== '') {
                window.open(venue.Google_Maps_URL, '_blank');
                return;
            }
            
            const mapQuery = venue.Native_Map_Query || venue.Address || venue.Name || '';
            const encodedQuery = encodeURIComponent(mapQuery.trim());
            if (isIOS) {
                window.open(`https://maps.apple.com/?q=${encodedQuery}`, '_blank');
            } else {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`, '_blank');
            }
        };
    }

    venueModal?.classList.remove('hidden');
}

async function shareURL(url, title) {
    if (navigator.share) {
        try { await navigator.share({title: title, url: url}); } catch (e) {}
    } else {
        navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard!");
    }
}

function saveLocation() {
    recordUserInteraction();

    const locationInput = getLocationInput();
    const postcode = document.getElementById('loc-postcode')?.value.trim() || '';
    const rawLocation = locationInput?.value || '';
    const resolved = resolveLocationInput(rawLocation, getMapResolvedLocation(rawLocation));

    if (!resolved.valid) {
        showToast(resolved.message || 'Choose a recognised city or country, or leave Location blank to browse all cities.');
        return;
    }

    const loc = {
        country: resolved.country,
        city: resolved.city,
        postcode: resolved.scope === 'all' ? '' : postcode,
        scope: resolved.scope
    };

    localStorage.setItem('br_location', JSON.stringify(loc));

    if (locationInput) {
        locationInput.value = getLocationDisplayText(loc);
        locationInput.dataset.lat = '';
        locationInput.dataset.lon = '';
        clearMapResolvedLocation(locationInput);
    }

    updateLocationDisplay(loc);
    updateLocationActionLabel(locationInput?.value || '');
    updateLocationDraftStatus(locationInput?.value || '');
    announceLocationChange(loc);
    showToast(`Location set to ${getLocationDisplayText(loc) || 'All Cities'}.`);

    // Location scope and free-text search are intentionally separate. Saving a scope
    // starts a clean location-based result view rather than a double-filtered search.
    if (searchInput) searchInput.value = '';
    updateSearchClearButton();

    locModal?.classList.add('hidden');

    // Location sets the shared scope for Results, Venues and Events.
    if (window.location.hash === '#results') handleRouting();
    else window.location.hash = '#results';
}

function clearLocation() {
    localStorage.removeItem('br_location');

    const locationInput = getLocationInput();
    const postcodeInput = document.getElementById('loc-postcode');
    const map = document.getElementById('loc-map');
    const mapPlaceholder = document.getElementById('map-preview-placeholder');

    if (locationInput) {
        locationInput.value = '';
        locationInput.dataset.lat = '';
        locationInput.dataset.lon = '';
        clearMapResolvedLocation(locationInput);
    }
    if (postcodeInput) postcodeInput.value = '';
    if (map) map.style.display = 'none';
    if (mapPlaceholder) mapPlaceholder.classList.remove('hidden');

    updateLocationDisplay(null);
    updateLocationActionLabel('');
    updateLocationDraftStatus('');
    announceLocationChange({ scope: 'all', city: '', country: '', postcode: '' });

    if (isResultsRouteHash()) handleRouting();
}

function loadSavedLocation() {
    const loc = getSavedLocation();
    const locationInput = getLocationInput();
    const postcodeInput = document.getElementById('loc-postcode');

    if (!loc || isAllCitiesLocation(loc)) {
        if (locationInput) {
            locationInput.value = '';
            locationInput.dataset.lat = '';
            locationInput.dataset.lon = '';
        }
        if (postcodeInput) postcodeInput.value = '';
        updateLocationDisplay(loc);
        updateLocationActionLabel('');
        return;
    }

    if (locationInput) {
        locationInput.value = getLocationDisplayText(loc);
        locationInput.dataset.lat = '';
        locationInput.dataset.lon = '';
    }
    if (postcodeInput) postcodeInput.value = loc.postcode || '';

    updateLocationDisplay(loc);
    updateLocationActionLabel(locationInput?.value || '');
}

function updateLocationDisplay(loc) {
    const display = document.getElementById('current-location-display');
    if (!display) return;

    if (!loc || isAllCitiesLocation(loc)) {
        display.textContent = 'No location set.';
        return;
    }

    const label = getLocationDisplayText(loc);
    display.textContent = label ? `Current: ${label}` : 'No location set.';
}


window.openBackroomLocationModal = function() {
    openLocationModal();
};

window.saveBackroomLocation = function() {
    saveLocation();
};

window.clearBackroomLocation = function() {
    clearLocation();
};

window.setBackroomSharedLocation = function(location) {
    const city = String(location?.city || '').trim();
    const country = String(location?.country || '').trim();
    const postcode = String(location?.postcode || '').trim();

    const nextLocation = city
        ? { country, city, postcode, scope: 'city' }
        : country
            ? { country, city: '', postcode, scope: 'country' }
            : { country: '', city: '', postcode: '', scope: 'all' };

    localStorage.setItem('br_location', JSON.stringify(nextLocation));

    const input = getLocationInput();
    if (input) input.value = getLocationDisplayText(nextLocation);

    updateLocationDisplay(nextLocation);
    updateLocationActionLabel(input?.value || '');
    announceLocationChange(nextLocation);
    return nextLocation;
};

window.openVenueBrowse = function() {
    window.location.hash = '#venues';
    if(window.location.hash === '#venues') handleRouting();
};
window.openSearchResults = function() {
    window.location.hash = '#results';
    if(window.location.hash === '#results') handleRouting();
};

document.addEventListener('DOMContentLoaded', initApp);