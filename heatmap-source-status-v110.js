(() => {
  'use strict';

  const marker = ' Data loaded:';

  function appendSourceStatus() {
    const note = document.getElementById('note');
    const summary = window.BRHeat?.state?.sourceSummary;
    if (!note || !summary) return false;

    const base = note.textContent.split(marker)[0].trim();
    const draftText = summary.localDraftCollections
      ? `, including ${summary.localVenueDraft.toLocaleString()} local venue draft records and ${summary.localEventDraft.toLocaleString()} local event draft records`
      : '';

    note.textContent = `${base}${marker} ${summary.venues.toLocaleString()} venues and ${summary.events.toLocaleString()} events from ${summary.publishedFiles} published files${draftText}.`;
    return true;
  }

  const timer = window.setInterval(() => {
    if (appendSourceStatus()) window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 20000);

  document.querySelectorAll('.controls select').forEach(control => {
    control.addEventListener('change', () => window.setTimeout(appendSourceStatus, 0));
  });
})();
