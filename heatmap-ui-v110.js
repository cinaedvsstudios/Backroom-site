(() => {
  'use strict';

  const H = window.BRHeat;
  const $ = id => document.getElementById(id);
  const ui = ['mode','category','range','display','pins','scale'].reduce((object, id) => {
    object[id] = $(id);
    return object;
  }, {});

  if (!H || !window.L) {
    const text = $('loading-text');
    if (text) text.textContent = 'Heat-map scripts could not start.';
    return;
  }

  const map = L.map('map', { zoomControl: true, minZoom: 2, worldCopyJump: true }).setView([51.2, 10.5], 4);
  const layers = { heat: null, marks: null, pins: null };
  const gradient = { .06:'#6d00ff', .20:'#2934ff', .36:'#00bfff', .52:'#00e87b', .68:'#eaff00', .84:'#ff9b00', 1:'#ff0000' };
  let loaded = false;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  function markerIcon(type, count) {
    if (type === 'none') return null;
    const html = type === 'count' ? `<div class="count">${count}</div>` : `<div class="${type}"></div>`;
    return L.divIcon({
      className: 'city-icon', html,
      iconSize: { dot:[14,14], ring:[26,26], pin:[34,40], count:[42,32] }[type],
      iconAnchor: { dot:[7,7], ring:[13,13], pin:[15,34], count:[21,16] }[type]
    });
  }

  function matchingLabel(count) {
    const mode = ui.mode.value;
    if (mode === 'events') return `${count} matching event${count === 1 ? '' : 's'}`;
    if (mode === 'cruising') return `${count} matching cruising area${count === 1 ? '' : 's'}`;
    if (mode === 'venues') return `${count} matching venue${count === 1 ? '' : 's'}`;
    return `${count} matching record${count === 1 ? '' : 's'}`;
  }

  function popup(point) {
    const city = point.city || point.name;
    const country = point.country || '';
    const approximation = point.approximate ? '<br><small style="color:#969cae">Placed at city centre</small>' : '';
    return `<div style="min-width:175px"><strong>${H.escape(point.name)}</strong><br><span>${H.escape([
      point.kind === 'city' ? '' : city, country
    ].filter(Boolean).join(' · '))}</span>${approximation}<br><button class="popup-record-link" data-city="${H.escape(city)}" data-country="${H.escape(country)}" data-mode="${H.escape(ui.mode.value)}" data-category="${H.escape(ui.category.value)}">${H.escape(matchingLabel(point.count || 1))}</button></div>`;
  }

  function clearLayers() {
    Object.keys(layers).forEach(key => {
      if (!layers[key]) return;
      map.removeLayer(layers[key]);
      layers[key] = null;
    });
  }

  function draw(data) {
    clearLayers();
    const maxCount = Math.max(1, ...data.points.map(point => point.count));
    const denominator = ui.scale.value === 'relative' ? maxCount : (data.mode === 'cities' ? 60 : 12);
    const isRecordMode = data.mode !== 'cities';

    if (ui.display.value === 'heat') {
      layers.heat = L.heatLayer(data.points.map(point => [
        point.lat,
        point.lng,
        isRecordMode ? 1 : Math.max(.15, Math.min(1, point.count / denominator))
      ]), {
        radius: isRecordMode ? 31 : 58,
        blur: isRecordMode ? 18 : 28,
        minOpacity: .34,
        max: 1,
        gradient
      }).addTo(map);
    } else {
      layers.marks = L.layerGroup(data.points.map(point => L.circleMarker([point.lat, point.lng], {
        radius: isRecordMode ? 8 : 8 + 22 * Math.sqrt(Math.min(1, point.count / denominator)),
        color: '#fff', weight: 2, fillColor: '#f00', fillOpacity: .92
      }).bindPopup(popup(point)))).addTo(map);
    }

    if (ui.pins.value !== 'none') {
      layers.pins = L.layerGroup(data.cityGroups.map(group => L.marker([group.lat, group.lng], {
        icon: markerIcon(ui.pins.value, group.count), zIndexOffset: 900
      }).bindTooltip(`${H.escape(group.name)}${group.country ? ` · ${H.escape(group.country)}` : ''}`, {
        direction: 'top', className: 'city-tip'
      }).bindPopup(popup({ ...group, kind: 'city' })))).addTo(map);
    }

    const boundsSource = data.points.length ? data.points : data.cityGroups;
    if (boundsSource.length) {
      const bounds = L.latLngBounds(boundsSource.map(point => [point.lat, point.lng]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(.16), { maxZoom: isRecordMode ? 7 : 6, animate: false });
    }
  }

  function render() {
    if (!loaded) return;
    const eventMode = ui.mode.value === 'events';
    ui.range.disabled = !eventMode;
    $('range-field').classList.toggle('disabled', !eventMode);

    const data = H.build({ mode: ui.mode.value, category: ui.category.value, range: ui.range.value });
    draw(data);

    const dateText = eventMode ? ` · ${ui.range.options[ui.range.selectedIndex].text}` : '';
    $('heading').textContent = { venues:'Venues', events:'Events', cities:'City totals', cruising:'Cruising areas' }[data.mode];
    $('sub').textContent = `${ui.category.options[ui.category.selectedIndex].text}${dateText} · ${ui.display.options[ui.display.selectedIndex].text}`;
    $('records').textContent = data.records.length.toLocaleString();
    $('points').textContent = data.points.length.toLocaleString();
    $('cities').textContent = data.cityGroups.length.toLocaleString();

    const ranked = [...data.cityGroups].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 15);
    $('list').innerHTML = ranked.length
      ? ranked.map((group, index) => `<div class="row" data-lat="${group.lat}" data-lng="${group.lng}"><b>${index + 1}</b><span><b>${H.escape(group.name)}</b><small>${H.escape(group.country || 'Country not set')}</small></span><b>${group.count}</b></div>`).join('')
      : '<div style="padding:18px;text-align:center;color:var(--text)">No matching records can be plotted.</div>';
    $('list').querySelectorAll('.row').forEach(row => {
      row.onclick = () => map.flyTo([+row.dataset.lat, +row.dataset.lng], 7, { duration: .6 });
    });

    const unplotted = Math.max(0, data.records.length - data.points.length);
    if (data.mode === 'cities') {
      $('note').textContent = `${data.cityGroups.length} matching cities are plotted. City centres come from record coordinates first, then the local Backroom fallback list.`;
    } else {
      $('note').textContent = `${data.exactCount} records use their saved coordinates; ${data.fallbackCount} use a city-centre fallback${unplotted ? `; ${unplotted} could not be placed` : ''}.`;
    }
  }

  map.on('popupopen', event => {
    event.popup.getElement()?.querySelectorAll('.popup-record-link').forEach(button => {
      button.onclick = () => {
        const payload = { city: button.dataset.city, country: button.dataset.country, mode: button.dataset.mode, category: button.dataset.category };
        if (parent !== window && typeof parent.openHeatmapRecordResults === 'function') {
          parent.openHeatmapRecordResults(payload);
          return;
        }
        localStorage.setItem('br_location', JSON.stringify({ city: payload.city, country: payload.country, postcode: '', scope: 'city' }));
        location.href = './' + (payload.mode === 'events' ? '#calendar' : payload.mode === 'cities' ? '#results' : '#venues');
      };
    });
  });

  Object.values(ui).forEach(control => control.addEventListener('change', render));
  if (new URLSearchParams(location.search).get('embed') === '1') document.querySelector('.top')?.classList.add('hidden');

  function showLoadError(error) {
    console.error(error);
    $('loading-text').textContent = `Could not load heat-map data: ${error?.message || 'Unknown error'}`;
    $('loading-retry')?.classList.remove('hidden');
  }

  async function load() {
    $('loading').classList.remove('hidden');
    $('loading-text').textContent = 'LOADING BACKROOM DATA';
    $('loading-retry')?.classList.add('hidden');
    try {
      await H.load();
      loaded = true;
      render();
      $('loading').classList.add('hidden');
      window.setTimeout(() => map.invalidateSize(), 100);
    } catch (error) {
      showLoadError(error);
    }
  }

  $('loading-retry')?.addEventListener('click', load);
  load();
})();
