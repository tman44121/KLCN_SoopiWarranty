// Mocked admin statistics; verifies lifetime totals are independent of daily filters, without writing real visits.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const payload = Buffer.from([80, 75, 3, 4, 0, 255]);
try {
  for (const width of [1440, 390]) {
    const s = await session('ADMIN', '/admin', width);
    const queries = [];
    let failed = false, empty = false, exported;
    await s.context.route('**/api/v1/admin/access/**', async route => {
      const url = new URL(route.request().url()); queries.push(url);
      const endpoint = url.pathname.split('/').at(-1);
      if (endpoint === 'export') {
        exported = url.searchParams;
        return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: payload });
      }
      if (failed) return route.fulfill({ status: 503, json: { detail: 'Không thể tải thống kê thử.' } });
      const from = url.searchParams.get('from') || '2026-10-31';
      const to = url.searchParams.get('to') || '2026-11-02';
      const days = [{ day: '2026-10-31', visits: 7, accounts: 4, logins: 5, failed: 1 },
        { day: '2026-11-01', visits: 5, accounts: 3, logins: 4, failed: 2 }, { day: '2026-11-02', visits: 3, accounts: 2, logins: 2, failed: 0 }]
        .filter(d => d.day >= from && d.day <= to);
      if (endpoint === 'summary') return route.fulfill({ json: { trackingStart: '2026-10-31', from, to, generatedAt: '2026-11-02T03:00:00Z', totalVisits: empty ? 0 : 15,
        visits: empty ? 0 : days.reduce((n, d) => n + d.visits, 0), accounts: empty ? 0 : 5, online: empty ? 0 : 1, logins: 11, failed: 3, days: empty ? [] : days } });
      const page = Number(url.searchParams.get('page') || 0);
      if (endpoint === 'online') return route.fulfill({ json: { page, totalItems: empty ? 0 : 1, totalPages: empty ? 0 : 1, items: empty ? [] : [{ accountId: '1', username: 'ktv.test', fullName: '<img src=x onerror=alert(1)>', kind: 'EMPLOYEE', roles: 'TECHNICIAN',
        startedAt: '2026-11-02T02:00:00Z', lastSeenAt: '2026-11-02T03:00:00Z', sessions: 2 }] } });
      const action = url.searchParams.get('action');
      return route.fulfill({ json: { page, totalItems: empty ? 0 : 52, totalPages: empty ? 0 : 3,
        items: empty ? [] : Array.from({ length: page === 2 ? 2 : 25 }, (_, n) => ({ id: String(page * 25 + n), at: '2026-11-02T03:00:00Z', username: `tài khoản ${page * 25 + n}`,
          fullName: 'Người dùng thử', kind: 'CUSTOMER', roles: 'CUSTOMER', action: action || 'AUTH_LOGIN_SUCCESS', label: action === 'AUTH_LOGIN_FAILED' ? 'Đăng nhập thất bại' : 'Đăng nhập thành công' })) } });
    });
    await login(s.page); await s.page.waitForURL(base + '/admin');
    await s.page.goto(base + '/admin#access');
    const report = s.page.getByRole('region', { name: 'Nhật ký đăng nhập và truy cập' });
    await report.locator('.stat-tile').first().getByText('15', { exact: true }).waitFor();
    assert.equal(await report.locator('.access-stats .stat-tile').count(), 6);
    const help = report.locator('details.admin-help');
    assert.equal(await help.getAttribute('open'), null);
    await help.locator('summary').focus(); await s.page.keyboard.press('Enter');
    await help.getByText('Lượt mới:', { exact: false }).waitFor();
    await help.locator('summary').click(); assert.equal(await help.getAttribute('open'), null);
    assert.equal(await report.locator('img').count(), 0);
    await report.getByLabel('Từ ngày', { exact: false }).fill('2026-11-01');
    await report.getByLabel('Đến ngày', { exact: false }).fill('2026-11-01');
    await report.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await report.locator('.stat-tile').filter({ hasText: 'Lượt trong kỳ' }).getByText('5', { exact: true }).waitFor();
    assert.equal(await report.locator('.stat-tile').filter({ hasText: 'Tổng lượt tích lũy' }).locator('.stat-tile__value').innerText(), '15');
    assert(queries.some(url => url.searchParams.get('from') === '2026-11-01' && url.searchParams.get('to') === '2026-11-01'));
    await report.getByLabel('Từ ngày', { exact: false }).fill('2026-11-02');
    await report.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await report.getByRole('alert').filter({ hasText: 'Khoảng ngày không hợp lệ.' }).waitFor();
    await report.getByRole('button', { name: 'Toàn bộ lịch sử', exact: true }).click();
    await report.locator('.stat-tile').filter({ hasText: 'Lượt trong kỳ' }).getByText('15', { exact: true }).waitFor();
    const logCard = report.locator('.card').filter({ has: s.page.getByRole('heading', { name: 'Lịch sử đăng nhập', exact: true }) });
    await logCard.getByRole('button', { name: 'Sau', exact: true }).click();
    await logCard.getByText(/^tài khoản 25/).waitFor();
    await report.getByLabel('Sự kiện nhật ký').selectOption('AUTH_LOGIN_FAILED');
    await logCard.getByText(/^tài khoản 0/).waitFor();
    await report.getByLabel('Loại tài khoản', { exact: true }).selectOption('EMPLOYEE');
    await report.getByLabel('Vai trò', { exact: true }).selectOption('TECHNICIAN');
    await report.getByLabel('Tìm tài khoản / họ tên / mã').fill('kythuat');
    await report.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await report.locator('.stat-tile').first().getByText('15', { exact: true }).waitFor();
    const download = s.page.waitForEvent('download');
    await report.getByRole('button', { name: 'Xuất Excel', exact: true }).click();
    const file = await download; assert.equal(file.suggestedFilename(), 'soopi-truy-cap-2026-10-31-2026-11-02.xlsx');
    assert.deepEqual(await readFile(await file.path()), payload);
    assert.equal(exported.get('kind'), 'EMPLOYEE'); assert.equal(exported.get('role'), 'TECHNICIAN'); assert.equal(exported.get('q'), 'kythuat');
    assert.equal(exported.get('action'), 'AUTH_LOGIN_FAILED');
    assert.equal(exported.get('from'), '2026-10-31'); assert.equal(exported.get('to'), '2026-11-02');
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/access-data-${width}.png`, import.meta.url)), fullPage: true });
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'populated tables fit viewport');
    failed = true;
    await report.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await report.getByRole('alert').filter({ hasText: 'Không thể tải thống kê thử.' }).waitFor();
    assert.equal(await report.getByRole('button', { name: 'Xuất Excel', exact: true }).isDisabled(), true);
    failed = false; await report.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await report.getByRole('button', { name: 'Xuất Excel', exact: true }).waitFor();
    empty = true; await report.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await report.getByText('Không có tài khoản online phù hợp.', { exact: true }).waitFor();
    await report.getByText('Chưa có sự kiện trong kỳ.', { exact: true }).waitFor();
    assert(s.errors.every(e => /Failed to load resource:.*503/.test(e)), s.errors.join('\n'));
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/access-${width}.png`, import.meta.url)), fullPage: true });
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await s.context.close();
    console.log(`PASS access ${width}px: lifetime totals, date filters, paging, roles, safe text, Excel, errors and empty state`);
  }
  const customer = await session('CUSTOMER', '/account');
  await login(customer.page); await customer.page.waitForURL(base + '/account');
  await customer.page.waitForFunction(() => document.body.getAttribute('aria-busy') !== 'true');
  await customer.page.waitForLoadState('networkidle');
  const before = customer.calls.filter(path => path === '/access/heartbeat').length; assert(before > 0, 'customer account page tracks');
  await customer.page.goto(base + '/'); await customer.page.waitForLoadState('networkidle');
  assert(customer.calls.filter(path => path === '/access/heartbeat').length > before, 'authenticated customer on public home still tracks');
  assert.deepEqual(customer.errors, []); await customer.context.close();
  const guest = await session('CUSTOMER', '/account'); await guest.page.goto(base + '/'); await guest.page.waitForLoadState('networkidle');
  assert(!guest.calls.includes('/access/heartbeat'), 'anonymous guests are not counted as accounts'); await guest.context.close();
  console.log('PASS presence covers customer pages and authenticated home, without counting guests');
} finally { await browser.close(); }
