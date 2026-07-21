/* Backroom public app v1.10 loader and dynamic About page. */
document.write('<script src="app-core.js?v=1.09"><\/script>');

(() => {
    'use strict';

    let aboutCoveragePromise = null;

    const cleanValue = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const countKey = (value) => cleanValue(value).toLocaleLowerCase('en');

    function splitCities(value) {
        const values = Array.isArray(value) ? value : String(value ?? '').split(/[;,|]+/);
        return values.map(cleanValue).filter(Boolean);
    }

    function directLocation(row) {
        return {
            cities: splitCities(row?.City || row?.Event_City || row?.Venue_City || row?.Location_City),
            country: cleanValue(row?.Country || row?.Event_Country || row?.Venue_Country || row?.Location_Country)
        };
    }

    function installAboutStyles() {
        if (document.getElementById('backroom-about-dynamic-style')) return;
        const style = document.createElement('style');
        style.id = 'backroom-about-dynamic-style';
        style.textContent = `
            #about-container .about-live-intro { font-size:1.12rem; line-height:1.6; color:#fff; }
            #about-container .about-live-copy { font-size:1.02rem; line-height:1.65; color:var(--text-light); }
            #about-container .about-coverage-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:22px 0; }
            #about-container .about-coverage-stat { background:var(--near-black); border:1px solid var(--primary-blue); border-radius:var(--radius-card); padding:18px; text-align:center; }
            #about-container .about-coverage-number { display:block; color:var(--primary-blue); font-family:'Antonio',sans-serif; font-size:2.3rem; font-weight:700; line-height:1; }
            #about-container .about-coverage-label { display:block; color:var(--text-light); font-family:'Barlow Condensed',sans-serif; font-weight:700; letter-spacing:.06em; margin-top:7px; text-transform:uppercase; }
            #about-container .about-contact-link { color:var(--primary-blue); font-weight:700; cursor:pointer; text-decoration:underline; }
            @media (max-width:600px) { #about-container .about-coverage-grid { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(style);
    }

    function renderAboutPage() {
        const container = document.getElementById('about-container');
        if (!container) return;
        installAboutStyles();

        container.innerHTML = `
            <h2 class="display-font" style="color:var(--primary-blue); margin-bottom:15px;">ABOUT BACKROOM</h2>
            <p class="body-font about-live-intro"><strong>Backroom focuses primarily on gay male and men-only nightlife and events across Europe, while also including a broader range of gay and queer venues.</strong></p>

            <div class="about-coverage-grid" id="about-coverage-summary" aria-live="polite">
                <div class="about-coverage-stat"><span class="about-coverage-number" id="about-country-count">—</span><span class="about-coverage-label">Countries</span></div>
                <div class="about-coverage-stat"><span class="about-coverage-number" id="about-city-count">—</span><span class="about-coverage-label">Cities</span></div>
            </div>

            <p class="body-font about-live-copy">The directory currently covers <strong id="about-country-count-inline">— countries</strong> and <strong id="about-city-count-inline">— cities</strong>, calculated automatically from our live venue and event records.</p>

            <p class="body-font about-live-copy">Information is gathered through actual in-person visits, as well as from multiple public sources. Wherever possible, details are cross-checked against at least two independent sources. Listings are reviewed regularly, with no listing left unchecked for longer than six months, to help ensure the information remains current.</p>

            <p class="body-font about-live-copy">Please <a href="#" class="about-contact-link" id="about-contact-link">contact us</a> if you would like to add a venue or event, request that something be removed, or report information that needs to be corrected or updated.</p>
        `;

        document.getElementById('about-contact-link')?.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof window.flagListing === 'function') {
                window.flagListing('N/A', 'General Message', 'General Support');
            } else {
                window.location.href = 'contact.html';
            }
        });
    }

    function setAboutCounts(countryCount, cityCount) {
        const countryNumber = document.getElementById('about-country-count');
        const cityNumber = document.getElementById('about-city-count');
        const countryInline = document.getElementById('about-country-count-inline');
        const cityInline = document.getElementById('about-city-count-inline');
        if (countryNumber) countryNumber.textContent = countryCount;
        if (cityNumber) cityNumber.textContent = cityCount;
        if (countryInline) countryInline.textContent = `${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`;
        if (cityInline) cityInline.textContent = `${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`;
    }

    async function calculateAboutCoverage() {
        const stamp = Date.now();
        const [venueResponse, eventResponse] = await Promise.all([
            fetch(`listings.json?v=${stamp}`),
            fetch(`events.json?v=${stamp}`)
        ]);
        if (!venueResponse.ok || !eventResponse.ok) throw new Error('Coverage data unavailable');

        const [venueRows, eventRows] = await Promise.all([venueResponse.json(), eventResponse.json()]);
        const venueMap = new Map();
        const cities = new Set();
        const countries = new Set();

        (Array.isArray(venueRows) ? venueRows : []).forEach((row) => {
            const location = directLocation(row);
            const venueId = cleanValue(row?.Venue_ID);
            if (venueId) venueMap.set(venueId, location);
            location.cities.forEach((city) => cities.add(countKey(city)));
            const country = countKey(location.country);
            if (country) countries.add(country);
        });

        (Array.isArray(eventRows) ? eventRows : []).forEach((row) => {
            const direct = directLocation(row);
            const linked = venueMap.get(cleanValue(row?.Venue_ID)) || { cities: [], country: '' };
            const eventCities = direct.cities.length ? direct.cities : linked.cities;
            const eventCountry = direct.country || linked.country;
            eventCities.forEach((city) => cities.add(countKey(city)));
            const country = countKey(eventCountry);
            if (country) countries.add(country);
        });

        return { countries: countries.size, cities: cities.size };
    }

    async function loadAboutCoverage(force = false) {
        if (force) aboutCoveragePromise = null;
        if (!aboutCoveragePromise) aboutCoveragePromise = calculateAboutCoverage();
        try {
            const counts = await aboutCoveragePromise;
            setAboutCounts(counts.countries, counts.cities);
        } catch {
            aboutCoveragePromise = null;
            const summary = document.getElementById('about-coverage-summary');
            if (summary) summary.innerHTML = '<span class="body-font" style="color:var(--text-light);">Live coverage figures are temporarily unavailable.</span>';
            const countryInline = document.getElementById('about-country-count-inline');
            const cityInline = document.getElementById('about-city-count-inline');
            if (countryInline) countryInline.textContent = 'our current countries';
            if (cityInline) cityInline.textContent = 'our current cities';
        }
    }

    function refreshAboutRoute() {
        renderAboutPage();
        loadAboutCoverage();
    }

    function installDynamicAboutPage() {
        refreshAboutRoute();
        window.addEventListener('hashchange', () => {
            if (window.location.hash === '#about') {
                window.setTimeout(refreshAboutRoute, 0);
                window.setTimeout(refreshAboutRoute, 120);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installDynamicAboutPage);
    } else {
        installDynamicAboutPage();
    }
})();
