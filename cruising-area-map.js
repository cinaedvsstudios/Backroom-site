/* Backroom v1.5.24 — Cruising Areas location map. */
(() => {
  'use strict';

  const COVERAGE = [[26, -27], [73, 52]];
  const CLUSTER_PIXELS = 78;
  let leafletReady = null;

  function ensureLeaflet() {
    if (window.L && typeof window.L.map === 'function') return Promise.resolve(window.L);
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((resolve, reject) => {
      const script = document.querySelector('script[src*="leaflet@1.9.4/dist/leaflet.js"]');
      if (!script) { reject(new Error('Leaflet script is missing.')); return; }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearInterval(poll);
        window.clearTimeout(timeout);
        if (error) reject(error);
        else resolve(window.L);
      };
      const poll = window.setInterval(() => {
        if (window.L && typeof window.L.map === 'function') finish();
      }, 80);
      const timeout = window.setTimeout(() => finish(new Error('Map library did not load.')), 9000);
      script.addEventListener('error', () => finish(new Error('Map library could not be loaded.')), { once: true });
      if (window.L && typeof window.L.map === 'function') finish();
    }).catch(error => { leafletReady = null; throw error; });
    return leafletReady;
  }

  function escapeText(text) {
    return String(text ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function validView(view) {
    return view && Array.isArray(view.center) && view.center.length === 2
      && view.center.every(Number.isFinite) && Number.isFinite(view.zoom)
      && view.center[0] >= COVERAGE[0][0] && view.center[0] <= COVERAGE[1][0]
      && view.center[1] >= COVERAGE[0][1] && view.center[1] <= COVERAGE[1][1];
  }

  function gridClusters(map, cities) {
    const grid = new Map();
    const zoom = map.getZoom();
    cities.forEach(city => {
      const pixel = map.project([city.lat, city.lng], zoom);
      const key = Math.floor(pixel.x / CLUSTER_PIXELS) + ':' + Math.floor(pixel.y / CLUSTER_PIXELS);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(city);
    });
    return [...grid.values()];
  }

  function buildClusterPopup(cities, onSelect) {
    const box = document.createElement('div');
    box.className = 'br-cruising-map-popup';
    const heading = document.createElement('strong');
    heading.textContent = 'Choose a city';
    box.appendChild(heading);
    cities.slice().sort((a, b) => a.city.localeCompare(b.city)).forEach(city => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = city.city + ', ' + city.country + ' (' + city.count + ')';
      button.addEventListener('click', () => onSelect(city));
      box.appendChild(button);
    });
    return box;
  }

  async function mount({ element, cities, scope, viewport, onCitySelected, onViewportChanged, isActive }) {
    const L = await ensureLeaflet();
    if (!element.isConnected || !isActive()) return null;
    const bounds = L.latLngBounds(COVERAGE);
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    const map = L.map(element, {
      zoomControl: true, minZoom: 2, maxZoom: 11, maxBounds: bounds,
      maxBoundsViscosity: 1, worldCopyJump: false,
      scrollWheelZoom: !mobile, dragging: !mobile, touchZoom: true,
      tap: false, doubleClickZoom: !mobile, bounceAtZoomLimits: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'br-cruising-map-dark-tile',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    let active = true;
    let renderTimeout = null;
    const selected = city => scope?.scope === 'city'
      && String(city.key) === String(scope.key)
      && String(city.countryKey) === String(scope.countryKey);

    function updateMarkers() {
      if (!active) return;
      markers.clearLayers();
      gridClusters(map, cities).forEach(cluster => {
        const total = cluster.reduce((sum, city) => sum + city.count, 0);
        const grouped = cluster.length > 1;
        const lat = cluster.reduce((sum, city) => sum + city.lat * city.count, 0) / total;
        const lng = cluster.reduce((sum, city) => sum + city.lng * city.count, 0) / total;
        const chosen = !grouped && selected(cluster[0]);
        const size = Math.min(52, Math.max(34, 32 + String(total).length * 5 + (grouped ? 3 : 0)));
        const css = 'br-cruising-map-bubble' + (grouped ? ' is-cluster' : '') + (chosen ? ' is-selected' : '');
        const icon = L.divIcon({
          className: 'br-cruising-map-icon',
          html: '<span class="' + css + '">' + escapeText(total) + '</span>',
          iconSize: [size, size], iconAnchor: [size / 2, size / 2]
        });
        const marker = L.marker([lat, lng], {
          icon, keyboard: true, riseOnHover: true,
          title: grouped
            ? total + ' cruising areas in ' + cluster.length + ' cities. Zoom in to choose.'
            : cluster[0].city + ', ' + cluster[0].country + ': ' + total + ' cruising areas. Select city.'
        });
        marker.on('click', () => {
          if (!grouped) {
            onCitySelected(cluster[0]);
            return;
          }
          if (map.getZoom() >= map.getMaxZoom() - 0.01) {
            L.popup({ maxHeight: 220, className: 'br-cruising-map-selection' })
              .setLatLng([lat, lng]).setContent(buildClusterPopup(cluster, onCitySelected)).openOn(map);
          } else {
            const clusterBounds = L.latLngBounds(cluster.map(city => [city.lat, city.lng]));
            map.flyToBounds(clusterBounds.pad(0.35), {
              maxZoom: Math.min(map.getMaxZoom(), map.getZoom() + 3), duration: 0.45
            });
          }
        });
        marker.addTo(markers);
      });
    }

    function getView() {
      const centre = map.getCenter();
      return { center: [centre.lat, centre.lng], zoom: map.getZoom() };
    }
    function reportView() {
      if (active) onViewportChanged(getView());
    }

    map.fitBounds(bounds, { padding: [10, 10], animate: false });
    const overviewZoom = map.getZoom();
    map.setMinZoom(overviewZoom);
    const saved = validView(viewport) ? viewport : null;
    if (saved) {
      map.setView(saved.center, Math.max(overviewZoom, Math.min(map.getMaxZoom(), saved.zoom)), { animate: false });
    } else if (scope?.scope === 'city') {
      const city = cities.find(candidate => selected(candidate));
      if (city) map.setView([city.lat, city.lng], Math.min(7, map.getMaxZoom()), { animate: false });
    }
    map.on('zoomend moveend', () => {
      if (renderTimeout) window.clearTimeout(renderTimeout);
      renderTimeout = window.setTimeout(updateMarkers, 40);
      reportView();
    });
    updateMarkers();
    reportView();

    return {
      getView,
      destroy() {
        if (!active) return;
        active = false;
        if (renderTimeout) window.clearTimeout(renderTimeout);
        map.off();
        map.remove();
      }
    };
  }

  window.BackroomCruisingMap = { mount };
})();