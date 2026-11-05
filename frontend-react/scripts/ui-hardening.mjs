// Isolated Edge regressions; every API request uses smoke's fixtures, never the live DB.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const output = new URL('../test-results/impeccable/', import.meta.url);
mkdirSync(output, { recursive: true });
let failures = 0;
async function check(name, action) {
  try { await action(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  const publicPage = await session('CUSTOMER', '/account', 1440);
  let releaseLogo;
  const logoReady = new Promise(resolve => { releaseLogo = resolve; });
  await publicPage.context.route('**/images/brand/wordmark.png', async route => { await logoReady; await route.continue(); });
  try {
    await publicPage.page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await check('landing content paints while the secondary logo image is still pending', async () => {
      await publicPage.page.getByRole('heading', { level: 1, name: 'Tra cứu & quản lý bảo hành sản phẩm' }).waitFor({ timeout: 5000 });
      assert(await publicPage.page.locator('.hero-actions a').first().isVisible());
    });
  } finally {
    releaseLogo();
    await publicPage.page.waitForLoadState('networkidle');
    await publicPage.context.close();
  }
  const staff = await session('DISPATCHER', '/dispatch', 360, { hasTouch: true });
  staff.page.setDefaultTimeout(5000);
  await login(staff.page);
  await staff.page.waitForURL(base + '/dispatch');
  await staff.page.waitForLoadState('networkidle');
  await check('all shared dialogs expose their title and restore keyboard focus', async () => {
    for (const method of ['confirm', 'promptReason', 'showTemporaryPassword']) {
      await staff.page.locator('[data-global-search]').focus();
      await staff.page.evaluate(method => { void window.LML_UI[method]({ title: 'Xác nhận kiểm tra', confirmLabel: 'Xác nhận', password: 'Mock-only' }); }, method);
      const dialog = staff.page.getByRole('dialog', { name: 'Xác nhận kiểm tra', exact: true });
      await dialog.waitFor();
      await staff.page.keyboard.press('Escape');
      assert.equal(await staff.page.locator('[data-global-search]').evaluate(e => e === document.activeElement), true);
    }
  });
  // Close a dialog left open by a failed assertion before the next independent check.
  await staff.page.keyboard.press('Escape');
  await check('API field errors describe the input and cleanup preserves existing hints', async () => {
    const result = await staff.page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = '<div class="form-field"><label for="audit-field">Tên</label><input id="audit-field" name="fullName" aria-describedby="audit-hint"><span id="audit-hint">Gợi ý</span></div>';
      document.body.append(form);
      window.LML_UI.showError({ code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'fullName', message: 'Vui lòng nhập tên.' }] }, form);
      const input = form.querySelector('input');
      const ids = input.getAttribute('aria-describedby')?.split(/\s+/) || [];
      const invalid = input.getAttribute('aria-invalid');
      const linked = ids.some(id => document.getElementById(id)?.textContent === 'Vui lòng nhập tên.');
      window.LML_UI.clearFieldErrors(form);
      const hint = input.getAttribute('aria-describedby');
      const cleared = input.getAttribute('aria-invalid') !== 'true';
      form.remove();
      return { invalid, linked, hint, cleared };
    });
    assert.deepEqual(result, { invalid: 'true', linked: true, hint: 'audit-hint', cleared: true });
  });
  await check('compact staff touch controls have a 44px target in both dimensions', async () => {
    const size = await staff.page.locator('.sort-button').first().boundingBox();
    assert(size.width >= 44 && size.height >= 44, JSON.stringify(size));
  });
  await staff.context.close();

  const reception = await session('RECEPTIONIST', '/receptionist', 768, { hasTouch: true });
  await login(reception.page);
  await reception.page.waitForURL(base + '/receptionist');
  await reception.page.evaluate(() => document.fonts.ready);
  await check('cosmetic acknowledgement has a real 44px label target and native touch/Space behavior', async () => {
    const label = reception.page.locator('label[for="ack"]');
    await label.scrollIntoViewIfNeeded();
    const rect = await label.boundingBox();
    assert(rect.width >= 44 && rect.height >= 44, JSON.stringify(rect));
    await reception.page.touchscreen.tap(rect.x + rect.width / 2, rect.y + 4);
    assert(await reception.page.locator('#ack').isChecked());
    await reception.page.locator('#ack').focus();
    await reception.page.keyboard.press('Space');
    assert(!await reception.page.locator('#ack').isChecked());
  });
  assert.deepEqual(reception.errors, []);
  await reception.context.close();

  const customer = await session('CUSTOMER', '/account', 360, { hasTouch: true });
  customer.page.setDefaultTimeout(5000);
  await customer.page.goto(base + '/portal#dang-ky');
  await customer.page.waitForLoadState('networkidle');
  await check('Sunday appointment keeps its actionable error after submission', async () => {
    await customer.page.fill('#reg-time-date', '2030-10-06');
    await customer.page.selectOption('#reg-time-time', '10:00');
    await customer.page.locator('[data-register-submit]').click();
    const error = customer.page.locator('#reg-time-error');
    assert.equal(await error.isVisible(), true);
    assert.match(await error.innerText(), /Chủ nhật/);
    await customer.page.fill('#reg-time-date', '2030-10-02');
    assert.equal(await error.isVisible(), false);
  });
  await customer.context.close();

  const overview = await session('CUSTOMER', '/account', 360, { hasTouch: true });
  await login(overview.page); await overview.page.waitForURL(base + '/account');
  await overview.page.waitForLoadState('networkidle');
  await check('quotation alert fits at 360px with a full touch action', async () => {
    assert.equal(await overview.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const action = overview.page.locator('.kh-alert--warning .btn-primary-teal');
    const box = await action.boundingBox();
    assert(box.width >= 44 && box.height >= 44 && box.x + box.width <= 360);
  });
  await overview.page.evaluate(() => window.scrollTo(0, 0));
  await overview.page.screenshot({ path: fileURLToPath(new URL('account-360.png', output)), fullPage: true });
  await overview.context.close();

  const code = 'TN-2026-1002-00001';
  for (const width of [1440, 768, 360]) {
    const s = await session('CUSTOMER', '/account', width, { hasTouch: width < 1024 });
    s.page.setDefaultTimeout(5000);
    const ticket = { code, productName: 'Thiết bị thử', brandName: 'Soopi', status: 'DELIVERED',
      steps: [], customerNotes: [], canRate: true, rating: null, pendingQuotation: null,
      costs: { total: 0, inWarrantyAmount: 0, outOfWarrantyParts: 0, serviceFee: 0, vat: 0, paymentStatus: 'PAID' } };
    await s.context.route(`**/api/v1/portal/tickets/${code}`, route => route.fulfill({ json: ticket }));
    await s.page.goto(base + `/account#phieu/${code}`);
    await s.page.locator('.star-picker-btn').first().waitFor();
    await check(`rating keyboard, selected-chip contrast and layout at ${width}px`, async () => {
      const last = s.page.locator('.star-picker-btn').last();
      await last.focus(); await last.press('Home');
      assert.equal(await s.page.locator('.star-picker-btn').first().getAttribute('aria-checked'), 'true');
      const tag = s.page.locator('.quick-tag-chip').first();
      await tag.click();
      assert.equal(await tag.getAttribute('aria-pressed'), 'true');
      const colors = await tag.evaluate(e => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
      const luminance = rgb => {
        const channels = rgb.match(/\d+/g).slice(0, 3).map(n => { const v = Number(n) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const fg = luminance(colors.fg), bg = luminance(colors.bg);
      assert((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) >= 4.5);
      assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width < 1024) for (const selector of ['.star-picker-btn', '.quick-tag-chip', '.nav-link']) {
        for (const item of await s.page.locator(selector).all()) {
          const box = await item.boundingBox();
          if (box) assert(box.width >= 44 && box.height >= 44, `${selector}: ${JSON.stringify(box)}`);
        }
      }
    });
    await check(`chat preserves visible feedback with reduced motion at ${width}px`, async () => {
      await s.page.emulateMedia({ reducedMotion: 'reduce' });
      await s.page.locator('[data-chat-open]').click();
      const chat = s.page.locator('.chat-window');
      await chat.waitFor();
      assert.equal(await chat.evaluate(e => getComputedStyle(e).animationName), 'kh-state-fade');
      await s.page.keyboard.press('Escape');
    });
    await s.page.evaluate(() => window.scrollTo(0, 0));
    await s.page.screenshot({ path: fileURLToPath(new URL(`rating-${width}.png`, output)), fullPage: true });
    await s.context.close();
  }

  const cashier = await session('CASHIER', '/cashier', 768, { hasTouch: true });
  cashier.page.setDefaultTimeout(5000);
  const handover = { code: 'TN-AUDIT', status: 'COMPLETED', device: { productName: 'Thiết bị thử', brandName: 'Soopi' }, customer: { fullName: 'Khách thử', phone: '0900000000' } };
  await cashier.context.route('**/api/v1/tickets**', route => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith('/billing') ? { paymentStatus: 'PAID', total: 0 }
      : url.pathname.endsWith('/TN-AUDIT') ? handover
        : { items: url.searchParams.get('status') === 'COMPLETED' ? [handover] : [], totalPages: 1 };
    return route.fulfill({ json: data });
  });
  await login(cashier.page); await cashier.page.waitForURL(base + '/cashier');
  await cashier.page.locator('[data-ticket="TN-AUDIT"]').click();
  const canvas = cashier.page.locator('[data-signature]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const x = Math.round(box.x + 20), y = Math.round(box.y + 30);
  const cdp = await cashier.context.newCDPSession(cashier.page);
  await check('cancelled touch stops signing and the next drag works', async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const before = await canvas.evaluate(e => e.toDataURL());
    await cashier.page.mouse.move(x + 80, y + 30);
    assert(await canvas.evaluate(e => e.toDataURL()) === before, 'cancelled pointer drew a stroke');
    await cashier.page.mouse.move(x, y); await cashier.page.mouse.down();
    await cashier.page.mouse.move(x + 50, y + 20); await cashier.page.mouse.up();
    assert(await canvas.evaluate(e => e.toDataURL()) !== before, 'new drag did not draw');
  });
  await check('second touch cannot take over the active signature', async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }, { x: x + 60, y, id: 2 }] });
    const before = await canvas.evaluate(e => e.toDataURL());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }, { x: x + 100, y: y + 40, id: 2 }] });
    assert(await canvas.evaluate(e => e.toDataURL()) === before, 'second pointer changed the signature');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  });
  await check('lost capture and blur end the signature stroke', async () => {
    for (const interruption of ['capture', 'blur']) {
      await cashier.page.mouse.move(x, y);
      await canvas.evaluate(e => e.addEventListener('pointerdown', event => { e.dataset.testPointer = event.pointerId; }, { once: true }));
      await cashier.page.mouse.down();
      await cashier.page.mouse.move(x + 1, y + 1); // Establish actual capture before interrupting it.
      await canvas.evaluate((e, interruption) => {
        if (interruption === 'capture') e.releasePointerCapture(Number(e.dataset.testPointer));
        else window.dispatchEvent(new Event('blur'));
      }, interruption);
      const before = await canvas.evaluate(e => e.toDataURL());
      await cashier.page.mouse.move(x + 60, y + 40); await cashier.page.mouse.up();
      assert(await canvas.evaluate(e => e.toDataURL()) === before, interruption);
    }
  });
  await cashier.context.close();
} finally { await browser.close(); }
if (failures) process.exitCode = 1;
