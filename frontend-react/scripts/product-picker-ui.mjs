// Hãng/Model picker regression: isolated Edge, mock API, no business writes.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const label = 'Daikin — Máy lạnh Daikin Inverter 1.5 HP FTKY35';
const request = { _id: 'YC-PICK', status: 'PENDING_INTAKE', categoryCode: 'AC', deviceTypeCode: 'AC_SPLIT',
  brandModel: 'Daikin Máy lạnh Daikin Inverter 1.5 HP FTKY35', serialOrImei: 'DK-0001', symptom: 'Không lạnh', attachments: [],
  customer: { fullName: 'Khách thử', phone: '0900000001', email: null, address: null }, createdAt: '2026-11-01T02:00:00Z' };
try {
  const r = await session('RECEPTIONIST', '/receptionist');
  let received = null;
  const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
  await r.context.route('**/api/v1/catalog/device-categories', route => route.fulfill(json([{ _id: 'AC', name: 'Điện lạnh', sortOrder: 1,
    deviceTypes: [{ code: 'AC_SPLIT', name: 'Máy lạnh', identifierType: 'SERIAL' }] }])));
  await r.context.route('**/api/v1/catalog/products', route => route.fulfill(json([
    { _id: 'P-DAIKIN', name: 'Máy lạnh Daikin Inverter 1.5 HP FTKY35', brandId: 'DAIKIN', categoryCode: 'AC', deviceTypeCode: 'AC_SPLIT' },
    { _id: 'P-LG', name: 'Máy lạnh LG Dual Inverter 1 HP', brandId: 'LG', categoryCode: 'AC', deviceTypeCode: 'AC_SPLIT' }])));
  await r.context.route('**/api/v1/catalog/brands', route => route.fulfill(json([{ _id: 'DAIKIN', name: 'Daikin' }, { _id: 'LG', name: 'LG' }])));
  await r.context.route('**/api/v1/warranty-requests/YC-PICK', route => route.fulfill(json(request)));
  await r.context.route('**/api/v1/customers?*', route => route.fulfill(json({ items: [], total: 0 })));
  await r.context.route('**/api/v1/devices/lookup?*', route => route.fulfill(json({ code: 'DEVICE_NOT_FOUND', detail: 'Không tìm thấy.' }, 404)));
  await r.context.route('**/api/v1/tickets', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    received = JSON.parse(route.request().postData());
    return route.fulfill(json({ code: 'TN-PICK', receivedAt: '2026-11-01T03:00:00Z', customer: request.customer, reportedIssue: 'Không lạnh',
      device: { deviceTypeName: 'Máy lạnh', brandName: 'Daikin', productName: 'FTKY35', identifierType: 'SERIAL', serialOrImei: 'DK-0001' },
      warrantyAtIntake: { status: 'OUT_OF_WARRANTY' }, cosmetic: received.cosmetic, sla: { dueAt: '2026-11-03T03:00:00Z' } }));
  });
  await login(r.page); await r.page.waitForURL(base + '/receptionist');
  await r.page.goto(base + '/receptionist?request=YC-PICK');
  const field = r.page.locator('[data-field="device.newDevice.productId"]');
  const option = field.getByRole('radio', { name: label });
  await option.waitFor();
  await r.page.locator('[data-submit-intake]').click();
  await field.getByText('Vui lòng chọn hãng/model.').waitFor();

  await option.click();
  assert.equal(await option.getAttribute('aria-checked'), 'true');
  assert.equal(await field.getByText('Vui lòng chọn hãng/model.').count(), 0, 'stale error must clear once a model is chosen');
  assert.equal(await field.locator('[aria-invalid="true"]').count(), 0);
  // Gõ lại ô lọc không làm mất lựa chọn đã bấm.
  await r.page.locator('[data-product-search]').fill('Daikinv - Máy lạnh Daikin Inverter 1.5 HP FTKY35');
  assert.equal(await option.getAttribute('aria-checked'), 'true');

  await r.page.locator('#ack').check();
  await r.page.locator('[data-submit-intake]').click();
  await r.page.locator('[data-created-ticket-id]').getByText('TN-PICK').waitFor();
  assert.equal(received.device.newDevice.productId, 'P-DAIKIN');
  assert.deepEqual(r.errors.filter(e => !/^Failed to load resource/.test(e)), []);
  await r.context.close();
  console.log('PASS product picker: choosing a suggested model clears its error and submits the model id');
} finally { await browser.close(); }
