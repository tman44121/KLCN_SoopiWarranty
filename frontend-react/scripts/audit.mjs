// Rendered WCAG checks with isolated Edge and mocked API; never touches the live DB.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/quality/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [];
const routes = { home: null, login: null, register: null, 'forgot-password': null, portal: null,
  account: 'CUSTOMER', dispatch: 'DISPATCHER', receptionist: 'RECEPTIONIST', technician: 'TECHNICIAN',
  warehouse: 'WAREHOUSE_KEEPER', cashier: 'CASHIER', tickets: 'RECEPTIONIST', reports: 'DISPATCHER', admin: 'ADMIN' };
try {
  for (const width of [1440, 768, 360]) for (const [name, role] of Object.entries(routes)) {
    const path = name === 'home' ? '/' : '/' + name;
    const s = await session(role || 'CUSTOMER', path, width, { hasTouch: width < 1024 });
    if (role) { await login(s.page); await s.page.waitForURL(base + path); }
    else await s.page.goto(base + path);
    await s.page.waitForLoadState('networkidle');
    await s.page.evaluate(() => document.fonts.ready);
    // Audit every offscreen section too; deferred rendering must not hide issues from axe.
    if (name === 'home') await s.page.addStyleTag({ content: '.kh-home .kh-main > section { content-visibility: visible !important; }' });
    const variants = [{ state: 'default' }];
    if (width === 360 && name === 'register') variants.push({ state: 'validation', action: () => s.page.locator('button[type="submit"]').click() });
    if (width === 360 && name === 'portal') variants.push({ state: 'new-request', action: () => s.page.locator('[data-open-register]').click() });
    if (width === 360 && name === 'account') variants.push(
      { state: 'chat', action: () => s.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click() },
      { state: 'quotation', action: async () => {
        await s.page.getByRole('button', { name: 'Đóng chat', exact: true }).click();
        await s.page.goto(base + '/account#phieu/TN-2026-1002-00001');
        await s.page.getByRole('button', { name: 'Kiểm tra & Xác nhận giá →', exact: true }).click();
      } },
      { state: 'payment', action: async () => {
        await s.page.keyboard.press('Escape');
        await s.context.route('**/api/v1/portal/tickets/TN-QUALITY-PAYMENT', route => route.fulfill({ json: {
          code: 'TN-QUALITY-PAYMENT', productName: 'Thiết bị thử', brandName: 'Soopi', status: 'COMPLETED',
          steps: [], customerNotes: [], pendingQuotation: null, canRate: false,
          costs: { total: 2916000, inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, paymentStatus: 'UNPAID' }
        } }));
        await s.page.goto(base + '/account#phieu/TN-QUALITY-PAYMENT');
        await s.page.locator('.pay-cta-btn').click();
      } },
      { state: 'card', action: async () => {
        await s.page.getByRole('button', { name: /Thẻ Visa/ }).click();
        await s.page.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
      } },
      { state: 'card-validation', action: async () => {
        await s.page.getByPlaceholder('4111 1111 1111 1111', { exact: true }).fill('123');
        await s.page.locator('.payment-modal-footer .btn-submit').click();
      } });
    for (const variant of variants) {
      if (variant.action) await variant.action();
      await s.page.waitForLoadState('networkidle');
      await s.page.evaluate(() => Promise.all(document.getAnimations()
        .filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished)));
      await s.page.addScriptTag({ content: axe });
      const accessibility = await s.page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        const compact = v => ({ id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) });
        return { violations: r.violations.map(compact), incomplete: r.incomplete.map(compact) };
      });
      const layout = await s.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
        unresolvedReferences: [...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')].flatMap(e =>
          ['aria-labelledby', 'aria-describedby', 'aria-controls'].flatMap(attribute =>
            (e.getAttribute(attribute) || '').split(/\s+/).filter(id => id && !document.getElementById(id))
              .map(id => ({ element: e.id || e.tagName, attribute, id })))) }));
      results.push({ path, width, state: variant.state, ...accessibility, ...layout, errors: s.errors });
      console.log(JSON.stringify({ path, width, state: variant.state, issues: accessibility.violations.map(v => ({ id: v.id, count: v.nodes.length })), ...layout, errors: s.errors }));
      if (['home', 'login', 'receptionist', 'account'].includes(name)) {
        await s.page.screenshot({ path: fileURLToPath(new URL(name + '-' + width + '-' + variant.state + '.png', output)), fullPage: true });
      }
    }
    await s.context.close();
  }
} finally {
  writeFileSync(new URL('audit.json', output), JSON.stringify({ axeVersion: require('axe-core/package.json').version, results }, null, 2));
  await browser.close();
}
assert.equal(results.filter(r => r.state === 'default').length, Object.keys(routes).length * 3, 'Audit did not cover every route and viewport');
assert.equal(results.length, 49, 'Audit did not cover every interactive state');
const failed = results.filter(r => r.violations.length || r.overflow > 0 || r.errors.length || r.unresolvedReferences.length);
assert.deepEqual(failed.map(r => ({ path: r.path, width: r.width, state: r.state, rules: r.violations.map(v => v.id), overflow: r.overflow, errors: r.errors, unresolvedReferences: r.unresolvedReferences })), []);
console.log(results.length + ' rendered accessibility/layout checks passed');
