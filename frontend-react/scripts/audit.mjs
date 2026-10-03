// Impeccable audit: reuse smoke's isolated browser and mocked API, no live DB.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';
const require = createRequire(new URL('../../../warranty-system-mysql/e2e/package.json', import.meta.url));
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/', import.meta.url);
const result = [];
try {
  for (const [name, role] of Object.entries({ home: null, login: null, portal: null, dispatch: 'DISPATCHER', receptionist: 'RECEPTIONIST', technician: 'TECHNICIAN', warehouse: 'WAREHOUSE_KEEPER', cashier: 'CASHIER', tickets: 'RECEPTIONIST', reports: 'DISPATCHER', admin: 'ADMIN' })) {
    const path = name === 'home' ? '/' : '/' + name;
    const s = await session(role || 'CUSTOMER', path);
    if (role) { await login(s.page); await s.page.waitForURL(base + path); }
    else await s.page.goto(base + path);
    await s.page.waitForLoadState('networkidle');
    await s.page.addScriptTag({ content: axe });
    const accessibility = await s.page.evaluate(async () => {
      const results = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
      return { violations: results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, helpUrl: v.helpUrl,
        nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })) })), incomplete: results.incomplete.map(v => ({ id: v.id, count: v.nodes.length })) };
    });
    const measurements = [];
    for (const width of [1440, 390]) {
      await s.page.setViewportSize({ width, height: 900 });
      measurements.push(await s.page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        title: document.title, oldBrand: /longmanloc/i.test(document.body.innerText),
        smallTargets: Array.from(document.querySelectorAll('button,a,input,select')).filter(n => !n.hidden && n.getBoundingClientRect().width > 0)
          .map(n => ({ id: n.id, label: n.getAttribute('aria-label') || n.innerText || n.getAttribute('type'), width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height }))
          .filter(n => n.width < 24 || n.height < 24).slice(0, 12) })));
      if (['home', 'login', 'portal', 'warehouse', 'receptionist'].includes(name)) await s.page.screenshot({ path: fileURLToPath(new URL(`audit-${name}-${width}.png`, output)), fullPage: false });
    }
    if (name === 'login') {
      await s.page.keyboard.press('Tab');
      measurements.push(await s.page.evaluate(() => ({ focus: document.activeElement.id, outline: getComputedStyle(document.activeElement).outlineStyle })));
    }
    result.push({ page: name, accessibility, measurements, errors: s.errors });
    console.log(JSON.stringify({ page: name, violations: accessibility.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), sizes: measurements.slice(0, 2), errors: s.errors }));
    await s.context.close();
  }
} finally {
  writeFileSync(new URL('ui-audit.json', output), JSON.stringify(result, null, 2));
  await browser.close();
}
