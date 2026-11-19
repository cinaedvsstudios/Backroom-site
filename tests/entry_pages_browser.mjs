import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 8765;
const BASE = 'http://127.0.0.1:' + PORT + '/';
const ENTRIES = [
  ['venues-app.html', '#venues', '#main-content.br-venues-sticky'],
  ['events-app.html', '#calendar', '#calendar-container:not(.hidden)'],
  ['festivals-app.html', '#festivals', '#calendar-container:not(.hidden)'],
  ['cruising-app.html', '#cruising-guide', '#cruising-guide-container:not(.hidden)'],
  ['travel-app.html', '#travel', '[data-backroom-embedded-page="travel"]'],
  ['heatmap-app.html', '#heatmap', '[data-backroom-embedded-page="heatmap"]'],
  ['terminology-app.html', '#dress-codes', '#dress-codes-container:not(.hidden)'],
];
const LOCATION = JSON.stringify({ scope: 'city', city: 'Berlin', country: 'Germany', postcode: '' });

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const result = await fetch(BASE + 'index.html');
      if (result.ok) return;
    } catch (_) {}
    await pause(250);
  }
  throw new Error('Local Backroom server did not start');
}

async function verifySection(page, hash, marker) {
  await page.waitForFunction(({ hash, marker }) => {
    const shell = document.getElementById('app-shell');
    const section = document.querySelector(marker);
    return window.location.hash === hash &&
      shell && !shell.classList.contains('hidden') &&
      !shell.hasAttribute('inert') &&
      section && !document.querySelector('#error-panel:not(.hidden)');
  }, { hash, marker }, { timeout: 60000 });
}

async function runVariant(browser, name, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const reportedErrors = [];

  page.on('pageerror', error => reportedErrors.push(error.message));
  await page.addInitScript(value => {
    if (window !== window.top) return;
    localStorage.setItem('br_age_verified', 'true');
    if (!localStorage.getItem('br_location')) localStorage.setItem('br_location', value);
    localStorage.setItem('__backroom_test_sentinel', 'keep');
  }, LOCATION);

  for (const [file, hash, marker] of ENTRIES) {
    const response = await page.goto(BASE + file, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response?.status(), 200, 'HTTP status for ' + file);
    await verifySection(page, hash, marker);

    assert.equal((await page.title()).includes('Backroom'), true);
    assert.equal(await page.locator('#search-input').count(), 1);
    assert.equal(await page.locator('#profile-modal').count(), 1);
    assert.equal(await page.locator('#age-gate').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('br_location')), LOCATION);
    assert.equal(await page.evaluate(() => localStorage.getItem('__backroom_test_sentinel')), 'keep');

    // Normal SPA navigation must not reload the entry page or force its section again.
    await page.locator('#btn-sidebar-search-results').evaluate(link => link.click());
    await page.waitForFunction(() => location.hash === '#results', null, { timeout: 15000 });
    assert.equal(new URL(page.url()).pathname, '/' + file);

    // Hash history returns to the original section, including embedded screens.
    await page.goBack({ timeout: 20000 });
    await verifySection(page, hash, marker);
    await page.goForward({ timeout: 20000 });
    await page.waitForFunction(() => location.hash === '#results', null, { timeout: 20000 });

    // Switching to Home must not be intercepted by entry-route startup code.
    await page.locator('#sidebar .sidebar-item[title="Home"]').evaluate(link => link.click());
    await page.waitForFunction(() => location.hash === '', null, { timeout: 15000 });

    console.log('PASS ' + name + ': ' + file + ' -> ' + hash + ', navigation and Back/Forward');
  }

  if (reportedErrors.length) {
    console.log(name + ' diagnostics (non-blocking page errors):', [...new Set(reportedErrors)].slice(0, 5));
  }
  await context.close();
}

async function runAgeGate(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE + 'venues-app.html', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#age-gate').isVisible(), true, 'Fresh visitors see age verification');
  await page.locator('#btn-enter').click();
  await page.waitForFunction(() => localStorage.getItem('br_age_verified') === 'true');
  await page.goto(BASE + 'events-app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#age-gate')?.classList.contains('hidden'), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('br_age_verified')), 'true');
  console.log('PASS age gate: fresh confirmation is retained across entry pages');
  await context.close();
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '.'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runAgeGate(browser);
  await runVariant(browser, 'desktop', { viewport: { width: 1280, height: 800 } });
  await runVariant(browser, 'mobile', {
    viewport: { width: 393, height: 852 },
    screen: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.75,
  });
  console.log('PASS all seven Backroom entry pages at desktop and mobile viewports');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
