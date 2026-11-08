// Focused customer profile UI test; routes are fixtures and never reach SQL.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5174';
try {
  for (const width of [1440, 390]) {
    const s = await session('CUSTOMER', '/account', width);
    let profile = {
      customerCode: 'KH-FIXTURE', fullName: 'Khách Hàng Thử',
      phone: '0900000000', email: 'old@example.test', address: 'Q1', username: 'kh.fixture',
    };
    const writes = [];
    let applyName = true;
    await s.context.route('**/api/v1/portal/my/profile', async route => {
      const request = route.request();
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON();
        writes.push(body);
        profile = { ...profile, ...(applyName ? body : { email: body.email, address: body.address }) };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
    });
    await login(s.page);
    await s.page.waitForURL(base + '/account');
    await s.page.goto(base + '/account#ho-so');
    await s.page.locator('#pf-name').waitFor();
    assert.equal(await s.page.inputValue('#pf-name'), 'Khách Hàng Thử');
    assert.equal(await s.page.inputValue('#pf-phone'), '0900000000');
    await s.page.fill('#pf-name', 'Khách Hàng Đã Đổi');
    await s.page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await s.page.getByText('Đã cập nhật hồ sơ cá nhân.').waitFor();
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0], {
      fullName: 'Khách Hàng Đã Đổi', email: 'old@example.test', address: 'Q1',
    });
    await s.page.locator('.user-card-fullname').getByText('Khách Hàng Đã Đổi').waitFor();
    assert.equal(await s.page.locator('.user-profile-trigger').getAttribute('aria-label'), 'Tài khoản: Khách Hàng Đã Đổi');
    await s.page.reload();
    await s.page.locator('.user-card-fullname').getByText('Khách Hàng Đã Đổi').waitFor();
    assert.equal(writes.length, 1);
    applyName = false;
    await s.page.fill('#pf-name', 'Tên Chưa Được Lưu');
    await s.page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await s.page.getByText('Máy chủ chưa cập nhật họ tên. Vui lòng kiểm tra lại hồ sơ và phiên bản API đang chạy.').waitFor();
    assert.equal(writes.length, 2);
    assert.equal(await s.page.locator('.user-profile-trigger').getAttribute('aria-label'), 'Tài khoản: Khách Hàng Đã Đổi');
    assert.deepEqual(s.errors, []);
    await s.context.close();
  }
  console.log('PASS customer profile name edit and header at desktop/mobile widths, fixture only');
} finally {
  await browser.close();
}
