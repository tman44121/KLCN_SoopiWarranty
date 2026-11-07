// Isolated browser and mocked APIs: these checks never write to the live database.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const fulfill = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
const monday = '2099-11-02'; // Monday; comfortably beyond the minimum appointment date.
try {
  for (const width of [1440, 320]) {
    const customer = await session('CUSTOMER', '/account', width);
    customer.page.setDefaultTimeout(10000);
    await customer.context.route('**/api/v1/portal/my/tickets', route => fulfill(route, [
      { code: 'TN-PAID-1', receivedAt: '2026-11-01T01:00:00Z', status: 'DELIVERED', currentStep: 6, paidAmount: 250000 },
      { code: 'TN-PAID-2', receivedAt: '2026-11-02T01:00:00Z', status: 'COMPLETED', currentStep: 5, paidAmount: 150000 },
      { code: 'TN-UNPAID', receivedAt: '2026-11-03T01:00:00Z', status: 'AWAITING_CUSTOMER_CONFIRMATION', currentStep: 1, paidAmount: 0 },
    ]));
    await login(customer.page);
    await customer.page.waitForURL('**/account');
    await customer.page.goto(base + '/account#lich-su');
    const spending = customer.page.getByText('Tổng tiền đã chi cho bảo hành & sửa chữa:', { exact: false });
    await spending.waitFor();
    assert.match(await spending.innerText(), /400[.]000/);
    await customer.page.getByRole('button', { name: 'Đang xử lý (0)', exact: true }).click();
    assert.match(await spending.innerText(), /400[.]000/);
    assert.equal(await customer.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await customer.page.goto(base + '/account#yeu-cau-moi');
    const date = customer.page.locator('#req-time-date');
    const time = customer.page.locator('#req-time-time');
    await date.fill(monday);
    await time.pressSequentially('14:37');
    assert.equal(await date.inputValue(), monday);
    assert.equal(await time.inputValue(), '14:37');
    assert.equal(await customer.page.locator('#req-time').inputValue(), monday + 'T14:37');
    await time.fill('09:99');
    assert.equal(await customer.page.locator('#req-time').inputValue(), '');
    await time.fill('17:00');
    assert.equal(await customer.page.locator('#req-time').inputValue(), monday + 'T17:00');
    await time.fill('17:01');
    assert.equal(await customer.page.locator('#req-time').inputValue(), '');
    await time.fill('08:00');
    await date.fill('2099-11-08'); // Sunday.
    assert.match(await customer.page.locator('#req-time-error').innerText(), /Chủ nhật/);
    assert.equal(await customer.page.locator('#req-time').inputValue(), '');
    assert.deepEqual(customer.errors, []);
    console.log(`PASS history spending and editable 24-hour appointments at ${width}px`);
    await customer.context.close();
  }

  const dispatch = await session('DISPATCHER', '/dispatch');
  dispatch.page.setDefaultTimeout(10000);
  let available = false;
  const statuses = [];
  await dispatch.context.route('**/api/v1/quotations?*', route => {
    statuses.push(new URL(route.request().url()).searchParams.get('approvalStatus'));
    return fulfill(route, { items: available ? [{ code: 'BG-NEW', ticketCode: 'TN-NEW', createdAt: '2026-11-07T01:00:00Z', grandTotal: 100000, approval: { status: 'PENDING' } }] : [], totalItems: available ? 1 : 0, totalPages: available ? 1 : 0 });
  });
  await login(dispatch.page);
  await dispatch.page.waitForURL('**/dispatch');
  await dispatch.page.waitForFunction(() => document.querySelector('[data-quotation-approval-list]')?.textContent.includes('Không có báo giá'));
  assert.equal(statuses[0], 'PENDING');
  available = true;
  await dispatch.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await dispatch.page.getByText('BG-NEW', { exact: true }).waitFor();
  assert.equal(await dispatch.page.locator('[data-view-quotation="BG-NEW"]').count(), 1);
  assert.deepEqual(dispatch.errors, []);
  console.log('PASS dispatcher sees newly created pending quotes on returning to the page');
  await dispatch.context.close();

  const portal = await session('CUSTOMER', '/account');
  portal.page.setDefaultTimeout(10000);
  await portal.page.goto(base + '/portal#dang-ky');
  await portal.page.locator('#reg-category').selectOption('PHONE');
  const serial = portal.page.locator('#reg-serial');
  await serial.fill('IMEI-ABC1'); await serial.blur();
  assert.notEqual(await serial.getAttribute('aria-invalid'), 'true');
  await serial.fill('123'); await serial.blur();
  assert.equal(await serial.getAttribute('aria-invalid'), 'true');
  await serial.fill('IMEI@ABC1'); await serial.blur();
  assert.equal(await serial.getAttribute('aria-invalid'), 'true');
  await serial.fill('490154203237519'); await serial.blur();
  assert.notEqual(await serial.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(portal.errors, []);
  console.log('PASS portal accepts flexible IMEI and rejects too-short or special-character identifiers');
  await portal.context.close();
} finally {
  await browser.close();
}
