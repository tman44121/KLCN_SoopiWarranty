// All APIs are mocked; no live business writes.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const custom = {
  expressSlaHours: 6, prioritySlaHours: 20, standardSlaHours: 36, defaultSlaLevel: 'PRIORITY_24H',
  atRiskMinutes: 45, quotationValidityHours: 24, openAt: '07:30', closeAt: '19:00', workingDays: [1, 2, 3, 4, 5, 6, 7],
};
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

try {
  for (const width of [1440, 390]) {
    // Quản trị: đọc, chặn dữ liệu sai ở client, lưu đúng body.
    const a = await session('ADMIN', '/admin', width);
    a.page.setDefaultTimeout(10000);
    let saved = null;
    await a.context.route('**/api/v1/settings/time', route => route.request().method() === 'PUT'
      ? (saved = route.request().postDataJSON(), json(route, saved))
      : route.fallback());
    await login(a.page); await a.page.waitForURL(base + '/admin');
    await a.page.goto(base + '/admin#time-settings');
    const panel = a.page.locator('[data-page-panel="time-settings"]');
    await panel.getByLabel('Tiêu chuẩn (giờ)').waitFor();
    assert.equal(await panel.getByLabel('Tiêu chuẩn (giờ)').inputValue(), '48');
    assert.equal(await panel.getByLabel('Giờ đóng cửa (HH:mm)').inputValue(), '17:00');
    assert.equal(await panel.getByLabel('Chủ nhật').isChecked(), false);

    await panel.getByLabel('Nhanh (giờ)').fill('30');
    await panel.getByRole('button', { name: 'Lưu cấu hình' }).click();
    await panel.getByText('Số giờ SLA phải tăng dần: Nhanh ≤ Ưu tiên ≤ Tiêu chuẩn.').waitFor();
    assert.equal(saved, null);

    await panel.getByLabel('Nhanh (giờ)').fill('6');
    await panel.getByLabel('Ưu tiên (giờ)').fill('20');
    await panel.getByLabel('Tiêu chuẩn (giờ)').fill('36');
    await panel.getByLabel('Mức mặc định khi lập phiếu').selectOption('PRIORITY_24H');
    await panel.getByLabel('Báo “sắp trễ” trước hạn SLA (phút)').fill('45');
    await panel.getByLabel('Hạn khách xác nhận báo giá (giờ)').fill('24');
    await panel.getByLabel('Giờ mở cửa (HH:mm)').fill('0730');
    await panel.getByLabel('Giờ đóng cửa (HH:mm)').fill('25:00');
    await panel.getByRole('button', { name: 'Lưu cấu hình' }).click();
    await panel.getByText('Giờ mở/đóng cửa nhập theo dạng HH:mm', { exact: false }).waitFor();
    assert.equal(await panel.getByLabel('Giờ mở cửa (HH:mm)').inputValue(), '07:30');
    await panel.getByLabel('Giờ đóng cửa (HH:mm)').fill('19:00');
    await panel.getByLabel('Chủ nhật').check();
    await panel.getByRole('button', { name: 'Lưu cấu hình' }).click();
    await panel.getByText('Đã lưu. Cấu hình áp dụng ngay', { exact: false }).waitFor();
    assert.deepEqual(saved, custom);
    assert.deepEqual(a.errors, []);
    assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await a.context.close();

    // Lễ tân: nhãn SLA có số giờ đã cấu hình, chọn sẵn mức mặc định, ghi chú giờ hẹn theo cấu hình.
    const r = await session('RECEPTIONIST', '/receptionist', width);
    r.page.setDefaultTimeout(10000);
    await r.context.route('**/api/v1/settings/time', route => json(route, custom));
    await login(r.page); await r.page.waitForURL(base + '/receptionist');
    const sla = r.page.locator('[data-sla-level]');
    await sla.getByRole('radio', { name: 'Tiêu chuẩn (36h)' }).waitFor();
    assert.deepEqual(await sla.getByRole('radio').allInnerTexts(), ['Tiêu chuẩn (36h)', 'Ưu tiên (20h)', 'Nhanh (6h)']);
    assert.equal(await sla.getByRole('radio', { checked: true }).innerText(), 'Ưu tiên (20h)');
    await r.page.locator('#promisedReturnAt-hours').filter({ hasText: 'Thứ Hai–Chủ nhật, 07:30–19:00 (giờ Việt Nam).' }).waitFor();
    assert.deepEqual(r.errors, []);
    await r.context.close();

    // Cổng khách: giờ hẹn ngoài khung mới bị chặn ngay ở client.
    const c = await session('CUSTOMER', '/account', width);
    c.page.setDefaultTimeout(10000);
    await c.context.route('**/api/v1/settings/time', route => json(route, { ...custom, workingDays: [1, 2, 3, 4, 5] }));
    await c.page.goto(base + '/portal#dang-ky');
    await c.page.locator('#reg-time-hours').filter({ hasText: 'Thứ Hai–thứ Sáu, 07:30–19:00' }).waitFor();
    await c.page.fill('#reg-time-date', '2030-10-05'); // thứ Bảy
    await c.page.getByText('Thứ Bảy không nhận lịch. Vui lòng chọn thứ Hai–thứ Sáu.', { exact: true }).waitFor();
    assert.deepEqual(c.errors, []);
    await c.context.close();
    console.log(`PASS admin time settings, receptionist SLA labels/default, portal business hours: ${width}px`);
  }
} finally { await browser.close(); }
