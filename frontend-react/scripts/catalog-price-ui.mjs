// All APIs are mocked; no live business writes.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

try {
  for (const width of [1440, 390]) {
    const s = await session('ADMIN', '/admin', width);
    s.page.setDefaultTimeout(10000);
    const parts = [{ _id: 'LK-1', name: 'Màn hình thử', categoryCode: 'PHONE', servicePrice: 1200000, active: true }];
    const services = [{ _id: 'DV-1', name: 'Công sửa thử', categoryCode: 'PHONE', price: 150000, active: true }];
    const puts = [];
    let finishPriceSave;
    await s.context.route('**/api/v1/catalog/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1/catalog/', '');
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        puts.push({ path, body });
        if (body.servicePrice === 999) return json(route, { code: 'VALIDATION_FAILED', detail: 'Dữ liệu không hợp lệ.' }, 400);
        if (body.servicePrice === 1350000) await new Promise(resolve => { finishPriceSave = resolve; });
        const list = path.startsWith('parts/') ? parts : services;
        const item = list.find(entry => path.endsWith('/' + entry._id));
        Object.assign(item, body);
        return json(route, item);
      }
      const data = { 'device-categories': [{ _id: 'PHONE', name: 'Điện thoại', deviceTypes: [] }], brands: [], products: [],
        parts, 'service-prices': services, 'warranty-policies': [], stations: [{ _id: 'ST01', name: 'Trạm thử' }] }[path];
      return data ? json(route, data) : route.fallback();
    });
    await login(s.page); await s.page.waitForURL(base + '/admin');
    await s.page.goto(base + '/admin#catalogs');
    const panel = s.page.locator('#catalog-panel-parts');
    await s.page.getByRole('tab', { name: /Linh kiện/ }).click();
    assert.equal(await s.page.getByRole('tab', { name: /Linh kiện/ }).innerText(), 'Linh kiện 1');

    // Esc hủy, không gửi gì; focus trở lại nút Sửa giá.
    await panel.getByRole('button', { name: 'Sửa giá Màn hình thử' }).click();
    const input = panel.getByRole('textbox', { name: 'Giá mới cho Màn hình thử (đồng)' });
    assert.equal(await input.inputValue(), '1.200.000');
    await input.fill('5');
    await input.press('Escape');
    assert.equal(puts.length, 0);
    assert.equal(await panel.getByRole('button', { name: 'Sửa giá Màn hình thử' }).evaluate(e => e === document.activeElement), true);
    assert.match(await panel.locator('[data-price-cell]').innerText(), /1\.200\.000/);

    // Ô tiền chỉ nhận chữ số và tự thêm dấu chấm; để trống thì bị chặn ở client.
    await panel.getByRole('button', { name: 'Sửa giá Màn hình thử' }).click();
    await input.fill('-12a3456');
    assert.equal(await input.inputValue(), '123.456');
    await input.fill('');
    await input.press('Enter');
    assert.equal(puts.length, 0);
    assert.equal(await input.evaluate(e => e.validationMessage), 'Nhập số tiền từ 0 đ trở lên.');

    // Lỗi máy chủ giữ ô nhập để sửa lại.
    await input.fill('999');
    await panel.getByRole('button', { name: 'Lưu' }).click();
    await s.page.getByText('Dữ liệu không hợp lệ.').first().waitFor();
    assert.equal(await input.isVisible(), true);

    // Enter lưu đúng trường, bảng hiện giá mới.
    await input.fill('1350000');
    const pendingSave = s.page.waitForRequest(request => request.method() === 'PUT' && request.postDataJSON().servicePrice === 1350000);
    await input.press('Enter');
    await pendingSave;
    await input.dispatchEvent('keydown', { key: 'Enter' });
    await s.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await input.isDisabled(), true);
    assert.equal(await panel.getByRole('button', { name: 'Hủy', exact: true }).isDisabled(), true);
    assert.equal(await s.page.locator('.toast--error').filter({ hasText: 'Đã xảy ra lỗi hệ thống' }).count(), 0);
    assert.equal(puts.filter(item => item.body.servicePrice === 1350000).length, 1);
    finishPriceSave();
    await panel.locator('[data-price-cell]').filter({ hasText: '1.350.000' }).waitFor();
    assert.deepEqual(puts.at(-1), { path: 'parts/LK-1', body: { servicePrice: 1350000 } });

    // Giá dịch vụ dùng trường price.
    await s.page.getByRole('tab', { name: /Giá dịch vụ/ }).click();
    const services$ = s.page.locator('#catalog-panel-services');
    await services$.getByRole('button', { name: 'Sửa giá Công sửa thử' }).click();
    await services$.getByRole('textbox').fill('180000');
    await services$.getByRole('button', { name: 'Lưu' }).click();
    await services$.locator('[data-price-cell]').filter({ hasText: '180.000' }).waitFor();
    assert.deepEqual(puts.at(-1), { path: 'service-prices/DV-1', body: { price: 180000 } });

    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(s.errors.filter(e => !/status of 400/.test(e)), []);
    await s.context.close();
    console.log(`PASS catalog tabs and inline price editing (cancel, validation, server error, parts/services): ${width}px`);
  }
} finally { await browser.close(); }
