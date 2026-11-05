// Isolated browser and mock API: selecting a different ticket must discard stale responses.
import assert from 'node:assert/strict';
import { browser, session } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const tickets = ['A', 'B'].map(code => ({ code: `TN-${code}`, status: 'COMPLETED', receivedAt: '2026-11-04T02:00:00Z',
  customer: { fullName: `Khách ${code}`, phone: '0901234567' }, device: { productName: `Máy ${code}`, brandName: 'Soopi' } }));
const billing = code => ({ ticketCode: `TN-${code}`, total: code === 'A' ? 111000 : 222000,
  freeWarrantyAmount: 0, partsFee: code === 'A' ? 111000 : 222000, serviceFee: 0, vat: 0, discount: 0, paymentStatus: 'UNPAID' });
try {
  const s = await session('CASHIER', '/cashier');
  s.page.setDefaultTimeout(5000);
  await s.context.route('**/api/v1/tickets?**', route => route.fulfill({ json: {
    items: new URL(route.request().url()).searchParams.get('status') === 'COMPLETED' ? tickets : [], totalPages: 1,
  } }));
  let pending;
  let delay = 'billing', fail = false;
  await s.context.route(/\/api\/v1\/tickets\/TN-[AB](\/billing)?$/, async route => {
    const path = new URL(route.request().url()).pathname;
    const code = path.includes('TN-A') ? 'A' : 'B';
    const isBilling = path.endsWith('/billing');
    if (code === 'A' && isBilling === (delay === 'billing')) {
      await new Promise(resolve => { pending = resolve; });
      if (fail) return route.fulfill({ status: 500, json: { detail: 'Lỗi cũ của A' } });
    }
    await route.fulfill({ json: isBilling ? billing(code) : tickets.find(t => t.code === `TN-${code}`) });
  });
  const detail = s.page.locator('[data-handover-detail]');
  for (const scenario of ['billing', 'ticket', 'error']) {
    delay = scenario === 'billing' ? 'billing' : 'ticket'; fail = scenario === 'error'; pending = null;
    await s.page.goto(base + '/cashier');
    await s.page.locator('[data-ticket="TN-A"]').click();
    await assertEventually(() => Boolean(pending));
    await s.page.locator('[data-ticket="TN-B"]').click();
    await detail.getByText('Chi tiết bàn giao — TN-B', { exact: true }).waitFor();
    const aFinished = s.page.waitForResponse(response => response.url().includes(`TN-A${delay === 'billing' ? '/billing' : ''}`));
    pending(); await aFinished;
    // A's handler must finish before checking that its late response did not overwrite B.
    await s.page.waitForLoadState('networkidle');
    assert.match(await detail.innerText(), /TN-B/);
    assert.doesNotMatch(await detail.innerText(), /TN-A|111\.000|Lỗi cũ của A/);
    assert.match(await detail.innerText(), /222\.000/);
    console.log(`PASS cashier ignores stale ${scenario} response`);
  }
  // VietQR do server tạo chỉ hiện khi thu ngân chọn Chuyển khoản.
  const qrUrl = 'https://img.vietqr.io/image/MB-0961575900-compact2.png?amount=222000&addInfo=SOOPI%20TNB';
  await s.context.route('https://img.vietqr.io/**', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#000"/></svg>' }));
  await s.context.route(/\/api\/v1\/tickets\/TN-B\/billing$/, route => route.fulfill({ json: { ...billing('B'),
    paymentQr: { imageUrl: qrUrl, bankId: 'MB', accountNo: '0961575900', accountName: null, amount: 222000, transferNote: 'SOOPI TNB' } } }));
  await s.page.goto(base + '/cashier');
  await s.page.locator('[data-ticket="TN-B"]').click();
  const qr = detail.locator('[data-payment-qr]');
  await qr.waitFor({ state: 'attached' });
  assert.equal(await qr.isVisible(), false);
  await detail.locator('[data-payment-method]').selectOption('BANK_TRANSFER');
  await qr.waitFor();
  assert.equal(await qr.locator('img').getAttribute('src'), qrUrl);
  assert.match(await qr.innerText(), /0961575900[\s\S]*222\.000[\s\S]*SOOPI TNB/);
  if (process.env.QR_SCREENSHOT) await detail.screenshot({ path: process.env.QR_SCREENSHOT });
  console.log('PASS cashier shows VietQR for bank transfer');
  assert.deepEqual(s.errors.filter(message => !message.includes('500')), []);
  await s.context.close();
} finally { await browser.close(); }

async function assertEventually(predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
  assert(predicate(), 'Expected the delayed request to reach the mock API');
}
