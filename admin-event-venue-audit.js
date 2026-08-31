/* Backroom Admin event Venue_ID audit v1.00 */
(() => {
    'use strict';

    if (window.__backroomAdminVenueIdAuditInstalled) return;
    window.__backroomAdminVenueIdAuditInstalled = true;

    const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const key = (value) => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');

    function removeReplaceJsonControl() {
        const input = document.getElementById('file-upload-replace');
        const label = input?.closest('label');
        if (label) label.remove();
    }

    function getWorkingEvents() {
        try {
            if (currentMode === 'events' && Array.isArray(draftData) && draftData.length) {
                return JSON.parse(JSON.stringify(draftData));
            }
        } catch (_) {}

        try {
            const stored = JSON.parse(localStorage.getItem('br_admin_events_draft') || '[]');
            if (Array.isArray(stored) && stored.length) return stored;
        } catch (_) {}

        return [];
    }

    async function getListingsFromJson() {
        const response = await fetch(`listings.json?v=${Date.now()}`);
        if (!response.ok) throw new Error(`Could not load listings.json: HTTP ${response.status}`);
        const parsed = await response.json();
        if (!Array.isArray(parsed)) throw new Error('listings.json did not contain an array.');
        return parsed;
    }

    function firstUrl(value) {
        return clean(String(value || '').split(/[|,\n]+/).map(clean).find(Boolean));
    }

    function buildVenueIndexes(venues) {
        const idMap = new Map();
        const nameMap = new Map();
        const looseMap = new Map();

        venues.forEach((venue) => {
            const id = clean(venue?.Venue_ID);
            if (id) idMap.set(id, venue);

            const name = key(venue?.Name);
            if (name) {
                if (!nameMap.has(name)) nameMap.set(name, []);
                nameMap.get(name).push(venue);
            }

            [venue?.Website_URL, venue?.Instagram_URL, venue?.Facebook_URL, venue?.Other_URL, venue?.Source_URLs]
                .map(firstUrl)
                .filter(Boolean)
                .forEach((url) => looseMap.set(key(url), venue));
        });

        return { idMap, nameMap, looseMap };
    }

    function possibleVenueNames(event) {
        return [
            event?.Venue_Name,
            event?.Venue,
            event?.Venue_Title,
            event?.Location_Name,
            event?.Place,
            event?.Event_Venue
        ].map(clean).filter(Boolean);
    }

    function eventLocationText(event) {
        return [
            event?.City || event?.Event_City || event?.Venue_City || event?.Location_City,
            event?.Country || event?.Event_Country || event?.Venue_Country || event?.Location_Country
        ].map(clean).filter(Boolean).join(', ');
    }

    function scoreVenueSuggestion(event, venue, wantedName) {
        let score = 0;
        const eventCity = key(event?.City || event?.Event_City || event?.Venue_City || event?.Location_City);
        const eventCountry = key(event?.Country || event?.Event_Country || event?.Venue_Country || event?.Location_Country);
        if (wantedName && key(venue?.Name) === key(wantedName)) score += 8;
        if (wantedName && key(venue?.Name).includes(key(wantedName))) score += 3;
        if (eventCity && key(venue?.City).includes(eventCity)) score += 3;
        if (eventCountry && key(venue?.Country) === eventCountry) score += 3;
        return score;
    }

    function suggestVenues(event, indexes, venues) {
        const suggestions = [];
        const seen = new Set();
        const names = possibleVenueNames(event);

        names.forEach((name) => {
            (indexes.nameMap.get(key(name)) || []).forEach((venue) => {
                const id = clean(venue?.Venue_ID);
                if (id && !seen.has(id)) {
                    seen.add(id);
                    suggestions.push({ venue, score: scoreVenueSuggestion(event, venue, name) });
                }
            });
        });

        const eventUrls = [event?.Source_URLs, event?.Ticket_URL, event?.Tickets_URL, event?.RSVP_URL, event?.Event_URL]
            .map(firstUrl)
            .filter(Boolean);
        eventUrls.forEach((url) => {
            const venue = indexes.looseMap.get(key(url));
            const id = clean(venue?.Venue_ID);
            if (venue && id && !seen.has(id)) {
                seen.add(id);
                suggestions.push({ venue, score: 6 });
            }
        });

        if (suggestions.length < 5 && names.length) {
            const wanted = key(names[0]);
            venues.forEach((venue) => {
                const id = clean(venue?.Venue_ID);
                if (!id || seen.has(id)) return;
                const venueName = key(venue?.Name);
                if (!wanted || !venueName) return;
                if (venueName.includes(wanted) || wanted.includes(venueName)) {
                    seen.add(id);
                    suggestions.push({ venue, score: scoreVenueSuggestion(event, venue, names[0]) });
                }
            });
        }

        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(({ venue }) => venue);
    }

    function describeEvent(event) {
        return [
            `Event_ID: ${clean(event?.Event_ID) || '(missing Event_ID)'}`,
            `Event_Name: ${clean(event?.Event_Name) || '(missing Event_Name)'}`,
            `Event_Date: ${clean(event?.Event_Date) || '(missing Event_Date)'}`,
            `Venue_ID: ${clean(event?.Venue_ID) || '(missing Venue_ID)'}`,
            possibleVenueNames(event).length ? `Venue name text: ${possibleVenueNames(event).join(' / ')}` : '',
            eventLocationText(event) ? `Location text: ${eventLocationText(event)}` : '',
            clean(event?.Event_Description) ? `Description: ${clean(event.Event_Description).slice(0, 220)}${clean(event.Event_Description).length > 220 ? '…' : ''}` : ''
        ].filter(Boolean).join('\n');
    }

    function buildAuditReport(events, venues) {
        const indexes = buildVenueIndexes(venues);
        const missing = [];
        const invalid = [];
        const whitespace = [];
        const valid = [];

        events.forEach((event) => {
            const rawId = String(event?.Venue_ID ?? '');
            const trimmedId = clean(rawId);
            if (!trimmedId) {
                missing.push(event);
            } else if (indexes.idMap.has(trimmedId)) {
                valid.push(event);
                if (rawId !== trimmedId) whitespace.push(event);
            } else {
                invalid.push(event);
            }
        });

        const lines = [];
        lines.push('BACKROOM EVENT VENUE_ID AUDIT');
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');
        lines.push(`Events checked: ${events.length}`);
        lines.push(`Venue IDs checked from listings.json: ${indexes.idMap.size}`);
        lines.push(`Valid Venue_ID: ${valid.length}`);
        lines.push(`Missing Venue_ID: ${missing.length}`);
        lines.push(`Invalid Venue_ID: ${invalid.length}`);
        lines.push(`Venue_ID needs trimming but matches after trim: ${whitespace.length}`);
        lines.push('');

        if (!missing.length && !invalid.length && !whitespace.length) {
            lines.push('No Venue_ID problems found. Every event has a Venue_ID that matches listings.json.');
            return lines.join('\n');
        }

        if (missing.length) {
            lines.push('==============================');
            lines.push('MISSING Venue_ID');
            lines.push('==============================');
            missing.forEach((event, index) => {
                lines.push('');
                lines.push(`[${index + 1}]`);
                lines.push(describeEvent(event));
                const suggestions = suggestVenues(event, indexes, venues);
                if (suggestions.length) {
                    lines.push('Possible matching venues:');
                    suggestions.forEach((venue) => lines.push(`- ${clean(venue.Venue_ID)} — ${clean(venue.Name)} (${clean(venue.City)}, ${clean(venue.Country)})`));
                } else {
                    lines.push('Possible matching venues: none found by simple name/source matching.');
                }
            });
            lines.push('');
        }

        if (invalid.length) {
            lines.push('==============================');
            lines.push('INVALID Venue_ID — not found in listings.json');
            lines.push('==============================');
            invalid.forEach((event, index) => {
                lines.push('');
                lines.push(`[${index + 1}]`);
                lines.push(describeEvent(event));
                const suggestions = suggestVenues(event, indexes, venues);
                if (suggestions.length) {
                    lines.push('Possible matching venues:');
                    suggestions.forEach((venue) => lines.push(`- ${clean(venue.Venue_ID)} — ${clean(venue.Name)} (${clean(venue.City)}, ${clean(venue.Country)})`));
                } else {
                    lines.push('Possible matching venues: none found by simple name/source matching.');
                }
            });
            lines.push('');
        }

        if (whitespace.length) {
            lines.push('==============================');
            lines.push('Venue_ID WHITESPACE WARNINGS');
            lines.push('==============================');
            whitespace.forEach((event, index) => {
                lines.push('');
                lines.push(`[${index + 1}] ${clean(event?.Event_ID) || '(missing Event_ID)'} — ${clean(event?.Event_Name) || '(missing Event_Name)'}`);
                lines.push(`Stored Venue_ID: ${JSON.stringify(String(event?.Venue_ID ?? ''))}`);
                lines.push(`Trimmed Venue_ID: ${clean(event?.Venue_ID)}`);
            });
        }

        return lines.join('\n');
    }

    function downloadText(filename, text) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        window.setTimeout(() => {
            URL.revokeObjectURL(link.href);
            link.remove();
        }, 250);
    }

    async function runVenueIdAudit() {
        if (currentMode !== 'events') {
            showToast('Audit Venue ID is available in the Events tab.');
            return;
        }

        const events = getWorkingEvents();
        if (!events.length) {
            showToast('No event data loaded to audit.');
            return;
        }

        try {
            showToast('Auditing event Venue_ID values…');
            const venues = await getListingsFromJson();
            const report = buildAuditReport(events, venues);
            const today = new Date().toISOString().slice(0, 10);
            downloadText(`backroom_event_venue_id_audit_${today}.txt`, report);
            const invalidCount = (report.match(/INVALID Venue_ID/g) ? 1 : 0);
            showToast('Venue ID audit downloaded.');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Venue ID audit failed.');
        }
    }

    function installAuditButton() {
        removeReplaceJsonControl();

        const removeOld = document.getElementById('btn-remove-old-events');
        const exportCsv = document.getElementById('btn-export-csv');
        if (!removeOld && !exportCsv) return false;
        if (document.getElementById('btn-audit-event-venue-ids')) return true;

        const button = document.createElement('button');
        button.id = 'btn-audit-event-venue-ids';
        button.className = 'btn secondary-btn pill-btn';
        button.style.width = 'auto';
        button.textContent = '🔎 Audit Venue ID';
        button.addEventListener('click', runVenueIdAudit);

        if (removeOld?.parentNode) removeOld.insertAdjacentElement('afterend', button);
        else exportCsv.insertAdjacentElement('beforebegin', button);
        return true;
    }

    function startInstaller() {
        installAuditButton();
        const observer = new MutationObserver(() => installAuditButton());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startInstaller);
    } else {
        startInstaller();
    }
})();
