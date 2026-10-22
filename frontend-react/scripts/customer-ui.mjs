// Customer regressions use smoke's isolated browser and mocked API; no live DB writes.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, session } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const code = 'TN-2026-1002-00001';
const output = new URL('../test-results/', import.meta.url);
let checks = 0;
try {
  for (const width of [1440, 768, 390]) {
    const s = await session('CUSTOMER', '/account', width);
    s.page.setDefaultTimeout(7000);
    let ticket = { code, productName: 'Galaxy S24', brandName: 'Samsung', serialOrImei: '356000000000001',
      receivedAt: '2026-10-01T02:00:00Z', promisedReturnAt: null, status: 'COMPLETED', stopped: false,
      steps: [], customerNotes: [], pendingQuotation: null, rating: null, canRate: false, handedOverAt: null,
      costs: { total: 2916000, inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, paymentStatus: 'UNPAID' } };
    const writes = [];
    s.page.on('request', request => {
      if (request.url().includes('/api/v1/') && request.method() !== 'GET') writes.push(new URL(request.url()).pathname);
    });
    await s.context.route(`**/api/v1/portal/tickets/${code}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ticket) }));
    await s.page.goto(`${base}/account#phieu/${code}`);
    const trigger = s.page.getByRole('button', { name: /Thử thanh toán \(mô phỏng\)/ });
    await trigger.waitFor();
    assert.equal(await s.page.locator('.paid-badge-box').count(), 0); checks++;

    for (const name of ['Chuyển khoản VietQR', 'Thẻ Visa / Mastercard', 'Ví MoMo', 'Ví ZaloPay', 'Cổng VNPay']) {
      await trigger.click();
      const dialog = s.page.getByRole('dialog', { name: 'Mô phỏng thanh toán' });
      await dialog.waitFor();
      assert.match(await dialog.locator('.payment-demo-notice').innerText(), /không thu tiền/i); checks++;
      const method = dialog.getByRole('button', { name: new RegExp(name) });
      await method.focus();
      await method.press('Enter');
      assert.equal(await method.getAttribute('aria-pressed'), 'true'); checks++;
      await dialog.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
      if (name === 'Thẻ Visa / Mastercard') {
        const number = dialog.getByPlaceholder('4111 1111 1111 1111', { exact: true });
        await number.fill('123');
        await dialog.locator('.payment-modal-footer .btn-submit').click();
        await dialog.getByText(/Số thẻ không hợp lệ/).waitFor(); checks++;
        await number.fill('4000000000000002');
        await dialog.locator('.payment-modal-footer .btn-submit').click();
        await dialog.getByText('Mô phỏng giao dịch bị từ chối', { exact: true }).waitFor(); checks++;
        await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
        await number.fill('4111111111111111');
      }
      await dialog.locator('.payment-modal-footer .btn-submit').click();
      await dialog.getByText('Đã hoàn tất mô phỏng', { exact: true }).waitFor(); checks++;
      assert.match(await dialog.locator('.payment-receipt').innerText(), /DEMO-/); checks++;
      assert.match(await dialog.locator('.payment-receipt-footer-note').innerText(), /không có giá trị xác nhận thanh toán/i); checks++;
      if (name === 'Chuyển khoản VietQR') {
        await s.page.screenshot({ path: fileURLToPath(new URL(`ui-demo-payment-${width}.png`, output)) });
        await s.page.emulateMedia({ media: 'print' });
        assert.equal(await s.page.locator('.payment-receipt-footer-note').evaluate(node => getComputedStyle(node).visibility), 'visible'); checks++;
        await s.page.emulateMedia({ media: 'screen' });
      }
      await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
      assert.equal(await s.page.locator('.paid-badge-box').count(), 0); checks++;
      assert.equal(await trigger.isVisible(), true); checks++;
    }
    assert.deepEqual(writes.filter(path => !path.endsWith('/auth/refresh')), []); checks++;
    await s.page.reload();
    await trigger.waitFor(); checks++;
    await trigger.click();
    await s.page.keyboard.press('Escape');
    await s.page.getByRole('dialog', { name: 'Mô phỏng thanh toán' }).waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true); checks++;

    ticket = { ...ticket, costs: { ...ticket.costs, paymentStatus: 'PAID' } };
    await s.page.reload();
    await s.page.locator('.paid-badge-box').waitFor();
    assert.equal(await trigger.count(), 0); checks++;
    assert.equal(await s.page.locator('.paid-receipt-btn').count(), 0); checks++;
    await s.page.screenshot({ path: fileURLToPath(new URL(`ui-paid-ticket-${width}.png`, output)) });

    const scroll = await s.page.evaluate(() => scrollY);
    await s.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    const input = s.page.getByRole('textbox', { name: 'Nhập tin nhắn', exact: true });
    assert.equal(await s.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).isDisabled(), true); checks++;
    await input.fill('Tin nhắn kiểm thử');
    await input.press('Enter');
    await s.page.getByRole('button', { name: 'Thu nhỏ', exact: true }).click();
    await s.page.locator('.chat-minimized-bar .chat-fab-badge').waitFor(); checks++;
    await s.page.getByRole('button', { name: 'Khôi phục chat hỗ trợ', exact: true }).click();
    assert.equal(await s.page.locator('.chat-fab-badge').count(), 0); checks++;
    await input.fill('Tin nhắn khi đóng cửa sổ');
    await input.press('Enter');
    await s.page.getByRole('button', { name: 'Đóng chat', exact: true }).click();
    await s.page.locator('#live-chat-bubble-btn .chat-fab-badge').waitFor(); checks++;
    await s.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    await s.page.locator('.chat-window').evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    assert.equal(await s.page.evaluate(() => scrollY), scroll); checks++;
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await s.page.screenshot({ path: fileURLToPath(new URL(`ui-chat-${width}.png`, output)) });
    assert.deepEqual(s.errors, []); checks++;
    await s.context.close();
    console.log(`PASS customer payment demo, server payment status, chat unread and layout: ${width}px`);
  }
  console.log(`PASS: ${checks} customer UI regression checks, no live database writes`);
} finally { await browser.close(); }
