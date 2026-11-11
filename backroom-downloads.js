/* Backroom downloads v1.0: story JPEGs and full offline shortlist PDFs. */
(() => {
  'use strict';
  const ASSET_ROOT = new URL('.', document.currentScript.src);
  const asset = path => new URL(path, ASSET_ROOT).href;
  const C = { bg: '#0B0F19', panel: '#111725', card: '#1B2333', cyan: '#2CA8D4', red: '#D55036', muted: '#969CAE', white: '#FFFFFF', line: '#313748' };
  const TAG_PRIORITY = [
    ['Men Only'], ['Cruising', 'Sauna'],
    ['Leather', 'Underwear', 'Naked', 'Fetish/Gear', 'Fetish', 'BDSM', 'Bear'],
    ['Techno', 'Pop/Dance', 'Queer', 'Young Crowd', 'Drag', 'Pride', 'Festival', 'Community', 'Social', 'Dancefloor', 'Party', 'Dresscode']
  ].flat();
  const clean = value => String(value ?? '').trim();
  const fileName = value => clean(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'Backroom';
  function storyTags(event) {
    const tags = [...new Set(clean(event.Vibe_Tags).split(',').map(clean).filter(Boolean))];
    return tags.sort((a, b) => {
      const ai = TAG_PRIORITY.indexOf(a), bi = TAG_PRIORITY.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    }).slice(0, 3);
  }
  function safeUrl(value) {
    try { const url = new URL(clean(value)); return /^https?:$/.test(url.protocol) ? url.href : ''; }
    catch (_) { return ''; }
  }
  function firstUrl(...values) {
    for (const value of values) {
      for (const part of clean(value).split(/[|,\s]+/)) { const url = safeUrl(part); if (url) return url; }
    }
    return '';
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function busy(button, task) {
    if (button?.disabled) return;
    const label = button?.textContent;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = label.length <= 4 ? '⏳' : 'Preparing download…'; }
    try { await task(); }
    catch (error) { console.error('Backroom download:', error); window.showToast?.('Download could not be prepared. Please try again.'); }
    finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = label; } }
  }
  const imageCache = new Map();
  function loadImage(url) {
    if (!imageCache.has(url)) imageCache.set(url, new Promise((resolve, reject) => {
      const image = new Image(); image.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { image.src = ''; reject(new Error('Image loading timed out')); }, 12000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Image could not load')); };
      image.src = url;
    }).catch(error => { imageCache.delete(url); throw error; }));
    return imageCache.get(url);
  }
  let fontsPromise;
  function storyFonts() {
    if (!fontsPromise) fontsPromise = Promise.all([
      new FontFace('BackroomDownload', `url("${asset('vendor/BarlowCondensed-Regular.ttf')}")`, { weight: '400' }).load(),
      new FontFace('BackroomDownload', `url("${asset('vendor/BarlowCondensed-SemiBold.ttf')}")`, { weight: '600' }).load()
    ]).then(fonts => fonts.forEach(font => document.fonts.add(font))).catch(error => { fontsPromise = null; throw error; });
    return fontsPromise;
  }
  function setFont(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px BackroomDownload, 'Arial Narrow', sans-serif`; }
  function wrap(ctx, text, maxWidth) {
    const lines = []; let line = '';
    for (const word of clean(text).split(/\s+/)) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ''; }
        let fragment = '';
        for (const char of word) { if (ctx.measureText(fragment + char).width > maxWidth && fragment) { lines.push(fragment); fragment = ''; } fragment += char; }
        line = fragment;
      } else if (line && ctx.measureText(line + ' ' + word).width > maxWidth) { lines.push(line); line = word; }
      else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }
  function rounded(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function centerLines(ctx, text, y, width, size, color, weight = 400, maxLines = 3) {
    let lines;
    do { setFont(ctx, size, weight); lines = wrap(ctx, text, width); if (lines.length <= maxLines || size <= 20) break; size -= 2; } while (true);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 540, y + i * size * 1.08));
    return y + lines.length * size * 1.08;
  }
  function cover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sw = width / scale, sh = height / scale;
    ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, width, height);
  }
  function dateLabel(event) {
    const raw = typeof getEventDisplayDate === 'function' ? getEventDisplayDate(event) : event.Display_Date || event.Event_Date;
    const date = typeof parseEventDateLocal === 'function' ? parseEventDateLocal(raw) : new Date(raw + 'T12:00:00');
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : clean(raw) || 'DATE TBC';
  }

  // Only these generic images can be chosen using the Story Card image cycle.
  // Special-purpose venue placeholders (08–14) are intentionally excluded.
  const STORY_GENERIC_IMAGES = Object.freeze([
    'placeholder_venue01.jpg', 'placeholder_venue02.jpg', 'placeholder_venue03.jpg',
    'placeholder_venue04.jpg', 'placeholder_venue05.jpg', 'placeholder_venue06.jpg',
    'placeholder_venue07.jpg', 'placeholder_venue15.jpg', 'placeholder_venue16.jpg',
    'placeholder_venue17.jpg', 'placeholder_venue18.jpg'
  ]);
  const STORY_STANDARD_FRAME = Object.freeze({ x: 108, y: 581, width: 864, height: 505 });
  const STORY_UPLOAD_FRAME = Object.freeze({ x: 108, y: 506, width: 864, height: 674 });
  const STORY_MAX_ZOOM = 3;

  function storyFrame(state) {
    return state.uploaded ? STORY_UPLOAD_FRAME : STORY_STANDARD_FRAME;
  }

  function clampPhotoOffset(state) {
    const frame = storyFrame(state), image = state.photo;
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const baseScale = Math.max(frame.width / width, frame.height / height);
    const scaledWidth = width * baseScale * state.zoom;
    const scaledHeight = height * baseScale * state.zoom;
    const limitX = Math.max(0, (scaledWidth - frame.width) / 2);
    const limitY = Math.max(0, (scaledHeight - frame.height) / 2);
    state.offsetX = Math.max(-limitX, Math.min(limitX, state.offsetX));
    state.offsetY = Math.max(-limitY, Math.min(limitY, state.offsetY));
    return { frame, scaledWidth, scaledHeight };
  }

  function paintStoryPhoto(ctx, state) {
    const metrics = clampPhotoOffset(state);
    if (!metrics) return;
    const { frame, scaledWidth, scaledHeight } = metrics;
    ctx.save();
    rounded(ctx, frame.x, frame.y, frame.width, frame.height, 22);
    ctx.clip();
    ctx.drawImage(
      state.photo,
      frame.x + (frame.width - scaledWidth) / 2 + state.offsetX,
      frame.y + (frame.height - scaledHeight) / 2 + state.offsetY,
      scaledWidth, scaledHeight
    );
    ctx.restore();
  }

  // One renderer is used for both the editable live preview and the downloaded JPEG.
  function paintStory(canvas, event, venue, logo, state) {
    const ctx = canvas.getContext('2d');
    const uploaded = state.uploaded;
    const frame = storyFrame(state);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = C.cyan; ctx.fillRect(0, 0, 1080, 12);

    centerLines(ctx, 'CHECK OUT THIS', uploaded ? 106 : 190, 900, 60, C.white);
    centerLines(ctx, 'EVENT FROM', uploaded ? 174 : 258, 900, 60, C.white);
    const logoScale = Math.min(555 / logo.naturalWidth, 100 / logo.naturalHeight);
    ctx.drawImage(
      logo, (1080 - logo.naturalWidth * logoScale) / 2,
      uploaded ? 287 : 350, logo.naturalWidth * logoScale,
      logo.naturalHeight * logoScale
    );
    centerLines(ctx, 'https://backroom.s.gy/', uploaded ? 400 : 458, 900, 30, C.muted);

    const cardY = uploaded ? 470 : 545;
    const cardHeight = uploaded ? 1260 : 1190;
    ctx.save();
    ctx.shadowColor = '#000000'; ctx.shadowBlur = 38; ctx.shadowOffsetY = 24;
    rounded(ctx, 72, cardY, 936, cardHeight, 42, C.card);
    ctx.restore();
    ctx.lineWidth = 4;
    rounded(ctx, 72, cardY, 936, cardHeight, 42, null, C.cyan);
    paintStoryPhoto(ctx, state);

    const title = clean(event.Event_Name).toUpperCase() || 'EVENT';
    let titleSize = uploaded ? 92 : 104, titleLines;
    do {
      setFont(ctx, titleSize, 600);
      titleLines = wrap(ctx, title, 820);
      if (titleLines.length <= 2 &&
          (!uploaded || titleLines.length * titleSize * 1.08 <= 182)) break;
      if (titleSize <= 20) break;
      titleSize -= 2;
    } while (true);

    const titleTop = uploaded
      ? 1195 + Math.max(0, (182 - titleLines.length * titleSize * 1.08) / 2)
      : 1125 + Math.max(0, (225 - titleLines.length * titleSize * 1.08) / 2);
    const titleBottom = centerLines(ctx, title, titleTop, 820, titleSize, C.red, 600, 2);
    const location = [
      venue?.Name || event.Venue_Name || event.Venue,
      event.City || venue?.City
    ].filter(Boolean).join(' / ');
    centerLines(
      ctx, '📍 ' + location,
      uploaded ? Math.max(1388, titleBottom + 8) : Math.max(1365, titleBottom + 14),
      810, 32, C.muted, 400, 2
    );

    const tags = storyTags(event);
    let size = 30, widths;
    do {
      setFont(ctx, size);
      widths = tags.map(tag => ctx.measureText(tag).width + 38);
      if (widths.reduce((a, b) => a + b, 0) + 14 * (tags.length - 1) <= 820 || size <= 18) break;
      size--;
    } while (true);
    let x = (1080 - widths.reduce((a, b) => a + b, 0) - 14 * (tags.length - 1)) / 2;
    tags.forEach((tag, i) => {
      ctx.lineWidth = 1;
      rounded(ctx, x, uploaded ? 1478 : 1450, widths[i], 48, 24, C.panel, C.cyan);
      ctx.fillStyle = '#E5E7ED';
      ctx.textAlign = 'center';
      ctx.fillText(tag, x + widths[i] / 2, uploaded ? 1486 : 1458);
      x += widths[i] + 14;
    });

    const panelY = uploaded ? 1542 : 1520;
    ctx.lineWidth = 2;
    rounded(ctx, 108, panelY, 864, 160, 18, C.panel, C.line);
    ctx.textAlign = 'left'; ctx.fillStyle = C.muted; setFont(ctx, 29);
    ctx.fillText('📅 DATE', 140, panelY + 22);
    ctx.fillText('🕒 TIME', 740, panelY + 22);
    ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.moveTo(697, panelY + 26); ctx.lineTo(697, panelY + 133); ctx.stroke();
    let dateSize = 48;
    while (dateSize > 20) {
      setFont(ctx, dateSize, 600);
      if (ctx.measureText(dateLabel(event)).width <= 520) break;
      dateSize--;
    }
    ctx.fillStyle = C.white; ctx.fillText(dateLabel(event), 140, panelY + 77);
    ctx.fillStyle = C.cyan; setFont(ctx, 48, 600);
    ctx.fillText(clean(event.Event_Start_Time) || 'TBC', 740, panelY + 77);
  }

  function storyJpeg(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(value => value ? resolve(value) :
          reject(new Error('JPEG export failed')), 'image/jpeg', 0.95);
      } catch (error) { reject(error); }
    });
  }

  // A locally selected image is decoded from an object URL. It never leaves the
  // browser, and the temporary object URL is revoked as soon as decoding ends.
  function loadOwnImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be opened by your browser.')); };
      image.src = url;
    });
  }

  function showStory(event, venue, button) {
    return busy(button, async () => {
      await storyFonts();
      const logo = await loadImage(asset('backdoortitle.png'));
      const originalSource = typeof getEventImageSource === 'function'
        ? getEventImageSource(event, venue) : venue?.Image_URL;
      let initialPhoto;
      try {
        initialPhoto = await loadImage(new URL(originalSource || 'placeholder_venue.jpg', ASSET_ROOT).href);
      } catch (_) {
        initialPhoto = await loadImage(asset('placeholder_venue.jpg'));
      }

      document.getElementById('backroom-story-preview')?.remove();
      const dialog = document.createElement('dialog');
      dialog.id = 'backroom-story-preview';
      dialog.style.cssText = 'box-sizing:border-box;margin:auto;padding:16px;background:#111725;color:#fff;border:1px solid #2CA8D4;border-radius:16px;width:min(440px,94vw);max-height:94dvh;overflow:auto;';
      const heading = document.createElement('h2');
      heading.textContent = 'Create Story Card';
      heading.style.cssText = 'font-size:1.3rem;margin:0 0 10px;';
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1920;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Story Card preview. Select Move to drag the photo inside its frame.');
      canvas.style.cssText = 'display:block;height:min(57dvh,540px);width:auto;max-width:100%;margin:auto;cursor:default;user-select:none;-webkit-user-select:none;';
      const state = {
        photo: initialPhoto, uploaded: false, zoom: 1,
        offsetX: 0, offsetY: 0, moving: false
      };
      let genericIndex = -1;
      let requestId = 0;
      let dragging = null;

      const toolbar = document.createElement('div');
      toolbar.setAttribute('role', 'toolbar');
      toolbar.setAttribute('aria-label', 'Story Card image controls');
      toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;margin-top:12px;';
      function toolButton(label, tooltip) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'btn secondary-btn pill-btn';
        control.textContent = label;
        control.title = tooltip;
        control.setAttribute('aria-label', tooltip);
        control.style.cssText = 'flex:0 0 auto;min-width:34px;min-height:38px;padding:6px 9px;font-size:0.88rem;line-height:1.15;white-space:nowrap;';
        return control;
      }
      const cycleButton = toolButton('↻ Images', 'Cycle through generic placeholder images');
      const ownButton = toolButton('Use own image', 'Choose an image from your device');
      const moveButton = toolButton('✥ Move', 'Move the selected photo');
      const minusButton = toolButton('−', 'Zoom out');
      const plusButton = toolButton('+', 'Zoom in');
      toolbar.append(cycleButton, ownButton, moveButton, minusButton, plusButton);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;flex-wrap:nowrap;gap:8px;margin-top:12px;';
      function actionButton(label, className) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = className;
        control.textContent = label;
        control.style.cssText = 'box-sizing:border-box;min-width:0;flex:1 1 0;padding:9px 10px;font-size:0.95rem;line-height:1.2;white-space:nowrap;';
        return control;
      }
      const download = actionButton('Download JPEG', 'btn primary-btn pill-btn');
      const close = actionButton('Close', 'btn secondary-btn pill-btn');
      actions.append(download, close);
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif';
      picker.hidden = true;
      dialog.append(heading, canvas, toolbar, actions, picker);
      document.body.append(dialog);

      function refresh() {
        paintStory(canvas, event, venue, logo, state);
        minusButton.disabled = state.zoom <= 1.0001;
        plusButton.disabled = state.zoom >= STORY_MAX_ZOOM - 0.0001;
        moveButton.setAttribute('aria-pressed', String(state.moving));
        moveButton.style.backgroundColor = state.moving ? '#00547C' : '';
        canvas.style.touchAction = state.moving ? 'none' : 'auto';
      }
      function stopDragging(pointerId) {
        if (!dragging || (pointerId !== undefined && dragging.id !== pointerId)) return;
        if (canvas.hasPointerCapture?.(dragging.id)) canvas.releasePointerCapture(dragging.id);
        dragging = null;
      }
      function cursorPoint(ev) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (ev.clientX - rect.left) * canvas.width / rect.width,
          y: (ev.clientY - rect.top) * canvas.height / rect.height
        };
      }
      function onPhoto(point) {
        const frame = storyFrame(state);
        return point.x >= frame.x && point.x <= frame.x + frame.width &&
          point.y >= frame.y && point.y <= frame.y + frame.height;
      }
      canvas.addEventListener('pointerdown', ev => {
        if (!state.moving || !onPhoto(cursorPoint(ev))) return;
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        const point = cursorPoint(ev);
        dragging = { id: ev.pointerId, x: point.x, y: point.y,
          offsetX: state.offsetX, offsetY: state.offsetY };
        canvas.setPointerCapture(ev.pointerId);
      });
      canvas.addEventListener('pointermove', ev => {
        const point = cursorPoint(ev);
        if (dragging && dragging.id === ev.pointerId) {
          ev.preventDefault();
          state.offsetX = dragging.offsetX + point.x - dragging.x;
          state.offsetY = dragging.offsetY + point.y - dragging.y;
          refresh();
        }
        canvas.style.cursor = state.moving && onPhoto(point)
          ? (dragging ? 'grabbing' : 'crosshair') : 'default';
      });
      canvas.addEventListener('pointerup', ev => stopDragging(ev.pointerId));
      canvas.addEventListener('pointercancel', ev => stopDragging(ev.pointerId));
      canvas.addEventListener('pointerleave', () => {
        if (!dragging) canvas.style.cursor = 'default';
      });

      function choosePhoto(promise, uploaded) {
        const currentRequest = ++requestId;
        return Promise.resolve(promise).then(photo => {
          if (!dialog.isConnected || currentRequest !== requestId) return;
          state.photo = photo;
          state.uploaded = uploaded;
          state.zoom = 1;
          state.offsetX = 0; state.offsetY = 0;
          stopDragging();
          refresh();
        }).catch(error => {
          console.error('Story Card image:', error);
          window.showToast?.(error.message || 'Image could not be loaded.');
        });
      }
      cycleButton.onclick = () => {
        const next = (genericIndex + 1) % STORY_GENERIC_IMAGES.length;
        const filename = STORY_GENERIC_IMAGES[next];
        choosePhoto(loadImage(asset(filename)), false).then(() => {
          if (dialog.isConnected) genericIndex = next;
        });
      };
      function privacyNotice() {
        const notice = document.createElement('dialog');
        notice.style.cssText = 'box-sizing:border-box;margin:auto;max-width:min(350px,90vw);padding:20px;border:1px solid #2CA8D4;border-radius:14px;background:#111725;color:white;';
        const title = document.createElement('h3');
        title.textContent = 'Your image stays private';
        title.style.cssText = 'margin:0 0 10px;font-size:1.2rem;';
        const message = document.createElement('p');
        message.textContent = 'This image is only used locally in your browser. It is not sent over the internet anywhere.';
        message.style.cssText = 'margin:0 0 16px;line-height:1.5;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;';
        const agree = document.createElement('button');
        agree.type = 'button'; agree.className = 'btn primary-btn pill-btn';
        agree.textContent = 'I Understand';
        agree.style.cssText = 'flex:1;white-space:nowrap;font-size:0.9rem;padding:9px;';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'btn secondary-btn pill-btn';
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'flex:1;white-space:nowrap;font-size:0.9rem;padding:9px;';
        agree.onclick = () => {
          notice.close();
          picker.value = '';
          picker.click();
        };
        cancel.onclick = () => notice.close();
        notice.addEventListener('close', () => notice.remove(), { once: true });
        row.append(agree, cancel);
        notice.append(title, message, row);
        document.body.append(notice);
        notice.showModal();
        agree.focus();
      }
      ownButton.onclick = privacyNotice;
      picker.addEventListener('change', () => {
        const file = picker.files?.[0];
        if (!file) return;
        const supported = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i.test(file.type);
        if (!supported) {
          window.showToast?.('Choose a JPEG, PNG, WebP or other supported photo.');
          return;
        }
        if (file.size > 40 * 1024 * 1024) {
          window.showToast?.('Please choose an image smaller than 40 MB.');
          return;
        }
        choosePhoto(loadOwnImage(file), true);
      });
      moveButton.onclick = () => {
        state.moving = !state.moving;
        stopDragging();
        refresh();
      };
      minusButton.onclick = () => {
        state.zoom = Math.max(1, Math.round((state.zoom - 0.12) * 100) / 100);
        refresh();
      };
      plusButton.onclick = () => {
        state.zoom = Math.min(STORY_MAX_ZOOM, Math.round((state.zoom + 0.12) * 100) / 100);
        refresh();
      };
      download.onclick = () => busy(download, async () => {
        paintStory(canvas, event, venue, logo, state);
        saveBlob(await storyJpeg(canvas), fileName(event.Event_Name) + '-story.jpg');
      });
      close.onclick = () => dialog.close();
      dialog.addEventListener('close', () => {
        ++requestId;
        stopDragging();
        dialog.remove();
      }, { once: true });

      refresh();
      dialog.showModal();
    });
  }
  let pdfLibraryPromise, pdfFontsPromise;
  function loadPdfLibrary() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!pdfLibraryPromise) pdfLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = asset('vendor/jspdf.umd.min.js');
      script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF library unavailable'));
      script.onerror = () => { script.remove(); reject(new Error('PDF library failed to load')); }; document.head.append(script);
    }).catch(error => { pdfLibraryPromise = null; throw error; });
    return pdfLibraryPromise;
  }
  function base64(buffer) {
    const bytes = new Uint8Array(buffer); let result = '';
    for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
  }
  function pdfFonts() {
    if (!pdfFontsPromise) pdfFontsPromise = Promise.all(['Regular', 'SemiBold'].map(async weight => {
      const response = await fetch(asset(`vendor/BarlowCondensed-${weight}.ttf`)); if (!response.ok) throw new Error('PDF font unavailable'); return base64(await response.arrayBuffer());
    })).catch(error => { pdfFontsPromise = null; throw error; });
    return pdfFontsPromise;
  }
  function descriptionText(value) {
    return clean(value).replace(/={5,}|------/g, '\n\n').replace(/={2}/g, '\n')
      .replace(/\*{5}|\+{5}/g, '\n').replace(/\|\||!!/g, '').replace(/\s+--\s+/g, '\n- ').replace(/\n[ \t]+/g, '\n');
  }
  function shortlistItems(entries) {
    const eventRows = typeof getShortlistEventOccurrences === 'function' ? getShortlistEventOccurrences(entries) : [];
    const venueRows = (typeof venues !== 'undefined' ? venues : []).filter(v => entries.some(e => e.type === 'venue' && e.id === v.Venue_ID));
    const venueFor = event => (typeof venues !== 'undefined' ? venues : []).find(v => v.Venue_ID === event.Venue_ID);
    return [
      ...eventRows.map(e => {
        const v = venueFor(e) || {};
        return { title: e.Event_Name, kind: 'EVENT', venue: v.Name || e.Venue_Name || e.Venue, date: dateLabel(e),
          time: [e.Event_Start_Time, e.Event_End_Time].filter(Boolean).join(' - ') || 'Time to be confirmed',
          address: [e.Address || e.Event_Address || v.Address, e.Postcode || v.Postcode, e.City || v.City, e.Country || v.Country].filter(Boolean).join(', '),
          description: e.Event_Description, dress: e.Dresscode_Info, price: e.Price_Info, audience: e.Audience_Info, status: e.Status,
          recurrence: [e.Recurrence_Label || e.Recurrence_Type, e.Recurrence_Day, e.Recurrence_Until].filter(Boolean).join(' / '),
          station: v.Nearest_Station, tags: e.Vibe_Tags, website: firstUrl(e.Event_URL, v.Website_URL, e.Source_URLs),
          tickets: firstUrl(e.Ticket_URL, e.Tickets_URL, e.RSVP_URL), updated: e.Last_Updated };
      }),
      ...venueRows.sort((a,b) => clean(a.Name).localeCompare(clean(b.Name))).map(v => ({ title: v.Name, kind: 'VENUE',
        address: [v.Address, v.Postcode, v.City, v.Country].filter(Boolean).join(', '),
        time: [v.Opening_Days, [v.Opening_Open_Time, v.Opening_Close_Time].filter(Boolean).join(' - '), v.Opening_Notes].filter(Boolean).join(' / '),
        description: v.Description, dress: v.Dresscode_Info, price: v.Price_Info, station: v.Nearest_Station, tags: v.Vibe_Tags,
        website: firstUrl(v.Website_URL), updated: v.Last_Updated }))
    ];
  }
  async function createPdf(name, entries) {
    const [JsPDF, fonts] = await Promise.all([loadPdfLibrary(), pdfFonts()]);
    const pdf = new JsPDF({ unit: 'pt', format: 'a4', compress: true });
    ['normal','bold'].forEach((style,i) => { pdf.addFileToVFS(`Barlow-${style}.ttf`, fonts[i]); pdf.addFont(`Barlow-${style}.ttf`, 'Barlow', style); });
    pdf.setProperties({ title: `Backroom - ${name}`, subject: 'Offline shortlist', creator: 'Backroom' });
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), left = 54, right = W - 54, width = right - left;
    let y = 0, first = true, activeItem = '', remainingHeight = 0;
    let logo;
    try { const img = await loadImage(asset('backdoortitle.png')); const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img,0,0); logo = { data: cv.toDataURL('image/png'), ratio: img.naturalHeight/img.naturalWidth }; } catch (_) {}
    function textFont(size, bold, color) { pdf.setFont('Barlow',bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color || C.white); }
    function cardPanel(extra=0) {
      const height = Math.min(H-65, y+remainingHeight+extra+10) - (y-17);
      pdf.setFillColor(C.panel); pdf.setDrawColor(C.line); pdf.setLineWidth(.7);
      pdf.roundedRect(38,y-17,W-76,Math.max(36,height),8,8,'FD');
      pdf.setFillColor(C.cyan); pdf.roundedRect(38,y-17,3,Math.max(36,height),1,1,'F');
    }
    function page() {
      if (!first) pdf.addPage(); first = false;
      pdf.setFillColor(C.bg); pdf.rect(0,0,W,H,'F'); pdf.setFillColor(C.cyan); pdf.rect(0,0,W,4,'F');
      if (logo) pdf.addImage(logo.data,'PNG',38,28,150,150*logo.ratio); else { textFont(20,true,C.cyan); pdf.text('BACKROOM',38,48); }
      textFont(9,false,C.muted); pdf.text('OFFLINE SHORTLIST',W-38,43,{align:'right'}); y = 108;
      textFont(26,true); const titleLines=pdf.splitTextToSize(clean(name) || 'Shortlist',W-76); pdf.text(titleLines,38,y,{lineHeightFactor:1.12}); y += titleLines.length*29 + 12;
      textFont(10,false,C.muted); pdf.text('All times local / Full details / https://backroom.s.gy/',38,y); y += 25;
      if (activeItem) { textFont(11,true,C.cyan); const continuation = pdf.splitTextToSize(activeItem + ' (continued)',width); cardPanel(continuation.length*15+12); pdf.text(continuation,left,y); y += continuation.length*15+12; }
    }
    page();
    function ensure(height) { if (y + height > H-65) page(); }
    function write(value, { size=12, bold=false, color=C.white, url='', gap=7 } = {}) {
      if (!clean(value)) return;
      textFont(size,bold,color);
      const lines = pdf.splitTextToSize(String(value), width);
      const leading = size*1.28;
      for (const line of lines) {
        ensure(leading+3); textFont(size,bold,color); pdf.text(line,left,y);
        if (url) pdf.link(left,y-size,width,leading,{url});
        y += leading; if (activeItem) remainingHeight -= leading;
      }
      y += gap; if (activeItem) remainingHeight -= gap;
    }
    const items = shortlistItems(entries);
    if (!items.length) write('No available events or venues in this shortlist.');
    for (const item of items) {
      activeItem = ''; ensure(150); y += 8;
      const rows = [];
      const add = (value, options={}) => { if (clean(value)) rows.push([String(value),options]); };
      add(item.kind,{size:9,color:C.cyan,gap:10}); add(item.title,{size:22,bold:true,color:C.white});
      add([item.date,item.time].filter(Boolean).join(' / '),{size:12,bold:true,color:C.cyan});
      add(item.venue,{size:12,bold:true});
      const maps = item.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([item.venue || item.title,item.address].filter(Boolean).join(', ')) : '';
      add(item.address,{color:C.cyan,url:maps,gap:12});
      add(descriptionText(item.description),{gap:12});
      for (const [label,value] of [['Dress code',item.dress],['Price',item.price],['Audience',item.audience],['Status',item.status],['Repeats',item.recurrence],['Nearest station',item.station],['Tags',item.tags]]) {
        if (clean(value)) add(`${label}: ${value}`);
      }
      if (item.website) add('Website / info: ' + item.website,{color:C.cyan,url:item.website});
      if (item.tickets && item.tickets !== item.website) add('Tickets: ' + item.tickets,{color:C.cyan,url:item.tickets});
      if (item.updated) add('Listing updated: '+item.updated,{size:9,color:C.muted});
      remainingHeight = rows.reduce((total,[value,options]) => {
        const size=options.size || 12; textFont(size,options.bold,options.color);
        return total+pdf.splitTextToSize(value,width).length*size*1.28+(options.gap ?? 7);
      },0);
      activeItem=item.title; cardPanel();
      for (const [value,options] of rows) write(value,options);
      activeItem=''; y += 34;
    }
    const pages = pdf.getNumberOfPages(), downloaded = new Date().toLocaleDateString('en-GB');
    for (let p=1;p<=pages;p++) {
      pdf.setPage(p); pdf.setDrawColor(C.line); pdf.line(38,H-49,W-38,H-49); textFont(9,false,C.muted);
      pdf.text(`Downloaded ${downloaded} / Details may change after download.`,38,H-33);
      pdf.text(`${p} / ${pages}`,W-38,H-20,{align:'right'});
    }
    return pdf.output('blob');
  }
  function downloadShortlist(name, entries, button) {
    // Snapshot the received list; exporting never saves or mutates the recipient's profile.
    const snapshot = entries.map(entry => ({...entry}));
    return busy(button, async () => saveBlob(await createPdf(name,snapshot),fileName(name)+'-offline.pdf'));
  }
  window.BackroomDownloads = { showStory, downloadShortlist, storyTags };
})();

