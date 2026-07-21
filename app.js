/* Backroom public app loader plus live About totals and embedded prototype pages. */
document.write('<script src="app-core.js?v=1.09"><\/script>');

(() => {
    'use strict';

    const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
    const key = value => clean(value).toLocaleLowerCase('en');
    const splitCities = value => (Array.isArray(value) ? value : String(value ?? '').split(/[;,|]+/)).map(clean).filter(Boolean);
    let coveragePromise = null;

    const embeddedPages = {
        heatmap: { src: 'heatmap.html?embed=1', title: 'Heat Map' },
        travel: { src: 'travel.html?embed=1', title: 'Travel Prototype' }
    };

    function installEmbeddedStyles() {
        if (document.getElementById('backroom-embedded-pages-style')) return;
        const style = document.createElement('style');
        style.id = 'backroom-embedded-pages-style';
        style.textContent = `
            #main-content .content-wrapper.backroom-embedded-active > :not(.backroom-embedded-page) { display:none !important; }
            .backroom-embedded-page { width:100%; height:calc(100vh - 105px); min-height:620px; background:#000; border:1px solid var(--panel-mid); border-radius:var(--radius-card); overflow:hidden; }
            .backroom-embedded-page iframe { width:100%; height:100%; display:block; border:0; background:#000; }
            #sidebar .sidebar-item.embedded-page-active { background:rgba(44,168,212,.16); color:#fff; }
            @media (max-width:768px) { .backroom-embedded-page { height:calc(100vh - 92px); min-height:560px; border-radius:10px; } }
        `;
        document.head.appendChild(style);
    }

    function getContentWrapper() {
        return document.querySelector('#main-content .content-wrapper');
    }

    function ensureEmbeddedPage(pageKey) {
        const config = embeddedPages[pageKey];
        const wrapper = getContentWrapper();
        if (!config || !wrapper) return null;

        let container = document.getElementById(`embedded-${pageKey}-container`);
        if (!container) {
            container = document.createElement('section');
            container.id = `embedded-${pageKey}-container`;
            container.className = 'backroom-embedded-page hidden';
            container.setAttribute('aria-label', config.title);
            const frame = document.createElement('iframe');
            frame.src = config.src;
            frame.title = `Backroom ${config.title}`;
            frame.loading = 'eager';
            frame.setAttribute('allow', 'geolocation');
            container.appendChild(frame);
            wrapper.appendChild(container);
        }
        return container;
    }

    function setEmbeddedNavigationState(pageKey = '') {
        document.querySelectorAll('#sidebar [data-embedded-page]').forEach(item => {
            item.classList.toggle('embedded-page-active', item.dataset.embeddedPage === pageKey);
        });
    }

    function hideEmbeddedPages() {
        const wrapper = getContentWrapper();
        wrapper?.classList.remove('backroom-embedded-active');
        document.querySelectorAll('.backroom-embedded-page').forEach(page => page.classList.add('hidden'));
        document.body.removeAttribute('data-backroom-embedded-page');
        setEmbeddedNavigationState('');
    }

    function showEmbeddedPage(pageKey) {
        const wrapper = getContentWrapper();
        const container = ensureEmbeddedPage(pageKey);
        if (!wrapper || !container) return;

        document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
        document.querySelectorAll('.backroom-embedded-page').forEach(page => page.classList.add('hidden'));
        container.classList.remove('hidden');
        wrapper.classList.add('backroom-embedded-active');
        document.body.dataset.backroomEmbeddedPage = pageKey;
        setEmbeddedNavigationState(pageKey);
        document.getElementById('sidebar')?.classList.remove('visible');
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function wrapCoreRouting() {
        if (typeof window.handleRouting !== 'function' || window.handleRouting.__embeddedPagesWrapped) return;
        const originalHandleRouting = window.handleRouting;
        const wrappedHandleRouting = function(...args) {
            hideEmbeddedPages();
            return originalHandleRouting.apply(this, args);
        };
        wrappedHandleRouting.__embeddedPagesWrapped = true;
        window.handleRouting = wrappedHandleRouting;
    }

    function installNativeNavigationReset() {
        const menu = document.querySelector('#sidebar .sidebar-menu');
        if (menu && !menu.dataset.embeddedResetBound) {
            menu.dataset.embeddedResetBound = 'true';
            menu.addEventListener('click', event => {
                if (event.target.closest('[data-embedded-page]')) return;
                if (!document.body.dataset.backroomEmbeddedPage) return;
                hideEmbeddedPages();
                window.setTimeout(() => window.handleRouting?.(), 0);
            }, true);
        }
        window.addEventListener('hashchange', hideEmbeddedPages);
    }

    function addSidebarLink(afterTitle, title, pageKey, image, fallback) {
        const menu = document.querySelector('#sidebar .sidebar-menu');
        if (!menu || menu.querySelector(`[data-extra-page="${title}"]`)) return;
        const after = Array.from(menu.querySelectorAll('.sidebar-item')).find(item => clean(item.getAttribute('title')) === afterTitle);
        if (!after) return;

        const item = document.createElement('div');
        item.className = 'sidebar-item tooltip';
        item.title = title;
        item.dataset.extraPage = title;
        item.dataset.embeddedPage = pageKey;
        item.tabIndex = 0;
        item.setAttribute('role', 'link');
        item.innerHTML = `<span class="icon"><img src="${image}" alt="" style="width:25px;height:25px;object-fit:contain;vertical-align:middle;"></span><span class="sidebar-text display-font">${title}</span>`;
        const icon = item.querySelector('img');
        icon.addEventListener('error', () => {
            const replacement = document.createElement('span');
            replacement.textContent = fallback;
            replacement.style.fontSize = '22px';
            icon.replaceWith(replacement);
        }, { once: true });
        const open = () => showEmbeddedPage(pageKey);
        item.addEventListener('click', open);
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });
        after.insertAdjacentElement('afterend', item);
    }

    function installExtraNavigation() {
        addSidebarLink('Featured', 'Heat Map', 'heatmap', 'Emoji/heatmap.png', '🌈');
        addSidebarLink('Cruising Guide', 'Travel Prototype', 'travel', 'train.webp', '🚄');
    }

    function countCoverage(venueRows, eventRows) {
        const venueMap = new Map();
        const cities = new Set();
        const countries = new Set();

        (Array.isArray(venueRows) ? venueRows : []).forEach(row => {
            const location = {
                cities: splitCities(row?.City),
                country: clean(row?.Country)
            };
            const id = clean(row?.Venue_ID);
            if (id) venueMap.set(id, location);
            location.cities.forEach(city => cities.add(key(city)));
            if (location.country) countries.add(key(location.country));
        });

        (Array.isArray(eventRows) ? eventRows : []).forEach(row => {
            const linked = venueMap.get(clean(row?.Venue_ID)) || { cities: [], country: '' };
            const eventCities = splitCities(row?.City || row?.Event_City || row?.Venue_City || row?.Location_City);
            const eventCountry = clean(row?.Country || row?.Event_Country || row?.Venue_Country || row?.Location_Country);
            (eventCities.length ? eventCities : linked.cities).forEach(city => cities.add(key(city)));
            const country = eventCountry || linked.country;
            if (country) countries.add(key(country));
        });

        return { cities: cities.size, countries: countries.size };
    }

    async function getCoverage() {
        if (coveragePromise) return coveragePromise;
        coveragePromise = (async () => {
            try {
                if (typeof venues !== 'undefined' && typeof events !== 'undefined' && Array.isArray(venues) && Array.isArray(events) && venues.length) {
                    return countCoverage(venues, events);
                }
            } catch (_) {}

            const stamp = Date.now();
            const [venueResponse, eventResponse] = await Promise.all([
                fetch(`listings.json?v=${stamp}`),
                fetch(`events.json?v=${stamp}`)
            ]);
            if (!venueResponse.ok || !eventResponse.ok) throw new Error('Coverage files unavailable');
            return countCoverage(await venueResponse.json(), await eventResponse.json());
        })().catch(error => {
            coveragePromise = null;
            throw error;
        });
        return coveragePromise;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    async function hydrateAboutCounts() {
        const container = document.getElementById('about-container');
        if (!container) return;
        const hasCountTargets = container.querySelector('#country-count, #about-country-count, #city-count, #about-city-count');
        if (!hasCountTargets) return;

        try {
            const counts = await getCoverage();
            const countryText = `${counts.countries} ${counts.countries === 1 ? 'country' : 'countries'}`;
            const cityText = `${counts.cities} ${counts.cities === 1 ? 'city' : 'cities'}`;
            setText('country-count', counts.countries);
            setText('city-count', counts.cities);
            setText('country-count-inline', countryText);
            setText('city-count-inline', cityText);
            setText('about-country-count', counts.countries);
            setText('about-city-count', counts.cities);
            setText('about-country-count-inline', countryText);
            setText('about-city-count-inline', cityText);
        } catch (error) {
            console.warn('Could not calculate About coverage totals:', error);
        }
    }

    function installAboutRepair() {
        const container = document.getElementById('about-container');
        if (container) {
            new MutationObserver(() => hydrateAboutCounts()).observe(container, { childList: true, subtree: true });
        }
        hydrateAboutCounts();
        window.addEventListener('hashchange', () => {
            if (window.location.hash === '#about') {
                [0, 150, 700].forEach(delay => window.setTimeout(hydrateAboutCounts, delay));
            }
        });
    }

    function install() {
        installEmbeddedStyles();
        installExtraNavigation();
        installNativeNavigationReset();
        wrapCoreRouting();
        installAboutRepair();
        window.setTimeout(() => {
            installExtraNavigation();
            wrapCoreRouting();
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();
