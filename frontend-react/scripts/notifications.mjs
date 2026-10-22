// API giả lập; dùng cùng runner/phiên đăng nhập của smoke.mjs, không ghi DB thật.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, login, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';

try {
  const customer = await session('CUSTOMER', '/account', 375);
  const items = ['Thông báo bảo trì', 'Thông báo dịch vụ'].map((message, i) =>
    ({ id: String(i + 1), message, read: false, link: null, createdAt: '2026-10-22T03:00:00Z' }));
  let polls = 0;
  await customer.context.route('**/api/v1/notifications**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET') {
      polls++;
      return route.fulfill({ json: { items, unreadCount: items.filter(n => !n.read).length } });
    }
    items.forEach(n => { if (path.endsWith('/read-all') || path.endsWith(`/${n.id}/read`)) n.read = true; });
    return route.fulfill({ status: 204 });
  });
  await customer.page.clock.install();
  await login(customer.page);
  await customer.page.waitForURL(base + '/account');
  await customer.page.getByRole('button', { name: 'Thông báo (2 chưa đọc)', exact: true }).click();
  await customer.page.getByRole('button', { name: 'Chưa đọc: Thông báo bảo trì', exact: true }).click();
  await customer.page.getByRole('button', { name: 'Đã đọc: Thông báo bảo trì', exact: true }).waitFor();
  assert.equal(await customer.page.locator('.notif-badge').textContent(), '1');
  await customer.page.getByRole('button', { name: 'Đã đọc: Thông báo bảo trì', exact: true }).click();
  assert.equal(await customer.page.locator('.notif-badge').textContent(), '1');
  await customer.page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  await customer.page.waitForFunction(() => !document.querySelector('.notif-badge'));
  assert(items.every(n => n.read));
  const before = polls;
  const refreshed = customer.page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/notifications');
  await customer.page.clock.fastForward(60_001);
  await refreshed;
  assert(polls > before);
  await customer.page.screenshot({ path: fileURLToPath(new URL('../test-results/notification-mobile.png', import.meta.url)), animations: 'disabled' });
  const bounds = await customer.page.locator('.notif-dropdown').boundingBox();
  const header = await customer.page.locator('.navbar-header').boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 375 && bounds.y >= header.y + header.height);
  await customer.page.keyboard.press('Escape');
  assert.equal(await customer.page.locator('.notif-dropdown').count(), 0);
  assert(await customer.page.locator('.notif-bell-btn').evaluate(el => el === document.activeElement));
  assert.deepEqual(customer.errors, []);
  await customer.context.close();

  for (const role of ['ADMIN', 'RECEPTIONIST']) {
    const s = await session(role, '/' + role.toLowerCase());
    const bodies = [];
    await s.context.route('**/api/v1/admin/notifications/broadcast', route => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    });
    await s.context.route('**/api/v1/customers?**', route => route.fulfill({ json: { items: [
      { code: 'KH-01', fullName: 'Nguyễn An', phone: '0900000001', hasAccount: true },
      { code: 'KH-02', fullName: 'Chưa có tài khoản', phone: '0900000002', hasAccount: false },
    ] } }));
    await login(s.page);
    await s.page.waitForURL(base + '/' + role.toLowerCase());
    if (role === 'ADMIN') await s.page.locator('[data-page-tab="notifications-broadcast"]').click();
    else await s.page.locator('.broadcast-section > summary').click();
    const form = s.page.getByRole('region', { name: 'Gửi thông báo khách hàng' });
    await form.getByLabel('Nội dung thông báo').fill('Thông báo chung');
    await form.getByRole('button', { name: 'Gửi thông báo', exact: true }).click();
    await form.getByRole('status').filter({ hasText: 'Đã gửi đến tất cả' }).waitFor();
    assert.equal(bodies[0].customerIds, null);
    await form.getByLabel('Chọn khách cụ thể').check();
    await form.getByLabel('Nội dung thông báo').fill('Thông báo riêng');
    await form.getByRole('button', { name: 'Gửi thông báo', exact: true }).click();
    await form.getByRole('alert').filter({ hasText: 'Vui lòng chọn' }).waitFor();
    assert.equal(bodies.length, 1);
    await form.getByLabel('Tìm theo tên').fill('An');
    await form.getByRole('button', { name: 'Nguyễn An · 0900000001 · KH-01', exact: true }).waitFor();
    assert.equal(await form.getByRole('button', { name: /Chưa có tài khoản/ }).count(), 0);
    await form.getByRole('button', { name: 'Nguyễn An · 0900000001 · KH-01', exact: true }).click();
    await form.getByLabel('Đường dẫn').fill('/account#lich-su');
    await form.getByRole('button', { name: 'Gửi thông báo', exact: true }).click();
    await form.getByRole('status').filter({ hasText: 'Đã gửi đến 1 khách hàng' }).waitFor();
    assert.deepEqual(bodies[1], { message: 'Thông báo riêng', link: '/account#lich-su', customerIds: 'KH-01' });
    assert.deepEqual(s.errors, []);
    await s.context.close();
  }
  console.log('PASS notifications: đọc/đọc tất cả, polling 60s, mobile, bàn phím và gửi chung/riêng cho cả hai vai trò');
} finally { await browser.close(); }
