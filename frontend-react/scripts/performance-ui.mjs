// Lab measurements, not field Core Web Vitals: cold cache, 4x CPU, 1.6Mbps/150ms network.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browser, session, login } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/quality/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [];
try {
  for (const width of [1440, 390]) for (const path of ['/', '/login', '/portal', '/account']) {
    const s = await session('CUSTOMER', '/account', width, { hasTouch: width < 1024 });
    await s.page.addInitScript(() => {
      window.__quality = { lcp: 0, cls: 0, worstEvent: 0, longTasks: [] };
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__quality.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__quality.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__quality.worstEvent = Math.max(window.__quality.worstEvent, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__quality.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true });
    });
    if (path === '/account') { await login(s.page); await s.page.waitForURL(base + path); }
    const cdp = await s.context.newCDPSession(s.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await s.page.goto(base + path);
    await s.page.waitForLoadState('networkidle');
    await s.page.evaluate(() => document.fonts.ready);
    await s.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const load = await s.page.evaluate(() => ({ ...window.__quality,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      bytes: performance.getEntriesByType('resource').reduce((n, e) => n + e.transferSize, 0) }));
    if (path === '/') await s.page.locator('.faq-question-btn').first().click();
    else if (path === '/login') { await s.page.locator('#login-username').pressSequentially('a'); await s.page.getByRole('button', { name: 'Hiện mật khẩu' }).click(); }
    else if (path === '/portal') await s.page.locator('[data-open-register]').click();
    else await s.page.locator('.dispatch-section-header > .dispatch-link').first().click();
    await s.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    const interaction = await s.page.evaluate(() => window.__quality.worstEvent);
    results.push({ path, width, ...load, interactionMs: interaction, errors: s.errors });
    console.log(JSON.stringify(results.at(-1)));
    await s.context.close();
  }
} finally {
  writeFileSync(new URL('performance.json', output), JSON.stringify({ profile: 'Cold cache; CPU 4x; network 1.6Mbps, 150ms RTT; API mocked', results }, null, 2));
  await browser.close();
}
assert.equal(results.length, 8);
for (const r of results) {
  assert(r.lcp > 0 && r.lcp <= 2500, `${r.path} ${r.width}: LCP ${r.lcp}`);
  assert(r.cls <= 0.1, `${r.path} ${r.width}: CLS ${r.cls}`);
  assert(r.interactionMs <= 200, `${r.path} ${r.width}: lab interaction ${r.interactionMs}ms`);
  assert.deepEqual(r.errors, []);
}
