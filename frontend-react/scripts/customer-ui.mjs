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
      costs: { total: 2916000, inWarrantyAmount: 0, outOfWarrantyParts: 2500000, serviceFee: 200000, vat: 216000, paymentStatus: 'UNPAID',
        paymentQr: { imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240"/%3E', bankId: 'MB',
          accountNo: '0961575900', accountName: null, amount: 2916000, transferNote: 'SOOPI TN2026100200001' } } };
    const writes = [];
    s.page.on('request', request => {
      if (request.url().includes('/api/v1/') && request.method() !== 'GET') writes.push(new URL(request.url()).pathname);
    });
    await s.context.route(`**/api/v1/portal/tickets/${code}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ticket) }));
    // Exercise the real contact/conversation flow; the former local demo chat no longer exists.
    const messages = [];
    let unread = 0;
    const contact = { ticketCode: code, staffAccountId: 'NVTEST', conversationId: 'CHAT-TEST', name: 'Kỹ thuật viên thử',
      role: 'Kỹ thuật viên', productName: 'Galaxy S24', serial: '356000000000001', canSend: true };
    await s.context.route('**/api/v1/chat/**', route => {
      const request = route.request(), url = new URL(request.url());
      let data;
      if (url.pathname.endsWith('/contacts')) data = { items: [{ ...contact, unreadCount: unread }], unreadCount: unread, hasMore: false };
      else if (url.pathname.endsWith('/read')) { unread = 0; data = {}; }
      else if (url.pathname.endsWith('/messages') && request.method() === 'POST') {
        data = { id: String(messages.length + 1), mine: true, text: request.postDataJSON().text, createdAt: new Date().toISOString() };
        messages.push(data);
      } else data = { items: messages.filter(message => BigInt(message.id) > BigInt(url.searchParams.get('after') || '0')), hasMore: false, canSend: true };
      return route.fulfill({ json: data });
    });
    await s.page.goto(`${base}/account#phieu/${code}`);
    const qr = s.page.locator('.payment-qr');
    await qr.waitFor();
    assert.equal(await s.page.locator('.paid-badge-box').count(), 0); checks++;
    assert.match(await qr.innerText(), /SOOPI TN2026100200001/); checks++;
    assert.equal(await s.page.getByText(/mô phỏng|minh họa|DEMO-/i).count(), 0); checks++;
    // Viewing the transfer QR never writes business data; the cashier confirms the payment.
    assert.deepEqual(writes.filter(path => !['/api/v1/auth/refresh', '/api/v1/access/heartbeat'].includes(path)), []); checks++;

    ticket = { ...ticket, costs: { ...ticket.costs, paymentStatus: 'PAID' } };
    await s.page.reload();
    await s.page.locator('.paid-badge-box').waitFor();
    assert.equal(await qr.count(), 0); checks++;
    await s.page.screenshot({ path: fileURLToPath(new URL(`ui-paid-ticket-${width}.png`, output)) });

    const scroll = await s.page.evaluate(() => scrollY);
    await s.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    await s.page.locator('.chat-contact', { hasText: contact.name }).click();
    const input = s.page.getByRole('textbox', { name: 'Nhập tin nhắn', exact: true });
    assert.equal(await s.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).isDisabled(), true); checks++;
    await input.fill('Tin nhắn kiểm thử');
    await input.press('Enter');
    await s.page.locator('.chat-bubble-msg', { hasText: 'Tin nhắn kiểm thử' }).waitFor(); checks++;
    messages.push({ id: String(messages.length + 1), mine: false, text: 'Phản hồi khi thu gọn', createdAt: new Date().toISOString() }); unread = 1;
    await s.page.getByRole('button', { name: 'Thu gọn chat', exact: true }).click();
    await s.page.locator('.chat-mini .chat-fab-badge').waitFor(); checks++;
    await s.page.getByRole('button', { name: 'Mở lại chat với ' + contact.name, exact: true }).click();
    await s.page.locator('.chat-bubble-msg', { hasText: 'Phản hồi khi thu gọn' }).waitFor();
    await s.page.locator('.chat-fab-badge').waitFor({ state: 'hidden' }); checks++;
    await input.fill('Tin nhắn khi đóng cửa sổ');
    await input.press('Enter');
    await s.page.locator('.chat-bubble-msg', { hasText: 'Tin nhắn khi đóng cửa sổ' }).waitFor(); checks++;
    messages.push({ id: String(messages.length + 1), mine: false, text: 'Phản hồi khi đóng', createdAt: new Date().toISOString() }); unread = 1;
    await s.page.getByRole('button', { name: 'Đóng chat', exact: true }).click();
    await s.page.locator('[data-chat-open] .chat-fab-badge').waitFor(); checks++;
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
