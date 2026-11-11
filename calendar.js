// Backroom Events calendar v1.5.20 — Gran Canaria event filtering now shares the venue location aliases.
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
        'placeholder_venue07.jpg',
        'placeholder_venue15.jpg',
        'placeholder_venue16.jpg',
        'placeholder_venue17.jpg',
        'placeholder_venue18.jpg'
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
        selectedDates: new Set([dateKey(new Date())]),
        eventsSelectedDates: new Set([dateKey(new Date())]),
        mode: 'events',
        festivalSearch: '',
        location: { scope: 'all', city: '', country: '' },
        dateFilter: 'all',
        vibeFilter: '',
        featuredOnly: false,
        events: [],
        venues: [],
        loading: false,
        loaded: false
    };

    // Selection editing deliberately updates only the grid classes and the event panel.
    const selection = { active:false, multi:false, anchor:'', last:'', deadline:0, timer:null, gesture:null, hold:null, suppressClickUntil:0 };
    const emptyJump = { timer:null, signature:'', cancelled:new Set(), target:'', deadline:0 };
    const HOLD_MS = 500, EDIT_MS = 5000;
    function stopEmptyJump() { clearInterval(emptyJump.timer); emptyJump.timer=null; }
    function cancelGesture() { clearTimeout(selection.hold); selection.hold=null; selection.gesture=null; }
    function stopSelection() {
        clearInterval(selection.timer); selection.timer=null; selection.active=false; cancelGesture();
    }
    function syncSelectionGrid() {
        document.querySelectorAll('#calendar-container [data-calendar-date]').forEach(button=>{
            const key=button.dataset.calendarDate, chosen=state.selectedDates.has(key);
            button.classList.toggle('selected',chosen);
            button.classList.toggle('calendar-multi-selected',chosen&&selection.multi);
            button.classList.toggle('calendar-selection-pulse',chosen&&selection.active&&key===selection.anchor);
            button.setAttribute('aria-pressed',String(chosen));
        });
    }
    function selectionPanel() {
        const panel=document.querySelector('#calendar-container .calendar-event-panel');
        if(!panel)return;
        if(!panel.querySelector('#calendar-selection-status')) {
            panel.innerHTML='<div class="calendar-selection-message" id="calendar-selection-status"><h2 class="display-font">SELECT YOUR DATES</h2><p>Tap more days to add or remove them, or hold and drag to select a range.</p><p><strong id="calendar-selection-count"></strong></p><p id="calendar-selection-clock" role="status" aria-live="polite"></p><button type="button" class="btn secondary-btn pill-btn" id="calendar-selection-done">Done</button></div>';
            panel.querySelector('#calendar-selection-done').onclick=finishSelection;
        }
        panel.querySelector('#calendar-selection-count').textContent=state.selectedDates.size+' date'+(state.selectedDates.size===1?'':'s')+' selected';
        const clock=panel.querySelector('#calendar-selection-clock');
        const label=selection.gesture?'Release to continue selecting.':'Loading your events in '+Math.max(1,Math.ceil((selection.deadline-Date.now())/1000))+' seconds…';
        if(clock.textContent!==label)clock.textContent=label;
    }
    function resetSelectionTimer() { selection.deadline=Date.now()+EDIT_MS; }
    function beginSelection(key, replace=true) {
        stopEmptyJump(); selection.active=true; selection.multi=true; selection.anchor=key; selection.last=key; state.dateFilter='all';
        if(replace)state.selectedDates=new Set([key]);
        state.selectedDate=key; resetSelectionTimer();
        clearInterval(selection.timer);
        selection.timer=setInterval(()=>{
            if(!selection.active)return;
            if(selection.gesture)resetSelectionTimer();
            else if(Date.now()>=selection.deadline){finishSelection();return;}
            selectionPanel();
        },200);
        syncSelectionGrid(); selectionPanel();
    }
    function finishSelection() {
        if(!selection.active)return;
        stopSelection();
        if(readCalendarRouteState())history.replaceState(history.state,'',getCalendarShareUrl());
        render();
    }
    function selectSingle(key) {
        stopSelection(); stopEmptyJump(); selection.multi=false; selection.anchor=key; selection.last=key;
        emptyJump.cancelled.clear(); state.dateFilter='all'; state.selectedDates=new Set([key]); state.selectedDate=key;
        const date=parseDate(key);state.month=new Date(date.getFullYear(),date.getMonth(),1);
        if(readCalendarRouteState())history.replaceState(history.state,'',getCalendarShareUrl());
        render();
    }
    function toggleSelected(key) {
        if(state.selectedDates.has(key)) { if(state.selectedDates.size>1)state.selectedDates.delete(key); }
        else state.selectedDates.add(key);
        state.selectedDate=state.selectedDates.has(key)?key:[...state.selectedDates].sort()[0];
        if(!state.selectedDates.has(selection.anchor))selection.anchor=[...state.selectedDates][0];
        selection.last=key; resetSelectionTimer();syncSelectionGrid();selectionPanel();
    }
    function rangeKeys(a,b) {
        const start=parseDate(a),end=parseDate(b); if(!start||!end)return [];
        const low=start<end?start:end,high=start<end?end:start,keys=[];
        for(let d=new Date(low);d<=high;d.setDate(d.getDate()+1))keys.push(dateKey(d));
        return keys;
    }
    function dayFromPoint(x,y) { return document.elementFromPoint(x,y)?.closest('#calendar-container [data-calendar-date]')?.dataset.calendarDate; }
    function bindDateSelection() {
        const grid=document.querySelector('#calendar-container .calendar-grid');if(!grid)return;
        grid.addEventListener('contextmenu',event=>{if(event.target.closest('[data-calendar-date]'))event.preventDefault();});
        grid.addEventListener('pointerdown',event=>{
            const button=event.target.closest('[data-calendar-date]');if(!button||event.button!==0||!event.isPrimary)return;
            stopEmptyJump(); cancelGesture(); selection.suppressClickUntil=0;
            const key=button.dataset.calendarDate;
            const gesture={id:event.pointerId,key,x:event.clientX,y:event.clientY,last:key,activated:false,dragged:false,base:new Set(state.selectedDates)};
            selection.gesture=gesture;
            selection.hold=setTimeout(()=>{
                if(selection.gesture!==gesture)return;
                gesture.activated=true;
                if(!selection.active) {beginSelection(key);gesture.base=new Set();}
                else {gesture.base=new Set(state.selectedDates);state.selectedDates.add(key);resetSelectionTimer();syncSelectionGrid();selectionPanel();}
            },HOLD_MS);
        });
        grid.addEventListener('click',event=>{
            const button=event.target.closest('[data-calendar-date]');if(!button)return;
            if(event.detail>0&&Date.now()<selection.suppressClickUntil){event.preventDefault();return;}
            const key=button.dataset.calendarDate;
            if(event.shiftKey) {
                const anchor=selection.last||state.selectedDate;
                if(!selection.active)beginSelection(anchor);
                state.selectedDates=new Set(rangeKeys(anchor,key));state.selectedDate=key;selection.last=key;resetSelectionTimer();syncSelectionGrid();selectionPanel();
            } else if(selection.active)toggleSelected(key);
            else selectSingle(key);
        });
        grid.addEventListener('keydown',event=>{
            if(event.key==='Escape'&&selection.active){event.preventDefault();finishSelection();}
        });
    }
    document.addEventListener('pointermove',event=>{
        const g=selection.gesture;if(!g||g.id!==event.pointerId)return;
        if(!g.activated) {if(Math.hypot(event.clientX-g.x,event.clientY-g.y)>10)cancelGesture();return;}
        event.preventDefault();const key=dayFromPoint(event.clientX,event.clientY);if(!key||key===g.last)return;
        g.dragged=true;g.last=key;state.selectedDates=new Set([...g.base,...rangeKeys(g.key,key)]);
        state.selectedDate=key;selection.last=key;resetSelectionTimer();syncSelectionGrid();selectionPanel();
    },{passive:false});
    // Cancelling touch scrolling only after activation preserves ordinary page scrolling.
    document.addEventListener('touchmove',event=>{if(selection.gesture?.activated)event.preventDefault();},{passive:false});
    document.addEventListener('pointerup',event=>{
        const g=selection.gesture;if(!g||g.id!==event.pointerId)return;
        if(g.activated){selection.suppressClickUntil=Date.now()+700;resetSelectionTimer();}
        cancelGesture();if(selection.active)selectionPanel();else scheduleEmptyJump();
    });
    document.addEventListener('pointercancel',()=>{cancelGesture();if(selection.active){resetSelectionTimer();selectionPanel();}});
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden){stopEmptyJump();if(selection.active){stopSelection();}else cancelGesture();}
        else if(isCalendarRouteHash()&&state.loaded)render();
    });
    window.addEventListener('blur',()=>{if(emptyJump.timer)document.getElementById('calendar-empty-cancel')?.click();stopEmptyJump();if(selection.active){stopSelection();if(isCalendarRouteHash())render();}else cancelGesture();});
    function nextMatchingDate() {
        const current=parseDate(state.selectedDate);if(!current)return '';
        const after=new Date(current);after.setDate(after.getDate()+1);
        const candidates=new Set();
        for(const event of state.events.filter(isPublic)) {
            const first=parseDate(event.Event_Date);if(!first)continue;
            if(!isWeekly(event)){if(first>current)candidates.add(dateKey(first));continue;}
            const weekday=weeklyDay(event);if(weekday===null)continue;
            const next=new Date(Math.max(first.getTime(),after.getTime()));next.setDate(next.getDate()+(weekday-next.getDay()+7)%7);
            if(occurrenceForDate(event,next))candidates.add(dateKey(next));
        }
        if(state.featuredOnly)for(const pick of window.BackroomV15?.picks?.Events||[])if(parseDate(pick.Event_Date)>current)candidates.add(pick.Event_Date);
        return [...candidates].sort().find(key=>eventsOnDate(key).some(e=>!state.featuredOnly||window.BackroomV15?.isFeaturedEvent(e.Event_ID,key)))||'';
    }
    function scheduleEmptyJump() {
        stopEmptyJump();
        if(!state.loaded||state.loading||document.hidden||!isCalendarRouteHash()||state.mode!=='events'||selection.active||selection.multi||state.selectedDates.size!==1||!['all','today'].includes(state.dateFilter))return;
        const matches=eventsForActiveDateFilter().filter(e=>!state.featuredOnly||window.BackroomV15?.isFeaturedEvent(e.Event_ID,e.Display_Date||e.Event_Date));if(matches.length)return;
        const box=document.querySelector('#calendar-container .calendar-empty');if(!box)return;
        const target=nextMatchingDate();
        const signature=JSON.stringify([state.selectedDate,state.location,state.vibeFilter,state.featuredOnly,state.dateFilter]);
        emptyJump.signature=signature;
        if(!target){box.innerHTML='<p>No events match your filters on this day, and no later matching events are currently listed.</p><button type="button" class="btn secondary-btn pill-btn" id="calendar-clear-empty-filters">Clear category and Featured filters</button>';box.querySelector('button').onclick=()=>activateFilter('all');return;}
        if(emptyJump.cancelled.has(signature)){box.textContent='No events match your filters on this day. Automatic navigation cancelled.';return;}
        emptyJump.target=target;emptyJump.deadline=Date.now()+5000;
        const label=parseDate(target).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
        box.innerHTML='<p>No events match your filters on this day.</p><p>Loading the next date with events: <strong>'+escapeHTML(label)+'</strong></p><p role="status" aria-live="polite">Moving in <strong id="calendar-empty-countdown">5</strong> seconds…</p><div class="calendar-empty-actions"><button type="button" class="btn primary-btn pill-btn" id="calendar-empty-now">Go now</button><button type="button" class="btn secondary-btn pill-btn" id="calendar-empty-cancel">Cancel</button></div>';
        const go=()=>{stopEmptyJump();selectSingle(target);};
        box.querySelector('#calendar-empty-now').onclick=go;
        box.querySelector('#calendar-empty-cancel').onclick=()=>{emptyJump.cancelled.add(signature);stopEmptyJump();box.textContent='No events match your filters on this day. Automatic navigation cancelled.';};
        emptyJump.timer=setInterval(()=>{
            if(!isCalendarRouteHash()||selection.active||document.hidden){stopEmptyJump();return;}
            const seconds=Math.ceil((emptyJump.deadline-Date.now())/1000);if(seconds<=0){go();return;}
            const counter=document.getElementById('calendar-empty-countdown');if(counter&&counter.textContent!==String(seconds))counter.textContent=String(seconds);
        },200);
    }

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
        return /^placeholder_venue(?:(?:0[1-7])|(?:1[5-8]))?\.jpg$/.test(image);
    }

    function isAnyPlaceholderImage(value) {
        const image = String(value || '').trim().split('/').pop().toLowerCase();
        return /^placeholder_venue(?:0[1-9]|1[0-8])?\.jpg$/.test(image);
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

    // The main directory is the single source of truth for city aliases,
    // including every locality grouped into Maspalomas, Spain. Do not duplicate
    // that locality list here: it had drifted out of sync with Events.
    function calendarCityKey(city, country = '', record = null) {
        if (typeof window.normalizeCityName === 'function') {
            return window.normalizeCityName(city, country, record);
        }
        return normalizeLocation(city);
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
                const cityKey = calendarCityKey(city, country, record);
                const countryKey = normalizeLocation(country);
                const key = `${cityKey}::${countryKey}`;
                if (!cityKey || !countryKey || records.has(key)) return;
                const displayCity = countryKey === 'spain' && cityKey === 'maspalomas' ? 'Maspalomas' : city;
                records.set(key, { city: displayCity, country });
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

    function syncLocationFromSharedLocation(ignoreSharedRoute = false) {
        const routeState = ignoreSharedRoute ? null : readCalendarRouteState();
        if (routeState) {
            state.location = routeState.location;
            return;
        }

        const shared = readSharedLocation();

        if (shared.scope === 'city') {
            const savedCityKey = calendarCityKey(shared.city, shared.country);
            const match = cityOptionRecords().find(option =>
                calendarCityKey(option.city, option.country) === savedCityKey
                && (!shared.country || normalizeLocation(option.country) === normalizeLocation(shared.country))
            );
            const city = match?.city || shared.city;
            const country = match?.country || findDisplayLocation(shared.country, countryOptions()) || shared.country;
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

    function isFestivalsRouteHash(hash = window.location.hash || '') {
        return hash === '#festivals';
    }

    function isCalendarRouteHash(hash = window.location.hash || '') {
        return hash === '#calendar' || String(hash).startsWith('#calendar?') || isFestivalsRouteHash(hash);
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
                calendarCityKey(option.city, option.country) === calendarCityKey(city, country)
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
            selectedDates: String(params.get('dates')||'').split(',').filter(v=>parseDate(v)).length ? String(params.get('dates')).split(',').filter(v=>parseDate(v)) : [dateKey(requestedDate)],
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
        state.selectedDates = new Set((routeState.selectedDates || [routeState.selectedDate]).filter(v=>parseDate(v)));
        selection.multi=state.selectedDates.size>1;selection.last=state.selectedDate;
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
        if(state.selectedDates.size>1)params.set('dates',[...state.selectedDates].sort().join(','));
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
            const country = countryFor(event);
            const venueOrEvent = venueFor(event) || event;
            const cityMatches = cityTokensFor(event).some(city =>
                calendarCityKey(city, country, venueOrEvent) === calendarCityKey(location.city, location.country)
            );
            const countryMatches = !location.country
                || normalizeLocation(country) === normalizeLocation(location.country);
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
        if (state.dateFilter === 'all') {
            const dates = [...state.selectedDates].sort();
            if (!dates.length) {
                // All future one-off events, plus the next 12 weeks of recurring occurrences.
                const today=dateKey(startOfToday());
                const future=state.events.filter(e=>isPublic(e)&&!isWeekly(e)&&String(e.Event_Date||'')>=today)
                  .map(e=>({...e,Display_Date:e.Event_Date,Is_Recurring:false,Recurrence_Label:''}));
                const start=startOfToday();
                for(let i=0;i<84;i++){
                    const day=new Date(start);day.setDate(start.getDate()+i);
                    const key=dateKey(day);
                    for(const recurring of state.events){
                        if(!isWeekly(recurring)||!isPublic(recurring))continue;
                        const occurrence=occurrenceForDate(recurring,day);
                        if(occurrence)future.push(occurrence);
                    }
                }
                return future.sort(sortEvents);
            }
            return dates.flatMap(eventsOnDate).sort(sortEvents);
        }

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
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return date;
    });
}

function ensureSelectedDate() {
        if(state.dateFilter === 'today'||state.dateFilter === 'week') {
            const today=startOfToday();
            state.month=new Date(today.getFullYear(),today.getMonth(),1);
            state.selectedDate=dateKey(today);
        }
        if(!state.selectedDates) state.selectedDates=new Set([state.selectedDate]);
    }

    function renderLocationPill() {
        const label = getLocationLabel() || 'All Cities';
        const cities = cityOptionRecords().map(item => item.city+', '+item.country);
        const countries = countryOptions();
        const values=[...new Set([...countries,...cities])].sort((a,b)=>a.localeCompare(b));
        return '<div class="v15-calendar-location"><button type="button" id="calendar-location-pill" class="calendar-location-pill pill-btn" aria-label="Search city or country">'+escapeHTML(label)+'</button>'
          +'<input id="v15-calendar-location-input" class="form-input pill-input hidden" list="v15-location-options" placeholder="Search city or country…" aria-label="Search location">'
          +'<datalist id="v15-location-options">'+values.map(v=>'<option value="'+escapeHTML(v)+'"></option>').join('')+'</datalist>'
          +'<button type="button" id="v15-calendar-map-pin" class="v15-location-pin" title="Open full location window" aria-label="Open location window">📍</button></div>';
    }

    function filterChip(label, value, extraClass = '') {
        const isAll = value === 'all';
        const isDate = value === 'today' || value === 'week';
        const isFeatured = value === 'featured';
        const isActive = isAll
            ? !state.vibeFilter && state.dateFilter === 'all' && !state.featuredOnly
            : isDate
                ? state.dateFilter === value
                : isFeatured ? state.featuredOnly : state.vibeFilter === value;
        const className = isFeatured ? 'event-filter-featured'
            : isDate ? 'event-filter-green' : (isAll ? 'event-filter-all' : tagClass(value));
        return `<button type="button" class="calendar-filter-chip pill-btn ${className} ${isActive ? 'active' : ''} ${extraClass}" data-calendar-filter="${escapeHTML(value)}"${isFeatured ? ' aria-pressed="' + isActive + '" title="Show only Backroom Featured events"' : ''}>${escapeHTML(label)}</button>`;
    }

    function renderFilterStrip() {
        const filters = [
            filterChip('All', 'all'),
            filterChip('Today', 'today'),
            filterChip('This Week', 'week'),
            filterChip('★ Featured', 'featured'),
            ...EVENT_VIBE_TAGS.map(tag => filterChip(tag, tag))
        ].join('');
        return `<div class="calendar-filter-shell" aria-label="Event filters"><div class="calendar-filter-scroll"><div class="calendar-filter-grid">${filters}</div></div></div>`;
    }

    function renderGrid() {
        const today = dateKey(new Date());
        const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
        const days = monthCells().map(date => {
    const key = dateKey(date);
    const count = state.mode === 'festivals' ? festivalsOnDate(date).length : eventsOnDate(key).length;
    const outsideMonth = date.getMonth() !== state.month.getMonth() || date.getFullYear() !== state.month.getFullYear();
    return `<button type="button" class="calendar-day${outsideMonth ? ' outside-month' : ''}${state.selectedDates.has(key) ? ' selected' : ''}${key === today ? ' today' : ''}${count ? ' has-events' : ''}" data-calendar-date="${key}"><span class="calendar-number">${date.getDate()}</span><span class="calendar-indicators">${count ? `<span class="calendar-dot"></span>${count > 1 ? `<span class="calendar-count">${count}</span>` : ''}` : ''}</span></button>`;
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
        return `<article class="calendar-event-card${isMenOnlyEvent(event, venue) ? ' calendar-event-card--men-only' : ''}">${window.BackroomV15?.badge('event',event.Event_ID,event.Display_Date || event.Event_Date) || ''}<div class="calendar-event-layout"><div class="calendar-event-media"><img class="calendar-venue-thumb" src="${escapeHTML(image)}" alt="${escapeHTML(venueName)}" onerror="this.onerror=null;this.src='${escapeHTML(imageFallback)}';"><button type="button" class="btn primary-btn pill-btn calendar-action ${saved ? 'calendar-saved' : ''}" data-calendar-save="${escapeHTML(event.Event_ID)}">${saved ? '💖 Saved' : '💖 Save Event'}</button><button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-shortlist="${escapeHTML(event.Event_ID)}">📑 Shortlist</button>${venue ? `<button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-venue="${escapeHTML(venue.Venue_ID)}">Open Venue</button>` : ''}</div><div class="calendar-event-body"><div class="calendar-event-top"><div><h3 class="calendar-event-name display-font">${escapeHTML(event.Event_Name || 'Event')}</h3><p class="calendar-event-meta">${escapeHTML(venueName)}${location ? ` · ${escapeHTML(location)}` : ''}</p>${dateText ? `<p class="calendar-event-date">${escapeHTML(dateText)}</p>` : ''}${times ? `<p class="calendar-event-time">${escapeHTML(times)}</p>` : ''}${event.Is_Recurring ? `<p class="calendar-event-recurrence">${escapeHTML(event.Recurrence_Label)}</p>` : ''}</div>${event.Dresscode_Info ? `<div class="calendar-event-dresscode">${escapeHTML(event.Dresscode_Info)}</div>` : ''}</div>${event.Event_Description ? `<div class="calendar-event-description">${formatEventDescription(event.Event_Description)}</div>` : ''}${renderEventTags(event)}</div></div></article>`;
    }



    function linkedFestivalEvents(festival) {
        const ids = new Set(Array.isArray(festival?.Event_IDs) ? festival.Event_IDs : []);
        return state.events.filter(event => ids.has(event.Event_ID) && isPublic(event));
    }

    function matchesFestivalSearch(festival, linked) {
        const q = String(state.festivalSearch || '').trim().toLocaleLowerCase();
        if (!q) return true;
        const fields = [festival.Festival_Name, festival.Festival_Description];
        linked.forEach(event => {
            const venue = venueFor(event);
            fields.push(event.Event_Name,event.Event_Description,event.City,event.Country,
                venue?.Name,venue?.City,venue?.Country);
        });
        return fields.some(field => String(field || '').toLocaleLowerCase().includes(q));
    }

    function matchingFestivalEntries() {
        const festivals = window.BackroomV15?.festivals || [];
        const selected = [...state.selectedDates].sort();
        const today = dateKey(startOfToday());
        const now = startOfToday();
        const results = [];
        for (const festival of festivals) {
            const linked = linkedFestivalEvents(festival);
            if (!linked.length || !matchesFestivalSearch(festival,linked)) continue;
            const matching = linked.filter(event => eventMatchesSharedLocation(event));
            if (!matching.length) continue;
            const occurrences = [];
            if (selected.length) {
                for (const date of selected) {
                    for (const event of matching) {
                        const found = occurrenceForDate(event, parseDate(date));
                        if (found) occurrences.push(found);
                    }
                }
            } else {
                for (const event of matching) {
                    const original = parseDate(event.Event_Date);
                    if (!original) continue;
                    if (!isWeekly(event) && event.Event_Date >= today) {
                        occurrences.push({...event, Display_Date:event.Event_Date});
                    } else if (isWeekly(event)) {
                        for (let day=0;day<84;day++) {
                            const target=new Date(now);target.setDate(now.getDate()+day);
                            const found=occurrenceForDate(event,target);
                            if (found) {occurrences.push(found);break;}
                        }
                    }
                }
            }
            if (occurrences.length) results.push({
                festival, occurrences,
                sortKey:occurrences.map(e=>e.Display_Date).sort()[0] || '9999-12-31'
            });
        }
        return results.sort((a,b)=>a.sortKey.localeCompare(b.sortKey) ||
          String(a.festival.Festival_Name).localeCompare(String(b.festival.Festival_Name)));
    }

    function festivalsOnDate(date) {
        const key = dateKey(date);
        return (window.BackroomV15?.festivals || []).filter(festival => {
            const linked = linkedFestivalEvents(festival);
            if (!linked.length || !matchesFestivalSearch(festival,linked)) return false;
            return linked.some(event => eventMatchesSharedLocation(event) && occurrenceForDate(event,date));
        });
    }

    function renderFestivalCard(festival, matchingOccurrences = []) {
        const all = linkedFestivalEvents(festival).sort((a,b) =>
          String(a.Event_Date||'').localeCompare(String(b.Event_Date||'')) ||
          String(a.Event_Start_Time||'').localeCompare(String(b.Event_Start_Time||'')));
        if (!all.length) return '';
        const dates=all.map(e=>e.Event_Date).filter(Boolean).sort();
        const city=cityFor(all[0]);
        const range=dates.length?(dates[0]===dates[dates.length-1]?dates[0]:dates[0]+' – '+dates[dates.length-1]):'Dates TBC';
        const description=String(festival.Festival_Description||'');
        const url=String(festival.Festival_URL||'').trim();
        const website=/^https?:\/\//i.test(url)?'<a class="v15-festival-url" target="_blank" rel="noopener noreferrer" href="'+escapeHTML(url)+'">Official festival website ↗</a>':'';
        const matchedIds = new Set(matchingOccurrences.map(item=>item.Event_ID));
        const full=all.map(e=>{
            const occurrence={...e,Display_Date:e.Event_Date,Is_Recurring:false};
            return '<div class="v15-festival-event '+(matchedIds.has(e.Event_ID)?'v15-festival-event-matched':'')+'">'+renderEventCard(occurrence,true)+'</div>';
        }).join('');
        return '<details class="v15-festival-card"><summary><span class="v15-festival-kicker">FESTIVAL · '+all.length+' EVENTS</span><strong>'+escapeHTML(festival.Festival_Name)+'</strong><span>'+escapeHTML([city,range].filter(Boolean).join(' · '))+'</span><p>'+escapeHTML(description.slice(0,155))+(description.length>155?'…':'')+'</p><span class="v15-festival-expand">View programme ▾</span></summary><div class="v15-festival-body"><p>'+escapeHTML(description)+'</p>'+website+full+'</div></details>';
    }

    function renderFestivalPanel() {
        const entries=matchingFestivalEntries();
        const selected=[...state.selectedDates].sort();
        const label=!selected.length ? 'UPCOMING FESTIVALS' : selected.length===1 ? selectedLabel() : selected.length+' DATES SELECTED';
        const heading='<div class="calendar-panel-heading"><h2 class="display-font">'+escapeHTML(label)+'</h2></div>';
        previousGenericEventFallback='';
        const count='<p class="calendar-day-count">'+entries.length+' festival'+(entries.length===1?'':'s')+' found</p>';
        const cards=entries.map(({festival,occurrences})=>renderFestivalCard(festival,occurrences)).join('');
        const empty='<div class="calendar-empty">'+(state.festivalSearch.trim()?'No festivals match that search and those dates or locations.':'No upcoming festivals match these dates or locations.')+'</div>';
        return '<section class="calendar-event-panel">'+heading+count+(cards||empty)+'</section>';
    }

    function renderPanel() {
        if (state.mode === 'festivals') return renderFestivalPanel();
        const items=eventsForActiveDateFilter().filter(event =>
            !state.featuredOnly || Boolean(window.BackroomV15?.isFeaturedEvent(
                event.Event_ID, event.Display_Date || event.Event_Date
            ))
        );
        const selected=[...state.selectedDates].sort();
        const label=state.dateFilter === 'today' ? 'TODAY' : state.dateFilter === 'week' ? 'THIS WEEK'
          : !selected.length ? 'UPCOMING EVENTS' : selected.length===1 ? selectedLabel() : selected.length+' DATES SELECTED';
        const shareButton=state.dateFilter==='all' && selected.length===1
          ? '<button type="button" id="calendar-share-day" class="calendar-share-day-btn icon-btn" title="Share selected day">📣</button>' : '';
        const heading='<div class="calendar-panel-heading"><h2 class="display-font">'+escapeHTML(label)+'</h2>'+shareButton+'</div>';
        previousGenericEventFallback='';
        if(!items.length) return '<section class="calendar-event-panel">'+heading+'<div class="calendar-empty">'+(state.featuredOnly ? 'No Featured events match this date and location. Choose another date or turn off Featured.' : 'No listed events match these filters yet.')+'</div></section>';
        const displayed=new Set(), nodes=[];
        for(const event of items){
            const matched=window.BackroomV15?.festivalForEvent(event.Event_ID);
            if(matched && !displayed.has(matched.Festival_ID)){
                displayed.add(matched.Festival_ID);
                nodes.push(renderFestivalCard(matched,items));
            } else if(!matched) {
                nodes.push(renderEventCard(event,state.dateFilter!=='all'||selected.length!==1));
            }
        }
        return '<section class="calendar-event-panel">'+heading+'<p class="calendar-day-count">'+items.length+' event occurrences · '+nodes.length+' listings</p>'+nodes.join('')+'</section>';
    }

    function render(allowDuringSelection = false) {
        if(selection.active && !allowDuringSelection){syncSelectionGrid();selectionPanel();return;}
        stopEmptyJump();
        const container = ensureContainer();
        ensureSelectedDate();
        const festivalsMode = state.mode === 'festivals';
        const heading = festivalsMode ? '<div class="v15-festivals-heading"><h1 class="display-font">🎪 FESTIVALS IN</h1>'+renderLocationPill()+'</div>' : '<h1 class="display-font">📅 EVENTS IN</h1>'+renderLocationPill();
        const right = festivalsMode ? '<div class="v15-festival-search"><label for="v15-festival-search-input">SEARCH FESTIVALS</label><input id="v15-festival-search-input" class="form-input pill-input" type="search" placeholder="Search festival names, descriptions, events or cities…" value="'+escapeHTML(state.festivalSearch)+'" autocomplete="off"></div>' : renderFilterStrip();
        container.innerHTML = `<div class="calendar-page ${festivalsMode?'calendar-page--festivals':''}"><div class="calendar-title-row"><div class="calendar-title-block">${heading}</div>${right}</div><div class="calendar-layout"><section class="calendar-selector"><div class="calendar-month-row"><button type="button" class="calendar-month-button" id="calendar-prev-month" aria-label="Previous month">‹</button><h2 class="display-font">${monthLabel()}</h2><button type="button" class="calendar-month-button" id="calendar-next-month" aria-label="Next month">›</button></div>${renderGrid()}<p class="calendar-key"><span class="calendar-dot"></span> ${festivalsMode?'Festivals with events on this date':'Events listed on this date'}</p></section>${renderPanel()}</div></div>`;
        window.BackroomCalendarLayout?.apply(container, festivalsMode);
        bindControls();
        syncSelectionGrid();
        if(selection.active)selectionPanel();else scheduleEmptyJump();
    }

    function activateFilter(value) {
        stopSelection(); stopEmptyJump(); emptyJump.cancelled.clear();
        if(value === 'today' || value === 'week'){selection.multi=false;state.selectedDates=new Set([dateKey(startOfToday())]);state.selectedDate=dateKey(startOfToday());}
        if (value === 'all') {
            state.dateFilter = 'all';
            state.vibeFilter = '';
            state.featuredOnly = false;
        } else if (value === 'featured') {
            state.featuredOnly = !state.featuredOnly;
        } else if (value === 'today' || value === 'week') {
            state.dateFilter = state.dateFilter === value ? 'all' : value;
        } else {
            state.vibeFilter = state.vibeFilter === value ? '' : value;
        }
        ensureSelectedDate();
        render();
    }

    function bindControls() {
        document.getElementById('v15-festival-search-input')?.addEventListener('input', event => {
            const input=event.currentTarget;
            const start=input.selectionStart,end=input.selectionEnd;
            state.festivalSearch=input.value;
            render();
            const replacement=document.getElementById('v15-festival-search-input');
            replacement?.focus();
            try{replacement?.setSelectionRange(start,end)}catch(_){}
        });
        document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
            if(emptyJump.timer)emptyJump.cancelled.add(emptyJump.signature);
            stopEmptyJump();
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
            ensureSelectedDate();
            if(selection.active)resetSelectionTimer();
            render(true);
        });
        document.getElementById('calendar-next-month')?.addEventListener('click', () => {
            if(emptyJump.timer)emptyJump.cancelled.add(emptyJump.signature);
            stopEmptyJump();
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
            ensureSelectedDate();
            if(selection.active)resetSelectionTimer();
            render(true);
        });
        document.getElementById('calendar-location-pill')?.addEventListener('click', () => {
            document.getElementById('calendar-location-pill')?.classList.add('hidden');
            const input=document.getElementById('v15-calendar-location-input');
            input?.classList.remove('hidden');input?.focus();
        });
        const inlineInput=document.getElementById('v15-calendar-location-input');
        const applyInlineLocation=()=>{
            const value=String(inlineInput?.value||'').trim();
            if(!value) {setSharedLocationFromSelection('all');render();return;}
            const parts = value.split(',').map(part => part.trim()).filter(Boolean);
            const searchCity = parts.length > 1 ? parts.slice(0, -1).join(', ') : value;
            const searchCountry = parts.length > 1 ? parts[parts.length - 1] : '';
            const location=cityOptionRecords().find(o =>
                calendarCityKey(o.city, o.country) === calendarCityKey(searchCity, searchCountry)
                && (!searchCountry || normalizeLocation(o.country) === normalizeLocation(searchCountry))
            );
            const country=countryOptions().find(o=>normalizeLocation(o)===normalizeLocation(value));
            if(location) setSharedLocationFromSelection('city::'+encodeURIComponent(location.city)+'::'+encodeURIComponent(location.country));
            else if(country) setSharedLocationFromSelection('country::'+country);
            else { inlineInput?.setCustomValidity('Select a listed city or country');inlineInput?.reportValidity();return; }
            render();
        };
        inlineInput?.addEventListener('input',()=>inlineInput.setCustomValidity(''));
        inlineInput?.addEventListener('change',applyInlineLocation);
        inlineInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyInlineLocation();}});
        document.getElementById('v15-calendar-map-pin')?.addEventListener('click',()=>{
            if(typeof window.openBackroomLocationModal==='function')window.openBackroomLocationModal();
            else document.getElementById('btn-location')?.click();
        });
        document.getElementById('calendar-share-day')?.addEventListener('click', shareSelectedCalendarDay);
        document.querySelectorAll('[data-calendar-filter]').forEach(button => button.addEventListener('click', () => activateFilter(button.dataset.calendarFilter)));
        bindDateSelection();
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
            await window.BackroomV15?.ready;
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
        stopSelection(); stopEmptyJump();
        const container = document.getElementById('calendar-container');
        container?.classList.add('hidden');
        if (container && clear) container.innerHTML = '';
        const results = document.getElementById('results-container');
        if (results) results.style.display = '';
    }

    window.closeCalendarScreen = close;
    window.openCalendarScreen = async function (requestedMode) {
        stopSelection(); stopEmptyJump();
        const targetMode = requestedMode === 'festivals' || isFestivalsRouteHash() ? 'festivals' : 'events';
        if (state.mode !== targetMode) {
            selection.multi=false;
            if (targetMode === 'festivals') {
                state.eventsSelectedDates = new Set(state.selectedDates);
                state.selectedDates = new Set();
            } else {
                state.selectedDates = new Set(state.eventsSelectedDates.size ? state.eventsSelectedDates : [dateKey(new Date())]);
                state.selectedDate = [...state.selectedDates].sort()[0] || dateKey(new Date());
            }
            selection.multi=state.selectedDates.size>1;
            selection.last=state.selectedDate;
            state.mode=targetMode;
            state.dateFilter='all';
            state.vibeFilter='';
            state.featuredOnly=false;
        }
        if (!isCalendarRouteHash()) history.pushState(null, '', targetMode === 'festivals' ? '#festivals' : '#calendar');
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

    window.openFestivalScreen = function () {
        if (!isFestivalsRouteHash()) window.location.hash='#festivals';
        return window.openCalendarScreen('festivals');
    };

    document.addEventListener('backroom:v15-saved', () => { if(isCalendarRouteHash() && state.loaded)render(); });
    document.addEventListener('backroom:v15-ready', () => { if(isCalendarRouteHash() && state.loaded)render(); });
    window.addEventListener('backroom:location-changed', () => {
        stopSelection(); stopEmptyJump(); emptyJump.cancelled.clear();
        if (!state.loaded) return;
        if (readCalendarRouteState()) history.replaceState(history.state, '', '#calendar');
        syncLocationFromSharedLocation(true);
        if (isCalendarRouteHash()) render();
    });

    window.addEventListener('hashchange', () => {
        if (!isCalendarRouteHash()) close(false);
    });
}());
