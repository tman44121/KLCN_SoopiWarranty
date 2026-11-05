// Staff selection regressions: isolated Edge, mock API, no business writes.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/staff-selection/', import.meta.url);
mkdirSync(output, { recursive: true });
let passed = 0, failed = 0;
async function check(name, action) {
  try { await action(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
const ticket = { code: 'TN-SELECTION', status: 'REPAIRING', customer: { fullName: 'Khách thử', phone: '0900000000' },
  device: { deviceTypeName: 'Điện thoại', productName: 'Thiết bị thử', brandName: 'Soopi', identifierType: 'IMEI', serialOrImei: '356000000000001', categoryCode: 'PHONE', deviceTypeCode: 'PHONE' },
  sla: { dueAt: '2030-11-01T10:00:00Z', status: 'ON_TIME', level: 'STANDARD_48H' },
  cosmetic: { scratches: 'NONE', moisture: 'NONE', accessories: 'COMPLETE' }, warrantyAtIntake: { status: 'IN_WARRANTY' },
  inspection: { classification: 'FREE_WARRANTY', findings: 'Lỗi thử', checklist: [] }, reportedIssue: 'Lỗi thử',
  receivedAt: '2026-11-02T02:00:00Z', activeQuotationCode: null, repairOrder: { results: [] } };
try {
  for (const width of [1440, 768, 360]) {
    const r = await session('RECEPTIONIST', '/receptionist', width, { hasTouch: width < 1024 });
    await login(r.page); await r.page.waitForURL(base + '/receptionist');
    await r.page.waitForLoadState('networkidle');
    await check(`cosmetic selections expose state and reset restores defaults: ${width}px`, async () => {
      for (const group of await r.page.locator('[data-cosmetic]').all()) {
        assert.equal(await group.getAttribute('role'), 'group');
        assert(await group.getAttribute('aria-label'));
        assert.equal(await group.locator('[aria-pressed="true"]').count(), 1);
        const last = group.locator('button').last();
        await last.focus(); await last.press('Space');
        assert.equal(await last.getAttribute('aria-pressed'), 'true');
        assert.equal(await group.locator('[aria-pressed="true"]').count(), 1);
      }
      await r.page.locator('[data-reset-form]').click();
      for (const group of await r.page.locator('[data-cosmetic]').all()) {
        assert.equal(await group.locator('button').first().getAttribute('aria-pressed'), 'true');
        assert.equal(await group.locator('[aria-pressed="true"]').count(), 1);
      }
    });
    await r.page.locator('[data-cosmetic=scratches]').scrollIntoViewIfNeeded();
    await r.page.screenshot({ path: fileURLToPath(new URL(`receptionist-${width}.png`, output)) });
    assert.deepEqual(r.errors, []); await r.context.close();

    const t = await session('TECHNICIAN', '/technician', width, { hasTouch: width < 1024 });
    let current = ticket;
    await t.context.route('**/api/v1/technicians/me/queue', route => route.fulfill({ json: [current] }));
    await t.context.route('**/api/v1/tickets/TN-SELECTION', route => route.fulfill({ json: current }));
    await t.context.route('**/api/v1/catalog/device-categories', route => route.fulfill({ json: [{ _id: 'PHONE', deviceTypes: [{ code: 'PHONE', diagnosticChecklist: ['Bật nguồn', 'Sạc điện'] }] }] }));
    await login(t.page); await t.page.waitForURL(base + '/technician');
    await t.page.goto(base + '/technician?ticket=TN-SELECTION');
    await t.page.locator('[data-qc-work]').fill('Nội dung sửa chữa cần giữ lại');
    await check(`all QC steps preserve keyboard focus, state and draft text: ${width}px`, async () => {
      const codes = await t.page.locator('[data-qc-value=PASS]').evaluateAll(es => es.map(e => e.dataset.qcStep));
      assert.equal(codes.length, 6);
      for (const code of codes) {
        const button = t.page.locator(`[data-qc-step="${code}"][data-qc-value=PASS]`);
        await button.focus(); await button.press('Enter');
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.equal(await button.evaluate(e => e === document.activeElement), true);
        assert.equal(await button.locator('..').getAttribute('role'), 'group');
        assert.equal(await button.locator('..').locator('[aria-pressed="true"]').count(), 1);
      }
      assert.equal(await t.page.locator('[data-qc-work]').inputValue(), 'Nội dung sửa chữa cần giữ lại');
      assert.equal(await t.page.locator('[data-submit-qc]').isEnabled(), true);
      await t.page.keyboard.press('Tab');
      assert.equal(await t.page.evaluate(() => document.activeElement.matches('[data-qc-step]')), true);
    });
    await t.page.locator('.qc-step').first().scrollIntoViewIfNeeded();
    await t.page.screenshot({ path: fileURLToPath(new URL(`qc-${width}.png`, output)) });
    current = { ...ticket, status: 'INSPECTING', inspection: null };
    await t.page.reload();
    await check(`diagnostic checklist and classification retain selection and focus: ${width}px`, async () => {
      const result = t.page.locator('[data-check-index="0"] [data-check-result=FAIL]');
      await result.focus(); await result.press('Enter');
      assert.equal(await result.getAttribute('aria-pressed'), 'true');
      assert.equal(await result.evaluate(e => e === document.activeElement), true);
      const classification = t.page.locator('[data-classification=OUT_OF_WARRANTY]');
      await classification.focus(); await classification.press('Enter');
      assert.equal(await classification.getAttribute('aria-pressed'), 'true');
      assert.equal(await classification.evaluate(e => e === document.activeElement), true);
      assert.equal(await t.page.locator('[data-classification][aria-pressed="true"]').count(), 1);
      assert.equal(await t.page.locator('#insp-reason').isVisible(), true);
    });
    assert.deepEqual(t.errors, []); await t.context.close();
  }
} finally { await browser.close(); }
console.log(`${passed} checks passed; ${failed} failed; all API calls mocked`);
if (failed) process.exitCode = 1;
