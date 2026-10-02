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
  console.log('PASS required password change, confirmation validation, multiple roles and logout');
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
  console.log(`PASS: 10 pages, ${assertions} checks, ${mockedWrites} mocked write requests, no live database writes`);
} finally { await browser.close(); } }
