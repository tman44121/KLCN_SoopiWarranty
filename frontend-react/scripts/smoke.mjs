// Reuse the original project's installed browser runner; all API calls are mocked.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../warranty-system-mysql/e2e/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/', import.meta.url);
mkdirSync(output, { recursive: true });
const permissions = [...new Set(readdirSync(new URL('../src/pages/', import.meta.url)).flatMap(file =>
  [...readFileSync(new URL(`../src/pages/${file}`, import.meta.url), 'utf8').matchAll(/data-perm="([^"]+)"/g)].flatMap(m => m[1].split(','))))];
const catalog = { categories: [{ code: 'PHONE', name: 'Điện thoại', deviceTypes: [{ code: 'PHONE', identifierType: 'IMEI' }] }], stations: [{ code: 'ST01', name: 'Trạm thử', address: 'Địa chỉ thử' }] };
const steps = (current) => ['RECEIVED', 'DIAGNOSIS', 'AWAITING_PARTS', 'REPAIRING', 'QC', 'READY'].map((key, i) =>
  ({ key, label: ['Tiếp nhận', 'Chẩn đoán', 'Chờ linh kiện', 'Đang sửa', 'QC', 'Sẵn sàng nhận máy'][i], state: i < current ? 'DONE' : i === current ? 'CURRENT' : 'UPCOMING' }));
const customer = {
  profile: { customerCode: 'KH0001', fullName: 'Nguyễn Văn Khách', phone: '0900000000', email: null, address: null, username: '0900000000' },
  tickets: [
    { code: 'TN-2026-1002-00001', productName: 'Galaxy S24', serialOrImei: '356000000000001', receivedAt: '2026-10-01T02:00:00Z', status: 'AWAITING_CUSTOMER_CONFIRMATION', stopped: false, currentStep: 1 },
    { code: 'TN-2026-0920-00007', productName: 'MacBook Air M2', serialOrImei: 'C02G789X01', receivedAt: '2026-09-20T03:00:00Z', status: 'DELIVERED', stopped: false, currentStep: 6 },
  ],
  requests: [{ code: 'YC-2026-0001', status: 'PENDING_INTAKE', createdAt: '2026-10-01T01:00:00Z', brandModel: 'Samsung Inverter RT35K5982', serialOrImei: 'RT35-001', ticketCode: null }],
  devices: [{ code: 'TB0001', productName: 'Galaxy S24', brandName: 'Samsung', identifierType: 'IMEI', serialOrImei: '356000000000001', warrantyActivatedOn: '2025-10-01', warrantyExpiresOn: '2027-10-01', warrantyStatus: 'IN_WARRANTY' }],
};
const ticketView = (quoted) => ({ code: 'TN-2026-1002-00001', productName: 'Galaxy S24', brandName: 'Samsung', serialOrImei: '356000000000001',
  receivedAt: '2026-10-01T02:00:00Z', promisedReturnAt: '2026-10-04T10:00:00Z', status: quoted ? 'AWAITING_CUSTOMER_CONFIRMATION' : 'REPAIRING', stopped: false,
  steps: steps(quoted ? 1 : 3), customerNotes: [{ at: '2026-10-01T05:00:00Z', text: 'Máy cần thay màn hình.' }], handedOverAt: null,
  costs: { inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, total: 2916000, paymentStatus: 'UNPAID' },
  pendingQuotation: quoted ? { code: 'BG-1', validUntil: '2026-10-09', vatRate: 0.08, partsTotal: 2500000, laborTotal: 200000, grandTotal: 2916000,
    lines: [{ lineNo: 1, description: 'Màn hình AMOLED', quantity: 1, lineTotal: 2500000 }, { lineNo: 2, description: 'Công thay', quantity: 1, lineTotal: 200000 }] } : null });
export const browser = await chromium.launch({ channel: 'msedge', headless: true });
let assertions = 0;
let mockedWrites = 0;
export async function session(role, landing, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const errors = [];
  let expectedResource404 = 0;
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)' && expectedResource404 > 0) { expectedResource404--; return; }
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  const user = { username: 'mock-user', displayName: 'Tài khoản kiểm tra', employeeId: 'NVTEST', stationCode: 'ST01', landing,
    mustChangePassword: false, roles: [{ code: role, label: role, landing }], permissions };
  const calls = [];
  page.on('request', request => {
    const url = new URL(request.url());
    assert(!url.searchParams.has('password'), 'Login credentials escaped through native form GET');
  });
  // Regression: slow controller imports must not leave a rendered form without handlers.
  await context.route('**/src/behaviors/login.js*', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.continue();
  });
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    calls.push(path);
    if (request.method() !== 'GET') mockedWrites++;
    let data = [];
    if (path === '/auth/login' || path === '/auth/refresh') data = { accessToken: 'mock-access', user };
    else if (path === '/auth/me') data = user;
    else if (path === '/auth/change-password') { user.mustChangePassword = false; data = {}; }
    else if (path === '/portal/catalog') data = catalog;
    else if (path === '/notifications') data = { unreadCount: 0, items: [] };
    else if (path === '/tickets' || path === '/quotations' || path === '/audit-logs') data = { items: [], total: 0, page: 0, size: 25 };
    else if (path === '/catalog/stations') data = [{ _id: 'ST01', name: 'Trạm thử' }];
    else if (path === '/portal/warranty-requests' && request.method() === 'POST') data = { code: 'YC-MOCK' };
    else if (path.startsWith('/portal/my/') && request.method() === 'GET') data = customer[path.split('/')[3].replace('warranty-requests', 'requests')];
    else if (path === '/portal/my/profile') data = { ...customer.profile, ...JSON.parse(request.postData()) };
    else if (path === '/portal/my/warranty-requests') data = { code: 'YC-OWN-MOCK' };
    else if (path === '/portal/tickets/TN-2026-1002-00001') data = ticketView(true);
    else if (path.endsWith('/quotation-decision')) data = ticketView(false);
    else if (path === '/auth/mobile/otp') data = { expiresIn: 300, resendAfter: 60 };
    else if (path === '/auth/mobile/register') data = { accessToken: 'mock-mobile', refreshToken: 'mock-mobile-rt', user };
    else if (path === '/auth/mobile/logout') return route.fulfill({ status: 204 });
    else if (path === '/portal/lookup') {
      expectedResource404++;
      return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ code: 'NOT_FOUND', detail: 'Không tìm thấy mã tra cứu thử.' }) });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { context, page, errors, calls, user };
}
export async function login(page) {
  await page.goto(base + '/login');
  await page.fill('#login-username', 'mock-user');
  await page.fill('#login-password', 'Mock-password-only1');
  await page.click('[data-login-form] button[type="submit"]');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { try {
  for (const [route, role] of Object.entries({ dispatch: 'DISPATCHER', receptionist: 'RECEPTIONIST', technician: 'TECHNICIAN', warehouse: 'WAREHOUSE_KEEPER', cashier: 'CASHIER', tickets: 'RECEPTIONIST', reports: 'DISPATCHER', admin: 'ADMIN' })) {
    const s = await session(role, '/' + route);
    await login(s.page);
    await s.page.waitForURL(base + '/' + route);
    await s.page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
    await s.page.waitForLoadState('networkidle');
    assert.equal(await s.page.locator('.header-user__name').textContent(), 'Tài khoản kiểm tra'); assertions++;
    assert.equal(await s.page.getByText('Không thể tải trang. Vui lòng tải lại.', { exact: true }).count(), 0); assertions++;
    assert.deepEqual(s.errors, [], `${route}: browser errors`); assertions++;
    assert(s.calls.includes('/auth/me'), `${route}: auth not initialized`); assertions++;
    await s.page.screenshot({ path: fileURLToPath(new URL(`staff-${route}.png`, output)) });
    if (route === 'warehouse') {
      await s.page.goto(base + '/pages/warehouse.html?station=ST01#stockout');
      await s.page.waitForURL(base + '/warehouse?station=ST01#stockout');
      await s.page.locator('[data-page-panel="stockout"]').waitFor({ state: 'visible' });
      assert.equal(await s.page.locator('[data-page-panel="stockout"]').isVisible(), true); assertions++;
      await s.page.screenshot({ path: fileURLToPath(new URL('warehouse.png', output)), fullPage: false });
      await s.page.goto(base + '/admin');
      await s.page.waitForURL(base + '/warehouse'); assertions++;
    }
    console.log(`PASS /${route}: login, role, API binding, browser console`);
    await s.context.close();
  }
  const staff = await session('DISPATCHER', '/dispatch');
  staff.user.mustChangePassword = true;
  staff.user.roles.push({ code: 'WAREHOUSE_KEEPER', label: 'Kho kiểm tra', landing: '/warehouse' });
  await login(staff.page);
  await staff.page.locator('[data-change-password-form]').waitFor({ state: 'visible' }); assertions++;
  await staff.page.fill('#current-password', 'Mock-old1');
  await staff.page.fill('#new-password', 'Mock-new-password1');
  await staff.page.fill('#confirm-password', 'Not-matching1');
  await staff.page.click('[data-change-password-form] button[type="submit"]');
  await staff.page.getByText('Mật khẩu nhập lại không khớp.', { exact: true }).waitFor(); assertions++;
  assert(!staff.calls.includes('/auth/change-password')); assertions++;
  await staff.page.fill('#confirm-password', 'Mock-new-password1');
  await staff.page.click('[data-change-password-form] button[type="submit"]');
  await staff.page.locator('.role-choice', { hasText: 'Kho kiểm tra' }).click();
  await staff.page.waitForURL(base + '/warehouse'); assertions++;
  await staff.page.locator('[data-logout-btn]').click();
  await staff.page.waitForURL(base + '/login'); assertions++;
  assert(staff.calls.includes('/auth/refresh') && staff.calls.includes('/auth/logout')); assertions++;
  assert.deepEqual(staff.errors, []); assertions++;
  await staff.context.close();
  const admin = await session('ADMIN', '/admin');
  await login(admin.page);
  await admin.page.waitForURL(base + '/admin');
  await admin.page.goto(base + '/portal');
  await admin.page.locator('.nav-menu').getByRole('link', { name: 'Lịch sử bảo hành' }).click();
  await admin.page.waitForURL(base + '/login?next=' + encodeURIComponent('/account#lich-su'));
  await admin.page.getByText(/tài khoản nhân viên Tài khoản kiểm tra/).waitFor(); assertions++;
  await admin.page.goto(base + '/account#ho-so');
  await admin.page.waitForURL(/\/login\?next=/);
  await admin.page.getByText(/chỉ dành cho tài khoản khách hàng/).waitFor(); assertions++;
  assert.deepEqual(admin.errors, [], 'staff on customer area: browser errors'); assertions++;
  await admin.context.close();
  console.log('PASS required password change, confirmation validation, multiple roles and logout');
  for (const width of [1440, 390]) {
    const h = await session('CUSTOMER', '/account', width);
    await h.page.goto(base + '/');
    await h.page.getByRole('heading', { name: 'Tra cứu & quản lý bảo hành sản phẩm' }).waitFor(); assertions++;
    await h.page.getByRole('heading', { name: 'Trạm thử' }).waitFor(); assertions++;
    await h.page.locator('.sla-pill-badge', { hasText: 'Ví dụ minh họa' }).waitFor(); assertions++;
    assert.equal(await h.page.locator('.nav-link.active').getAttribute('href'), '/'); assertions++;
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `home ${width}: horizontal scroll`); assertions++;
    assert.deepEqual(h.errors, [], 'home: browser errors'); assertions++;
    await h.page.screenshot({ path: fileURLToPath(new URL(`home-${width}.png`, output)), fullPage: true });
    await h.context.close();
  }
  const s = await session('CUSTOMER', '/portal', 390);
  await s.page.goto(base + '/login');
  await s.page.waitForLoadState('networkidle');
  await s.page.screenshot({ path: fileURLToPath(new URL('login-mobile.png', output)) });
  await s.page.goto(base + '/portal');
  await s.page.waitForSelector('#reg-category option[value="PHONE"]', { state: 'attached' });
  await s.page.click('[data-lookup-submit]');
  assert(await s.page.locator('[data-field="lookupId"]').evaluate(node => node.classList.contains('has-error'))); assertions++;
  await s.page.fill('#lookupId', 'TN-MOCK');
  await s.page.fill('#lookupPhone', '0900000000');
  await s.page.click('[data-lookup-submit]');
  await s.page.getByText('Không tìm thấy mã tra cứu thử.', { exact: true }).waitFor(); assertions++;
  await s.page.click('[data-open-register]');
  await s.page.click('[data-register-submit]');
  assert(await s.page.locator('[data-field="regName"]').evaluate(node => node.classList.contains('has-error'))); assertions++;
  for (const [selector, value] of Object.entries({ '#reg-name': 'Khách thử', '#reg-phone': '0900000000', '#reg-brand-model': 'Hãng thử', '#reg-serial': 'IMEI-TEST', '#reg-symptom': 'Lỗi thử', '#reg-time': '2026-10-02T10:00' })) await s.page.fill(selector, value);
  await s.page.selectOption('#reg-category', 'PHONE');
  await s.page.selectOption('#reg-station', 'ST01');
  await s.page.fill('#reg-time', 'invalid-time');
  await s.page.click('[data-register-submit]');
  await s.page.getByText('Thời gian không hợp lệ. Vui lòng kiểm tra lại.', { exact: true }).waitFor(); assertions++;
  assert(!s.calls.includes('/portal/warranty-requests')); assertions++;
  await s.page.fill('#reg-time', '2026-10-02T10:00');
  await s.page.click('[data-register-submit]');
  await s.page.getByText('YC-MOCK', { exact: true }).waitFor(); assertions++;
  assert.deepEqual(s.errors, [], 'portal: browser errors'); assertions++;
  assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assertions++;
  await s.page.screenshot({ path: fileURLToPath(new URL('portal-mobile.png', output)), fullPage: true });
  await s.context.close();
  for (const width of [1440, 390]) {
    const c = await session('CUSTOMER', '/account', width);
    await c.page.goto(base + '/portal');
    const nav = c.page.locator('.nav-menu');
    await nav.getByRole('link', { name: 'Gửi yêu cầu bảo hành' }).click();
    await c.page.locator('[data-register-section]').waitFor({ state: 'visible' }); assertions++;
    await nav.getByRole('link', { name: 'Lịch sử bảo hành' }).click();
    await c.page.waitForURL(base + '/login?next=' + encodeURIComponent('/account#lich-su')); assertions++;
    await c.page.goto(base + '/register');
    await c.page.click('button[type="submit"]');
    await c.page.getByText('Vui lòng nhập họ và tên.', { exact: true }).waitFor(); assertions++;
    assert(!c.calls.includes('/auth/mobile/register')); assertions++;
    if (width === 1440) await c.page.screenshot({ path: fileURLToPath(new URL('register-desktop.png', output)) });
    await c.page.fill('#fullName', 'Nguyễn Văn Khách');
    await c.page.fill('#phone', '0900000000');
    await c.page.click('.btn-otp');
    await c.page.getByText(/Gửi lại sau \d+s/).waitFor(); assertions++;
    await c.page.fill('#otp', '123456');
    await c.page.fill('#password', 'Khach-mat-khau-1');
    await c.page.fill('#confirm', 'Khach-mat-khau-1');
    await c.page.click('button[type="submit"]');
    await c.page.waitForURL(base + '/account');
    for (const path of ['/auth/mobile/register', '/auth/mobile/logout', '/auth/login']) assert(c.calls.includes(path), path);
    assertions++;
    await c.page.getByRole('heading', { name: 'Xin chào, Nguyễn Văn Khách' }).waitFor(); assertions++;
    await c.page.goto(base + '/portal');
    await c.page.locator('.user-profile-trigger').waitFor(); assertions++;
    assert.equal(await c.page.locator('.nav-menu a').first().getAttribute('href'), '/account'); assertions++;
    await c.page.goto(base + '/');
    await c.page.locator('.sla-pill-badge', { hasText: 'Phiếu của bạn' }).waitFor(); assertions++;
    assert.equal(await c.page.locator('.hero-dashboard-card .ticket-item-row').count(), customer.tickets.length); assertions++;
    await c.page.goto(base + '/account');
    await c.page.getByRole('heading', { name: 'Xin chào, Nguyễn Văn Khách' }).waitFor();
    await c.page.screenshot({ path: fileURLToPath(new URL(`account-${width}.png`, output)), fullPage: true });
    assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overview ${width}: horizontal scroll`); assertions++;
    await c.page.goto(base + '/account#lich-su');
    await c.page.getByRole('button', { name: /^Hoàn thành/ }).click();
    assert.equal(await c.page.locator('.ticket-card-box').count(), 1); assertions++;
    await c.page.screenshot({ path: fileURLToPath(new URL(`history-${width}.png`, output)), fullPage: true });
    await c.page.goto(base + '/account#phieu/TN-2026-1002-00001');
    await c.page.getByRole('button', { name: 'Đồng ý báo giá' }).click();
    await c.page.getByText('Đã xác nhận báo giá.').waitFor(); assertions++;
    await c.page.screenshot({ path: fileURLToPath(new URL(`ticket-${width}.png`, output)), fullPage: true });
    await c.page.goto(base + '/account#yeu-cau-moi/356000000000001');
    await c.page.waitForSelector('#req-category option[value="PHONE"]', { state: 'attached' });
    assert.equal(await c.page.inputValue('#req-brand-model'), 'Samsung Galaxy S24'); assertions++;
    await c.page.selectOption('#req-category', 'PHONE');
    await c.page.selectOption('#req-station', 'ST01');
    await c.page.fill('#req-symptom', 'Màn hình sọc');
    await c.page.fill('#req-time', '2030-10-02T10:00');
    await c.page.click('form.form-card-panel button[type="submit"]');
    await c.page.getByText('YC-OWN-MOCK', { exact: true }).waitFor(); assertions++;
    await c.page.screenshot({ path: fileURLToPath(new URL(`request-${width}.png`, output)), fullPage: true });
    await c.page.goto(base + '/account#ho-so');
    await c.page.fill('#pf-email', 'khach@example.com');
    await c.page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await c.page.getByText('Đã cập nhật thông tin liên hệ.').waitFor(); assertions++;
    await c.page.screenshot({ path: fileURLToPath(new URL(`profile-${width}.png`, output)), fullPage: true });
    await c.page.goto(base + '/account#doi-mat-khau');
    await c.page.fill('#pw-current', 'Khach-mat-khau-1');
    await c.page.fill('#pw-new', 'Khach-mat-khau-2');
    await c.page.fill('#pw-confirm', 'khac');
    await c.page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await c.page.getByText('Mật khẩu xác nhận không khớp.').waitFor(); assertions++;
    assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `account ${width}: horizontal scroll`); assertions++;
    if (width === 1440) {
      await c.page.goto(base + '/portal');
      await c.page.waitForLoadState('networkidle');
      await c.page.screenshot({ path: fileURLToPath(new URL('portal-desktop.png', output)), fullPage: true });
      await c.page.evaluate(() => sessionStorage.clear());
      await c.page.goto(base + '/login');
      await c.page.waitForLoadState('networkidle');
      await c.page.screenshot({ path: fileURLToPath(new URL('login-desktop.png', output)) });
    }
    assert.deepEqual(c.errors, [], `customer ${width}: browser errors`); assertions++;
    await c.context.close();
  }
  console.log('PASS customer register, account, history, quotation, request, profile and password');
  console.log(`PASS: 12 pages, ${assertions} checks, ${mockedWrites} mocked write requests, no live database writes`);
} finally { await browser.close(); } }
