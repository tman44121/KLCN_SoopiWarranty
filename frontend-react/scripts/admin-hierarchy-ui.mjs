// Isolated browser sessions; all account changes below are mocked.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const employee = (employeeId, username, code) => ({ employeeId, username, fullName: username, phone: '0900000000',
  roles: [{ code, label: code }], accountStatus: 'ACTIVE', lastLoginAt: null });
let checks = 0;
try {
  for (const width of [1440, 768, 390]) for (const root of [false, true]) {
    const s = await session('ADMIN', '/admin', width);
    s.user.username = root ? 'admin' : 'ordinary-admin';
    s.user.isRootAdmin = root;
    const employees = [employee('NV-ROOT', 'admin', 'ADMIN'), employee('NV-PEER', 'peer', 'ADMIN'), employee('NV-STAFF', 'staff', 'TECHNICIAN')];
    const changes = [];
    await s.context.route('**/api/v1/admin/employees**', async route => {
      const request = route.request();
      if (request.method() !== 'GET') changes.push({ url: request.url(), body: request.postDataJSON() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(request.method() === 'GET' ? employees : employees[2]) });
    });
    await login(s.page);
    await s.page.waitForURL(base + '/admin');
    await s.page.locator('[data-row-open="NV-ROOT"]').waitFor();
    for (const target of ['NV-ROOT', 'NV-PEER']) {
      await s.page.locator(`[data-row-open="${target}"]`).click();
      await s.page.locator('[data-emp-modal]:not([hidden])').waitFor();
      assert.equal(await s.page.locator('[data-emp-modal-actions] button').count(), root ? 3 : 0); checks++;
      if (!root) { await s.page.getByText('Chỉ quản trị gốc mới được thay đổi vai trò, khóa/mở khóa hoặc đặt lại mật khẩu của quản trị viên.', { exact: true }).waitFor(); checks++; }
      await s.page.locator('[data-emp-modal-close]').click();
    }
    await s.page.locator('[data-row-open="NV-STAFF"]').click();
    await s.page.locator('[data-emp-action="roles"]').click();
    const adminChoice = s.page.locator('[data-edit-roles-list] input[value="ADMIN"]');
    assert.equal(await adminChoice.count(), root ? 1 : 0); checks++;
    if (root) await adminChoice.check();
    await s.page.locator('[data-edit-roles-list] input[value="CASHIER"]').check();
    await s.page.locator('[data-edit-roles-save]').click();
    await s.page.locator('[data-edit-roles-modal]').waitFor({ state: 'hidden' });
    assert.equal(changes.length, 1); checks++;
    assert.equal(changes[0].body.roles.includes('ADMIN'), root); checks++;
    await s.page.locator('[data-open-add-employee]').click();
    assert.equal(await s.page.locator('[data-add-emp-roles] input[value="ADMIN"]').count(), root ? 1 : 0); checks++;
    assert.deepEqual(s.errors, []); checks++;
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await s.context.close();
    console.log(`PASS admin hierarchy UI: ${root ? 'root' : 'ordinary admin'}, ${width}px`);
  }
  console.log(`PASS: ${checks} hierarchy UI checks; no live account changes`);
} finally { await browser.close(); }
