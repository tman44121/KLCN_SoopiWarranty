// Quote/payment UI regressions use an isolated Edge profile and mocked APIs only.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, session } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/quotation-payment/', import.meta.url);
mkdirSync(output, { recursive: true });
let checks = 0, failures = 0;
async function check(name, action) {
  try { await action(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
const settle = dialog => dialog.evaluate(e => Promise.all(e.getAnimations({ subtree: true })
  .filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished)));
try {
  for (const width of [1440, 768, 360]) {
    const s = await session('CUSTOMER', '/account', width, { hasTouch: width < 1024 });
    s.page.setDefaultTimeout(5000);
    await s.page.goto(base + '/account#phieu/TN-2026-1002-00001');
    const trigger = s.page.getByRole('button', { name: 'Kiểm tra & Xác nhận giá →', exact: true });
    await trigger.click();
    const quote = s.page.locator('.payment-overlay');
    await settle(quote);
    await check(`quote name, keyboard containment and Escape restore focus: ${width}px`, async () => {
      assert.equal(await s.page.getByRole('dialog', { name: 'Xác nhận chi phí sửa chữa', exact: true }).count(), 1);
      assert.equal(await quote.evaluate(e => e.contains(document.activeElement)), true);
      for (let i = 0; i < 8; i++) {
        await s.page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
        assert.equal(await quote.evaluate(e => e.contains(document.activeElement)), true);
      }
      await s.page.keyboard.press('Escape');
      assert.equal(await quote.count(), 0);
      assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
      await trigger.click(); await settle(quote);
    });
    await check(`quote uses policy-based warranty copy: ${width}px`, async () => {
      const text = await quote.locator('.quote-commit-list').innerText();
      assert(!/3[–-]6 tháng/.test(text));
      assert.match(text, /chính sách của từng linh kiện/);
    });
    await check(`quote controls fit the viewport and touch targets: ${width}px`, async () => {
      const button = await quote.locator('.payment-modal-close').boundingBox();
      assert(button.width >= 44 && button.height >= 44);
      assert.equal(await quote.locator('.payment-modal').evaluate(e => e.scrollWidth > e.clientWidth), false);
      assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    });
    await s.page.screenshot({ path: fileURLToPath(new URL(`quote-${width}.png`, output)) });
    if (await quote.count()) await quote.getByRole('button', { name: 'Đóng', exact: true }).click();

    const qr = { imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240"/%3E', bankId: 'MB',
      accountNo: '0961575900', accountName: null, amount: 2916000, transferNote: 'SOOPI TNPAYMENTTEST' };
    const ticket = { code: 'TN-PAYMENT-TEST', productName: 'Thiết bị thử', brandName: 'Soopi', status: 'COMPLETED',
      steps: [], customerNotes: [], pendingQuotation: null, canRate: false,
      costs: { total: 2916000, inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, paymentStatus: 'UNPAID', paymentQr: qr } };
    await s.context.route('**/api/v1/portal/tickets/TN-PAYMENT-TEST', route => route.fulfill({ json: ticket }));
    await s.page.goto(base + '/account#phieu/TN-PAYMENT-TEST');
    const payment = s.page.locator('.payment-qr');
    await payment.waitFor();
    await check(`payment shows the real VietQR transfer details: ${width}px`, async () => {
      assert.equal(await payment.getByRole('img', { name: /Mã VietQR chuyển khoản/ }).count(), 1);
      const text = await payment.innerText();
      assert.match(text, /0961575900/);
      assert.match(text, /SOOPI TNPAYMENTTEST/);
      assert.equal(await s.page.getByText(/mô phỏng|minh họa|DEMO/i).count(), 0);
      assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    });
    await check(`copy buttons meet touch targets: ${width}px`, async () => {
      for (const button of await payment.locator('.payment-copy-btn').all()) {
        const box = await button.boundingBox();
        if (width < 1024) assert(box.height >= 24 && box.width >= 24, JSON.stringify(box));
      }
    });
    await s.page.screenshot({ path: fileURLToPath(new URL(`payment-${width}.png`, output)) });
    assert.deepEqual(s.errors, []);
    await s.context.close();
  }
} finally { await browser.close(); }
console.log(`${checks} checks passed; ${failures} failed; all API calls mocked`);
if (failures) process.exitCode = 1;
