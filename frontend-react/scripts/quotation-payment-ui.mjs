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
const contrast = (a, b) => {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
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

    const ticket = { code: 'TN-PAYMENT-TEST', productName: 'Thiết bị thử', brandName: 'Soopi', status: 'COMPLETED',
      steps: [], customerNotes: [], pendingQuotation: null, canRate: false,
      costs: { total: 2916000, inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, paymentStatus: 'UNPAID' } };
    await s.context.route('**/api/v1/portal/tickets/TN-PAYMENT-TEST', route => route.fulfill({ json: ticket }));
    await s.page.goto(base + '/account#phieu/TN-PAYMENT-TEST');
    await s.page.getByRole('button', { name: /Thử thanh toán/ }).click();
    const payment = s.page.getByRole('dialog', { name: 'Mô phỏng thanh toán' });
    await settle(payment);
    await check(`payment shares Soopi tokens and a 44px close button: ${width}px`, async () => {
      const values = await payment.evaluate(e => {
        const modal = getComputedStyle(e.querySelector('.payment-modal'));
        const button = getComputedStyle(e.querySelector('.btn-submit'));
        const close = e.querySelector('.payment-modal-close').getBoundingClientRect();
        return { radius: modal.borderRadius, primary: button.backgroundColor, close: [close.width, close.height] };
      });
      assert.equal(values.radius, '10px');
      assert.equal(values.primary, 'rgb(36, 76, 67)');
      assert(values.close.every(value => value >= 44));
    });
    await payment.getByRole('button', { name: /Thẻ Visa/ }).click();
    await payment.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
    await check(`card fields have persistent programmatic labels: ${width}px`, async () => {
      for (const name of ['Số thẻ tín dụng / ghi nợ', 'Tên in trên thẻ (không dấu)', 'Hạn thẻ (MM/YY)', 'Mã CVV']) {
        const field = payment.getByLabel(name, { exact: true });
        assert.equal(await field.count(), 1, name);
        if (width < 1024) {
          const box = await field.boundingBox();
          assert(box.height >= 44 && box.width >= 44, `${name}: ${JSON.stringify(box)}`);
        }
      }
    });
    const number = payment.getByPlaceholder('4111 1111 1111 1111', { exact: true });
    await number.fill('123');
    await payment.locator('.payment-modal-footer .btn-submit').click();
    await check(`invalid card describes its error and receives focus: ${width}px`, async () => {
      assert.equal(await number.getAttribute('aria-invalid'), 'true');
      assert.equal(await number.evaluate(e => e === document.activeElement), true);
      const description = await number.evaluate(e => (e.getAttribute('aria-describedby') || '').split(/\s+/)
        .map(id => document.getElementById(id)?.textContent || '').join(' '));
      assert.match(description, /Số thẻ không hợp lệ/);
      assert.equal(await payment.getByRole('alert').count(), 1);
      await s.page.screenshot({ path: fileURLToPath(new URL(`card-error-${width}.png`, output)) });
      await number.fill('4111111111111111');
      for (const [label, valid] of [['Tên in trên thẻ (không dấu)', 'KHACH THU'], ['Hạn thẻ (MM/YY)', '12/28'], ['Mã CVV', '888']]) {
        const field = payment.getByLabel(label, { exact: true });
        await field.fill('');
        await payment.locator('.payment-modal-footer .btn-submit').click();
        assert.equal(await field.getAttribute('aria-invalid'), 'true', label);
        assert.equal(await field.evaluate(e => e === document.activeElement), true, label);
        assert.equal(await number.getAttribute('aria-invalid'), null);
        await field.fill(valid);
        assert.equal(await field.getAttribute('aria-invalid'), null, `corrected ${label}`);
        assert.equal(await payment.getByRole('alert').count(), 0);
      }
    });
    await number.fill('4111111111111111');
    await payment.locator('.payment-modal-footer .btn-submit').click();
    await payment.getByText('Đã hoàn tất mô phỏng', { exact: true }).waitFor();
    await settle(payment);
    await check(`receipt disclaimer is readable and layout stays contained: ${width}px`, async () => {
      const colors = await payment.locator('.payment-receipt-footer-note').evaluate(e => ({
        fg: getComputedStyle(e).color, bg: getComputedStyle(e.parentElement).backgroundColor, size: parseFloat(getComputedStyle(e).fontSize),
      }));
      assert(contrast(colors.fg, colors.bg) >= 4.5, JSON.stringify(colors));
      assert(colors.size >= 12);
      assert.equal(await payment.locator('.payment-modal').evaluate(e => e.scrollWidth > e.clientWidth), false);
      await s.page.emulateMedia({ media: 'print' });
      try {
        // Print hides the surrounding dialog from the accessibility tree, leaving only the receipt visible.
        assert.equal(await s.page.locator('.payment-overlay .payment-modal').evaluate(e => getComputedStyle(e).maxHeight), 'none');
        assert.equal(await s.page.locator('.payment-overlay .payment-modal-body').evaluate(e => getComputedStyle(e).overflowY), 'visible');
        assert.equal(await s.page.locator('.payment-receipt-footer-note').evaluate(e => getComputedStyle(e).visibility), 'visible');
      } finally { await s.page.emulateMedia({ media: 'screen' }); }
    });
    await payment.locator('.payment-receipt-footer-note').scrollIntoViewIfNeeded();
    await s.page.screenshot({ path: fileURLToPath(new URL(`receipt-${width}.png`, output)) });
    assert.deepEqual(s.errors, []);
    await s.context.close();
  }
} finally { await browser.close(); }
console.log(`${checks} checks passed; ${failures} failed; all API calls mocked`);
if (failures) process.exitCode = 1;
