// All APIs are mocked; no live business writes.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ok = (route, json) => route.fulfill({ status: 200, json });
const catalog = {
  categories: [
    { code: 'PHONE', name: 'Điện thoại', deviceTypes: [{ code: 'OLD', identifierType: 'SERIAL' }, { code: 'SMART', identifierType: 'IMEI' }] },
    { code: 'LAPTOP', name: 'Máy tính', deviceTypes: [{ code: 'NOTEBOOK', identifierType: 'SERIAL' }] },
    { code: 'EMPTY', name: 'Danh mục trống', deviceTypes: [] },
  ],
  products: [
    { code: 'SP-PHONE', name: 'Galaxy S24', brandName: 'Samsung', categoryCode: 'PHONE', deviceTypeCode: 'SMART' },
    { code: 'SP-LAPTOP', name: 'Inspiron', brandName: 'Dell', categoryCode: 'LAPTOP', deviceTypeCode: 'NOTEBOOK' },
  ],
  stations: [{ code: 'ST01', name: 'Trạm thử', address: 'Địa chỉ thử' }],
};
try {
  for (const width of [1440, 390]) {
    const s = await session('CUSTOMER', '/account', width);
    s.page.setDefaultTimeout(10000);
    await s.context.route('**/api/v1/portal/catalog', route => ok(route, catalog));
    await s.page.goto(base + '/portal#dang-ky');
    await s.page.locator('#reg-category option[value=PHONE]').waitFor({ state: 'attached' });
    assert.equal(await s.page.locator('#reg-brand-model').isDisabled(), true);
    for (const prefix of ['reg', 'req']) {
      if (prefix === 'req') {
        await login(s.page); await s.page.waitForURL(base + '/account');
        await s.page.goto(base + '/account#yeu-cau-moi');
        await s.page.locator('#req-category option[value=PHONE]').waitFor({ state: 'attached' });
      }
      const model = s.page.locator(`#${prefix}-brand-model`);
      const options = s.page.locator(`#${prefix}-brand-model-options option`);
      assert.equal(await model.evaluate(e => e.tagName), 'INPUT');
      await s.page.selectOption(`#${prefix}-category`, 'PHONE');
      assert.deepEqual(await options.evaluateAll(nodes => nodes.map(n => n.value)), ['Samsung Galaxy S24']);
      await model.fill('Samsung Galaxy S24');
      assert.match(await s.page.locator(`label[for=${prefix}-serial]`).innerText(), /IMEI/);
      await s.page.selectOption(`#${prefix}-category`, 'LAPTOP');
      assert.equal(await model.inputValue(), '');
      assert.deepEqual(await options.evaluateAll(nodes => nodes.map(n => n.value)), ['Dell Inspiron']);
      await s.page.selectOption(`#${prefix}-category`, 'EMPTY');
      assert.equal(await model.isDisabled(), true);
      assert.match(await model.getAttribute('placeholder'), /Chưa có model/);
      await s.page.selectOption(`#${prefix}-category`, 'PHONE');
      await model.fill('Samsung Galaxy S24');
      if (prefix === 'reg') {
        await s.page.fill('#reg-name', 'Người con'); await s.page.fill('#reg-phone', '0912230011');
      }
      await s.page.fill(`#${prefix}-serial`, 'PHONE-SON-1234');
      await s.page.fill(`#${prefix}-symptom`, 'Không lên nguồn');
      await s.page.selectOption(`#${prefix}-station`, 'ST01');
      await s.page.fill(`#${prefix}-time-date`, '2030-10-02');
      await s.page.fill(`#${prefix}-time-time`, '10:15');
      await model.fill('Model không có trong danh mục');
      const before = s.calls.filter(path => path.endsWith('/warranty-requests')).length;
      await s.page.locator(prefix === 'reg' ? '[data-register-submit]' : 'form.form-card-panel button[type=submit]').click();
      await s.page.getByText('Vui lòng chọn hãng/model có sẵn trong danh sách.', { exact: true }).waitFor();
      assert.equal(s.calls.filter(path => path.endsWith('/warranty-requests')).length, before);
      await model.fill('Samsung Galaxy S24');
      const sent = s.page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/warranty-requests'));
      await s.page.locator(prefix === 'reg' ? '[data-register-submit]' : 'form.form-card-panel button[type=submit]').click();
      const body = (await sent).postData();
      assert.match(body, /"brandModel":"Samsung Galaxy S24"/);
      assert.match(body, /"deviceTypeCode":"SMART"/);
      assert.match(body, /"identifierType":"IMEI"/);
      await s.page.getByText(prefix === 'reg' ? 'YC-MOCK' : 'YC-OWN-MOCK', { exact: true }).waitFor();
    }
    assert.deepEqual(s.errors, []);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await s.context.close();

    const r = await session('RECEPTIONIST', '/receptionist', width);
    r.page.setDefaultTimeout(10000);
    let ownerReads = 0;
    await r.context.route('**/api/v1/customers?*', route => ok(route, { items: [{ code: 'KH-SON', fullName: 'Người con', phone: '0912230011', status: 'ACTIVE' }] }));
    await r.context.route('**/api/v1/customers/KH-FATHER', route => {
      ownerReads++; return ok(route, { code: 'KH-FATHER', fullName: 'Người cha', phone: '0900000000' });
    });
    await r.context.route('**/api/v1/devices/lookup?*', route => ok(route, {
      code: 'TB-FAMILY', customerCode: 'KH-FATHER', productId: 'SP-PHONE', product: { name: 'Galaxy S24', brandName: 'Samsung' },
      warranty: { status: 'IN_WARRANTY' }, tickets: [],
    }));
    await r.context.route('**/api/v1/tickets', route => route.request().method() !== 'POST' ? route.fallback() : ok(route, {
      code: 'TN-SON', receivedAt: '2030-10-02T03:00:00Z', sla: { dueAt: '2030-10-04T03:00:00Z' }, customer: { fullName: 'Người con', phone: '0912230011' },
      device: { deviceTypeName: 'Điện thoại', brandName: 'Samsung', productName: 'Galaxy S24', serialOrImei: 'PHONE-SON-1234', identifierType: 'IMEI' },
      warrantyAtIntake: { status: 'IN_WARRANTY' }, cosmetic: { scratches: 'NONE', dents: false, cracks: false, moisture: 'NONE', accessories: 'COMPLETE' }, reportedIssue: 'Không lên nguồn',
    }));
    await login(r.page); await r.page.waitForURL(base + '/receptionist');
    await r.page.fill('#phone', '0912230011'); await r.page.locator('[data-customer-lookup]').click();
    await r.page.getByText('KH-SON', { exact: true }).waitFor();
    await r.page.fill('#identifier', 'PHONE-SON-1234'); await r.page.locator('[data-warranty-check]').click();
    await r.page.locator('[data-warranty-result]').waitFor();
    assert.equal(await r.page.inputValue('#phone'), '0912230011');
    assert.equal(await r.page.inputValue('#customerName'), 'Người con');
    assert.equal(ownerReads, 0);
    await r.page.fill('#symptom', 'Không lên nguồn'); await r.page.check('#ack');
    const received = r.page.waitForRequest(q => q.method() === 'POST' && q.url().endsWith('/tickets'));
    await r.page.locator('[data-submit-intake]').click();
    const command = (await received).postDataJSON();
    assert.deepEqual(command.customer, { code: 'KH-SON' });
    assert.deepEqual(command.device, { code: 'TB-FAMILY' });
    await r.page.locator('[data-created-ticket-id]').filter({ hasText: 'TN-SON' }).waitFor();
    assert.deepEqual(r.errors, []);
    await r.context.close();
    console.log(`PASS model dropdown, category reset, actual subtype, per-visit sender: ${width}px`);
  }
} finally { await browser.close(); }
